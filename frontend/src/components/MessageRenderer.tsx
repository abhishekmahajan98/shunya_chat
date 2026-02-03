import { useState, useEffect, memo } from 'react';
import { DownOutlined, UpOutlined, CheckCircleFilled, LoadingOutlined, FileTextOutlined, BulbOutlined, CopyOutlined, CheckOutlined } from '@ant-design/icons';
import type { Message, Citation, ReasoningStep } from '../context/ChatContext';
import AIResponse from './AIResponse';

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
const CopyButton = ({ text }: { text: string }) => {
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
                color: copied ? 'var(--color-text)' : 'var(--color-text-secondary)',
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
                    e.currentTarget.style.color = 'var(--color-primary)';
                    e.currentTarget.style.background = 'var(--color-surface-hover)';
                }
            }}
            onMouseLeave={(e) => {
                if (!copied) {
                    e.currentTarget.style.opacity = '0.6';
                    e.currentTarget.style.color = 'var(--color-text-secondary)';
                    e.currentTarget.style.background = 'transparent';
                }
            }}
            title="Copy response"
        >
            {copied ? (
                <span style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500 }}>
                    <CheckOutlined style={{ color: 'var(--color-primary)' }} /> Copied to clipboard
                </span>
            ) : (
                <CopyOutlined />
            )}
        </button>
    );
};

// Thinking Display Component - Minimal, above the bubble
const ThinkingDisplay = ({
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
    const thinkingText = steps[0]?.text || '';

    return (
        <div style={{ marginBottom: 8 }}>
            {/* Expand/Collapse Toggle */}
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
                    color: 'var(--color-text-secondary)',
                    fontSize: 13,
                    fontWeight: 500,
                }}
            >
                {isThinking ? (
                    <LoadingOutlined style={{ fontSize: 12, color: 'var(--color-primary)' }} />
                ) : (
                    <BulbOutlined style={{ fontSize: 12, color: 'var(--color-primary)' }} />
                )}
                <span style={{ color: 'var(--color-primary)' }}>
                    {isThinking ? 'Thinking...' : 'Thought process'}
                </span>
                {isExpanded ? (
                    <UpOutlined style={{ fontSize: 10, opacity: 0.6 }} />
                ) : (
                    <DownOutlined style={{ fontSize: 10, opacity: 0.6 }} />
                )}
            </button>

            {/* Thinking Content - No visible container, just subtle text */}
            {isExpanded && thinkingText && (
                <div
                    style={{
                        paddingLeft: 20,
                        marginTop: 4,
                        maxHeight: isThinking ? 'none' : 400,
                        overflowY: isThinking ? 'visible' : 'auto',
                        color: 'var(--color-text-secondary)',
                    }}
                >
                    <AIResponse content={thinkingText} compact={true} />
                </div>
            )}
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
                marginBottom: 12,
            }}>
                <div style={{
                    padding: '12px 16px',
                    borderRadius: '16px 16px 16px 4px',
                    background: 'var(--color-msg-ai)',
                    color: 'var(--color-msg-ai-text)',
                }}>
                    <div className="typing-dots">
                        <span></span>
                        <span></span>
                        <span></span>
                    </div>
                </div>
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
                {/* Thinking display - ABOVE the message bubble, no container */}
                <ThinkingDisplay
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
                {/* Message content - use AIResponse for AI, plain text for user */}
                {isUser ? message.content : <AIResponse content={message.content} />}

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
        JSON.stringify(prevMsg.task) === JSON.stringify(nextMsg.task)
    );
});

export default MessageRenderer;
