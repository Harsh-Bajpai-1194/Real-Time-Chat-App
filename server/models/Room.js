const mongoose = require('mongoose');
const Message = require('./Message');

const roomSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    desc: String,
    icon: String,
});

// When a room is deleted from the database (e.g., via findOneAndDelete),
// this middleware will trigger to also remove all associated messages.
roomSchema.post('findOneAndDelete', async function (doc) {
    if (doc) {
        const roomName = doc.name;
        console.log(`Triggering cleanup for deleted room: "${roomName}"`);

        // 1. Delete associated messages from the database
        try {
            await Message.deleteMany({ room: roomName });
            console.log(`Deleted messages for room: "${roomName}"`);
        } catch (error) {
            console.error(`Error deleting messages for room "${roomName}":`, error);
        }

        // 2. Emit an event for the main server to handle in-memory/socket updates
        this.model.emit('roomDeleted', roomName);
    }
});

const Room = mongoose.model('Room', roomSchema);

module.exports = Room;