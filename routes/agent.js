const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Agent = require('../models/Agent');
const auth = require('../middleware/auth');
const { validateAgent } = require('../middleware/validation');

// Register new agent
router.post('/register', validateAgent, async (req, res) => {
    try {
        const { name, email, password } = req.body;
        
        // Check if agent already exists
        const existingAgent = await Agent.findOne({ email });
        if (existingAgent) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        // Create new agent
        const agent = new Agent({ name, email, password });
        await agent.save();

        // Generate token
        const token = jwt.sign({ id: agent._id }, process.env.JWT_SECRET, {
            expiresIn: '24h'
        });

        res.status(201).json({ agent, token });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Login agent
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // Find agent
        const agent = await Agent.findOne({ email });
        if (!agent) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Check password
        const isMatch = await agent.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Update status
        agent.status = 'online';
        agent.lastActive = new Date();
        await agent.save();

        // Generate token
        const token = jwt.sign({ id: agent._id }, process.env.JWT_SECRET, {
            expiresIn: '24h'
        });

        res.json({ agent, token });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Get agent profile
router.get('/profile', auth, async (req, res) => {
    try {
        res.json(req.agent);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Update agent status
router.patch('/status', auth, async (req, res) => {
    try {
        const { status } = req.body;
        if (!['online', 'busy', 'offline'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        req.agent.status = status;
        req.agent.lastActive = new Date();
        await req.agent.save();

        res.json(req.agent);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Logout agent
router.post('/logout', auth, async (req, res) => {
    try {
        req.agent.status = 'offline';
        req.agent.lastActive = new Date();
        await req.agent.save();

        res.json({ message: 'Logged out successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router; 