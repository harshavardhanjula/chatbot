const jwt = require('jsonwebtoken');
const Agent = require('../models/Agent');

const auth = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const agent = await Agent.findOne({ _id: decoded._id });

        if (!agent) {
            return res.status(401).json({ error: 'Agent not found' });
        }

        if (agent.status === 'offline') {
            return res.status(401).json({ error: 'Agent is offline' });
        }

        req.token = token;
        req.agent = agent;
        next();
    } catch (error) {
        res.status(401).json({ error: 'Please authenticate' });
    }
};

module.exports = auth; 