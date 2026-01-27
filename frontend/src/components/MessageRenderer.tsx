import { useState } from 'react';
import { DownOutlined, UpOutlined, CheckCircleFilled, LoadingOutlined, FileTextOutlined } from '@ant-design/icons';
import type { Message, Citation, ReasoningStep } from '../context/ChatContext';

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

// Reasoning Step Component
const ReasoningStepItem = ({ step }: { step: ReasoningStep }) => (
    <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 0',
        fontSize: 13,
        color: 'var(--color-text-secondary)',
    }}>
        {step.status === 'complete' && <CheckCircleFilled style={{ color: 'var(--color-primary)', fontSize: 12 }} />}
        {step.status === 'running' && <LoadingOutlined style={{ color: 'var(--color-primary)', fontSize: 12 }} />}
        {step.status === 'pending' && <span style={{ width: 12, height: 12, borderRadius: '50%', border: '1px solid var(--color-border)' }} />}
        <span style={{ opacity: step.status === 'pending' ? 0.5 : 1 }}>{step.text}</span>
    </div>
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

const MessageRenderer = ({ message }: MessageRendererProps) => {
    const [isReasoningExpanded, setIsReasoningExpanded] = useState(false);
    const isUser = message.sender === 'user';

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

    // Reasoning Message
    if (message.type === 'reasoning' && message.reasoning) {
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
                    {/* Agent badges */}
                    {message.agents && message.agents.length > 0 && (
                        <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
                            {message.agents.map((agentId) => (
                                <AgentBadge key={agentId} agentId={agentId} />
                            ))}
                        </div>
                    )}

                    {/* Collapsible reasoning */}
                    <button
                        onClick={() => setIsReasoningExpanded(!isReasoningExpanded)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            background: 'none',
                            border: 'none',
                            padding: 0,
                            cursor: 'pointer',
                            color: 'var(--color-text-secondary)',
                            fontSize: 13,
                            marginBottom: isReasoningExpanded ? 8 : 0,
                        }}
                    >
                        {isReasoningExpanded ? <UpOutlined style={{ fontSize: 10 }} /> : <DownOutlined style={{ fontSize: 10 }} />}
                        {isReasoningExpanded ? 'Hide reasoning' : 'View reasoning'}
                    </button>

                    {isReasoningExpanded && (
                        <div style={{
                            padding: '8px 12px',
                            background: 'var(--color-surface)',
                            borderRadius: 8,
                            marginBottom: 12,
                            borderLeft: '2px solid var(--color-primary)',
                        }}>
                            {message.reasoning.steps.map((step) => (
                                <ReasoningStepItem key={step.id} step={step} />
                            ))}
                        </div>
                    )}

                    {/* Main content */}
                    {message.content && (
                        <div style={{ fontSize: 15, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                            {message.content}
                        </div>
                    )}

                    {/* Citations */}
                    {message.citations && message.citations.length > 0 && (
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
                            {message.citations.map((citation) => (
                                <CitationBadge key={citation.id} citation={citation} />
                            ))}
                        </div>
                    )}
                </div>
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

                {message.content}

                {/* Citations */}
                {!isUser && message.citations && message.citations.length > 0 && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
                        {message.citations.map((citation) => (
                            <CitationBadge key={citation.id} citation={citation} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default MessageRenderer;
