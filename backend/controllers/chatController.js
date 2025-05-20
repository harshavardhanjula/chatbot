const Chat = require('../models/Chat');

exports.createChat = async (data) => {
    try {
        // Validate required fields
        if (!data.chatId || !data.userId || !data.socketId) {
            throw new Error('Missing required fields: chatId, userId, and socketId are required');
        }

        // Check if chat already exists
        const existingChat = await Chat.findOne({ chatId: data.chatId });
        if (existingChat) {
            throw new Error('Chat with this ID already exists');
        }

    const chat = new Chat(data);
        const savedChat = await chat.save();
        console.log('✅ Chat created successfully:', savedChat.chatId);
        return savedChat;
    } catch (error) {
        console.error('❌ Error creating chat:', error);
        throw error;
    }
};

exports.addMessage = async (chatId, message) => {
    try {
        if (!chatId || !message || !message.senderId || !message.message) {
            throw new Error('Invalid message data: chatId, senderId, and message are required');
        }

    const chat = await Chat.findOne({ chatId });
        if (!chat) {
            throw new Error('Chat not found');
        }

        // Validate message format
        const newMessage = {
            senderId: message.senderId,
            message: message.message,
            timestamp: message.timestamp || new Date()
        };

        chat.messages.push(newMessage);
        chat.updatedAt = new Date();
        
        const updatedChat = await chat.save();
        console.log('✅ Message added to chat:', chatId);
        return updatedChat;
    } catch (error) {
        console.error('❌ Error adding message to chat:', error);
        throw error;
    }
};

exports.getChat = async (chatId) => {
    try {
        const chat = await Chat.findOne({ chatId });
        if (!chat) {
            throw new Error('Chat not found');
        }
        return chat;
    } catch (error) {
        console.error('❌ Error retrieving chat:', error);
        throw error;
    }
};

exports.updateChatStatus = async (chatId, status) => {
    try {
        if (!['pending', 'active', 'closed'].includes(status)) {
            throw new Error('Invalid chat status');
        }

        const chat = await Chat.findOneAndUpdate(
            { chatId },
            { 
                status,
                updatedAt: new Date()
            },
            { new: true }
        );

        if (!chat) {
    throw new Error('Chat not found');
        }

        console.log('✅ Chat status updated:', chatId, status);
        return chat;
    } catch (error) {
        console.error('❌ Error updating chat status:', error);
        throw error;
    }
}; 