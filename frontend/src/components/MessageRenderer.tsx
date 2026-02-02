import { useState, useEffect } from 'react';
import { DownOutlined, UpOutlined, CheckCircleFilled, LoadingOutlined, FileTextOutlined, BulbOutlined, CopyOutlined, CheckOutlined } from '@ant-design/icons';
import type { Message, Citation, ReasoningStep } from '../context/ChatContext';
import AIResponse from './AIResponse';

interface MessageRendererProps {
    message: Message;
}

// Citation Badge Component
const CitationBadge = ({ citation }: { citation: Citation }) => (
    <span
        style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '4px 8px',
            borderRadius: 6,
            background: 'var(--color-surface-hover)',
            fontSize: 12,
            color: 'var(--color-text-secondary)',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
        }}
        onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--color-primary)';
            e.currentTarget.style.color = 'var(--color-primary)';
        }}
        onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'transparent';
            e.currentTarget.style.color = 'var(--color-text-secondary)';
        }}
    >
        <FileTextOutlined style={{ fontSize: 11 }} />
        {citation.title}
        {citation.page && <span style={{ opacity: 0.7 }}> p.{citation.page}</span>}
    </span>
);

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

// Agent Badge Component
const AgentBadge = ({ agentId }: { agentId: string }) => {
    const agentIcons: Record<string, string> = {
        'web-search': '🔍',
        'data-cruncher': '📊',
        'code-helper': '💻',
        'task-automator': '⚙️',
    };
    return (
        <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '2px 6px',
            borderRadius: 4,
            background: 'var(--color-primary)',
            color: 'var(--color-text-inverse)',
            fontSize: 11,
            fontWeight: 500,
        }}>
            {agentIcons[agentId] || '🤖'}
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

const MessageRenderer = ({ message }: MessageRendererProps) => {
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
                        {/* Agent badges */}
                        {message.agents && message.agents.length > 0 && (
                            <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
                                {message.agents.map((agentId) => (
                                    <AgentBadge key={agentId} agentId={agentId} />
                                ))}
                            </div>
                        )}

                        {/* Main content - with markdown rendering */}
                        <AIResponse content={message.content} />

                        {/* Citations & Copy Button Footer */}
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-end',
                            marginTop: (message.citations?.length || 0) > 0 ? 12 : 4
                        }}>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                {message.citations && message.citations.map((citation) => (
                                    <CitationBadge key={citation.id} citation={citation} />
                                ))}
                            </div>
                            <CopyButton text={message.content} />
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // Standard Sync Message (default)
    return (
        <div style={{
            display: 'flex',
            justifyContent: isUser ? 'flex-end' : 'flex-start',
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
                {/* Agent badges for assistant */}
                {!isUser && message.agents && message.agents.length > 0 && (
                    <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
                        {message.agents.map((agentId) => (
                            <AgentBadge key={agentId} agentId={agentId} />
                        ))}
                    </div>
                )}

                {/* Message content - use AIResponse for AI, plain text for user */}
                {isUser ? message.content : <AIResponse content={message.content} />}

                {/* Citations & Copy Button */}
                {!isUser && (
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-end',
                        marginTop: (message.citations?.length || 0) > 0 ? 12 : 4
                    }}>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {message.citations && message.citations.map((citation) => (
                                <CitationBadge key={citation.id} citation={citation} />
                            ))}
                        </div>
                        <CopyButton text={message.content} />
                    </div>
                )}
            </div>
        </div>
    );
};

export default MessageRenderer;
