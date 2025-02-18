// src/pages/RightSidebar.tsx
import React from 'react';
import { List, Typography } from 'antd';
import { MessageOutlined } from '@ant-design/icons';

interface RightSidebarProps {
  isTablet?: boolean;
}

const historyItems = [
  { id: 1, name: 'Thread 1' },
  { id: 2, name: 'Thread 2' },
  { id: 3, name: 'Thread 3' },
];

const RightSidebar: React.FC<RightSidebarProps> = ({ isTablet = false }) => {
  return (
    <div style={{ padding: '16px', color: '#fff' }}>
      {/* Show title only when not in mobile view */}
      {!isTablet && (
        <Typography.Title level={4} style={{ color: '#fff', marginBottom: '16px' }}>
          Conversation History
        </Typography.Title>
      )}
      <List
        dataSource={historyItems}
        renderItem={(item) => (
          <List.Item
            style={{
              cursor: 'pointer',
              padding: '12px',
              borderRadius: '8px',
              transition: 'background 0.3s',
            }}
            onClick={() => console.log(`Clicked ${item.name}`)}
            onMouseEnter={(e) =>
              (e.currentTarget as HTMLElement).style.background = '#444'
            }
            onMouseLeave={(e) =>
              (e.currentTarget as HTMLElement).style.background = 'transparent'
            }
          >
            <MessageOutlined style={{ marginRight: '8px', fontSize: '16px', color: '#fff' }} />
            <span>{item.name}</span>
          </List.Item>
        )}
      />
    </div>
  );
};

export default RightSidebar;
