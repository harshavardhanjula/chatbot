import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { io, Socket } from 'socket.io-client';
import './AgentPortal.css';

interface Request {
  id: string;
  name: string;
  email: string;
  query: string;
  status: string;
  createdAt?: string;
}

interface Message {
  id: string;
  sender: 'agent' | 'user';
  content: string;
  timestamp: string;
}

interface RequestListProps {
  onJoinChat: (request: Request) => void;
}

export default function RequestList({ onJoinChat }: RequestListProps) {
  const [requests, setRequests] = useState<Request[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [socket, setSocket] = useState<Socket | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    // Connect to Socket.IO server
    const newSocket = io('http://localhost:5000');
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Agent Socket.IO connected:', newSocket.id);
    });

    newSocket.on('disconnect', () => {
      console.log('Agent Socket.IO disconnected');
    });

    // Listen for new_request events
    newSocket.on('new_request', (request: Request) => {
      setRequests(prev => [...prev, request]);
    });

    return () => {
      newSocket.close();
    };
  }, []);

  useEffect(() => {
    const fetchRequests = async () => {
      try {
        const response = await axios.get('/api/requests');
        setRequests(response.data);
      } catch (err) {
        setError('Failed to fetch requests');
      } finally {
        setLoading(false);
      }
    };
    fetchRequests();
  }, []);

  const handleJoinChat = (request: Request) => {
    console.log('About to make PUT request for:', request.id);
    // Make the PUT request to update status
    fetch('http://localhost:5000/api/requests/' + request.id + '/status', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'active' })
    })
    .then(res => res.json())
    .then(response => {
      console.log('Join chat API response:', response);
    if (socket) {
      socket.emit('join_chat', { requestId: request.id });
        console.log('Emitted join_chat for:', request.id);
    }
    onJoinChat(request);
    })
    .catch(error => {
      console.error('Error joining chat via API:', error);
    });
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div style={{ color: 'red' }}>{error}</div>;

  return (
    <div>
      <h2>Pending Requests</h2>
      {requests.length === 0 && <div>No requests found.</div>}
      <div>
        {requests.map((req) => (
          <div className="request-card" key={req.id}>
            <div className="request-header">
              <div>
                <strong>{req.name}</strong>
                <div className="request-email">Email: {req.email}</div>
                <div className="request-issue">Query: {req.query}</div>
                <div className="request-time">
                  Requested: {req.createdAt ? new Date(req.createdAt).toLocaleString() : "Unknown time"}
                </div>
              </div>
              <span className={`badge badge-${req.status.toLowerCase()}`}>{req.status}</span>
            </div>
            <button className="join-chat-btn" onClick={() => handleJoinChat(req)}>
              Join Chat
            </button>
          </div>
        ))}
      </div>
    </div>
  );
} 