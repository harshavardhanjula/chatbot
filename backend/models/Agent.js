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
    agentId: { type: String },
});

module.exports = mongoose.model('Agent', agentSchema); 