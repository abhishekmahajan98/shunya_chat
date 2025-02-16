// src/Sidebar.tsx
import React from 'react';
import './Sidebar.css';

const Sidebar: React.FC = () => {
  return (
    <div className="sidebar">
      <div className="sidebar-top">
        <div className="sidebar-title">T3 Chat</div>
        <div className="sidebar-item">New to T3 Chat</div>
        <div className="sidebar-item">FAQ</div>
      </div>
      <div className="sidebar-login">Login</div>
    </div>
  );
};

export default Sidebar;
