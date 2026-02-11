import { useState, useEffect, memo } from 'react';
import { DownOutlined, UpOutlined, CheckCircleFilled, LoadingOutlined, FileTextOutlined, BulbOutlined, CopyOutlined, CheckOutlined, CloseCircleOutlined } from '@ant-design/icons';
import type { Message, Citation, ReasoningStep } from '../context/ChatContext';
import AIResponse from './AIResponse';
import { InnovationLoader } from './InnovationLoader';

interface MessageRendererProps {
    message: Message;
}



// Progress Bar Component
const ProgressBar = ({ progress }: { progress: number }) => (
    <div style={{
        width: '100%',
        height: 4,
        borderRadius: 2,
        background: 'var(--color-border)',
        overflow: 'hidden',
        marginTop: 8,
    }}>
        <div
            style={{
                width: `${progress}%`,
                height: '100%',
                background: 'var(--color-primary)',
                transition: 'width 0.3s ease',
            }}
        />
    </div>
);

// Agent Badge Component - displays agent name with subtle styling
const AgentBadge = ({ agentId }: { agentId: string }) => {
    return (
        <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '2px 8px',
            borderRadius: 4,
            background: 'rgba(139, 92, 246, 0.1)',
            color: 'var(--color-text-secondary)',
            fontSize: 11,
            fontWeight: 500,
            border: '1px solid rgba(139, 92, 246, 0.2)',
        }}>
            {agentId}
        </span>
    );
};

// Copy Button Component
const CopyButton = ({ text, color }: { text: string, color?: string }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <button
            onClick={handleCopy}
            className="copy-btn"
            style={{
                background: 'transparent',
                border: 'none',
                color: copied ? (color || 'var(--color-text)') : (color || 'var(--color-text-secondary)'),
                cursor: copied ? 'default' : 'pointer',
                padding: '4px 8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s',
                opacity: copied ? 1 : 0.6,
                borderRadius: 4,
            }}
            onMouseEnter={(e) => {
                if (!copied) {
                    e.currentTarget.style.opacity = '1';
                    e.currentTarget.style.color = color || 'var(--color-primary)';
                    e.currentTarget.style.background = 'var(--color-surface-hover)';
                }
            }}
            onMouseLeave={(e) => {
                if (!copied) {
                    e.currentTarget.style.opacity = '0.6';
                    e.currentTarget.style.color = color || 'var(--color-text-secondary)';
                    e.currentTarget.style.background = 'transparent';
                }
            }}
            title="Copy response"
        >
            {copied ? (
                <span style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500 }}>
                    <CheckOutlined style={{ color: color || 'var(--color-primary)' }} />
                </span>
            ) : (
                <CopyOutlined />
            )}
        </button>
    );
};

