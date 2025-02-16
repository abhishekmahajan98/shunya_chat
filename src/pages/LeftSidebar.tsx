import React from 'react';
import './LeftSidebar.css';

interface LeftSidebarProps {
  collapsed?: boolean;
}

const LeftSidebar: React.FC<LeftSidebarProps> = ({ collapsed }) => {
  const handleSpacesClick = () => {
    // Navigate to the Spaces page.
    window.location.href = '/spaces';
  };

  const handleSettingsClick = () => {
    // Navigate to the Settings page.
    window.location.href = '/settings';
  };

  return (
    <div className={`left-sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="menu-options">
        <div className="menu-option selected">Chat</div>
        <div className="menu-option" onClick={handleSpacesClick}>
          Spaces
        </div>
        <div className="menu-option" onClick={handleSettingsClick}>
          Settings
        </div>
      </div>
    </div>
  );
};

export default LeftSidebar;
