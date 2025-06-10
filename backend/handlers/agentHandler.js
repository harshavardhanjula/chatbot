const Agent = require('../models/Agent');
const Chat = require('../models/Chat');

class AgentHandler {
    constructor(io) {
        this.io = io;
        this.activeAgents = new Map();
    }

    // Handle agent connection
    async handleAgentConnect(socket, agentData) {
        try {
            // Create or update agent in database
            const agent = await Agent.findOneAndUpdate(
                { agentId: socket.id },
                {
                    agentId: socket.id,
                    name: agentData.name,
                    status: 'online',
                    lastActive: new Date()
                },
                { upsert: true, new: true }
            );

            this.activeAgents.set(socket.id, {
                ...agentData,
                type: 'agent',
                socketId: socket.id
            });

            console.log('Agent connected:', agentData);
            
            // Send pending requests to the agent
            const pendingChats = await Chat.find({ status: 'pending' });
            socket.emit('pending_requests', pendingChats);

            return agent;
        } catch (error) {
            console.error('Error in agent connection:', error);
            throw error;
        }
    }

    // Handle agent accepting request
    async handleAcceptRequest(socket, data) {
        const { requestId, agentId } = data;
        
        try {
            // Update chat status
            const chat = await Chat.findOneAndUpdate(
                { chatId: requestId },
                {
                    agentId: agentId,
                    status: 'active',
                    updatedAt: new Date()
                },
                { new: true }
            );

            if (chat) {
                // Update agent status
                await Agent.findOneAndUpdate(
                    { agentId: agentId },
                    {
                        $push: { activeChats: requestId },
                        status: 'busy',
                        lastActive: new Date()
                    }
                );

                // Notify user and agent
                this.io.to(chat.userId).emit('request_accepted', {
                    requestId,
                    agentId,
                    chatId: requestId
                });

                socket.emit('request_accepted', {
                    requestId,
                    chatId: requestId
                });

                return chat;
            }
        } catch (error) {
            console.error('Error accepting request:', error);
            throw error;
        }
    }

    // Handle agent disconnection
    async handleAgentDisconnect(socket) {
        try {
            const agent = this.activeAgents.get(socket.id);
            if (agent) {
                // Update agent status in database
                await Agent.findOneAndUpdate(
                    { agentId: socket.id },
                    {
                        status: 'offline',
                        lastActive: new Date()
                    }
                );

                // Update active chats
                await Chat.updateMany(
                    { agentId: socket.id, status: 'active' },
                    { status: 'closed', updatedAt: new Date() }
                );

                this.activeAgents.delete(socket.id);
                console.log('Agent disconnected:', socket.id);
            }
        } catch (error) {
            console.error('Error in agent disconnection:', error);
            throw error;
        }
    }

    // Get agent statistics
    async getAgentStats(agentId) {
        try {
            const agent = await Agent.findOne({ agentId });
            const activeChats = await Chat.countDocuments({ agentId, status: 'active' });
            const totalChats = await Chat.countDocuments({ agentId });
            
            return {
                agent,
                activeChats,
                totalChats
            };
        } catch (error) {
            console.error('Error getting agent stats:', error);
            throw error;
        }
    }
}

module.exports = AgentHandler; 