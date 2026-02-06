import { useState, useRef, useEffect } from 'react';
import type { MenuProps } from 'antd';
import { Layout, Input, Button, Dropdown, Grid, Drawer, Popover, List, message as antMessage } from 'antd';
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
import { useChat, type Attachment } from '../context/ChatContext';
import AppMenu from '../components/AppMenu';
import RightSidebar from '../components/RightSidebar';
import MessageRenderer from '../components/MessageRenderer';
import { streamMessage, type AgentStreamChunk, uploadFile } from '../api';

const { Sider, Content } = Layout;


// No longer hardcoded - fetched from API

const ChatPage = () => {
  const { theme, toggleTheme } = useTheme();
  const {
    messages,
    addMessage,
    updateMessage,
    selectedScope,
    setSelectedScope,
    activeAgents,
    backgroundTasks,
    conversationId,
    setConversationId,
  } = useChat();

  const [inputValue, setInputValue] = useState('');
  const [inputFocused, setInputFocused] = useState(false);
  const [leftDrawerVisible, setLeftDrawerVisible] = useState(false);
  const [rightDrawerVisible, setRightDrawerVisible] = useState(false);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightExpanded, setRightExpanded] = useState(false);

  const [modelOptions, setModelOptions] = useState<{ id: string, name: string, detail: string }[]>([]);
  const [selectedModel, setSelectedModel] = useState<{ id: string, name: string } | null>(null);

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
  const [isLoading, setIsLoading] = useState(false);

  // Attachments state
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const screens = Grid.useBreakpoint();
  const isTablet = !screens.lg;

  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    if (scrollRef.current) {
      const scrollContainer = scrollRef.current;

      // Use 'auto' (instant) scrolling if we are loading or streaming to prevent 
      // the "chunky" feel of smooth scrolling fighting with rapid updates
      const behavior = isLoading ? 'auto' : 'smooth';

      // Only scroll if we're near the bottom or it's a new message
      // A simple heuristic: always scroll for now, but use instant behavior for fluidity
      scrollContainer.scrollTo({
        top: scrollContainer.scrollHeight,
        behavior: behavior
      });
    }
  }, [messages, isLoading]);

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
      content: `I speak $\LaTeX$ fluently!\n\n**Inline:** The energy-mass equivalence is $E=mc^2$.\n\n**Block:**\n$$\nf(x) = \\int_{-\\infty}^{\\infty} \\hat f(\\xi)\\,e^{2\\pi i \\xi x} \\,d\\xi\n$$`
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
    // We don't assume reasoning yet - we'll upgrade the message type when thinking actually starts
    const assistantMsgId = addMessage({
      type: 'sync',
      sender: 'assistant',
      content: '',
      pending: true,
    });

    let thinkingContent = '';
    let textContent = '';
    // Track agents in a local variable (React state is async, causes stale closure)
    const collectedAgents: string[] = [];
    // Track reasoning steps locally due to closure
    // We define this interface locally to match ReasoningStep but without import issues if specific props differ
    interface LocalReasoningStep { id: string; text: string; status: 'pending' | 'running' | 'complete' }
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
            // General status update from Router/System
            const stepId = 'system-planning';
            const stepText = chunk.content || 'Processing...';

            const existingStepIndex = collectedSteps.findIndex(s => s.id === stepId);
            if (existingStepIndex >= 0) {
              collectedSteps[existingStepIndex] = { ...collectedSteps[existingStepIndex], text: stepText, status: 'running' };
            } else {
              // Insert at start
              collectedSteps.unshift({ id: stepId, text: stepText, status: 'running' });
            }

            updateMessage(assistantMsgId, {
              type: 'reasoning',
              reasoning: { steps: [...collectedSteps], isExpanded: true }
            });

          } else if (chunk.type === 'plan_created') {
            // Initialize agent steps based on plan
            const plan = chunk.plan || [];

            // Mark system planning as complete if it exists
            const sysIdx = collectedSteps.findIndex(s => s.id === 'system-planning');
            if (sysIdx >= 0) {
              collectedSteps[sysIdx] = { ...collectedSteps[sysIdx], status: 'complete', text: 'Plan created' };
            }

            plan.forEach(step => {
              const agentId = step.agent;
              // Use unique ID from backend if available, fallback to agent name
              const stepId = step.id || `agent-${agentId}`;
              // Try to find name from activeAgents or use ID
              // We don't have full agent info here easily unless we lookup.
              // chunk.plan objects might just have agent/goal.
              // We'll use ID/Goal for now.
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

          } else if (chunk.type === 'agent_status') {
            // Agent status update (Plan execution)
            const agentName = chunk.name || chunk.agent || '';
            const goal = chunk.goal || '';
            const status = chunk.status as 'pending' | 'running' | 'complete' | 'error';

            // Use unique ID from backend if available for plan steps
            const planStepId = chunk.id || `agent-${chunk.agent}`;
            const parentId = chunk.parent_id;

            // Check if this is a Tool Execution Event 
            const isToolEvent = !!parentId || goal.startsWith('Using ');
            const isToolComplete = goal === 'Tool execution finished';

            if (isToolEvent) {
              // Creates a new sub-step for the tool usage
              const toolStepId = `tool-${chunk.agent}-${Date.now()}`;
              const newToolStep = {
                id: toolStepId,
                text: goal,
                status: 'running' as const
              };

              if (parentId) {
                // Find parent index based on the ID assigned by the router
                const parentIdx = collectedSteps.findIndex(s => s.id === parentId);

                if (parentIdx >= 0) {
                  // Insert AFTER parent and its current children (other tools)
                  let insertIdx = parentIdx + 1;
                  while (insertIdx < collectedSteps.length && collectedSteps[insertIdx].id.startsWith('tool-')) {
                    insertIdx++;
                  }
                  collectedSteps.splice(insertIdx, 0, newToolStep);
                } else {
                  // Fallback to end if parent ID mapping fails
                  collectedSteps.push(newToolStep);
                }
              } else {
                // Legacy/fallback append
                collectedSteps.push(newToolStep);
              }

            } else if (isToolComplete) {
              // Determine which tool step to complete
              // Usually the latest running one for this agent
              for (let i = collectedSteps.length - 1; i >= 0; i--) {
                if (collectedSteps[i].id.startsWith('tool-') &&
                  collectedSteps[i].status === 'running' &&
                  collectedSteps[i].id.includes(`tool-${chunk.agent}`)) {
                  collectedSteps[i] = { ...collectedSteps[i], status: 'complete' };
                  break;
                }
              }
            } else {
              // Normal Agent Goal Update (Plan Step)
              if (chunk.agent && !collectedAgents.includes(chunk.agent)) {
                collectedAgents.push(chunk.agent);
              }

              const stepText = goal ? `${agentName}: ${goal}` : `${agentName} working...`;
              const existingStepIndex = collectedSteps.findIndex(s => s.id === planStepId);

              if (existingStepIndex >= 0) {
                // Update existing step by its unique ID
                collectedSteps[existingStepIndex] = {
                  ...collectedSteps[existingStepIndex],
                  status: status === 'pending' ? 'pending' : (status === 'complete' ? 'complete' : 'running'),
                  // Only update text for high-level goal updates
                  text: (goal && !isToolEvent && !isToolComplete) ? stepText : collectedSteps[existingStepIndex].text
                };
              } else {
                // New step (e.g. if we missed plan_created)
                collectedSteps.push({
                  id: planStepId,
                  text: stepText,
                  status: status === 'pending' ? 'pending' : 'running'
                });
              }
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
            // Agent completed step
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
              pending: false, // Stop loader
              type: 'reasoning',
              reasoning: {
                // Focus on thinking content as requested by user
                steps: [...collectedSteps, { id: 'thinking', text: thinkingContent, status: 'running' }],
                isExpanded: true
              },
            });
          } else if (chunk.type === 'text') {
            textContent += chunk.content || '';
            // Transition to content display and clear pending
            updateMessage(assistantMsgId, {
              pending: false, // Stop loader
              content: textContent,
              reasoning: (thinkingContent || collectedSteps.length > 0) ? {
                steps: [...collectedSteps, ...(thinkingContent ? [{ id: 'thinking', text: thinkingContent, status: 'complete' as const }] : [])],
                isExpanded: false // Collapse when text arrives
              } : undefined,
            });
          } else if (chunk.type === 'done') {
            // Use local collectedAgents
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
            updateMessage(assistantMsgId, {
              citations: chunk.citations
            });
          } else if (chunk.type === 'error') {
            updateMessage(assistantMsgId, {
              type: 'sync',
              content: `Error: ${chunk.content}`,
            });
          }
        },
        conversationId || undefined,
        activeAgents.map(a => a.id),  // Pass active agent IDs from UI
        currentAttachments.length > 0 ? currentAttachments : undefined
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
    <Layout style={{ height: '100vh', background: 'var(--color-bg)', overflow: 'hidden' }}>
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
      <Layout style={{
        background: 'var(--color-bg)',
        transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        // When right is expanded, collapse this area completely
        flex: rightExpanded ? '0 0 0' : 1,
        width: rightExpanded ? 0 : 'auto',
        minWidth: 0,
        overflow: 'hidden',
        opacity: rightExpanded ? 0 : 1,
        pointerEvents: rightExpanded ? 'none' : 'auto',
      }}>
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
              overflowY: 'auto', // Allow scrolling if empty state content is too tall
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
                {/* View Demo Button - Primary Call to Action */}
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
                height: '0px', // Hack to force flex container to respect parent height
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

      {/* Right Sidebar - Agent Marketplace */}
      {
        isTablet ? (
          <Drawer
            title="Agents"
            placement="right"
            closable
            onClose={() => setRightDrawerVisible(false)}
            open={rightDrawerVisible}
            styles={{
              wrapper: { width: 280 },
              body: { padding: 0, background: 'var(--color-sidebar)' },
              header: { background: 'var(--color-sidebar)', borderBottom: '1px solid var(--color-border)' },
            }}
          >
            <RightSidebar isTablet={true} />
          </Drawer>
        ) : rightExpanded ? (
          <div style={{
            ...rightSiderStyle,
            flex: 1,
            width: 'auto',
            minWidth: 0,
            transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}>
            <RightSidebar
              isTablet={false}
              expanded={rightExpanded}
              onToggleExpand={() => setRightExpanded(!rightExpanded)}
            />
          </div>
        ) : (
          <Sider
            width={280}
            style={{
              ...rightSiderStyle,
              transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
            trigger={null}
          >
            <RightSidebar
              isTablet={false}
              expanded={rightExpanded}
              onToggleExpand={() => setRightExpanded(!rightExpanded)}
            />
          </Sider>
        )
      }
    </Layout >
  );
};

export default ChatPage;
