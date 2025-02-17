// src/pages/ChatPage.tsx
import React, { useState, useRef, useEffect } from 'react';
import { Layout, Input, Button, List, Drawer, Grid, Dropdown, Menu, Card, Typography } from 'antd';
import {
  SendOutlined,
  PaperClipOutlined,
  MenuOutlined,
  MessageOutlined,
  ThunderboltOutlined,
  SwapOutlined,
} from '@ant-design/icons';
import LeftSidebar from './LeftSidebar';
import RightSidebar from './RightSidebar';

const { Sider, Content } = Layout;
const { useBreakpoint } = Grid;
const { Title, Paragraph } = Typography;

interface Message {
  id: number;
  text: string;
  sender: 'user' | 'llm';
}

interface ModelOption {
  name: string;
  detail: string;
}

const modelOptions: ModelOption[] = [
  { name: 'Gemini 2.0 Flash', detail: 'Good for coding' },
  { name: 'Gemini 2.0 Ultra', detail: 'Great for general tasks' },
  { name: 'GPT-4', detail: 'Legalcy model by OAI' },
  { name: 'GPT-3.5 Turbo', detail: 'Fast and efficient' },
];

const ChatPage: React.FC = () => {
  // Start with an empty messages array.
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Mobile drawer visibility states
  const [leftDrawerVisible, setLeftDrawerVisible] = useState(false);
  const [rightDrawerVisible, setRightDrawerVisible] = useState(false);

  // Desktop: left sidebar collapsible state
  const [leftCollapsed, setLeftCollapsed] = useState(false);

  // Determine tablet vs. desktop based on breakpoint
  const screens = useBreakpoint();
  const isTablet = !screens.lg;

  // Auto-scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (inputValue.trim()) {
      setMessages((prev) => {
        const userMessage: Message = {
          id: prev.length + 1,
          text: inputValue,
          sender: 'user',
        };
        const llmMessage: Message = {
          id: prev.length + 2,
          text: 'LLM response',
          sender: 'llm',
        };
        return [...prev, userMessage, llmMessage];
      });
      setInputValue('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Send message on Enter without Shift; allow newline with Shift+Enter.
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Default selected model is the first one in the list.
  const [selectedModel, setSelectedModel] = useState<ModelOption>(modelOptions[0]);

  // Handle selecting a new model from the dropdown menu.
  const handleMenuClick = (e: any) => {
    const newModel = modelOptions.find((model) => model.name === e.key);
    if (newModel) {
      setSelectedModel(newModel);
    }
  };

  // Define the menu for model selection.
  const modelMenu = (
    <Menu onClick={handleMenuClick}>
      {modelOptions.map((model) => (
        <Menu.Item key={model.name}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span>{model.name}</span>
            <small style={{ color: '#888' }}>{model.detail}</small>
          </div>
        </Menu.Item>
      ))}
    </Menu>
  );

  // Custom welcome screen if there are no messages.
  const renderWelcomeScreen = () => (
    <div
      style={{
        height: '100%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <Card style={{ maxWidth: 500, width: '100%', textAlign: 'center', borderRadius: '8px' }}>
        <ThunderboltOutlined style={{ fontSize: '48px', color: '#1890ff' }} />
        <Title level={2} style={{ marginTop: '16px' }}>
          Welcome to Shunya Chat
        </Title>
        <Paragraph style={{ color: 'off-white' }}>
          Experience the future of conversation with our intelligent AI assistant. To get started, choose
          the AI model that best suits your needs and let the conversation flow.
        </Paragraph>
        <Dropdown overlay={modelMenu} trigger={['click']}>
          <Button type="primary" size="large">
            Select AI Model (Current: {selectedModel.name})
          </Button>
        </Dropdown>
      </Card>
    </div>
  );

  return (
    <Layout style={{ height: '100vh', position: 'relative' }}>
      {/* Left Sidebar */}
      {isTablet ? (
        <Drawer
          title={
            <>
              <ThunderboltOutlined style={{ fontSize: '24px', color: '#fff', marginRight: '8px' }} />
              Shunya Chat
            </>
          }
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
        <Sider collapsible collapsed={leftCollapsed} onCollapse={setLeftCollapsed} width={250} theme="dark">
          <LeftSidebar collapsed={leftCollapsed} isTablet={false} />
        </Sider>
      )}

      {/* Main Chat Area */}
      <Layout>
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
          {messages.length === 0 ? (
            renderWelcomeScreen()
          ) : (
            <>
              <List
                locale={{ emptyText: null }} // hide default empty message 
                dataSource={messages}
                renderItem={(msg) => (
                  <List.Item style={{ justifyContent: msg.sender === 'user' ? 'flex-end' : 'flex-start' }}>
                    <div
                      style={{
                        background: msg.sender === 'user' ? '#1890ff' : '#f0f0f0',
                        color: msg.sender === 'user' ? '#fff' : '#000',
                        padding: '8px 16px',
                        borderRadius: '20px',
                        maxWidth: '60%',
                        wordBreak: 'break-word',
                        whiteSpace: 'pre-wrap', // preserve newlines
                      }}
                    >
                      {msg.text}
                    </div>
                  </List.Item>
                )}
              />
              <div ref={messagesEndRef} />
            </>
          )}
        </Content>

        {/* Chat Input Section */}
        <div style={{ padding: '16px', borderTop: '1px solid #444' }}>
          <Input.TextArea
            id="chat-input"
            placeholder="Type your message..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            autoSize={{ minRows: 1, maxRows: 6 }}
            style={{ width: '100%' }}
          />
          <div
            style={{
              marginTop: '8px',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '8px',
            }}
          >
            <Button icon={<PaperClipOutlined />} />
            <Dropdown overlay={modelMenu} trigger={['click']}>
              <Button icon={<SwapOutlined />}>{selectedModel.name}</Button>
            </Dropdown>
            <Button type="primary" icon={<SendOutlined />} onClick={handleSend} />
          </div>
          {/* Footer */}
          <div style={{ marginTop: '8px', textAlign: 'center', fontSize: '12px', color: '#888' }}>
            Powered by Abhishek Mahajan&apos;s Programming Skills and some masala chai over the weekend
          </div>
        </div>
      </Layout>

      {/* Right Sidebar */}
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
