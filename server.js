const express = require('express');
require('dotenv').config(); // Load environment variables from .env file
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const Filter = require('bad-words');
const cors = require('cors');
const { OAuth2Client } = require('google-auth-library');

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
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/realtime-chat';
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

const messageSchema = new mongoose.Schema({
    username: String,
    text: String,
    room: String,
    timestamp: { type: Date, default: Date.now }
});
const Message = mongoose.model('Message', messageSchema);

const roomSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    desc: String,
    icon: String,
});
const Room = mongoose.model('Room', roomSchema);

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
            const history = await Message.find({ room }).sort({ timestamp: -1 }).limit(50);
            return history.reverse();
        } catch (error) {
            console.error('Error fetching chat history:', error.message);
        }
    }

    return (roomMessages.get(room) || []).slice(-50);
};

const loadAndSeedRooms = async () => {
    // Always start with the default rooms in memory to ensure they exist.
    for (const room of defaultRooms) {
        roomRegistry.set(room.name, { ...room, members: 0, online: 0 });
    }

    if (!isMongoAvailable()) {
        console.warn('MongoDB not available. Using only default in-memory rooms.');
        return;
    }

    try {
        const roomsInDb = await Room.find({});
        if (roomsInDb.length === 0) {
            console.log('No rooms found in database. Seeding with default rooms...');
            // Filter out fields that are not in the schema before inserting
            const roomsToSeed = defaultRooms.map(({ name, desc, icon }) => ({ name, desc, icon }));
            await Room.insertMany(roomsToSeed);
        } else {
            console.log('Loading custom rooms from database...');
            for (const dbRoom of roomsInDb) {
                // Add to registry if it's not a default room already added
                if (!roomRegistry.has(dbRoom.name)) {
                    roomRegistry.set(dbRoom.name, {
                        ...dbRoom.toObject(),
                        members: 0, // transient state
                        online: 0,  // transient state
                    });
                }
            }
        }
        console.log(`${roomRegistry.size} rooms loaded into registry.`);
    } catch (error) {
        console.error('Error loading or seeding rooms:', error.message);
    }
};

const connectToDatabase = async () => {
    const candidateUris = [];
    if (process.env.MONGO_URI) {
        candidateUris.push(process.env.MONGO_URI);
    }
    candidateUris.push('mongodb://127.0.0.1:27017/realtime-chat');

    for (const uri of candidateUris) {
        try {
            await mongoose.connect(uri, {
                serverSelectionTimeoutMS: 4000,
                socketTimeoutMS: 4000,
                family: 4,
            });
            mongoReady = true;
            console.log(`MongoDB connected successfully using ${uri}`);
            await loadAndSeedRooms();
            return;
        } catch (error) {
            console.warn(`MongoDB connection failed for ${uri}: ${error.message}`);
        }
    }

    mongoReady = false;
    await loadAndSeedRooms(); // Still load default rooms if DB fails
    console.warn('MongoDB unavailable; the app will use in-memory storage for rooms and chat history for this session.');
};

mongoose.connection.on('error', (error) => {
    mongoReady = false;
    console.warn(`MongoDB connection error: ${error.message}`);
});

mongoose.connection.on('disconnected', () => {
    mongoReady = false;
    console.warn('MongoDB disconnected; using in-memory fallback for chat history.');
});

connectToDatabase();

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
        roomRegistry.set(trimmed, {
            ...newRoomData,
            members: 0,
            online: 0,
        });

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

app.get('/api/rooms', (req, res) => {
    const rooms = Array.from(roomRegistry.values()).sort((a, b) => a.name.localeCompare(b.name));
    res.json(rooms);
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
    socket.on('set username', (name, room, email) => {
        username = name.trim() || 'Anonymous';
        socket.username = username; // Store username on the socket instance
        if (email) socket.email = email;
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

const PORT = process.env.PORT || 7777;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
