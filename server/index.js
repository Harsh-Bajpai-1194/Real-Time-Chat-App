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
const MONGO_URI = process.env.MONGO_URI;
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
Room.on('roomDeleted', (roomName) => {
    roomRegistry.delete(roomName);
    roomMessages.delete(roomName);
    console.log(`Removed room "${roomName}" from in-memory stores.`);
    io.emit('rooms updated');
});

const isMongoAvailable = () => mongoose.connection.readyState === 1;

let isConnecting = false;
let reconnectTimer = null;

const scheduleReconnect = () => {
    if (reconnectTimer || mongoose.connection.readyState === 1) return;
    reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        if (mongoose.connection.readyState !== 1 && process.env.MONGO_URI) {
            console.log('Retrying MongoDB connection...');
            connectToDatabase();
        }
    }, 5000);
};

const loadAndSeedRooms = async () => {
    roomRegistry.clear();

    if (!isMongoAvailable()) {
        console.warn('MongoDB not available. Using in-memory rooms.');
        for (const room of defaultRooms) {
            roomRegistry.set(room.name, { ...room });
        }
        return;
    }

    try {
        const upsertPromises = defaultRooms.map(room =>
            Room.findOneAndUpdate(
                { name: room.name },
                { $setOnInsert: { desc: room.desc, icon: room.icon } },
                { upsert: true, new: true }
            )
        );
        await Promise.all(upsertPromises);

        const allDbRooms = await Room.find({});
        for (const dbRoom of allDbRooms) {
            roomRegistry.set(dbRoom.name, dbRoom.toObject());
        }
        console.log(`${roomRegistry.size} rooms loaded into registry from MongoDB.`);
    } catch (error) {
        console.error('Error loading or seeding rooms:', error.message);
        for (const room of defaultRooms) {
            roomRegistry.set(room.name, { ...room });
        }
    }
};

const connectToDatabase = async () => {
    const mongoUri = process.env.MONGO_URI;

    if (!mongoUri) {
        console.warn('MONGO_URI not set. The app will use in-memory storage for rooms and chat history.');
        await loadAndSeedRooms();
        return;
    }

    if (mongoose.connection.readyState === 1 || isConnecting) {
        return;
    }

    isConnecting = true;
    try {
        await mongoose.connect(mongoUri, {
            serverSelectionTimeoutMS: 15000,
            socketTimeoutMS: 45000,
        });
        isConnecting = false;
        console.log('MongoDB connected successfully.');
        await loadAndSeedRooms();
    } catch (error) {
        isConnecting = false;
        console.warn(`MongoDB connection failed: ${error.message}`);
        await loadAndSeedRooms();
        scheduleReconnect();
    }
};

mongoose.connection.on('connected', () => {
    console.log('MongoDB connection established.');
    loadAndSeedRooms();
});

mongoose.connection.on('error', (error) => {
    console.warn(`MongoDB connection error: ${error.message}`);
});

mongoose.connection.on('disconnected', () => {
    console.warn('MongoDB disconnected; scheduling reconnect.');
    scheduleReconnect();
});

const saveMessageToStore = async (messageData) => {
    const room = messageData.room;
    const messages = roomMessages.get(room) || [];
    messages.push({ ...messageData, timestamp: messageData.timestamp || new Date() });
    if (messages.length > 250) {
        messages.splice(0, messages.length - 250);
    }
    roomMessages.set(room, messages);

    if (isMongoAvailable()) {
        try {
            const message = new Message(messageData);
            await message.save();
            return message.toObject();
        } catch (error) {
            console.error('Error saving message to database:', error.message);
        }
    }

    return { ...messageData, _id: new mongoose.Types.ObjectId().toString() };
};

