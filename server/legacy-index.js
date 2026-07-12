import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import Message from './models/Message.js';

// --- Basic Setup ---
dotenv.config();
const app = express();
const httpServer = createServer(app);

// Your client runs on localhost:3000, so we allow it to connect.
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 7777;

// --- Middleware ---
app.use(cors());
app.use(express.json()); // Parses incoming JSON requests

// --- API Routes ---
app.get('/', (req, res) => {
  res.send('Hello from the Real-Time-Chat-App Server!');
});

// --- Socket.IO Connection Handling ---
io.on('connection', (socket) => {
  console.log(`User Connected: ${socket.id}`);

  socket.on('send_message', async (data) => {
    // Save message to MongoDB
    try {
      const newMessage = new Message(data);
      await newMessage.save();
      // Broadcast message to others in the same room
      socket.to(data.room).emit('receive_message', data);
    } catch (error) {
      console.error('Failed to save or broadcast message:', error);
    }
  });

  socket.on('disconnect', () => {
    console.log('User Disconnected', socket.id);
  });
});

// --- MongoDB Connection (The "M") ---
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/realtimechatapp';

mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('Successfully connected to MongoDB.');
    // --- Start the Server (Express + Socket.IO) ---
    httpServer.listen(PORT, () => {
      console.log(`Server is running on port: ${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Error connecting to MongoDB:', error.message);
  });