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

for (const room of defaultRooms) {
    roomRegistry.set(room.name, { ...room, members: 0, online: 0 });
}

const messageSchema = new mongoose.Schema({
    username: String,
    text: String,
    room: String,
    timestamp: { type: Date, default: Date.now }
});

const Message = mongoose.model('Message', messageSchema);

const isMongoAvailable = () => mongoReady && mongoose.connection.readyState === 1;

const saveMessageToStore = async (messageData) => {
    if (isMongoAvailable()) {
        try {
            const message = new Message(messageData);
            await message.save();
        } catch (error) {
            console.error('Error saving message to database:', error.message);
        }
        return;
    }

    const room = messageData.room;
    const messages = roomMessages.get(room) || [];
    messages.push({ ...messageData, timestamp: messageData.timestamp || new Date() });
    if (messages.length > 250) {
        messages.splice(0, messages.length - 250);
    }
    roomMessages.set(room, messages);
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
            return;
        } catch (error) {
            console.warn(`MongoDB connection failed for ${uri}: ${error.message}`);
        }
    }

    mongoReady = false;
    console.warn('MongoDB unavailable; the app will use in-memory chat history for this session.');
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

const ensureRoomExists = (roomName) => {
    const trimmed = roomName.trim();
    if (!trimmed) {
        return null;
    }

    if (!roomRegistry.has(trimmed)) {
        roomRegistry.set(trimmed, {
            name: trimmed,
            desc: 'A custom chat room.',
            icon: '💬',
            members: 0,
            online: 0,
        });
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
    socket.on('set username', (name, room) => {
        username = name.trim() || 'Anonymous';
        socket.username = username; // Store username on the socket instance
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
            room: room
        };

        // 1. Broadcast message to the room IMMEDIATELY for a real-time feel
        io.to(room).emit('chat message', messageData);

        // 2. Save message to the active store (MongoDB or in-memory fallback)
        await saveMessageToStore(messageData);
    });

    // Handle joining rooms
    socket.on('join room', async (room) => {
        const normalizedRoom = room.trim();
        ensureRoomExists(normalizedRoom);
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
