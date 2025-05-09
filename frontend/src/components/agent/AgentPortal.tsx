import React, { useState, useEffect } from 'react';
import AgentLogin from './AgentLogin';
import RequestList from './RequestList';
import LiveChat from './LiveChat';

function AgentHeader({ agentName, onLogout }: { agentName: string; onLogout: () => void }) {
  return (
    <header className="agent-header-bar">
      <div className="company-logo">
        <img src="https://via.placeholder.com/40" alt="Company Logo" style={{ borderRadius: '8px', marginRight: '12px' }} />
        <span className="company-name">Your Company</span>
      </div>
      <div className="agent-header-info">
        <span className="agent-name">{agentName}</span>
        <button onClick={onLogout} className="logout-button">Logout</button>
      </div>
    </header>
  );
}

export default function AgentPortal() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [agentData, setAgentData] = useState<any>(null);
  const [activeRequest, setActiveRequest] = useState<any>(null);

  useEffect(() => {
    // Check if agent is already logged in
    const token = localStorage.getItem('agentToken');
    const storedAgentData = localStorage.getItem('agentData');
    
    if (token && storedAgentData) {
      setIsLoggedIn(true);
      setAgentData(JSON.parse(storedAgentData));
    }
  }, []);

  const handleLogin = (agent: any) => {
    setAgentData(agent);
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('agentToken');
    localStorage.removeItem('agentData');
    setIsLoggedIn(false);
    setAgentData(null);
  };

  if (!isLoggedIn) {
    return <AgentLogin onLogin={handleLogin} />;
  }

  return (
    <div className="agent-portal-3col">
      <AgentHeader agentName={agentData?.name || 'Agent'} onLogout={handleLogout} />
      <div className="agent-main-content">
        <div className="agent-requests-panel">
          <RequestList onJoinChat={setActiveRequest} />
        </div>
        <div className="agent-chat-panel">
          {activeRequest ? (
            <LiveChat request={activeRequest} />
          ) : (
            <div className="live-chat-placeholder">
              <h3>Live Chat</h3>
              <p>Select a request to start chatting.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 