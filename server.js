const express = require('express');
require('dotenv').config(); // Load environment variables from .env file
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const path = require('path');
const Filter = require('bad-words');
const { OAuth2Client } = require('google-auth-library');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*", // Allow any origin to connect, useful for GitHub Codespaces
        methods: ["GET", "POST"]
    }
});

const filter = new Filter();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

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

// In a MERN stack, the Express server's primary role is to be an API.
// We will serve the React frontend from its own development server.
// The line below is no longer needed for development.
// app.use(express.static(path.join(__dirname, 'templates')));

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
            username: socket.username || 'Anonymous',
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

    // Handle disconnect
    socket.on('disconnect', () => {
        console.log('User disconnected');
        // You could add logic here to announce that a user has left.
    });
});

// Serve static files from the React frontend app
app.use(express.static(path.join(__dirname, 'client/build')));
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
});

const PORT = process.env.PORT || 7777;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
