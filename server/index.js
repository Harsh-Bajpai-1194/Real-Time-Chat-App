const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const path = require('path');

// Load environment variables from the .env file in the project root
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const fs = require('fs');
const Filter = require('bad-words');
const cors = require('cors');
const { OAuth2Client } = require('google-auth-library');

const Room = require('./models/Room');
const Message = require('./models/Message');
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: process.env.CORS_ORIGIN || "*", // Allow specific origin or any for development
        methods: ["GET", "POST"]
    }
});

const filter = new Filter();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'harshbajpai1194@gmail.com';

/**
 * Helper to prevent XSS attacks by escaping HTML special characters.
 * This converts characters like `<` and `>` into their safe HTML entity equivalents.
 */
function escapeHtml(unsafe) {
    return unsafe
         .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

mongoose.set('bufferCommands', false);
mongoose.set('bufferTimeoutMS', 1000);

app.use(cors());
app.use((req, res, next) => {
    // This header is needed to allow the Google Sign-In popup to communicate with the main page.
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
    next();
});

app.use(express.json()); 

// --- MongoDB Connection ---
// Make sure you have MongoDB running and replace the URI if needed.
const MONGO_URI = process.env.MONGO_URI;
let mongoReady = false;
const roomMessages = new Map();
const roomRegistry = new Map();

const defaultRooms = [
    { name: 'Tech Talk', desc: 'Discuss latest tech trends, programming, gadgets.', icon: '💻' },
    { name: 'Gaming Lair', desc: 'Community for gamers, share tips, find teammates.', icon: '🎮' },
    { name: 'Open Discussions', desc: 'General chat for everyone on various topics.', icon: '🗣️' },
    { name: 'Creative Corner', desc: 'Showcase art, design projects, and get feedback.', icon: '🎨' },
    { name: 'Movie Buffs', desc: 'Talking about films, series, and reviews.', icon: '🍿' },
    { name: 'Book Club', desc: 'Share current reads, recommendations, and reviews.', icon: '📚' },
];

// Listen for the 'roomDeleted' event emitted from the Room model's middleware.
// This decouples the database logic from the server's runtime state.
Room.on('roomDeleted', (roomName) => {
    // Also remove from our in-memory caches to keep things consistent
    roomRegistry.delete(roomName);
    roomMessages.delete(roomName);
    console.log(`Removed room "${roomName}" from in-memory stores.`);

    // Notify clients that the room list has changed
    io.emit('rooms updated');
});

const isMongoAvailable = () => mongoReady && mongoose.connection.readyState === 1;

const saveMessageToStore = async (messageData) => {
    if (isMongoAvailable()) {
        try {
            const message = new Message(messageData);
            await message.save();
            return message.toObject(); // Return the saved document
        } catch (error) {
            console.error('Error saving message to database:', error.message);
            return null;
        }
    }

    const room = messageData.room;
    const messages = roomMessages.get(room) || [];
    messages.push({ ...messageData, timestamp: messageData.timestamp || new Date() });
    if (messages.length > 250) {
        messages.splice(0, messages.length - 250);
    }
    roomMessages.set(room, messages);
    // For in-memory, we don't have a real DB ID, so we can fake one for consistency
    return { ...messageData, _id: new mongoose.Types.ObjectId().toString() };
};

const getRoomHistory = async (room) => {
    if (isMongoAvailable()) {
        try {
            const history = await Message.find({ room })
            .sort({ timestamp: -1 }) // Sort by newest first
            .limit(50);
            return history.reverse();
        } catch (error) {
            // Add more detailed logging to pinpoint the issue
            console.error(`Error fetching chat history for room "${room}":`, error);
        }
    }

    return (roomMessages.get(room) || []).slice(-50);
};

const getOlderRoomHistory = async (room, lastMessageId) => {
    if (!lastMessageId) return [];

    if (isMongoAvailable()) {
        try {
            const lastMessage = await Message.findById(lastMessageId);
            if (!lastMessage) return [];

            const olderMessages = await Message.find({
                room,
                timestamp: { $lt: lastMessage.timestamp }
            }).sort({ timestamp: -1 }).limit(50);

            return olderMessages.reverse();
        } catch (error) {
            console.error('Error fetching older messages:', error.message);
            return [];
        }
    }

    const allMessages = roomMessages.get(room) || [];
    const index = allMessages.findIndex((m) => m._id === lastMessageId);
    if (index === -1) return [];
    return allMessages.slice(Math.max(0, index - 50), index);
};

const loadAndSeedRooms = async () => {
    // Clear the registry to ensure we load fresh from the source of truth.
    roomRegistry.clear();

    if (!isMongoAvailable()) {
        console.warn('MongoDB not available. Using only default in-memory rooms.');
        // If no DB, just load defaults into memory.
        for (const room of defaultRooms) {
            roomRegistry.set(room.name, { ...room });
        }
        return;
    }

    try {
        // Ensure all default rooms exist in the DB without overwriting them.
        const upsertPromises = defaultRooms.map(room =>
            Room.findOneAndUpdate(
                { name: room.name },
                { $setOnInsert: { desc: room.desc, icon: room.icon } },
                { upsert: true, new: true }
            )
        );
        await Promise.all(upsertPromises);
        console.log('Default rooms seeded/verified in database.');

        // Now, load ALL rooms from the database. This is the single source of truth.
        const allDbRooms = await Room.find({});
        console.log(`Found ${allDbRooms.length} rooms in the database to load.`);
        for (const dbRoom of allDbRooms) {
            roomRegistry.set(dbRoom.name, dbRoom.toObject());
        }
        console.log(`${roomRegistry.size} rooms loaded into registry from database.`);
    } catch (error) {
        console.error('Error loading or seeding rooms:', error.message);
        console.log('Falling back to default in-memory rooms due to error.');
        // Fallback to in-memory if DB operations fail
        for (const room of defaultRooms) {
            roomRegistry.set(room.name, { ...room });
        }
    }
};

const connectToDatabase = async () => {
    const mongoUri = process.env.MONGO_URI;

    if (!mongoUri) {
        mongoReady = false;
        await loadAndSeedRooms(); // Fall back to in-memory storage.
        console.warn('MONGO_URI not set. The app will use in-memory storage for rooms and chat history for this session.');
        return;
    }

    try {
        await mongoose.connect(mongoUri, {
            serverSelectionTimeoutMS: 10000,
            socketTimeoutMS: 10000,
            family: 4,
        });
        mongoReady = true;
        console.log(`MongoDB connected successfully.`);
        await loadAndSeedRooms();
    } catch (error) {
        mongoReady = false;
        console.warn(`MongoDB connection failed: ${error.message}`);
        await loadAndSeedRooms(); // Fall back to in-memory storage.
        console.warn('MongoDB unavailable; the app will use in-memory storage for rooms and chat history for this session.');
    }
};

mongoose.connection.on('error', (error) => {
    mongoReady = false;
    console.warn(`MongoDB connection error: ${error.message}`);
});

mongoose.connection.on('disconnected', () => {
    mongoReady = false;
    console.warn('MongoDB disconnected; using in-memory fallback for chat history.');
});

const ensureRoomExists = async (roomName) => {
    const trimmed = roomName.trim();
    if (!trimmed) {
        return null;
    }

    if (!roomRegistry.has(trimmed)) {
        const newRoomData = {
            name: trimmed,
            desc: 'A custom chat room.',
            icon: '💬',
        };

        // Add to in-memory registry first for responsiveness
        roomRegistry.set(trimmed, { ...newRoomData });

        // Then save to database if available
        if (isMongoAvailable()) {
            try {
                // Use findOneAndUpdate with upsert to prevent race conditions
                await Room.findOneAndUpdate({ name: trimmed }, { $setOnInsert: newRoomData }, { upsert: true });
            } catch (error) {
                console.error(`Error saving new room "${trimmed}" to database:`, error.message);
            }
        }
    }
    return roomRegistry.get(trimmed);
};

app.get('/api/rooms', async (req, res) => {
    const roomsFromRegistry = Array.from(roomRegistry.values());

    if (!isMongoAvailable()) {
        const rooms = roomsFromRegistry.map(room => {
            const messages = roomMessages.get(room.name) || [];
            const totalMessages = messages.length;
            const memberCount = new Set(messages.map(m => m.username)).size;
            return { ...room, memberCount, totalMessages };
        }).sort((a, b) => a.name.localeCompare(b.name));
        return res.json(rooms);
    }

    try {
        const stats = await Message.aggregate([
            {
                $group: {
                    _id: '$room',
                    totalMessages: { $sum: 1 },
                    uniqueUsers: { $addToSet: '$username' }
                }
            },
            {
                $project: {
                    _id: 0,
                    name: '$_id',
                    totalMessages: 1,
                    memberCount: { $size: '$uniqueUsers' }
                }
            }
        ]);

        const statsMap = new Map(stats.map(stat => [stat.name, stat]));

        const rooms = roomsFromRegistry.map(room => {
            const roomStats = statsMap.get(room.name) || { memberCount: 0, totalMessages: 0 };
            return { ...room, memberCount: roomStats.memberCount, totalMessages: roomStats.totalMessages };
        }).sort((a, b) => a.name.localeCompare(b.name));

        res.json(rooms);
    } catch (error) {
        console.error('Error fetching room stats:', error);
        const rooms = roomsFromRegistry.map(r => ({ ...r, memberCount: 0, totalMessages: 0 })).sort((a, b) => a.name.localeCompare(b.name));
        res.status(500).json(rooms);
    }
});

app.get('/api/rooms/:roomName/participants', (req, res) => {
    const { roomName } = req.params;
    const roomSockets = io.sockets.adapter.rooms.get(roomName);

    if (!roomSockets) {
        // Return an empty array if the room doesn't exist or is empty
        return res.json([]);
    }

    const participants = [];
    for (const socketId of roomSockets) {
        const socket = io.sockets.sockets.get(socketId);
        // Ensure the socket and its username exist before adding
        if (socket && socket.username) {
            participants.push({
                username: socket.username,
                picture: socket.picture || null, // Fallback to null if no picture
            });
        }
    }

    // A user might have multiple tabs open, creating multiple sockets in the same room.
    // We can filter to get a list of unique users based on their username.
    const uniqueParticipants = Array.from(new Map(participants.map(p => [p.username, p])).values());

    res.json(uniqueParticipants);
});

app.get('/api/rooms/:roomName/members', async (req, res) => {
    try {
      const roomName = req.params.roomName;
  
      // This query finds all unique users who have sent a message in the room.
      const members = await Message.aggregate([
        // 1. Find all messages for the specified room
        { $match: { room: roomName } },
        // 2. Group by a unique user identifier (like email) to get unique users
        {
          $group: {
            _id: '$email', // Group by email to ensure each person appears only once
            username: { $first: '$username' },
            picture: { $first: '$picture' },
            email: { $first: '$email' }
          }
        },
        // 3. Reshape the output to be a clean object
        {
          $project: {
            _id: 0,
            username: 1,
            picture: 1,
            email: 1
          }
        },
        // 4. Sort the members alphabetically by username
        { $sort: { username: 1 } }
      ]);
  
      res.json(members);
    } catch (error) {
      console.error('Failed to fetch room members:', error);
      res.status(500).json({ message: 'Error fetching room members' });
    }
  });

// --- Authentication Routes ---
app.post('/api/auth/google', async (req, res) => {
    const { token } = req.body;
    try {
        const ticket = await googleClient.verifyIdToken({
            idToken: token,
            audience: process.env.GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        res.json({ success: true, user: { name: payload.name, email: payload.email, picture: payload.picture } });
    } catch (error) {
        console.error('Google token verification failed:', error);
        res.status(401).json({ success: false, message: 'Invalid Google token' });
    }
});

io.on('connection', (socket) => {
    let username = 'Anonymous';

    console.log('A user connected');
    
    // Ask for username when connecting
    socket.on('set username', (name, room, email, picture) => {
        username = name.trim() || 'Anonymous';
        socket.username = username; // Store username on the socket instance
        if (email) socket.email = email;
        if (picture) socket.picture = picture;
    });
    
    // Typing indicator
        socket.on("typing", (data) => {
        socket.to(data.room).emit("typing", data.username);
    });

    // Handle chat messages
    socket.on('chat message', async (msg, room) => {
        if (!msg.trim() || !room) return;

        // A more robust check for profanity that ignores spaces and special characters.
        const profanityCheckText = msg.replace(/[^a-zA-Z0-9]/g, '');

        // Block the message entirely if it contains profanity
        if (filter.isProfane(profanityCheckText)) {
            return socket.emit('system message', 'Your message was blocked for containing inappropriate language.');
        }

        const messageData = {
            username: socket.username,
            email: socket.email || '',
            picture: socket.picture || '',
            text: escapeHtml(msg), // Sanitize text to prevent XSS attacks
            room: room,
            timestamp: new Date()
        };

        // Save message to the store first to get a persistent ID
        const savedMessage = await saveMessageToStore(messageData);

        // If saving was successful, broadcast the full message data (including ID)
        if (savedMessage) {
            io.to(room).emit('chat message', savedMessage);
        }
    });

    // Handle joining rooms
    socket.on('join room', async (room) => {
        const normalizedRoom = room.trim();

        if (!normalizedRoom) {
            return;
        }
        if (filter.isProfane(normalizedRoom.replace(/[^a-zA-Z0-9]/g, ''))) {
            return socket.emit('system message', 'This room name is not allowed due to inappropriate language.');
        }

        await ensureRoomExists(normalizedRoom);
        socket.join(normalizedRoom);
        // Announce that a user has joined the room
        io.to(normalizedRoom).emit('system message', `${socket.username || 'Anonymous'} has joined the room.`);
        io.emit('rooms updated');

        // Send recent chat history to the newly joined user
        const history = await getRoomHistory(normalizedRoom);
        socket.emit('chat history', history, normalizedRoom);
    });

    socket.on('fetch older messages', async ({ room, lastMessageId }) => {
        if (!room || !lastMessageId) {
            return;
        }

        const normalizedRoom = room.trim();
        if (!normalizedRoom) {
            return;
        }

        const olderMessages = await getOlderRoomHistory(normalizedRoom, lastMessageId);
        socket.emit('older messages', olderMessages, normalizedRoom);
    });

    // Handle leaving rooms
    socket.on('leave room', (room) => {
        socket.leave(room);
        io.to(room).emit('system message', `${socket.username || 'Anonymous'} has left the room.`);
    });

    socket.on('delete message', async (messageId, room) => {
        if (socket.email !== ADMIN_EMAIL) {
            return socket.emit('system message', 'You are not authorized to delete messages.');
        }

        try {
            const result = await Message.findByIdAndDelete(messageId);
            if (result) {
                io.to(room).emit('message deleted', messageId);
            }
        } catch (error) {
            console.error('Error deleting message:', error);
            socket.emit('system message', 'Error deleting message.');
        }
    });
    // Handle disconnect
    socket.on('disconnect', () => {
        console.log('User disconnected');
        // You could add logic here to announce that a user has left.
    });
});

// Serve the built frontend when it exists; otherwise provide a helpful local-dev fallback.
const buildPath = path.join(__dirname, 'client', 'build');
const buildIndexPath = path.join(buildPath, 'index.html');

if (fs.existsSync(buildIndexPath)) {
    app.use(express.static(buildPath));
    app.get('*', (req, res) => {
        res.sendFile(buildIndexPath);
    });
} else {
    app.get('*', (req, res) => {
        res.status(200).send(`
            <!doctype html>
            <html>
            <head><meta charset="utf-8"><title>Real-Time Chat App</title></head>
            <body style="font-family: Arial, sans-serif; padding: 2rem;">
                <h1>Real-Time Chat App</h1>
                <p>The backend is running successfully.</p>
                <p>Start the React frontend with:</p>
                <pre>cd client && npm start</pre>
                <p>Then open <a href="http://localhost:3000">http://localhost:3000</a>.</p>
            </body>
            </html>
        `);
    });
}

/**
 * Starts the server after ensuring the database is connected and initial data is loaded.
 * This prevents a race condition where the server might start accepting requests
 * before it's fully initialized.
 */
const startServer = async () => {
    await connectToDatabase(); // This function connects and then seeds/loads rooms.
    const PORT = process.env.PORT || 7777;
    server.listen(PORT, () => {
        console.log(`Server is ready and running on port ${PORT}`);
    });
};

startServer();
