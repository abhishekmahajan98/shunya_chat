import { useState, useRef, useEffect, useCallback } from 'react';
import type { MenuProps } from 'antd';
import { Layout, Input, Button, Dropdown, Grid, Drawer, message as antMessage, Modal } from 'antd';
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
  RobotOutlined,
  CheckOutlined,
} from '@ant-design/icons';
import { useTheme } from '../context/ThemeContext';
import { useChat, type Attachment, type ReasoningStep, type TodoItem, type Citation } from '../context/ChatContext';
import { VerticalNav } from '../components/VerticalNav';
import { HistoryPanel } from '../components/HistoryPanel';
import MessageRenderer from '../components/MessageRenderer';
import { streamMessage, type StreamChunk, uploadFile, connectIntegrationUrl, disconnectIntegration, saveIntegrationApiKey } from '../api';
import { useNavigate, useSearchParams } from 'react-router-dom';

const { Content } = Layout;
const { useBreakpoint } = Grid;

const ChatPage = () => {
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    messages,
    addMessage,
    updateMessage,
    insertMessageBefore,
    removeMessage,
    conversationId,
    setConversationId,
    clearMessages,
    availableAgents,
    selectedAgentIds,
    toggleAgent,
    refreshAgents,
  } = useChat();

  const [inputValue, setInputValue] = useState('');
  const [inputFocused, setInputFocused] = useState(false);
  const [mobileNavVisible, setMobileNavVisible] = useState(false);
  const [agentMenuOpen, setAgentMenuOpen] = useState(false);

  const [apiKeyModalAgent, setApiKeyModalAgent] = useState<{ id: string; name: string } | null>(null);
  const [apiKeyDraft, setApiKeyDraft] = useState('');
  const [apiKeySaving, setApiKeySaving] = useState(false);

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

  // OAuth return: ?integration=linear&status=connected|error
  useEffect(() => {
    const integration = searchParams.get('integration');
    const status = searchParams.get('status');
    if (!integration || !status) return;
    const error = searchParams.get('error');
    if (status === 'connected') {
      antMessage.success(`${integration} connected`);
      void refreshAgents().then(() => {
        if (!selectedAgentIds.includes(integration)) {
          toggleAgent(integration);
        }
      });
    } else {
      antMessage.error(error || `Failed to connect ${integration}`);
    }
    const next = new URLSearchParams(searchParams);
    next.delete('integration');
    next.delete('status');
    next.delete('error');
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

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
      type: 'reasoning',
      sender: 'assistant',
      content: '',
      pending: true,
      reasoning: {
        steps: [],
        isExpanded: true,
      },
    });

    let textContent = '';
    const steps: ReasoningStep[] = [];
    let todos: TodoItem[] = [];
    let citations: Citation[] = [];
    let compactionPendingId: string | null = null;

    const pushSteps = (expanded = true) => {
      // Keep Agentic Reasoning open while a plan exists so todos stay visible
      const keepOpen = expanded || todos.length > 0;
      updateMessage(assistantMsgId, {
        pending: false,
        type: steps.length || todos.length ? 'reasoning' : 'sync',
        content: textContent,
        reasoning: steps.length
          ? { steps: [...steps], isExpanded: keepOpen }
          : todos.length
            ? { steps: [], isExpanded: true }
            : undefined,
        todos: todos.length ? [...todos] : undefined,
        citations: citations.length ? [...citations] : undefined,
      });
    };

    if (!selectedModel) {
      setIsLoading(false);
      return;
    }

    try {
      await streamMessage(
        selectedModel.id,
        userInput,
        (chunk: StreamChunk) => {
          if (chunk.type === 'meta' && (chunk.conversation_id || chunk.thread_id)) {
            setConversationId(chunk.conversation_id || chunk.thread_id || null);
          } else if (chunk.type === 'status') {
            // Old split prep events — ignore; we use a single `prep` line
            const skip = new Set(['prep-agents', 'prep-skills', 'starting', 'planning']);
            if (chunk.step_id && skip.has(chunk.step_id)) {
              return;
            }
            const id = chunk.step_id || `status-${steps.length}`;
            // Insert prep before Planning so the timeline reads setup → plan → work
            const step = {
              id,
              text: chunk.label || chunk.content || 'Working…',
              detail: chunk.detail,
              status: 'complete' as const,
              category: chunk.category || (chunk.step_id === 'prep' ? 'prep' : 'status'),
            };
            const planningIdx = steps.findIndex((s) => s.id === 'tool-planning');
            const existing = steps.findIndex((s) => s.id === id);
            if (existing >= 0) {
              steps[existing] = step;
            } else if (chunk.step_id === 'prep' && planningIdx >= 0) {
              steps.splice(planningIdx, 0, step);
            } else {
              steps.push(step);
            }
            pushSteps(true);
          } else if (chunk.type === 'todos' && chunk.todos) {
            todos = chunk.todos.map((t) => ({
              content: t.content,
              status: t.status,
            }));
            pushSteps(true);
          } else if (chunk.type === 'citations' && chunk.citations) {
            citations = chunk.citations.map((c) => ({
              id: String(c.id),
              title: c.title,
              url: c.url,
              agent: c.agent,
              detail: c.detail,
            }));
            pushSteps(true);
          } else if (chunk.type === 'compaction_start') {
            compactionPendingId = addMessage({
              type: 'sync',
              sender: 'system',
              content: chunk.content || 'Compacting context…',
              pending: true,
            });
          } else if (chunk.type === 'compaction_end') {
            if (compactionPendingId) {
              removeMessage(compactionPendingId);
              compactionPendingId = null;
            }
          } else if (chunk.type === 'compaction') {
            if (compactionPendingId) {
              updateMessage(compactionPendingId, {
                pending: false,
                content: chunk.content || 'Context compacted',
                compactionSummary: chunk.summary || '',
              });
              compactionPendingId = null;
            } else if (chunk.first_kept_message_id) {
              insertMessageBefore(chunk.first_kept_message_id, {
                type: 'sync',
                sender: 'system',
                content: chunk.content || 'Context compacted',
                compactionSummary: chunk.summary || '',
              });
            } else {
              addMessage({
                type: 'sync',
                sender: 'system',
                content: chunk.content || 'Context compacted',
                compactionSummary: chunk.summary || '',
              });
            }
          } else if (chunk.type === 'tool_start') {
            const id = chunk.tool_run_id === 'planning'
              ? 'tool-planning'
              : `tool-${chunk.tool_run_id}`;
            const idx = steps.findIndex((s) => s.id === id);
            const step = {
              id,
              text: chunk.label || chunk.tool_name || chunk.name || 'tool',
              detail: chunk.detail,
              status: 'running' as const,
              category: chunk.category || (chunk.tool_run_id === 'planning' ? 'plan' : 'tool'),
              via: chunk.via,
            };
            if (idx >= 0) steps[idx] = step;
            else steps.push(step);
            pushSteps(true);
          } else if (chunk.type === 'tool_end') {
            const id = chunk.tool_run_id === 'planning'
              ? 'tool-planning'
              : `tool-${chunk.tool_run_id}`;
            const idx = steps.findIndex((s) => s.id === id);
            const step = {
              id,
              text: chunk.label || chunk.tool_name || steps[idx]?.text || 'tool',
              // Prefer end-event params (start often has empty args)
              detail: chunk.detail || (idx >= 0 ? steps[idx].detail : undefined),
              status: 'complete' as const,
              category: chunk.category || steps[idx]?.category || 'tool',
              via: chunk.via || (idx >= 0 ? steps[idx].via : undefined),
            };
            // Upsert — never drop a completed tool if start was missed
            if (idx >= 0) steps[idx] = step;
            else steps.push(step);
            pushSteps(true);
          } else if (chunk.type === 'text') {
            textContent += chunk.content || '';
            pushSteps(true);
          } else if (chunk.type === 'done') {
            // Mark leftovers complete — do NOT drop them (task/subagents often
            // finish without a matched tool_end run_id, and splicing hid real calls).
            steps.forEach((s, i) => {
              if (s.status === 'running') {
                steps[i] = { ...s, status: 'complete' };
              }
            });
            if (chunk.todos?.length) {
              todos = chunk.todos.map((t) => ({
                content: t.content,
                status: t.status,
              }));
            }
            if (chunk.citations?.length) {
              citations = chunk.citations.map((c) => ({
                id: String(c.id),
                title: c.title,
                url: c.url,
                agent: c.agent,
                detail: c.detail,
              }));
            }
            pushSteps(false);
            if (chunk.agents?.length) {
              updateMessage(assistantMsgId, {
                agents: chunk.agents,
                citations: citations.length ? [...citations] : undefined,
              });
            }
          } else if (chunk.type === 'error') {
            updateMessage(assistantMsgId, {
              type: 'sync',
              pending: false,
              content: textContent || `Error: ${chunk.content}`,
            });
          }
        },
        conversationId || undefined,
        currentAttachments.length > 0 ? currentAttachments : undefined,
        selectedAgentIds,
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

  const agentMenuItems: MenuProps['items'] = availableAgents.map((agent) => {
    const needsConnect =
      agent.auth === 'oauth_dcr' ||
      agent.auth === 'oauth_static' ||
      agent.auth === 'user_api_key';
    const connected = Boolean(agent.connected);
    const missingEnv = agent.auth === 'env_api_key' && agent.ready === false;
    let subtitle = agent.description;
    if (needsConnect && !connected) {
      subtitle = agent.auth === 'user_api_key' ? 'Add API key to enable' : 'Connect to enable';
    } else if (missingEnv) {
      subtitle = 'Server API key not configured';
    }
    return {
      key: agent.id,
      disabled: missingEnv,
      label: (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, minWidth: 220 }}>
          <div style={{ padding: '2px 0' }}>
            <div style={{ fontWeight: 500 }}>{agent.name}</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{subtitle}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            {needsConnect && (
              <span style={{
                fontSize: 11,
                color: connected ? 'var(--color-primary)' : 'var(--color-text-secondary)',
              }}>
                {connected ? 'Connected' : (agent.auth === 'user_api_key' ? 'Add key' : 'Connect')}
              </span>
            )}
            {selectedAgentIds.includes(agent.id) && (
              <CheckOutlined style={{ color: 'var(--color-primary)', fontSize: 12 }} />
            )}
          </div>
        </div>
      ),
    };
  });

  const handleAgentMenuClick: MenuProps['onClick'] = (e) => {
    e.domEvent.preventDefault();
    e.domEvent.stopPropagation();
    const agent = availableAgents.find((a) => a.id === e.key);
    if (!agent) return;

    if (agent.auth === 'env_api_key' && agent.ready === false) {
      antMessage.warning(`${agent.name} needs a server env key`);
      return;
    }

    if ((agent.auth === 'oauth_dcr' || agent.auth === 'oauth_static') && !agent.connected) {
      window.location.href = connectIntegrationUrl(agent.id);
      return;
    }

    if (agent.auth === 'user_api_key' && !agent.connected) {
      setApiKeyDraft('');
      setApiKeyModalAgent({ id: agent.id, name: agent.name });
      return;
    }

    if (
      (agent.auth === 'oauth_dcr' || agent.auth === 'oauth_static' || agent.auth === 'user_api_key') &&
      agent.connected &&
      (e.domEvent.altKey || e.domEvent.shiftKey)
    ) {
      void disconnectIntegration(agent.id).then(() => {
        if (selectedAgentIds.includes(agent.id)) toggleAgent(agent.id);
        return refreshAgents();
      }).then(() => antMessage.info(`${agent.name} disconnected`));
      setAgentMenuOpen(true);
      return;
    }

    toggleAgent(e.key);
    setAgentMenuOpen(true);
  };

  const saveApiKey = useCallback(async () => {
    if (!apiKeyModalAgent) return;
    setApiKeySaving(true);
    try {
      await saveIntegrationApiKey(apiKeyModalAgent.id, apiKeyDraft);
      antMessage.success(`${apiKeyModalAgent.name} connected`);
      setApiKeyModalAgent(null);
      setApiKeyDraft('');
      await refreshAgents();
      if (!selectedAgentIds.includes(apiKeyModalAgent.id)) {
        toggleAgent(apiKeyModalAgent.id);
      }
    } catch (err) {
      antMessage.error(err instanceof Error ? err.message : 'Failed to save key');
    } finally {
      setApiKeySaving(false);
    }
  }, [apiKeyDraft, apiKeyModalAgent, refreshAgents, selectedAgentIds, toggleAgent]);

  const agentButtonLabel =
    selectedAgentIds.length === 0
      ? 'Agents'
      : selectedAgentIds.length === 1
        ? availableAgents.find((a) => a.id === selectedAgentIds[0])?.name || '1 agent'
        : `${selectedAgentIds.length} agents`;

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
                      open={agentMenuOpen}
                      onOpenChange={setAgentMenuOpen}
                      menu={{
                        items: agentMenuItems,
                        selectable: true,
                        multiple: true,
                        selectedKeys: selectedAgentIds,
                        onClick: handleAgentMenuClick,
                      }}
                      trigger={['click']}
                    >
                      <Button
                        type="text"
                        icon={<RobotOutlined />}
                        style={{
                          color: selectedAgentIds.length
                            ? 'var(--color-primary)'
                            : 'var(--color-text-secondary)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <span style={{ fontSize: 13 }}>{agentButtonLabel}</span>
                      </Button>
                    </Dropdown>

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

      <Modal
        title={apiKeyModalAgent ? `Connect ${apiKeyModalAgent.name}` : 'API key'}
        open={Boolean(apiKeyModalAgent)}
        onCancel={() => { setApiKeyModalAgent(null); setApiKeyDraft(''); }}
        onOk={() => void saveApiKey()}
        confirmLoading={apiKeySaving}
        okText="Save"
        okButtonProps={{ disabled: !apiKeyDraft.trim() }}
      >
        <p style={{ color: 'var(--color-text-secondary)', marginBottom: 12 }}>
          Paste a personal API key. It is stored encrypted for your account only.
        </p>
        <Input.Password
          value={apiKeyDraft}
          onChange={(e) => setApiKeyDraft(e.target.value)}
          placeholder="API key"
          onPressEnter={() => void saveApiKey()}
        />
      </Modal>
    </Layout>
  );
};

export default ChatPage;
