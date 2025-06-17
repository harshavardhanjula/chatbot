const mongoose = require('mongoose');

const agentSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    username: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    role: {
        type: String,
        default: 'agent'
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    agentId: { 
        type: String,
        unique: true,
        sparse: true
    },
});

// Pre-save hook to generate agentId
agentSchema.pre('save', function(next) {
    if (!this.agentId) {
        // Generate a random 6-character alphanumeric ID
        const randomId = Math.random().toString(36).substring(2, 8).toUpperCase();
        this.agentId = `AGENT-${randomId}`;
    }
    next();
});

module.exports = mongoose.model('Agent', agentSchema); 