const mongoose = require('mongoose');

const ResolvedRequestSchema = new mongoose.Schema({
    originalId: String,
    type: String,
    userId: String,
    socketId: String,
    name: String,
    email: String,
    mobile: String,
    query: String,
    agentId: String,
    timestamp: Date,
    updatedAt: Date,
    status: String,
    resolutionNote: String
});

module.exports = mongoose.model('ResolvedRequest', ResolvedRequestSchema); 