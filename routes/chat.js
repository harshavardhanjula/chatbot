const express = require('express');
const router = express.Router();
const Chat = require('../models/Chat');
const Request = require('../models/Request');
const auth = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');

let ioInstance = null;
let agentSockets = null;
function setIo(io, sockets) { ioInstance = io; agentSockets = sockets; }

// Get all pending requests
router.get('/requests', auth, async (req, res) => {
    try {
        const requests = await Request.find({ status: 'pending' })
            .sort({ timestamp: -1 });
        res.json(requests);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Get agent's active chats
router.get('/active', auth, async (req, res) => {
    try {
        const chats = await Chat.find({ 
            agentId: req.agent._id,
            status: 'active'
        }).sort({ updatedAt: -1 });
        res.json(chats);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Get chat history
router.get('/:chatId', auth, async (req, res) => {
    try {
        const chat = await Chat.findOne({ chatId: req.params.chatId });
        if (!chat) {
            return res.status(404).json({ error: 'Chat not found' });
        }
        res.json(chat);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Create new request
router.post('/request', validateRequest, async (req, res) => {
    try {
        const { name, email, mobile, query } = req.body;
        const requestId = Date.now().toString();

        // Create request
        const request = new Request({
            userId: req.body.userId,
            name,
            email,
            mobile,
            query,
            timestamp: new Date()
        });
        await request.save();

        // Create chat
        const chat = new Chat({
            chatId: requestId,
            userId: req.body.userId,
            status: 'pending',
            messages: [{
                senderId: req.body.userId,
                message: query,
                timestamp: new Date()
            }]
        });
        await chat.save();

        console.log(`Chat created with chatId: ${chat.chatId}`);

        // Emit new_request to all agents
        if (ioInstance) {
            ioInstance.emit('new_request', request);
        }

        res.status(201).json({ request, chat });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Accept request
router.post('/accept/:requestId', auth, async (req, res) => {
    try {
        const request = await Request.findById(req.params.requestId);
        if (!request) {
            return res.status(404).json({ error: 'Request not found' });
        }

        if (request.status !== 'pending') {
            return res.status(400).json({ error: 'Request already accepted' });
        }

        // Update request
        request.status = 'accepted';
        request.agentId = req.agent._id;
        await request.save();

        // Update chat
        const chat = await Chat.findOne({ chatId: req.params.requestId });
        if (chat) {
            chat.status = 'active';
            chat.agentId = req.agent._id;
            chat.updatedAt = new Date();
            await chat.save();
            console.log(`Agent ${req.agent._id} joined chat with chatId: ${chat.chatId}`);
        }

        // Emit request_accepted to the agent's socket (HTTP flow)
        if (ioInstance && agentSockets) {
            // Try to get agentSocketId from body, headers, or by agent DB ID
            const agentSocketId = req.body.agentSocketId || req.headers['x-socket-id'] || agentSockets[req.agent._id?.toString()];
            if (agentSocketId) {
                ioInstance.to(agentSocketId).emit('request_accepted', {
                    chatId: req.params.requestId,
                    agentId: req.agent._id
                });
                console.log('Emitted request_accepted to agent socket:', agentSocketId);
            }
        }

        res.json({ request, chat });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Close chat
router.post('/close/:chatId', auth, async (req, res) => {
    try {
        const chat = await Chat.findOne({ chatId: req.params.chatId });
        if (!chat) {
            return res.status(404).json({ error: 'Chat not found' });
        }

        if (chat.agentId.toString() !== req.agent._id.toString()) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        chat.status = 'closed';
        chat.updatedAt = new Date();
        await chat.save();

        // Update request status
        const request = await Request.findOne({ userId: chat.userId });
        if (request) {
            request.status = 'closed';
            await request.save();
        }

        res.json({ chat, request });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
module.exports.setIo = setIo; 