const getRoomHistory = async (room) => {
    if (isMongoAvailable()) {
        try {
            const history = await Message.find({
                room: { $regex: new RegExp(`^${room.trim()}$`, 'i') }
            })
            .sort({ timestamp: -1 })
            .limit(50);
            return history.reverse();
        } catch (error) {
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
                room: { $regex: new RegExp(`^${room.trim()}$`, 'i') },
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
    if (!isMongoAvailable() && process.env.MONGO_URI) {
        connectToDatabase();
    }

    const roomsFromRegistry = Array.from(roomRegistry.values());

    if (!isMongoAvailable()) {
        const rooms = roomsFromRegistry.map(room => {
            const messages = roomMessages.get(room.name) || [];
            const totalMessages = messages.length;
            const memberCount = new Set(messages.map(m => m.username).filter(Boolean)).size;
            return { ...room, memberCount, totalMessages };
        }).sort((a, b) => (b.totalMessages || 0) - (a.totalMessages || 0));
        return res.json(rooms);
    }

    try {
        const stats = await Message.aggregate([
            {
                $group: {
                    _id: '$room',
                    totalMessages: { $sum: 1 },
                    uniqueUsers: { $addToSet: { $ifNull: ['$username', 'Anonymous'] } }
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

        const statsMap = new Map();
        for (const stat of stats) {
            if (stat.name) {
                const roomNameStr = String(stat.name).trim();
                statsMap.set(roomNameStr.toLowerCase(), {
                    ...stat,
                    name: roomNameStr
                });

                if (!roomRegistry.has(roomNameStr)) {
                    roomRegistry.set(roomNameStr, {
                        name: roomNameStr,
                        desc: 'A chat room.',
                        icon: '💬'
                    });
                }
            }
        }

        const updatedRoomsFromRegistry = Array.from(roomRegistry.values());

        const rooms = updatedRoomsFromRegistry.map(room => {
            const key = room.name ? String(room.name).trim().toLowerCase() : '';
            const roomStats = statsMap.get(key) || { memberCount: 0, totalMessages: 0 };
            return {
                ...room,
                memberCount: roomStats.memberCount,
                totalMessages: roomStats.totalMessages
            };
        }).sort((a, b) => b.totalMessages - a.totalMessages);

        res.json(rooms);
    } catch (error) {
        console.error('Error fetching room stats from MongoDB:', error);
        const rooms = roomsFromRegistry.map(room => {
            const messages = roomMessages.get(room.name) || [];
            return {
                ...room,
                memberCount: new Set(messages.map(m => m.username).filter(Boolean)).size,
                totalMessages: messages.length
            };
        }).sort((a, b) => (b.totalMessages || 0) - (a.totalMessages || 0));
        res.json(rooms);
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
      const roomName = req.params.roomName.trim();
  
      if (!isMongoAvailable()) {
          const messages = roomMessages.get(roomName) || [];
          const uniqueMembersMap = new Map();
          for (const m of messages) {
              if (m.username) {
                  const key = m.email || m.username;
                  if (!uniqueMembersMap.has(key)) {
                      uniqueMembersMap.set(key, {
                          username: m.username,
                          picture: m.picture || null,
                          email: m.email || ''
                      });
                  }
              }
          }
          return res.json(Array.from(uniqueMembersMap.values()));
      }

      const members = await Message.aggregate([
        { $match: { room: { $regex: new RegExp(`^${roomName}$`, 'i') } } },
        {
          $group: {
            _id: { $ifNull: ['$email', '$username'] },
            username: { $first: '$username' },
            picture: { $first: '$picture' },
            email: { $first: '$email' }
          }
        },
        {
          $project: {
            _id: 0,
            username: 1,
            picture: 1,
            email: 1
          }
        },
        { $sort: { username: 1 } }
      ]);
  
      res.json(members);
    } catch (error) {
      console.error('Failed to fetch room members:', error);
      const messages = roomMessages.get(req.params.roomName.trim()) || [];
      const uniqueMembersMap = new Map();
      for (const m of messages) {
          if (m.username) {
              const key = m.email || m.username;
              if (!uniqueMembersMap.has(key)) {
                  uniqueMembersMap.set(key, {
                      username: m.username,
                      picture: m.picture || null,
                      email: m.email || ''
                  });
              }
          }
      }
      res.json(Array.from(uniqueMembersMap.values()));
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

        if (isMongoAvailable()) {
            try {
                const result = await Message.findByIdAndDelete(messageId);
                if (result) {
                    io.to(room).emit('message deleted', messageId);
                }
            } catch (error) {
                console.error('Error deleting message:', error);
                socket.emit('system message', 'Error deleting message.');
            }
        } else {
            const messages = roomMessages.get(room) || [];
            const updated = messages.filter(m => m._id !== messageId);
            roomMessages.set(room, updated);
            io.to(room).emit('message deleted', messageId);
        }
    });
    // Handle disconnect
    socket.on('disconnect', () => {
        console.log('User disconnected');
        // You could add logic here to announce that a user has left.
    });
});

// Serve the built frontend when it exists; otherwise provide a helpful local-dev fallback.
const buildPath = path.join(__dirname, '..', 'client', 'build');
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
    const PORT = process.env.PORT || 3000;
    server.listen(PORT, '0.0.0.0', () => {
        console.log(`Server is ready and running on port ${PORT}`);
    });
};

startServer();
