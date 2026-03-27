const express = require('express');
require('dotenv').config(); // Load environment variables from .env file
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "http://localhost:3000", // Allow React dev server to connect
        methods: ["GET", "POST"]
    }
});

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

        const messageData = {
            username: socket.username || 'Anonymous',
            text: msg,
            room: room
        };

        // 1. Save message to database
        try {
            const message = new Message(messageData);
            await message.save();
            // 2. Broadcast message to the room
            io.to(room).emit('chat message', messageData);
        } catch (error) {
            console.error('Error saving or broadcasting message:', error);
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

const PORT = process.env.PORT || 7777;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
