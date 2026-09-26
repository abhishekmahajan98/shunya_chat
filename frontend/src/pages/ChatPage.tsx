import { useState, useRef, useEffect } from 'react';
import type { MenuProps } from 'antd';
import { Layout, Input, Button, Dropdown, Grid, Drawer, message as antMessage } from 'antd';
import {
  SendOutlined,
  PaperClipOutlined,
  MenuOutlined,
  SwapOutlined,
  SunOutlined,
  MoonOutlined,
  FileTextOutlined,
  CloseOutlined,
  ClockCircleOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { useTheme } from '../context/ThemeContext';
import { useChat, type Attachment } from '../context/ChatContext';
import { VerticalNav } from '../components/VerticalNav';
import { HistoryPanel } from '../components/HistoryPanel';
import MessageRenderer from '../components/MessageRenderer';
import { streamMessage, type StreamChunk, uploadFile } from '../api';
import { useNavigate } from 'react-router-dom';

const { Content } = Layout;
const { useBreakpoint } = Grid;

const ChatPage = () => {
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const {
    messages,
    addMessage,
    updateMessage,
    conversationId,
    setConversationId,
    clearMessages,
  } = useChat();

  const [inputValue, setInputValue] = useState('');
  const [inputFocused, setInputFocused] = useState(false);
  const [mobileNavVisible, setMobileNavVisible] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [modelOptions, setModelOptions] = useState<{ id: string, name: string, detail: string }[]>([]);
  const [selectedModel, setSelectedModel] = useState<{ id: string, name: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const screens = useBreakpoint();
  const isTablet = !screens.lg;

  const handleNewChat = () => {
    clearMessages();
    setConversationId(null);
    navigate('/');
  };

  useEffect(() => {
    import('../api').then(({ getModels }) => {
      getModels().then(models => {
        const options = models.map(m => ({
          id: m.id,
          name: m.name,
          detail: m.description
        }));
        setModelOptions(options);
        if (options.length > 0) {
          setSelectedModel({ id: options[0].id, name: options[0].name });
        }
      }).catch(err => {
        console.error("Failed to fetch models:", err);
      });
    });
  }, []);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setIsUploading(true);
      try {
        const newAttachments: Attachment[] = [];
        for (let i = 0; i < e.target.files.length; i++) {
          const file = e.target.files[i];
          const result = await uploadFile(file);
          newAttachments.push({
            id: crypto.randomUUID(),
            name: result.name,
            type: result.type,
            url: result.url,
            size: result.size,
          });
        }
        setAttachments(prev => [...prev, ...newAttachments]);
      } catch (error) {
        console.error("Upload failed:", error);
        antMessage.error("Failed to upload file");
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  };

  useEffect(() => {
    if (scrollRef.current) {
      const scrollContainer = scrollRef.current;
      const behavior = isLoading ? 'auto' : 'smooth';
      scrollContainer.scrollTo({
        top: scrollContainer.scrollHeight,
        behavior: behavior
      });
    }
  }, [messages, isLoading]);

  const handleSend = async () => {
    if ((!inputValue.trim() && attachments.length === 0) || isLoading || isUploading) return;

    const userInput = inputValue;
    const currentAttachments = [...attachments];
    setInputValue('');
    setAttachments([]);
    setIsLoading(true);

    addMessage({
      type: 'sync',
      sender: 'user',
      content: userInput,
      attachments: currentAttachments.length > 0 ? currentAttachments : undefined
    });

    const assistantMsgId = addMessage({
      type: 'sync',
      sender: 'assistant',
      content: '',
      pending: true,
    });

    let thinkingContent = '';
    let textContent = '';

    if (!selectedModel) {
      setIsLoading(false);
      return;
    }

    try {
      await streamMessage(
        selectedModel.id,
        userInput,
        (chunk: StreamChunk) => {
          if (chunk.type === 'meta' && chunk.conversation_id) {
            setConversationId(chunk.conversation_id);
          } else if (chunk.type === 'thinking') {
            thinkingContent += chunk.content || '';
            updateMessage(assistantMsgId, {
              pending: false,
              type: 'reasoning',
              reasoning: {
                steps: [{ id: 'thinking', text: thinkingContent, status: 'running' }],
                isExpanded: true
              },
            });
          } else if (chunk.type === 'text') {
            textContent += chunk.content || '';
            updateMessage(assistantMsgId, {
              pending: false,
              content: textContent,
              reasoning: thinkingContent ? {
                steps: [{ id: 'thinking', text: thinkingContent, status: 'complete' as const }],
                isExpanded: false
              } : undefined,
            });
          } else if (chunk.type === 'done') {
            updateMessage(assistantMsgId, {
              pending: false,
              type: thinkingContent ? 'reasoning' : 'sync',
              content: textContent,
              reasoning: thinkingContent ? {
                steps: [{ id: 'thinking', text: thinkingContent, status: 'complete' as const }],
                isExpanded: false
              } : undefined,
            });
          } else if (chunk.type === 'error') {
            updateMessage(assistantMsgId, {
              type: 'sync',
              content: `Error: ${chunk.content}`,
            });
          }
        },
        conversationId || undefined,
        currentAttachments.length > 0 ? currentAttachments : undefined,
      );
    } catch (error) {
      console.error('Failed to stream message:', error);
      antMessage.error(error instanceof Error ? error.message : 'Failed to stream message');
      updateMessage(assistantMsgId, {
        type: 'sync',
        content: 'Sorry, I encountered an error. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleMenuClick: MenuProps['onClick'] = (e) => {
    const newModel = modelOptions.find((model) => model.id === e.key);
    if (newModel) setSelectedModel(newModel);
  };

  const menuItems: MenuProps['items'] = modelOptions.map((model) => ({
    key: model.id,
    label: (
      <div style={{ padding: '4px 0' }}>
        <div style={{ fontWeight: 500 }}>{model.name}</div>
        <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{model.detail}</div>
      </div>
    ),
  }));

  return (
    <Layout style={{ height: '100vh', background: 'var(--color-bg)', overflow: 'hidden', flexDirection: 'row' }}>
      <VerticalNav />

      <Layout style={{
        background: 'var(--color-bg)',
        flex: 1,
        minWidth: 0,
        overflow: 'hidden',
      }}>
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
              onClick={() => setMobileNavVisible(true)}
            />
            <span style={{ fontWeight: 600, fontSize: 16 }}>Shunya Chat</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button
                type="text"
                icon={theme === 'dark' ? <SunOutlined /> : <MoonOutlined />}
                onClick={toggleTheme}
              />
            </div>
          </div>
        )}

        <Content style={{
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--color-bg)',
          overflow: 'hidden',
          flex: 1,
        }}>
          {messages.length === 0 ? (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              flex: 1,
              padding: '40px 20px',
              overflowY: 'auto',
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
                flexShrink: 0,
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
                marginBottom: 0,
                textAlign: 'center',
                maxWidth: 400,
              }}>
                Start a conversation. Your history is saved in the sidebar.
              </p>
            </div>
          ) : (
            <div
              ref={scrollRef}
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '24px 20px',
                display: 'flex',
                flexDirection: 'column',
                scrollBehavior: 'smooth',
                height: '0px',
                minHeight: '0px',
              }}
            >
              <div style={{ maxWidth: 800, width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 20 }}>
                {messages.map((msg) => (
                  <MessageRenderer key={msg.id} message={msg} />
                ))}
                <div ref={messagesEndRef} />
              </div>
            </div>
          )}

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
                {(attachments.length > 0 || isUploading) && (
                  <div style={{ display: 'flex', gap: 8, padding: '8px 16px', overflowX: 'auto', borderBottom: '1px solid var(--color-border-light)' }}>
                    {attachments.map(att => (
                      <div key={att.id} style={{
                        position: 'relative',
                        width: 48,
                        height: 48,
                        borderRadius: 8,
                        background: 'var(--color-bg)',
                        border: '1px solid var(--color-border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        {att.type.startsWith('image/') ? (
                          <img src={att.url} alt={att.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8 }} />
                        ) : (
                          <FileTextOutlined style={{ fontSize: 20, color: 'var(--color-text-secondary)' }} />
                        )}
                        <button
                          onClick={() => removeAttachment(att.id)}
                          style={{
                            position: 'absolute',
                            top: -6,
                            right: -6,
                            width: 16,
                            height: 16,
                            borderRadius: '50%',
                            background: 'var(--color-text)',
                            color: 'var(--color-bg)',
                            border: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            fontSize: 10
                          }}
                        >
                          <CloseOutlined />
                        </button>
                      </div>
                    ))}
                    {isUploading && (
                      <div style={{ width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <ClockCircleOutlined spin style={{ color: 'var(--color-primary)' }} />
                      </div>
                    )}
                  </div>
                )}

                <Input.TextArea
                  placeholder="Message Shunya Chat..."
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
                    <input
                      type="file"
                      ref={fileInputRef}
                      hidden
                      multiple
                      accept="image/*,.pdf,application/pdf"
                      onChange={handleFileSelect}
                    />
                    <Button
                      type="text"
                      icon={<PaperClipOutlined />}
                      style={{ color: 'var(--color-text-secondary)' }}
                      onClick={() => fileInputRef.current?.click()}
                      loading={isUploading}
                    />

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
                        <span style={{ fontSize: 13 }}>{selectedModel?.name || 'Loading...'}</span>
                      </Button>
                    </Dropdown>
                  </div>

                  <Button
                    type="primary"
                    icon={<SendOutlined />}
                    onClick={handleSend}
                    disabled={!inputValue.trim() || isLoading}
                    loading={isLoading}
                    style={{
                      borderRadius: 8,
                      background: inputValue.trim() && !isLoading ? 'var(--color-primary)' : undefined,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </Content>
      </Layout>

      <Drawer
        title="Menu"
        placement="left"
        closable
        onClose={() => setMobileNavVisible(false)}
        open={mobileNavVisible}
        width={280}
        styles={{
          body: { padding: 0, background: 'var(--color-sidebar)' },
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => { handleNewChat(); setMobileNavVisible(false); }}
            style={{ margin: 16 }}
          >
            New Chat
          </Button>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <HistoryPanel />
          </div>
        </div>
      </Drawer>
    </Layout>
  );
};

export default ChatPage;
