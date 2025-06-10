const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    senderId: String,
    message: String,
    timestamp: { type: Date, default: Date.now }
});

const chatSchema = new mongoose.Schema({
    chatId: { type: String, required: true, unique: true },
    userId: { type: String, required: true },
    socketId: { type: String, required: true },
    agentId: { type: String },
    messages: [messageSchema],
    status: { type: String, enum: ['pending', 'active', 'closed'], default: 'pending' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Chat', chatSchema); 