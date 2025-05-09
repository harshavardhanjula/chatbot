import React from 'react';
import { createRoot } from 'react-dom/client';
import AgentPortal from './components/agent/AgentPortal';

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <AgentPortal />
    </React.StrictMode>
  );
} 