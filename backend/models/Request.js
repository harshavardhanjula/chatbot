const mongoose = require('mongoose');

const RequestSchema = new mongoose.Schema({
    type: {
        type: String,
        default: 'chat'
    },
    userId: {
        type: String,
        required: true
    },
    socketId: {
        type: String,
        required: true
    },
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true
    },
    mobile: {
        type: String,
        required: true
    },
    query: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'accepted', 'closed'],
        default: 'pending'
    },
    agentId: {
        type: String
    },
    timestamp: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Update the updatedAt timestamp before saving
RequestSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    next();
});

module.exports = mongoose.model('Request', RequestSchema); 