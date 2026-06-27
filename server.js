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

app.use(cors()); // Add this line to enable CORS for all HTTP routes
app.use(express.json()); 

// --- MongoDB Connection ---
// Make sure you have MongoDB running and replace the URI if needed.
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/realtime-chat';

mongoose.connect(MONGO_URI)
    .then(() => console.log('MongoDB connected successfully.'))
    .catch(err => console.error('MongoDB connection error:', err));

// --- Message Schema and Model ---
const messageSchema = new mongoose.Schema({
    username: String,
    text: String,
    room: String,
    timestamp: { type: Date, default: Date.now }
});

const Message = mongoose.model('Message', messageSchema);

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

    // Handle chat messages
    socket.on('chat message', async (msg, room) => {
        if (!msg.trim() || !room) return;

        // Block the message entirely if it contains profanity
        if (filter.isProfane(msg)) {
            return socket.emit('system message', 'Your message was blocked for containing inappropriate language.');
        }

        const messageData = {
            username: socket.username,
            text: msg,
            room: room
        };

        // 1. Broadcast message to the room IMMEDIATELY for a real-time feel
        io.to(room).emit('chat message', messageData);

        // 2. Save message to database in the background
        try {
            const message = new Message(messageData);
            await message.save();
        } catch (error) {
            console.error('Error saving message to database:', error);
        }
    });

    // Handle joining rooms
    socket.on('join room', async (room) => {
        socket.join(room);
        // Announce that a user has joined the room
        io.to(room).emit('system message', `${socket.username || 'Anonymous'} has joined the room.`);

        // Send recent chat history to the newly joined user
        try {
            const history = await Message.find({ room: room }).sort({ timestamp: -1 }).limit(50);
            socket.emit('chat history', history.reverse());
        } catch (error) {
            console.error('Error fetching chat history:', error);
        }
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
