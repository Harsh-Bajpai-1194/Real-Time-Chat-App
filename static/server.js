const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const rooms = {}; // Keep track of rooms and messages

app.use(express.static(path.join('public')));

io.on('connection', (socket) => {
    let username = 'Anonymous';

    console.log('A user connected');
    
    // Ask for username when connecting
    socket.on('set username', (name) => {
        username = name || 'Anonymous';
        socket.emit('chat message', `${username} has joined the chat!`);
    });

    // Handle chat messages
    socket.on('chat message', (msg, room) => {
        const message = `${username}: ${msg}`;
        if (room) {
            io.to(room).emit('chat message', message); // Send to room
        } else {
            io.emit('chat message', message); // Broadcast globally
        }
    });

    // Handle joining rooms
    socket.on('join room', (room) => {
        socket.join(room);
        socket.emit('chat message', `You have joined the room: ${room}`);
    });

    // Handle disconnect
    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});

const PORT = process.env.PORT || 7777;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