// Unified Reasoning Display - Merges agent logs and thinking process
const UnifiedReasoningDisplay = ({
    steps,
    isExpanded,
    onToggle,
    isThinking
}: {
    steps: ReasoningStep[];
    isExpanded: boolean;
    onToggle: () => void;
    isThinking: boolean;
}) => {
    const thinkingStep = steps.find(s => s.id === 'thinking') || steps.find(s => s.id === '1');
    const agentSteps = steps.filter(s => s.id !== 'thinking' && s.id !== '1');
    const isAgentic = agentSteps.length > 0;

    if (agentSteps.length === 0 && (!thinkingStep || !thinkingStep.text)) return null;

    return (
        <div style={{ marginBottom: 12 }}>
            {/* Unified Toggle Header */}
            <button
                onClick={onToggle}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    background: 'none',
                    border: 'none',
                    padding: '4px 0',
                    cursor: 'pointer',
                    color: 'var(--color-primary)',
                    fontSize: 13,
                    fontWeight: 500,
                }}
            >
                {isThinking ? (
                    <LoadingOutlined style={{ fontSize: 12 }} />
                ) : isAgentic ? (
                    <BulbOutlined style={{ fontSize: 12 }} />
                ) : (
                    <BulbOutlined style={{ fontSize: 12 }} />
                )}
                <span>
                    {isThinking ? (isAgentic ? 'Agentic Reasoning...' : 'Thinking...') : (isAgentic ? 'Agentic Reasoning' : 'Thought process')}
                </span>
                {isExpanded ? (
                    <UpOutlined style={{ fontSize: 10, opacity: 0.6 }} />
                ) : (
                    <DownOutlined style={{ fontSize: 10, opacity: 0.6 }} />
                )}
            </button>

            {/* Content (Logs + Thought Text) */}
            {isExpanded && (
                <div style={{
                    paddingTop: 4,
                    marginTop: 4,
                }}>
                    {/* Agent Logs section */}
                    {agentSteps.length > 0 && (
                        <div style={{
                            paddingLeft: 12,
                            borderLeft: '1px solid var(--color-border)',
                            marginLeft: 6,
                            marginBottom: thinkingStep?.text ? 16 : 0
                        }}>
                            <div style={{
                                fontSize: 10,
                                fontWeight: 600,
                                color: 'var(--color-text-tertiary)',
                                textTransform: 'uppercase',
                                marginBottom: 8,
                                letterSpacing: '0.5px',
                                opacity: 0.8
                            }}>
                                Execution Steps
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {agentSteps.map((step) => {
                                    const isTool = step.id.startsWith('tool-');
                                    const displayText = isTool
                                        ? step.text.replace(/{'query':\s*'([^']+)'}/, '"$1"').replace(/{'query':\s*"([^"]+)"}/, '"$1"')
                                        : step.text;

                                    return (
                                        <div key={step.id} style={{
                                            display: 'flex',
                                            alignItems: 'flex-start',
                                            gap: 8,
                                            fontSize: 12,
                                            paddingLeft: isTool ? 16 : 0,
                                            position: 'relative'
                                        }}>
                                            {isTool && (
                                                <div style={{
                                                    position: 'absolute',
                                                    left: 4,
                                                    top: -8,
                                                    bottom: 10,
                                                    width: 8,
                                                    borderLeft: '1px solid var(--color-border)',
                                                    borderBottom: '1px solid var(--color-border)',
                                                    borderBottomLeftRadius: 4
                                                }} />
                                            )}
                                            <div style={{ marginTop: 2, zIndex: 1, background: 'var(--color-bg)' }}>
                                                {step.status === 'running' ? (
                                                    <LoadingOutlined style={{ color: 'var(--color-primary)', fontSize: 10 }} />
                                                ) : step.status === 'complete' ? (
                                                    <CheckOutlined style={{ color: '#52c41a', fontSize: 10 }} />
                                                ) : step.status === 'failed' ? (
                                                    <CloseCircleOutlined style={{ color: '#ff4d4f', fontSize: 10 }} />
                                                ) : (
                                                    <div style={{ width: 8, height: 8, borderRadius: '50%', border: '1px solid var(--color-border)' }} />
                                                )}
                                            </div>
                                            <span style={{
                                                color: step.status === 'pending' ? 'var(--color-text-tertiary)' : (step.status === 'failed' ? '#ff4d4f' : 'var(--color-text-secondary)'),
                                                opacity: step.status === 'pending' ? 0.7 : 1,
                                            }}>
                                                {displayText}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Final Thinking Text section */}
                    {thinkingStep?.text && (
                        <div style={{
                            paddingLeft: 12,
                            marginLeft: 6,
                            borderLeft: isAgentic ? 'none' : '1px solid var(--color-border)',
                            marginTop: isAgentic ? 12 : 0,
                        }}>
                            {isAgentic && (
                                <div style={{
                                    fontSize: 10,
                                    fontWeight: 600,
                                    color: 'var(--color-text-tertiary)',
                                    textTransform: 'uppercase',
                                    marginBottom: 8,
                                    letterSpacing: '0.5px',
                                    opacity: 0.8,
                                    paddingTop: 12,
                                    borderTop: '1px solid var(--color-border-subtle)'
                                }}>
                                    Synthesized Reasoning
                                </div>
                            )}
                            <div style={{
                                fontSize: 13,
                                color: 'var(--color-text-secondary)',
                                fontStyle: isAgentic ? 'normal' : 'italic'
                            }}>
                                <AIResponse content={thinkingStep.text} compact={true} />
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// Attachment Grid Component
const AttachmentGrid = ({ attachments }: { attachments: Message['attachments'] }) => {
    if (!attachments || attachments.length === 0) return null;

    return (
        <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
            marginBottom: 8,
        }}>
            {attachments.map(att => (
                <div key={att.id} style={{
                    width: 120,
                    height: 120,
                    borderRadius: 8,
                    overflow: 'hidden',
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-bg)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                }}>
                    {att.type.startsWith('image/') ? (
                        <img
                            src={att.url}
                            alt={att.name}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            onClick={() => window.open(att.url, '_blank')}
                            title="Click to view full size"
                        />
                    ) : (
                        <a href={att.url} target="_blank" rel="noopener noreferrer" style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            textDecoration: 'none',
                            color: 'var(--color-text)',
                            padding: 8,
                            textAlign: 'center'
                        }}>
                            <FileTextOutlined style={{ fontSize: 24, marginBottom: 4, color: 'var(--color-text-secondary)' }} />
                            <span style={{ fontSize: 11, wordBreak: 'break-word', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                {att.name}
                            </span>
                        </a>
                    )}
                </div>
            ))}
        </div>
    );
};

// Citations Display Component
const CitationsDisplay = ({ citations }: { citations: Citation[] }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    if (!citations || citations.length === 0) return null;

    return (
        <div style={{ marginTop: 8, borderTop: '1px solid var(--color-border)', paddingTop: 8 }}>
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    background: 'none',
                    border: 'none',
                    padding: '4px 0',
                    cursor: 'pointer',
                    color: 'var(--color-text-secondary)',
                    fontSize: 12,
                    fontWeight: 500,
                    width: '100%',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
                    <FileTextOutlined style={{ fontSize: 12 }} />
                    <span>{citations.length} Sources</span>
                </div>
                {isExpanded ? (
                    <UpOutlined style={{ fontSize: 10, opacity: 0.6 }} />
                ) : (
                    <DownOutlined style={{ fontSize: 10, opacity: 0.6 }} />
                )}
            </button>

            {isExpanded && (
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                    marginTop: 8,
                    paddingLeft: 4,
                }}>
                    {citations.map((citation, index) => (
                        <div key={index} style={{ display: 'flex', gap: 8, fontSize: 12 }}>
                            <span style={{
                                color: 'var(--color-text-secondary)',
                                minWidth: 20,
                            }}>[{citation.id}]</span>
                            <a
                                href={citation.title}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                    color: 'var(--color-primary)',
                                    textDecoration: 'none',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                }}
                            >
                                {citation.title}
                            </a>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const MessageRenderer = memo(({ message }: MessageRendererProps) => {
    const isUser = message.sender === 'user';

    // Determine if thinking is active (running status)
    const isThinking = message.reasoning?.steps?.some(s => s.status === 'running') || false;

    // Auto-manage expand state:
    // - Expand when thinking is happening
    // - Collapse when text starts coming in (thinking done)
    const [isReasoningExpanded, setIsReasoningExpanded] = useState(
        message.reasoning?.isExpanded ?? isThinking
    );

    // Auto-collapse when thinking completes and text arrives
    useEffect(() => {
        if (message.reasoning) {
            const hasContent = Boolean(message.content);
            const thinkingDone = message.reasoning.steps?.every(s => s.status === 'complete');

            if (isThinking) {
                // Auto-expand while thinking
                setIsReasoningExpanded(true);
            } else if (thinkingDone && hasContent) {
                // Auto-collapse when results arrive
                setIsReasoningExpanded(false);
            }
        }
    }, [isThinking, message.content, message.reasoning]);

    // Typing indicator
    if (message.pending) {
        return (
            <div style={{
                display: 'flex',
                justifyContent: 'flex-start',
                marginBottom: 20,
                paddingLeft: 12, // Align with typical message start
            }}>
                <InnovationLoader />
            </div>
        );
    }

    // Async Task Message
    if (message.type === 'async-task' && message.task) {
        const { task } = message;
        const isComplete = task.status === 'complete';
        const isFailed = task.status === 'failed';

        return (
            <div style={{
                display: 'flex',
                justifyContent: 'flex-start',
                marginBottom: 12,
            }}>
                <div style={{
                    maxWidth: '75%',
                    padding: '12px 16px',
                    borderRadius: '16px 16px 16px 4px',
                    background: 'var(--color-msg-ai)',
                    color: 'var(--color-msg-ai-text)',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {isComplete && <CheckCircleFilled style={{ color: '#52c41a' }} />}
                        {isFailed && <span style={{ color: '#ff4d4f' }}>❌</span>}
                        {!isComplete && !isFailed && <LoadingOutlined style={{ color: 'var(--color-primary)' }} />}
                        <span style={{ fontWeight: 500 }}>{task.label}</span>
                    </div>
                    {!isComplete && !isFailed && <ProgressBar progress={task.progress} />}
                    {message.content && (
                        <div style={{ marginTop: 8, fontSize: 14 }}>{message.content}</div>
                    )}
                </div>
            </div>
        );
    }

    // Reasoning/Thinking Message - Thinking ABOVE the bubble
    if (message.type === 'reasoning' && message.reasoning) {
        return (
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                marginBottom: 12,
                maxWidth: '75%',
            }}>
                {/* Unified Reasoning (Agent logs + Thinking) */}
                <UnifiedReasoningDisplay
                    steps={message.reasoning.steps}
                    isExpanded={isReasoningExpanded}
                    onToggle={() => setIsReasoningExpanded(!isReasoningExpanded)}
                    isThinking={isThinking}
                />

                {/* Message bubble - only show if there's content */}
                {message.content && (
                    <div style={{
                        padding: '12px 16px',
                        borderRadius: '16px 16px 16px 4px',
                        background: 'var(--color-msg-ai)',
                        color: 'var(--color-msg-ai-text)',
                        width: '100%',
                    }}>
                        <AttachmentGrid attachments={message.attachments} />

                        {/* Main content - with markdown rendering */}
                        <AIResponse content={message.content} />

                        {/* Footer: Agent tags & Copy Button */}
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginTop: 8,
                            gap: 8,
                        }}>
                            {/* Left: Agent tags */}
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                                {message.agents && message.agents.length > 0 && (
                                    <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>Agents used:</span>
                                )}
                                {message.agents && message.agents.map((agentId) => (
                                    <AgentBadge key={agentId} agentId={agentId} />
                                ))}
                            </div>
                            {/* Right: Copy Button */}
                            <CopyButton text={message.content} />
                        </div>
                        {message.citations && <CitationsDisplay citations={message.citations} />}
                    </div>
                )}
            </div>
        );
    }

    // Standard Sync Message (default)
    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: isUser ? 'flex-end' : 'flex-start',
            marginBottom: 12,
        }}>
            <div style={{
                maxWidth: '75%',
                padding: '12px 16px',
                borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                background: isUser ? 'var(--color-msg-user)' : 'var(--color-msg-ai)',
                color: isUser ? 'var(--color-msg-user-text)' : 'var(--color-msg-ai-text)',
                fontSize: 15,
                lineHeight: 1.5,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
            }}>
                <AttachmentGrid attachments={message.attachments} />

                {/* Message content - use AIResponse for AI, plain text for user */}
                {isUser ? message.content : <AIResponse content={message.content} />}

                {/* User Footer with Copy Button */}
                {isUser && (
                    <div style={{
                        display: 'flex',
                        justifyContent: 'flex-end',
                        marginTop: 4,
                        opacity: 0.8
                    }}>
                        <CopyButton text={message.content} color="inherit" />
                    </div>
                )}

                {/* Footer and Citations - only for AI */}
                {!isUser && (
                    <>
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginTop: 8,
                            gap: 8,
                        }}>
                            {/* Left: Agent tags */}
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                                {message.agents && message.agents.length > 0 && (
                                    <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>Agents used:</span>
                                )}
                                {message.agents && message.agents.map((agentId) => (
                                    <AgentBadge key={agentId} agentId={agentId} />
                                ))}
                            </div>
                            {/* Right: Copy Button */}
                            <CopyButton text={message.content} />
                        </div>
                        {message.citations && <CitationsDisplay citations={message.citations} />}
                    </>
                )}
            </div>
        </div>
    );
}, (prevProps, nextProps) => {
    // Custom comparison function for React.memo
    // Returns true if props are equal (do NOT re-render)
    const prevMsg = prevProps.message;
    const nextMsg = nextProps.message;

    return (
        prevMsg.id === nextMsg.id &&
        prevMsg.content === nextMsg.content &&
        prevMsg.type === nextMsg.type &&
        prevMsg.pending === nextMsg.pending &&
        JSON.stringify(prevMsg.reasoning) === JSON.stringify(nextMsg.reasoning) &&
        JSON.stringify(prevMsg.citations) === JSON.stringify(nextMsg.citations) &&
        JSON.stringify(prevMsg.agents) === JSON.stringify(nextMsg.agents) &&
        JSON.stringify(prevMsg.task) === JSON.stringify(nextMsg.task) &&
        JSON.stringify(prevMsg.attachments) === JSON.stringify(nextMsg.attachments)
    );
});

export default MessageRenderer;
