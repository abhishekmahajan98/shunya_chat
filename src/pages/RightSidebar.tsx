import React from 'react';
import './RightSidebar.css';

interface RightSidebarProps {
  collapsed?: boolean;
}

const RightSidebar: React.FC<RightSidebarProps> = ({ collapsed }) => {
  return (
    <div className={`right-sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">Message History</div>
      {/* Example message history items */}
      <div className="message-thread">Thread 1</div>
      <div className="message-thread">Thread 2</div>
      <div className="message-thread">Thread 3</div>
    </div>
  );
};

export default RightSidebar;
