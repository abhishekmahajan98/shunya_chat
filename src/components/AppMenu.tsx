import React from 'react';
import { Menu } from 'antd';
import {
  MessageOutlined,
  AppstoreOutlined,
  SettingOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

interface AppMenuProps {
  collapsed: boolean;
  isTablet?: boolean;
}

const AppMenu: React.FC<AppMenuProps> = ({ collapsed, isTablet }) => {
  const navigate = useNavigate();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div
        style={{
          padding: '16px',
          textAlign: 'center',
          color: '#fff',
          fontWeight: 'bold',
          borderBottom: '1px solid #444',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {isTablet ? null : (
          collapsed ? (
            <ThunderboltOutlined style={{ fontSize: '24px', color: '#fff' }} />
          ) : (
            <>
              <ThunderboltOutlined style={{ fontSize: '24px', color: '#fff', marginRight: '8px' }} />
              Shunya Chat
            </>
          )
        )}
      </div>

      {/* Menu */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <Menu
          theme="dark"
          mode="inline"
          defaultSelectedKeys={['chat']}
          style={{ borderRight: 0 }}
        >
          <Menu.Item key="chat" icon={<MessageOutlined />} onClick={() => navigate('/')}>
            Chat
          </Menu.Item>
          <Menu.Item key="spaces" icon={<AppstoreOutlined />} onClick={() => navigate('/spaces')}>
            Spaces
          </Menu.Item>
          <Menu.Item key="settings" icon={<SettingOutlined />} onClick={() => navigate('/settings')}>
            Settings
          </Menu.Item>
        </Menu>
      </div>
    </div>
  );
};

export default AppMenu;
