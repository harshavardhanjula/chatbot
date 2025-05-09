import React, { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import './AgentPortal.css';

interface Message {
  id: string;
  sender: 'agent' | 'user';
  content: string;
  timestamp: string;
}

interface Request {
  id: string;
  name: string;
  email: string;
  query: string;
  status: string;
  createdAt?: string;
}

interface LiveChatProps {
  request: Request;
}

export default function LiveChat({ request }: LiveChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [socket, setSocket] = useState<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Connect to Socket.IO server
    const newSocket = io('http://localhost:5000');
    setSocket(newSocket);

    // Join the chat room for this request
    newSocket.emit('join_chat', { requestId: request.id });

    // Listen for incoming messages
    newSocket.on('chat_message', (msg: Message) => {
      setMessages(prev => [...prev, msg]);
    });

    // Optionally, fetch chat history from backend (if available)
    // newSocket.emit('fetch_history', { requestId: request.id });
    // newSocket.on('chat_history', (history: Message[]) => setMessages(history));

    return () => {
      newSocket.disconnect();
    };
  }, [request.id]);

  useEffect(() => {
    // Scroll to bottom when messages change
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (socket && newMessage.trim()) {
      const msg: Message = {
        id: Date.now().toString(),
        sender: 'agent',
        content: newMessage,
        timestamp: new Date().toISOString(),
      };
      socket.emit('chat_message', { ...msg, requestId: request.id });
      setMessages(prev => [...prev, msg]);
      setNewMessage('');
    }
  };

  return (
    <div className="live-chat-container">
      <div className="chat-header">
        <h3>Chat with {request.name}</h3>
        <div className="chat-user-email">{request.email}</div>
      </div>
      <div className="chat-history">
        {messages.map((msg, idx) => (
          <div key={idx} className={`message ${msg.sender}`}>
            <div className="message-content">{msg.content}</div>
            <div className="message-time">{new Date(msg.timestamp).toLocaleTimeString()}</div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <div className="chat-input-row">
        <input
          type="text"
          value={newMessage}
          onChange={e => setNewMessage(e.target.value)}
          placeholder="Type your message..."
          onKeyDown={e => e.key === 'Enter' && handleSend()}
        />
        <button onClick={handleSend} disabled={!newMessage.trim()}>
          Send
        </button>
      </div>
    </div>
  );
} 