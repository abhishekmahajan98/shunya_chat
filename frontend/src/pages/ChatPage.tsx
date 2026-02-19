import { useState, useRef, useEffect, useMemo } from 'react';
import type { MenuProps } from 'antd';
import { Layout, Input, Button, Dropdown, Grid, Drawer, Popover, Tooltip, Divider, message as antMessage } from 'antd';
import {
  SendOutlined,
  PaperClipOutlined,
  MenuOutlined,
  SwapOutlined,
  SunOutlined,
  MoonOutlined,
  FolderOutlined,
  FileTextOutlined,
  CloseOutlined,
  ClockCircleOutlined,
  RobotOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { useTheme } from '../context/ThemeContext';
import { useChat, type Attachment } from '../context/ChatContext';
import { VerticalNav } from '../components/VerticalNav';
import { SpacesPanel } from '../components/SpacesPanel';
import { AgentsPanel } from '../components/AgentsPanel';
import MessageRenderer from '../components/MessageRenderer';
import ScopeSelector from '../components/ScopeSelector';
import { streamMessage, type AgentStreamChunk, uploadFile } from '../api';
import { useNavigate } from 'react-router-dom';

const { Content } = Layout;
const { useBreakpoint } = Grid;


// No longer hardcoded - fetched from API

const ChatPage = () => {
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const {
    messages,
    addMessage,
    updateMessage,
    selectedScope,
    activeAgents,
    backgroundTasks,
    conversationId,
    setConversationId,
    clearMessages,
  } = useChat();

  const [inputValue, setInputValue] = useState('');
  const [inputFocused, setInputFocused] = useState(false);
  const [mobileNavVisible, setMobileNavVisible] = useState(false);

  // Refs
  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // States
  const [modelOptions, setModelOptions] = useState<{ id: string, name: string, detail: string }[]>([]);
  const [selectedModel, setSelectedModel] = useState<{ id: string, name: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  // Breakpoint for mobile/tablet
  const screens = useBreakpoint();
  const isTablet = !screens.lg;

  const handleNewChat = () => {
    clearMessages();
    setConversationId(null);
    navigate('/');
  };

  // Fetch models from backend on mount
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
            size: result.size
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

  // Auto-scroll to bottom of messages
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

  const handleViewDemo = () => {
    setIsLoading(true);

    // 1. Rich Text
    addMessage({ type: 'sync', sender: 'user', content: 'Show me what you can render!' });
    addMessage({
      type: 'sync',
      sender: 'assistant',
      content: `I'd love to! I support **bold**, *italic*, ~~strikethrough~~, and \`inline code\`.\n\n> **Blockquotes** are great for emphasizing key points.\n> They can even be nested!`
    });

    // 2. Code
    addMessage({ type: 'sync', sender: 'user', content: 'Can you handle code snippets?' });
    addMessage({
      type: 'sync',
      sender: 'assistant',
      content: `Absolutely. Here's some **Python** with syntax highlighting:\n\n\`\`\`python\ndef fibonacci(n):\n    if n <= 1:\n        return n\n    return fibonacci(n-1) + fibonacci(n-2)\n\nprint(fibonacci(10))\n\`\`\``
    });

    // 3. Math
    addMessage({ type: 'sync', sender: 'user', content: 'What about math equations?' });
    addMessage({
      type: 'sync',
      sender: 'assistant',
      content: `I speak $\\LaTeX$ fluently!\n\n**Inline:** The energy-mass equivalence is $E=mc^2$.\n\n**Block:**\n$$\nf(x) = \\int_{-\\infty}^{\\infty} \\hat f(\\xi)\\,e^{2\\pi i \\xi x} \\,d\\xi\n$$`
    });

    // 4. Tables
    addMessage({ type: 'sync', sender: 'user', content: 'Can you make tables I can export?' });
    addMessage({
      type: 'sync',
      sender: 'assistant',
      content: `Yes! Tables come with a **CSV Export** button automatically.\n\n| ID | Name | Role | Status |\n|----|------|------|--------|\n| 001 | Alice | Admin | Active |\n| 002 | Bob | User | Offline |`
    });

    // 5. Diagrams
    addMessage({ type: 'sync', sender: 'user', content: 'Do you do diagrams?' });
    addMessage({
      type: 'sync',
      sender: 'assistant',
      content: `I can generate dynamic diagrams using Mermaid.\n\n\`\`\`mermaid\ngraph LR\n    A[Start] --> B{success?}\n    B -- Yes --> C[Great!]\n    B -- No --> D[Retry]\n    D --> B\n\`\`\``
    });

    // 6. Thinking
    addMessage({ type: 'sync', sender: 'user', content: 'And your reasoning process?' });
    addMessage({
      type: 'reasoning',
      sender: 'assistant',
      content: 'I can show my internal thought process like this, collapsible above the message.',
      reasoning: {
        steps: [
          { id: '1', text: 'Analyzing user request for capabilities demonstration...', status: 'complete' },
          { id: '2', text: 'Generating comprehensive showcase including markdown, math, code, and diagrams.', status: 'complete' },
          { id: '3', text: 'Verifying rendering pipeline for all components.', status: 'complete' }
        ],
        isExpanded: true
      }
    });

    setIsLoading(false);
  };


  const handleSend = async () => {
    if ((!inputValue.trim() && attachments.length === 0) || isLoading || isUploading) return;

    const userInput = inputValue;
    const currentAttachments = [...attachments]; // Capture current attachments
    setInputValue('');
    setAttachments([]); // Clear attachments immediately
    setIsLoading(true);


    // Add user message to UI
    addMessage({
      type: 'sync',
      sender: 'user',
      content: userInput,
      attachments: currentAttachments.length > 0 ? currentAttachments : undefined
    });

    // Create placeholder for assistant response with pending state (loader)
    const assistantMsgId = addMessage({
      type: 'sync',
      sender: 'assistant',
      content: '',
      pending: true,
    });

    let thinkingContent = '';
    let textContent = '';
    const collectedAgents: string[] = [];
    interface LocalReasoningStep { id: string; text: string; status: 'pending' | 'running' | 'complete' | 'failed' }
    const collectedSteps: LocalReasoningStep[] = [];

    if (!selectedModel) return;

    try {
      await streamMessage(
        selectedModel.id,
        userInput,
        (chunk: AgentStreamChunk) => {
          if (chunk.type === 'meta' && chunk.conversation_id) {
            setConversationId(chunk.conversation_id);
          } else if (chunk.type === 'status') {
            const stepId = 'system-planning';
            const stepText = chunk.content || 'Processing...';

            const existingStepIndex = collectedSteps.findIndex(s => s.id === stepId);
            if (existingStepIndex >= 0) {
              collectedSteps[existingStepIndex] = { ...collectedSteps[existingStepIndex], text: stepText, status: 'running' };
            } else {
              collectedSteps.unshift({ id: stepId, text: stepText, status: 'running' });
            }

            updateMessage(assistantMsgId, {
              type: 'reasoning',
              reasoning: { steps: [...collectedSteps], isExpanded: true }
            });

          } else if (chunk.type === 'plan_created') {
            const plan = chunk.plan || [];

            const sysIdx = collectedSteps.findIndex(s => s.id === 'system-planning');
            if (sysIdx >= 0) {
              collectedSteps[sysIdx] = { ...collectedSteps[sysIdx], status: 'complete', text: 'Plan created' };
            }

            plan.forEach(step => {
              const agentId = step.agent;
              const stepId = step.id || `agent-${agentId}`;
              const stepText = `${agentId}: ${step.goal}`;

              if (!collectedSteps.find(s => s.id === stepId)) {
                collectedSteps.push({
                  id: stepId,
                  text: stepText,
                  status: 'pending'
                });
              }
            });

            updateMessage(assistantMsgId, {
              type: 'reasoning',
              pending: false,
              reasoning: { steps: [...collectedSteps], isExpanded: true }
            });

          } else if (chunk.type === 'tool_start') {
            const toolId = `tool-${chunk.tool_run_id}`;
            const toolName = chunk.tool_name || chunk.name || 'Tool';
            const inputVal = chunk.input || '';
            const toolText = `Using ${toolName}: ${inputVal}`;

            const newToolStep: LocalReasoningStep = {
              id: toolId,
              text: toolText,
              status: 'running'
            };

            let parentIdx = -1;
            if (chunk.parent_id) {
              parentIdx = collectedSteps.findIndex(s => s.id === chunk.parent_id);
            }
            if (parentIdx === -1) {
              parentIdx = collectedSteps.findIndex(s => s.status === 'running' && !s.id.startsWith('tool-'));
            }

            if (parentIdx >= 0) {
              let insertIdx = parentIdx + 1;
              while (insertIdx < collectedSteps.length && collectedSteps[insertIdx].id.startsWith('tool-')) {
                insertIdx++;
              }
              collectedSteps.splice(insertIdx, 0, newToolStep);
            } else {
              collectedSteps.push(newToolStep);
            }

            updateMessage(assistantMsgId, {
              type: 'reasoning',
              reasoning: { steps: [...collectedSteps], isExpanded: true }
            });

          } else if (chunk.type === 'tool_end') {
            const toolId = `tool-${chunk.tool_run_id}`;
            const toolIdx = collectedSteps.findIndex(s => s.id === toolId);

            if (toolIdx >= 0) {
              const currentText = collectedSteps[toolIdx].text;
              const output = chunk.output;
              const newText = output ? `${currentText} \n-> ${output}` : currentText;

              collectedSteps[toolIdx] = {
                ...collectedSteps[toolIdx],
                status: 'complete',
                text: newText
              };

              updateMessage(assistantMsgId, {
                type: 'reasoning',
                reasoning: { steps: [...collectedSteps], isExpanded: true }
              });
            }

          } else if (chunk.type === 'tool_error') {
            const toolId = `tool-${chunk.tool_run_id}`;
            const toolIdx = collectedSteps.findIndex(s => s.id === toolId);

            if (toolIdx >= 0) {
              const currentText = collectedSteps[toolIdx].text;
              const error = chunk.error;
              const newText = error ? `${currentText} \n(Error: ${error})` : currentText;

              collectedSteps[toolIdx] = {
                ...collectedSteps[toolIdx],
                status: 'failed',
                text: newText
              };

              updateMessage(assistantMsgId, {
                type: 'reasoning',
                reasoning: { steps: [...collectedSteps], isExpanded: true }
              });
            }

          } else if (chunk.type === 'agent_status') {
            const agentName = chunk.name || chunk.agent || '';
            const goal = chunk.goal || '';
            const planStepId = chunk.id || `agent-${chunk.agent}`;
            const status = chunk.status as 'pending' | 'running' | 'complete' | 'failed';

            if (chunk.agent && !collectedAgents.includes(chunk.agent)) {
              collectedAgents.push(chunk.agent);
            }

            const stepText = goal ? `${agentName}: ${goal}` : `${agentName} working...`;
            const existingStepIndex = collectedSteps.findIndex(s => s.id === planStepId);

            if (existingStepIndex >= 0) {
              collectedSteps[existingStepIndex] = {
                ...collectedSteps[existingStepIndex],
                status: status,
                text: goal ? stepText : collectedSteps[existingStepIndex].text
              };
            } else {
              collectedSteps.push({
                id: planStepId,
                text: stepText,
                status: status === 'pending' ? 'pending' : 'running'
              });
            }

            updateMessage(assistantMsgId, {
              agents: collectedAgents,
              pending: false,
              type: 'reasoning',
              reasoning: {
                steps: [...collectedSteps],
                isExpanded: true
              }
            });

          } else if (chunk.type === 'agent_result') {
            const stepId = chunk.id || `agent-${chunk.agent}`;
            const existingStepIndex = collectedSteps.findIndex(s => s.id === stepId);

            if (existingStepIndex >= 0) {
              collectedSteps[existingStepIndex] = {
                ...collectedSteps[existingStepIndex],
                status: 'complete',
                text: collectedSteps[existingStepIndex].text + (chunk.data ? ' ✓' : '')
              };
            }

            updateMessage(assistantMsgId, {
              pending: false,
              reasoning: {
                steps: [...collectedSteps],
                isExpanded: true
              }
            });

          } else if (chunk.type === 'thinking') {
            thinkingContent += chunk.content || '';
            updateMessage(assistantMsgId, {
              pending: false,
              type: 'reasoning',
              reasoning: {
                steps: [...collectedSteps, { id: 'thinking', text: thinkingContent, status: 'running' }],
                isExpanded: true
              },
            });
          } else if (chunk.type === 'text') {
            textContent += chunk.content || '';
            updateMessage(assistantMsgId, {
              pending: false,
              content: textContent,
              reasoning: (thinkingContent || collectedSteps.length > 0) ? {
                steps: [...collectedSteps, ...(thinkingContent ? [{ id: 'thinking', text: thinkingContent, status: 'complete' as const }] : [])],
                isExpanded: false
              } : undefined,
            });
          } else if (chunk.type === 'done') {
            updateMessage(assistantMsgId, {
              pending: false,
              type: (thinkingContent || collectedSteps.length > 0) ? 'reasoning' : 'sync',
              content: textContent,
              agents: collectedAgents.length > 0 ? collectedAgents : undefined,
              reasoning: (thinkingContent || collectedSteps.length > 0) ? {
                steps: [...collectedSteps, ...(thinkingContent ? [{ id: 'thinking', text: thinkingContent, status: 'complete' as const }] : [])],
                isExpanded: false
              } : undefined,
            });
          } else if (chunk.type === 'citations') {
            const newCitations = chunk.citations || [];
            updateMessage(assistantMsgId, (prevValue: any) => {
              const existingCitations = prevValue?.citations || [];
              const uniqueNewCitations = newCitations.filter(
                (newCit: any) => !existingCitations.some((oldCit: any) => oldCit.url === newCit.url)
              );
              return {
                citations: [...existingCitations, ...uniqueNewCitations]
              };
            });
          }
          else if (chunk.type === 'error') {
            updateMessage(assistantMsgId, {
              type: 'sync',
              content: `Error: ${chunk.content}`,
            });
          }
        },
        conversationId || undefined,
        activeAgents.map(a => a.id),
        currentAttachments.length > 0 ? currentAttachments : undefined,
        selectedScope?.spaceId ? [selectedScope.spaceId] : undefined,
        selectedScope?.selectedItems.map(i => i.id)
      );
    } catch (error) {
      console.error('Failed to stream message:', error);
      antMessage.error(error instanceof Error ? error.message : 'Failed to stream message');
      updateMessage(assistantMsgId, {
        type: 'sync',
        content: 'Sorry, I encountered an error. Please check your API keys and try again.',
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

  // Scope hover details
  const scopeTooltipContent = useMemo(() => {
    if (!selectedScope) return null;
    const selectedDocuments = selectedScope.selectedItems.filter(i => i.type === 'document');

    return (
      <div style={{ padding: '4px 8px' }}>
        <div style={{ fontWeight: 600, marginBottom: 4, opacity: 0.8, fontSize: 12 }}>
          Space: {selectedScope.spaceName}
        </div>
        {selectedScope.selectedItems.length === 0 ? (
          <div style={{ fontSize: 11 }}>All contents selected</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {selectedDocuments.slice(0, 10).map(item => (
              <div key={item.id} style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 6 }}>
                <FileTextOutlined style={{ fontSize: 10 }} />
                <span>{item.name}</span>
              </div>
            ))}
            {selectedDocuments.length > 10 && (
              <div style={{ fontSize: 10, opacity: 0.6, marginTop: 2 }}>
                + {selectedDocuments.length - 10} more documents...
              </div>
            )}
            {selectedDocuments.length === 0 && (
              <div style={{ fontSize: 11, opacity: 0.6 }}>No documents selected</div>
            )}
          </div>
        )}
      </div>
    );
  }, [selectedScope]);

  // Scope Popover Content
  const scopePopoverContent = useMemo(() => <ScopeSelector />, []);

  const selectedDocCount = useMemo(() =>
    selectedScope?.selectedItems.filter(i => i.type === 'document').length || 0
    , [selectedScope]);

  return (
    <Layout style={{ height: '100vh', background: 'var(--color-bg)', overflow: 'hidden', flexDirection: 'row' }}>
      {/* New Consolidated Vertical Navigation */}
      <VerticalNav />

      {/* Main Chat Area */}
      <Layout style={{
        background: 'var(--color-bg)',
        flex: 1,
        minWidth: 0,
        overflow: 'hidden',
      }}>
        {/* Mobile Header - Repurposed for mobile navigation if needed */}
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

        {/* Chat Content */}
        <Content style={{
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--color-bg)',
          overflow: 'hidden',
          flex: 1,
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
                marginBottom: 40,
                textAlign: 'center',
                maxWidth: 400,
              }}>
                Select a Space, enable Agents, and start collaborating.
              </p>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                justifyContent: 'center',
                width: '100%',
                maxWidth: 420
              }}>
                <button
                  onClick={handleViewDemo}
                  style={{
                    padding: '12px 20px',
                    borderRadius: 12,
                    border: '1px solid var(--color-primary)',
                    background: 'var(--color-surface)',
                    color: 'var(--color-primary)',
                    fontSize: 15,
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10,
                    marginBottom: 16,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.05)';
                  }}
                >
                  <span style={{ fontSize: 18 }}>🎨</span> See Capabilities Demo
                </button>

                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  margin: '8px 0',
                  color: 'var(--color-text-tertiary)',
                  fontSize: 12,
                  fontWeight: 500,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5
                }}>
                  <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }}></div>
                  <span>Or try an example</span>
                  <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }}></div>
                </div>

                {['🔍 Deep search competitor X', '📊 Analyze Q4 budget report', '📧 Draft weekly summary email', '💻 Debug Python script'].map((action, i) => (
                  <button
                    key={i}
                    onClick={() => setInputValue(action.split(' ').slice(1).join(' '))}
                    style={{
                      padding: '12px 16px',
                      borderRadius: 12,
                      border: '1px solid var(--color-border)',
                      background: 'var(--color-surface)',
                      color: 'var(--color-text)',
                      fontSize: 14,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      textAlign: 'left',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--color-primary)';
                      e.currentTarget.style.color = 'var(--color-primary)';
                      e.currentTarget.style.background = 'var(--color-surface-hover)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--color-border)';
                      e.currentTarget.style.color = 'var(--color-text)';
                      e.currentTarget.style.background = 'var(--color-surface)';
                    }}
                  >
                    <span style={{ fontSize: 16 }}>{action.split(' ')[0]}</span>
                    <span>{action.split(' ').slice(1).join(' ')}</span>
                  </button>
                ))}
              </div>
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
                {/* File Previews */}
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
                  placeholder={selectedScope
                    ? (selectedDocCount > 0
                      ? `Message ${selectedDocCount} selected documents in ${selectedScope.spaceName}...`
                      : `Message ${selectedScope.spaceName} (All contents)...`)
                    : 'Message Shunya Chat...'}
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

                    {/* Scope Pill */}
                    <Popover content={scopePopoverContent} trigger="click" placement="topLeft">
                      <Tooltip title={scopeTooltipContent} placement="top" mouseEnterDelay={0.5}>
                        <button
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '4px 10px',
                            borderRadius: 16,
                            border: '1px solid var(--color-border)',
                            background: selectedScope ? 'var(--color-primary-subtle)' : 'transparent',
                            color: selectedScope ? 'var(--color-primary)' : 'var(--color-text)',
                            fontSize: 13,
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            maxWidth: 160,
                          }}
                        >
                          <FolderOutlined style={{ fontSize: 12 }} />
                          <span style={{
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            maxWidth: 150
                          }}>
                            {selectedScope ? (
                              selectedScope.selectedItems.length === 0
                                ? `In Scope: ${selectedScope.spaceName} (All)`
                                : `In Scope: ${selectedDocCount} documents`
                            ) : 'Select Scope'}
                          </span>
                        </button>
                      </Tooltip>
                    </Popover>

                    {/* Active Agents Pill */}
                    <Tooltip title="Manage Agents" placement="top">
                      <button
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
                          cursor: 'default', // Managed through sidebar now
                          transition: 'all 0.2s ease',
                        }}
                      >
                        <RobotOutlined style={{ fontSize: 12 }} />
                        <span>{activeAgents.length > 0 ? `${activeAgents.length} Agents` : 'Agents'}</span>
                      </button>
                    </Tooltip>

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
      </Layout >

      {/* Mobile Sidebar - Replaced with a simple Drawer using functional panels if needed */}
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
          {/* Minimal mobile menu */}
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => { handleNewChat(); setMobileNavVisible(false); }}
            style={{ margin: 16 }}
          >
            New Chat
          </Button>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <SpacesPanel />
            <Divider />
            <AgentsPanel />
          </div>
        </div>
      </Drawer>
    </Layout >
  );
};

export default ChatPage;
