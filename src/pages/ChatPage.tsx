// src/pages/ChatPage.tsx
import React, { useState, useRef, useEffect } from 'react';
import { Layout, Input, Button, List, Drawer, Grid } from 'antd';
import {
  SendOutlined,
  PaperClipOutlined,
  MenuOutlined,
  MessageOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import LeftSidebar from './LeftSidebar';
import RightSidebar from './RightSidebar';

const { Sider, Content } = Layout;
const { useBreakpoint } = Grid;

interface Message {
  id: number;
  text: string;
  sender: 'user' | 'llm';
}

const ChatPage: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      text: "Hello! How can I help you today? I'm running on the Gemini 2.0 Flash model, so I should be able to respond quickly.",
      sender: 'llm',
    },
    {
      id: 2,
      text: 'whats up?',
      sender: 'user',
    },
    {
      id: 3,
      text: "Not much! Just here and ready to assist. How about you? Anything interesting happening on your end?",
      sender: 'llm',
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Mobile drawer visibility states
  const [leftDrawerVisible, setLeftDrawerVisible] = useState(false);
  const [rightDrawerVisible, setRightDrawerVisible] = useState(false);

  // Desktop: left sidebar collapsible state (right sidebar remains non-collapsible)
  const [leftCollapsed, setLeftCollapsed] = useState(false);

  // Determine tablet vs. desktop based on breakpoint
  const screens = useBreakpoint();
  const isTablet = !screens.lg; // tablet (and below) use drawers

  // Auto-scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (inputValue.trim()) {
      setMessages((prev) => [
        ...prev,
        { id: prev.length + 1, text: inputValue.trim(), sender: 'user' },
      ]);
      setInputValue('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Layout style={{ height: '100vh', position: 'relative' }}>
      {/* Left Sidebar: Drawer on tablet/mobile, collapsible Sider on desktop */}
      {isTablet ? (
        <Drawer
          title={<>
            <ThunderboltOutlined style={{ fontSize: '24px', color: '#fff', marginRight: '8px' }} />
            Shunya Chat
          </>}
          placement="left"
          closable
          onClose={() => setLeftDrawerVisible(false)}
          visible={leftDrawerVisible}
          width={220}
          bodyStyle={{ padding: 0, backgroundColor: '#2e2e2e' }}
        >
          <LeftSidebar collapsed={false} isTablet={true} />
        </Drawer>
      ) : (
        <Sider
          collapsible
          collapsed={leftCollapsed}
          onCollapse={setLeftCollapsed}
          width={250}
          theme="dark"
        >
          <LeftSidebar collapsed={leftCollapsed} isTablet={false}/>
        </Sider>
      )}

      {/* Main Chat Area */}
      <Layout>
        {/* Tablet/mobile header triggers */}
        {isTablet && (
          <div
            style={{
              padding: '8px 16px',
              borderBottom: '1px solid #444',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: '#2e2e2e',
            }}
          >
            <Button
              type="text"
              icon={<MenuOutlined style={{ fontSize: '20px', color: '#fff' }} />}
              onClick={() => setLeftDrawerVisible(true)}
            />
            <Button
              type="text"
              icon={<MessageOutlined style={{ fontSize: '20px', color: '#fff' }} />}
              onClick={() => setRightDrawerVisible(true)}
            />
          </div>
        )}

        <Content style={{ padding: '16px', overflowY: 'auto' }}>
          <List
            dataSource={messages}
            renderItem={(msg) => (
              <List.Item
                style={{
                  justifyContent: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                }}
              >
                <div
                  style={{
                    background: msg.sender === 'user' ? '#1890ff' : '#f0f0f0',
                    color: msg.sender === 'user' ? '#fff' : '#000',
                    padding: '8px 16px',
                    borderRadius: '20px',
                    maxWidth: '60%',
                    wordBreak: 'break-word',
                  }}
                >
                  {msg.text}
                </div>
              </List.Item>
            )}
          />
          <div ref={messagesEndRef} />
        </Content>

        {/* Chat Input */}
        <div
          style={{
            padding: '16px',
            borderTop: '1px solid #444',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Input
            placeholder="Type your message..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{ flex: 1 }}
          />
          <Button icon={<PaperClipOutlined />} />
          <Button type="primary" icon={<SendOutlined />} onClick={handleSend} />
        </div>
      </Layout>

      {/* Right Sidebar: Drawer on tablet/mobile, non-collapsible Sider on desktop */}
      {isTablet ? (
        <Drawer
          title="Conversation History"
          placement="right"
          closable
          onClose={() => setRightDrawerVisible(false)}
          visible={rightDrawerVisible}
          width={220}
          bodyStyle={{ padding: 0, backgroundColor: '#2e2e2e' }}
        >
          {/* In mobile view, we hide the internal title */}
          <RightSidebar isTablet={true} />
        </Drawer>
      ) : (
        <Sider width={250} theme="dark">
          <RightSidebar isTablet={false} />
        </Sider>
      )}
    </Layout>
  );
};

export default ChatPage;
