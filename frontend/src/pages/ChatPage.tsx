import { useState, useRef, useEffect } from 'react';
import type { MenuProps } from 'antd';
import { Layout, Input, Button, Dropdown, Grid, Drawer, Popover, List } from 'antd';
import {
  SendOutlined,
  PaperClipOutlined,
  MenuOutlined,
  SwapOutlined,
  SunOutlined,
  MoonOutlined,
  FolderOutlined,
  RobotOutlined,
  DownOutlined,
  FileTextOutlined,
  CloseOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { useTheme } from '../context/ThemeContext';
import { useChat } from '../context/ChatContext';
import AppMenu from '../components/AppMenu';
import RightSidebar from '../components/RightSidebar';
import MessageRenderer from '../components/MessageRenderer';

const { Sider, Content } = Layout;
const { useBreakpoint } = Grid;

interface ModelOption {
  name: string;
  detail: string;
}

const modelOptions: ModelOption[] = [
  { name: 'Gemini 2.0 Flash', detail: 'Fast & efficient' },
  { name: 'Gemini 2.0 Ultra', detail: 'Most capable' },
  { name: 'GPT-4', detail: 'OpenAI flagship' },
  { name: 'Claude 3', detail: 'Anthropic AI' },
];

const ChatPage = () => {
  const { theme, toggleTheme } = useTheme();
  const {
    messages,
    addMessage,
    updateMessage,
    selectedScope,
    setSelectedScope,
    activeAgents,
    addBackgroundTask,
    updateBackgroundTask,
    backgroundTasks,
  } = useChat();

  const [inputValue, setInputValue] = useState('');
  const [inputFocused, setInputFocused] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const [leftDrawerVisible, setLeftDrawerVisible] = useState(false);
  const [rightDrawerVisible, setRightDrawerVisible] = useState(false);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [selectedModel, setSelectedModel] = useState<ModelOption>(modelOptions[0]);

  const screens = useBreakpoint();
  const isTablet = !screens.lg;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle clearing specific selected items from scope
  const handleRemoveSelectedItem = (id: string) => {
    if (!selectedScope) return;
    setSelectedScope({
      ...selectedScope,
      selectedItems: selectedScope.selectedItems.filter(i => i.id !== id),
    });
  };

  const handleClearSelection = () => {
    if (!selectedScope) return;
    setSelectedScope({
      ...selectedScope,
      selectedItems: [],
    });
  };

  const handleSend = () => {
    if (!inputValue.trim()) return;

    // Add user message
    addMessage({
      type: 'sync',
      sender: 'user',
      content: inputValue,
    });

    const userInput = inputValue;
    setInputValue('');

    // Check for active agents
    const dexterActive = activeAgents.find(a => a.id === 'dexter');
    const quickSearchActive = activeAgents.find(a => a.id === 'quick-search');

    // 1. Dexter (Background Task)
    if (dexterActive) {
      setTimeout(() => {
        // Add initial response
        addMessage({
          type: 'sync',
          sender: 'assistant',
          content: `I've started a deep research task for "${userInput}". This might take a while. I'll email you the results when I'm done.`,
          agents: ['dexter'],
        });

        // Start background task
        const taskId = addBackgroundTask({
          agentId: 'dexter',
          agentName: 'Dexter',
          query: userInput,
          status: 'running',
          progress: 0,
          willEmail: true,
        });

        // Simulate background progress
        let progress = 0;
        const interval = setInterval(() => {
          progress += 5;
          if (progress >= 100) {
            clearInterval(interval);
            updateBackgroundTask(taskId, { status: 'complete', progress: 100, completedAt: new Date() });
          } else {
            updateBackgroundTask(taskId, { progress });
          }
        }, 1000); // 20 seconds total
      }, 500);
      return;
    }

    // 2. Quick Search (Reasoning)
    if (quickSearchActive) {
      const msgId = addMessage({
        type: 'reasoning',
        sender: 'assistant',
        content: '',
        agents: ['quick-search'],
        reasoning: {
          steps: [
            { id: '1', text: 'Analyzing query intent...', status: 'running' },
            { id: '2', text: 'Searching knowledge base...', status: 'pending' },
            { id: '3', text: 'Synthesizing answer...', status: 'pending' },
          ],
          isExpanded: true,
        },
      });

      // Simulate steps
      setTimeout(() => {
        updateMessage(msgId, {
          reasoning: {
            steps: [
              { id: '1', text: 'Analyzing query intent...', status: 'complete' },
              { id: '2', text: 'Searching knowledge base...', status: 'running' },
              { id: '3', text: 'Synthesizing answer...', status: 'pending' },
            ],
            isExpanded: true,
          }
        });
      }, 1500);

      setTimeout(() => {
        updateMessage(msgId, {
          content: `Here is what I found regarding "${userInput}". \n\nBased on the quick search, the key points are:\n1. Detailed analysis of the topic.\n2. Cross-referenced data points.\n3. Verified sources.`,
          reasoning: {
            steps: [
              { id: '1', text: 'Analyzing query intent...', status: 'complete' },
              { id: '2', text: 'Searching knowledge base...', status: 'complete' },
              { id: '3', text: 'Synthesizing answer...', status: 'complete' },
            ],
            isExpanded: false,
          },
          citations: [
            { id: '1', title: 'Market Report 2024' },
            { id: '2', title: 'Internal Wiki' },
          ],
        });
      }, 3000);
      return;
    }

    // 3. Default / Context Aware Response
    setTimeout(() => {
      const contextPrefix = selectedScope?.selectedItems.length
        ? `Using context from ${selectedScope.selectedItems.length} selected items in ${selectedScope.spaceName}: `
        : `Using context from ${selectedScope?.spaceName || 'Global'}: `;

      addMessage({
        type: 'sync',
        sender: 'assistant',
        content: `${contextPrefix} I've processed your request: "${userInput}". \n\nThis is a sample response demonstrating how I can help you with your tasks in this space.`,
        agents: activeAgents.map(a => a.id),
      });
    }, 1000);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleMenuClick: MenuProps['onClick'] = (e) => {
    const newModel = modelOptions.find((model) => model.name === e.key);
    if (newModel) setSelectedModel(newModel);
  };

  const menuItems: MenuProps['items'] = modelOptions.map((model) => ({
    key: model.name,
    label: (
      <div style={{ padding: '4px 0' }}>
        <div style={{ fontWeight: 500 }}>{model.name}</div>
        <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{model.detail}</div>
      </div>
    ),
  }));

  // Sidebar styles
  const siderStyle = {
    background: 'var(--color-sidebar)',
    borderRight: '1px solid var(--color-border)',
  };

  const rightSiderStyle = {
    background: 'var(--color-sidebar)',
    borderLeft: '1px solid var(--color-border)',
  };

  // Scope Popover Content
  const scopePopoverContent = (
    <div style={{ width: 300 }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0 0 8px',
        borderBottom: '1px solid var(--color-border)',
        marginBottom: 8
      }}>
        <span style={{ fontWeight: 600 }}>Selected Context</span>
        <Button size="small" type="text" onClick={handleClearSelection} disabled={!selectedScope?.selectedItems.length}>
          Clear All
        </Button>
      </div>

      {selectedScope?.selectedItems.length === 0 ? (
        <div style={{ color: 'var(--color-text-secondary)', fontStyle: 'italic', padding: '8px 0' }}>
          Whole space "{selectedScope.spaceName}" selected
        </div>
      ) : (
        <List
          size="small"
          dataSource={selectedScope?.selectedItems}
          renderItem={(item) => (
            <List.Item
              actions={[
                <Button
                  key="del"
                  type="text"
                  size="small"
                  icon={<CloseOutlined style={{ fontSize: 10 }} />}
                  onClick={() => handleRemoveSelectedItem(item.id)}
                />
              ]}
              style={{ padding: '4px 0' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, maxWidth: 220 }}>
                {item.type === 'folder' ? <FolderOutlined /> : <FileTextOutlined />}
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
              </div>
            </List.Item>
          )}
        />
      )}
    </div>
  );

  return (
    <Layout style={{ height: '100vh', background: 'var(--color-bg)' }}>
      {/* Left Sidebar */}
      {isTablet ? (
        <Drawer
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 20 }}>⚡</span>
              <span style={{ fontWeight: 600 }}>Shunya Chat</span>
            </div>
          }
          placement="left"
          closable
          onClose={() => setLeftDrawerVisible(false)}
          open={leftDrawerVisible}
          width={280}
          styles={{
            body: { padding: 0, background: 'var(--color-sidebar)' },
            header: { background: 'var(--color-sidebar)', borderBottom: '1px solid var(--color-border)' },
          }}
        >
          <AppMenu collapsed={false} isTablet={true} />
        </Drawer>
      ) : (
        <Sider
          collapsible
          collapsed={leftCollapsed}
          onCollapse={setLeftCollapsed}
          width={260}
          collapsedWidth={72}
          style={siderStyle}
          trigger={null}
        >
          <AppMenu collapsed={leftCollapsed} isTablet={false} onCollapseToggle={() => setLeftCollapsed(!leftCollapsed)} />
        </Sider>
      )}

      {/* Main Chat Area */}
      <Layout style={{ background: 'var(--color-bg)' }}>
        {/* Mobile Header */}
        {isTablet && (
          <div style={{
            padding: '12px 16px',
            borderBottom: '1px solid var(--color-border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'var(--color-surface)',
          }}>
            <Button
              type="text"
              icon={<MenuOutlined style={{ fontSize: 20 }} />}
              onClick={() => setLeftDrawerVisible(true)}
            />
            <span style={{ fontWeight: 600, fontSize: 16 }}>Shunya Chat</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button
                type="text"
                icon={theme === 'dark' ? <SunOutlined /> : <MoonOutlined />}
                onClick={toggleTheme}
              />
              <Button
                type="text"
                icon={<RobotOutlined style={{ fontSize: 20 }} />}
                onClick={() => setRightDrawerVisible(true)}
              />
            </div>
          </div>
        )}

        {/* Chat Content */}
        <Content style={{
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--color-bg)',
          overflow: 'hidden',
        }}>
          {/** Active Background Tasks Indicator **/}
          {backgroundTasks.some(t => t.status === 'running') && (
            <div style={{
              background: 'var(--color-surface)',
              borderBottom: '1px solid var(--color-border)',
              padding: '8px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              fontSize: 13
            }}>
              <ClockCircleOutlined style={{ color: 'var(--color-primary)' }} />
              <span style={{ fontWeight: 500 }}>Background Tasks Running:</span>
              <div style={{ display: 'flex', gap: 12 }}>
                {backgroundTasks.filter(t => t.status === 'running').map(t => (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: 0.8 }}>
                    <span>{t.agentName}</span>
                    <div style={{ width: 60, height: 4, background: 'var(--color-border)', borderRadius: 2 }}>
                      <div style={{ width: `${t.progress}%`, height: '100%', background: 'var(--color-primary)' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          {messages.length === 0 ? (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              flex: 1,
              padding: '40px 20px',
            }}>
              <div style={{
                width: 80,
                height: 80,
                borderRadius: 20,
                background: 'var(--color-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 24,
              }}>
                <span style={{ fontSize: 40, color: 'var(--color-text-inverse)' }}>⚡</span>
              </div>
              <h1 style={{
                fontSize: 32,
                fontWeight: 700,
                marginBottom: 8,
                color: 'var(--color-text)',
              }}>
                Shunya Chat
              </h1>
              <p style={{
                fontSize: 16,
                color: 'var(--color-text-secondary)',
                marginBottom: 40,
                textAlign: 'center',
                maxWidth: 400,
              }}>
                Select a Space, enable Agents, and start collaborating.
              </p>
              <div style={{
                display: 'flex',
                gap: 12,
                flexWrap: 'wrap',
                justifyContent: 'center',
              }}>
                {['🔍 deep search competitor X', '📊 analyze Q4 budget', '📧 email weekly summary'].map((action, i) => (
                  <button
                    key={i}
                    onClick={() => setInputValue(action.split(' ').slice(1).join(' '))}
                    style={{
                      padding: '10px 16px',
                      borderRadius: 8,
                      border: '1px solid var(--color-border)',
                      background: 'transparent',
                      color: 'var(--color-text)',
                      fontSize: 14,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--color-primary)';
                      e.currentTarget.style.color = 'var(--color-primary)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--color-border)';
                      e.currentTarget.style.color = 'var(--color-text)';
                    }}
                  >
                    {action}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '24px 20px',
              display: 'flex',
              flexDirection: 'column',
            }}>
              <div style={{ maxWidth: 800, width: '100%', margin: '0 auto' }}>
                {messages.map((msg) => (
                  <MessageRenderer key={msg.id} message={msg} />
                ))}
                <div ref={messagesEndRef} />
              </div>
            </div>
          )}

          {/* Enhanced Input Bar */}
          <div style={{ padding: '16px 20px 24px' }}>
            <div style={{ maxWidth: 800, margin: '0 auto' }}>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                border: `2px solid ${inputFocused ? 'var(--color-primary)' : 'var(--color-border)'}`,
                borderRadius: 12,
                background: 'var(--color-surface)',
                transition: 'border-color 0.2s ease',
              }}>
                <Input.TextArea
                  placeholder={`Message ${selectedScope?.spaceName || 'Shunya Chat'}...`}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onFocus={() => setInputFocused(true)}
                  onBlur={() => setInputFocused(false)}
                  autoSize={{ minRows: 1, maxRows: 6 }}
                  variant="borderless"
                  style={{
                    padding: '12px 16px',
                    fontSize: 15,
                    resize: 'none',
                  }}
                />
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  borderTop: '1px solid var(--color-border-light)',
                  gap: 8,
                }}>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {/* Attach */}
                    <Button
                      type="text"
                      icon={<PaperClipOutlined />}
                      style={{ color: 'var(--color-text-secondary)' }}
                    />

                    {/* Scope Pill */}
                    <Popover content={scopePopoverContent} trigger="click" placement="topLeft">
                      <button
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '4px 10px',
                          borderRadius: 16,
                          border: '1px solid var(--color-border)',
                          background: selectedScope?.selectedItems.length ? 'var(--color-sidebar-active)' : 'transparent',
                          color: selectedScope?.selectedItems.length ? 'var(--color-primary)' : 'var(--color-text)',
                          fontSize: 13,
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          maxWidth: 200,
                        }}
                      >
                        <FolderOutlined style={{ fontSize: 12 }} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {selectedScope?.selectedItems.length
                            ? `${selectedScope.spaceName} > ${selectedScope.selectedItems.length} items`
                            : selectedScope?.spaceName || 'Select Space'}
                        </span>
                        <DownOutlined style={{ fontSize: 10, opacity: 0.5 }} />
                      </button>
                    </Popover>

                    {/* Active Agents Pill */}
                    <button
                      onClick={() => !isTablet && setRightDrawerVisible(true)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '4px 10px',
                        borderRadius: 16,
                        border: activeAgents.length > 0 ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                        background: activeAgents.length > 0 ? 'var(--color-sidebar-active)' : 'transparent',
                        color: activeAgents.length > 0 ? 'var(--color-primary)' : 'var(--color-text)',
                        fontSize: 13,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      <RobotOutlined style={{ fontSize: 12 }} />
                      <span>{activeAgents.length > 0 ? `${activeAgents.length} Agents` : 'Agents'}</span>
                    </button>

                    {/* Model Selector */}
                    <Dropdown
                      menu={{ items: menuItems, onClick: handleMenuClick }}
                      trigger={['click']}
                    >
                      <Button
                        type="text"
                        icon={<SwapOutlined />}
                        style={{
                          color: 'var(--color-text-secondary)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <span style={{ fontSize: 13 }}>{selectedModel.name}</span>
                      </Button>
                    </Dropdown>
                  </div>

                  <Button
                    type="primary"
                    icon={<SendOutlined />}
                    onClick={handleSend}
                    disabled={!inputValue.trim()}
                    style={{
                      borderRadius: 8,
                      background: inputValue.trim() ? 'var(--color-primary)' : undefined,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </Content>
      </Layout>

      {/* Right Sidebar - Agent Marketplace */}
      {isTablet ? (
        <Drawer
          title="Agents"
          placement="right"
          closable
          onClose={() => setRightDrawerVisible(false)}
          open={rightDrawerVisible}
          width={280}
          styles={{
            body: { padding: 0, background: 'var(--color-sidebar)' },
            header: { background: 'var(--color-sidebar)', borderBottom: '1px solid var(--color-border)' },
          }}
        >
          <RightSidebar isTablet={true} />
        </Drawer>
      ) : (
        <Sider width={280} style={rightSiderStyle} trigger={null}>
          <RightSidebar isTablet={false} />
        </Sider>
      )}
    </Layout>
  );
};

export default ChatPage;
