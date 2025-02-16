// src/Sidebar.tsx
import React from 'react';
import './Sidebar.css';

const Sidebar: React.FC = () => {
  return (
    <div className="sidebar">
      <button className="new-chat-btn">+ New Chat</button>

      <div className="sidebar-chats">
        {/* Example chat items */}
        <div className="chat-item">Chat 1</div>
        <div className="chat-item">Chat 2</div>
        <div className="chat-item">Chat 3</div>
      </div>

      <div className="sidebar-footer">
        Powered by GPT
      </div>
    </div>
  );
};

export default Sidebar;
