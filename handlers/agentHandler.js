class AgentHandler {
    constructor() {
        this.activeAgents = new Map();
    }

    // Handle agent connection
    async handleAgentConnect(socket, agentData) {
        try {
            this.activeAgents.set(socket.id, {
                ...agentData,
                type: 'agent',
                socketId: socket.id
            });

            console.log('Agent connected:', agentData);
            
            // Send pending requests to the agent
            const pendingChats = await Chat.find({ status: 'pending' });
            socket.emit('pending_requests', pendingChats);

            return true;
        } catch (error) {
            console.error('Error in agent connection:', error);
            throw error;
        }
    }

    // Handle agent disconnection
    async handleAgentDisconnect(socket) {
        try {
            const agent = this.activeAgents.get(socket.id);
            if (agent) {
                this.activeAgents.delete(socket.id);
                console.log('Agent disconnected:', agent);
            }
        } catch (error) {
            console.error('Error in agent disconnection:', error);
        }
    }
}

module.exports = new AgentHandler(); 