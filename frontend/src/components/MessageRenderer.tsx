import { useState, useEffect, memo, type ReactNode } from 'react';
import { Checkbox, ConfigProvider, Drawer } from 'antd';
import { DownOutlined, UpOutlined, CheckCircleFilled, LoadingOutlined, FileTextOutlined, BulbOutlined, CopyOutlined, CheckOutlined, CloseCircleOutlined, LinkOutlined } from '@ant-design/icons';
import type { Message, Citation, ReasoningStep, TodoItem } from '../context/ChatContext';
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

const CollapseHeader = ({
    icon,
    label,
    expanded,
    onToggle,
}: {
    icon: ReactNode;
    label: string;
    expanded: boolean;
    onToggle: () => void;
}) => (
    <button
        type="button"
        onClick={onToggle}
        style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'none',
            border: 'none',
            padding: '2px 0',
            cursor: 'pointer',
            fontSize: 12,
            color: 'var(--color-text)',
            width: '100%',
            textAlign: 'left',
        }}
    >
        <div style={{ minWidth: 14, display: 'flex', justifyContent: 'center' }}>
            {icon}
        </div>
        <span style={{ fontWeight: 500 }}>{label}</span>
        {expanded ? (
            <UpOutlined style={{ fontSize: 9, opacity: 0.55, marginLeft: 'auto' }} />
        ) : (
            <DownOutlined style={{ fontSize: 9, opacity: 0.55, marginLeft: 'auto' }} />
        )}
    </button>
);

// Plan: expanded while in progress, auto-collapses when all done (Gemini-style)
const PlanChecklist = ({ todos }: { todos: TodoItem[] }) => {
    if (!todos.length) return null;

    const doneCount = todos.filter((t) => t.status === 'completed').length;
    const total = todos.length;
    const allDone = doneCount === total;
    const running = todos.some((t) => t.status === 'in_progress');

    // null = follow auto (open while incomplete, closed when done)
    const [userOverride, setUserOverride] = useState<boolean | null>(null);
    useEffect(() => {
        setUserOverride(null);
    }, [allDone]);
    const expanded = userOverride ?? !allDone;

    const icon = running && !allDone ? (
        <LoadingOutlined style={{ color: 'var(--color-primary)', fontSize: 10 }} />
    ) : allDone ? (
        <CheckOutlined style={{ color: '#52c41a', fontSize: 10 }} />
    ) : (
        <div style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            border: '1px solid var(--color-border)',
        }} />
    );

    return (
        <div style={{ margin: '2px 0 4px' }}>
            <CollapseHeader
                icon={icon}
                label={`Plan · ${doneCount}/${total} done`}
                expanded={expanded}
                onToggle={() => setUserOverride(!expanded)}
            />

            {expanded && (
                <ConfigProvider
                    theme={{
                        token: {
                            colorPrimary: '#EDAC33',
                            colorPrimaryHover: '#F5C04A',
                            colorPrimaryActive: '#D99A20',
                        },
                    }}
                >
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 4,
                        marginTop: 6,
                        paddingLeft: 20,
                    }}>
                        {todos.map((todo, i) => {
                            const itemRunning = todo.status === 'in_progress';
                            const itemDone = todo.status === 'completed';
                            return (
                                <div key={`${todo.content}-${i}`} style={{ pointerEvents: 'none' }}>
                                    <Checkbox
                                        checked={itemDone}
                                        indeterminate={itemRunning && !itemDone}
                                        style={{ alignItems: 'flex-start' }}
                                    >
                                        <span style={{
                                            color: itemDone
                                                ? 'var(--color-text-secondary)'
                                                : itemRunning
                                                    ? 'var(--color-text)'
                                                    : 'var(--color-text-secondary)',
                                            textDecoration: itemDone ? 'line-through' : 'none',
                                            lineHeight: 1.5,
                                            fontWeight: itemRunning ? 500 : 400,
                                            fontSize: 12,
                                        }}>
                                            {todo.content}
                                        </span>
                                    </Checkbox>
                                </div>
                            );
                        })}
                    </div>
                </ConfigProvider>
            )}
        </div>
    );
};

const ViaBadge = ({ via }: { via?: string }) => {
    if (!via) return null;
    return (
        <span style={{
            marginLeft: 6,
            fontSize: 10,
            fontWeight: 500,
            color: 'var(--color-text-tertiary)',
            background: 'var(--color-surface-hover)',
            borderRadius: 3,
            padding: '1px 5px',
            textTransform: 'lowercase',
            whiteSpace: 'nowrap',
        }}>
            via {via}
        </span>
    );
};

const viaMatchesSubagent = (via: string | undefined, sub: ReasoningStep): boolean => {
    if (!via) return false;
    const v = via.toLowerCase().trim();
    const label = (sub.text || '').toLowerCase().trim();
    if (v === label) return true;
    const vn = v.match(/sub\s*agent\s*(\d+)/);
    const ln = label.match(/sub\s*agent\s*(\d+)/);
    return !!(vn && ln && vn[1] === ln[1]);
};

// Finished tools fold into expandable; currently-running tools stay visible
const ToolsGroup = ({
    steps,
    stepIcon,
    showVia = false,
}: {
    steps: ReasoningStep[];
    stepIcon: (step: ReasoningStep, muted?: boolean) => ReactNode;
    /** When nested under a subagent, hierarchy replaces via badges */
    showVia?: boolean;
}) => {
    const [expanded, setExpanded] = useState(false);
    if (!steps.length) return null;

    const activeSteps = steps.filter((s) => s.status === 'running' || s.status === 'pending');
    const doneSteps = steps.filter((s) => s.status === 'complete' || s.status === 'failed');
    const failed = doneSteps.some((s) => s.status === 'failed');
    const nDone = doneSteps.length;
    const label = nDone === 1 ? '1 tool called' : `${nDone} tools called`;

    const doneIcon = failed ? (
        <CloseCircleOutlined style={{ color: '#ff4d4f', fontSize: 10 }} />
    ) : (
        <CheckOutlined style={{ color: '#52c41a', fontSize: 10 }} />
    );

    return (
        <div style={{ margin: '2px 0 4px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {nDone > 0 && (
                <div>
                    <CollapseHeader
                        icon={doneIcon}
                        label={label}
                        expanded={expanded}
                        onToggle={() => setExpanded((v) => !v)}
                    />
                    {expanded && (
                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 8,
                            marginTop: 6,
                            paddingLeft: 20,
                        }}>
                            {doneSteps.map((step) => (
                                <TimelineRow
                                    key={step.id}
                                    muted
                                    icon={stepIcon(step, true)}
                                    title={step.text}
                                    detail={step.detail}
                                    via={showVia ? step.via : undefined}
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}

            {activeSteps.map((step) => (
                <TimelineRow
                    key={step.id}
                    icon={stepIcon(step)}
                    title={step.text}
                    detail={step.detail}
                    via={showVia ? step.via : undefined}
                />
            ))}
        </div>
    );
};

/** Sub agent N row with its nested tool calls indented underneath */
const SubagentGroup = ({
    step,
    nestedTools,
    stepIcon,
}: {
    step: ReasoningStep;
    nestedTools: ReasoningStep[];
    stepIcon: (step: ReasoningStep, muted?: boolean) => ReactNode;
}) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <TimelineRow
            icon={stepIcon(step)}
            title={step.text}
            detail={step.detail}
        />
        {nestedTools.length > 0 ? (
            <div style={{
                marginLeft: 14,
                paddingLeft: 12,
                borderLeft: '1px solid var(--color-border)',
            }}>
                <ToolsGroup steps={nestedTools} stepIcon={stepIcon} showVia={false} />
            </div>
        ) : null}
    </div>
);

const TimelineRow = ({
    icon,
    title,
    detail,
    via,
    muted,
}: {
    icon: ReactNode;
    title: string;
    detail?: string;
    via?: string;
    muted?: boolean;
}) => (
    <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
        fontSize: 12,
        opacity: muted ? 0.75 : 1,
    }}>
        <div style={{ marginTop: 2, minWidth: 14, display: 'flex', justifyContent: 'center' }}>
            {icon}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{
                color: muted ? 'var(--color-text-secondary)' : 'var(--color-text)',
                lineHeight: 1.4,
                display: 'flex',
                alignItems: 'center',
                flexWrap: 'wrap',
            }}>
                <span>{title}</span>
                <ViaBadge via={via} />
            </div>
            {detail ? (
                <div style={{
                    color: 'var(--color-text-tertiary)',
                    fontSize: 11,
                    marginTop: 2,
                    lineHeight: 1.35,
                }}>
                    {detail}
                </div>
            ) : null}
        </div>
    </div>
);

// One activity trail: prep → planning → plan progress → tools group
const UnifiedReasoningDisplay = ({
    steps,
    todos,
    isExpanded,
    onToggle,
    isThinking
}: {
    steps: ReasoningStep[];
    todos?: TodoItem[];
    isExpanded: boolean;
    onToggle: () => void;
    isThinking: boolean;
}) => {
    const thinkingStep = steps.find(s => s.id === 'thinking') || steps.find(s => s.id === '1');
    const agentSteps = steps.filter(s => s.id !== 'thinking' && s.id !== '1');
    const planItems = todos || [];
    const isAgentic = agentSteps.length > 0 || planItems.length > 0;

    if (!isAgentic && (!thinkingStep || !thinkingStep.text)) return null;

    const isPrep = (s: ReasoningStep) =>
        s.category === 'prep' || s.id === 'prep';
    const isPlanStep = (s: ReasoningStep) =>
        s.id === 'tool-planning' || s.category === 'plan';
    // Subagent task steps (Sub agent N) — first-class, not tools
    const isSubagentStep = (s: ReasoningStep) =>
        s.category === 'subagent'
        || s.category === 'verifier'
        || s.category === 'gatherer'
        || s.category === 'general-purpose';
    // Actual model tool calls (prep/plan/subagents are separate). Name+params from SSE.
    const isRealTool = (s: ReasoningStep) =>
        !isPrep(s) && !isPlanStep(s) && !isSubagentStep(s) && (s.category || 'tool') !== 'status';

    const prepSteps = agentSteps.filter(isPrep);
    const planningSteps = agentSteps.filter(isPlanStep);
    // Preserve stream order for subagent + tool interleaving
    const workSteps = agentSteps.filter((s) => isSubagentStep(s) || isRealTool(s));
    const otherSteps = agentSteps.filter(
        (s) => !isPrep(s) && !isPlanStep(s) && !isSubagentStep(s) && !isRealTool(s)
    );

    const collapsedBits: string[] = [];
    if (prepSteps.length) collapsedBits.push(prepSteps[0].text);
    if (planItems.length) {
        const done = planItems.filter((t) => t.status === 'completed').length;
        collapsedBits.push(`${done}/${planItems.length} done`);
    }
    const subN = workSteps.filter(isSubagentStep).length;
    if (subN) collapsedBits.push(subN === 1 ? '1 subagent' : `${subN} subagents`);
    const toolOnly = workSteps.filter(isRealTool);
    if (toolOnly.length) {
        collapsedBits.push(
            toolOnly.length === 1 ? '1 tool called' : `${toolOnly.length} tools called`
        );
    }

    const stepIcon = (step: ReasoningStep, muted?: boolean) => {
        if (step.status === 'running') {
            return <LoadingOutlined style={{ color: 'var(--color-primary)', fontSize: 10 }} />;
        }
        if (step.status === 'failed') {
            return <CloseCircleOutlined style={{ color: '#ff4d4f', fontSize: 10 }} />;
        }
        return (
            <CheckOutlined
                style={{
                    color: muted ? 'var(--color-text-tertiary)' : '#52c41a',
                    fontSize: 10,
                }}
            />
        );
    };

    // Build body in stream order: after plan, emit parent tool batches and
    // Sub agent N groups with nested tools indented underneath.
    const bodyRows: ReactNode[] = [];
    prepSteps.forEach((step) => {
        bodyRows.push(
            <TimelineRow
                key={step.id}
                muted
                icon={stepIcon(step, true)}
                title={step.text}
                detail={step.detail}
            />
        );
    });
    planningSteps.forEach((step) => {
        bodyRows.push(
            <TimelineRow
                key={step.id}
                icon={stepIcon(step)}
                title={step.text}
                detail={step.detail}
            />
        );
    });
    if (planItems.length) {
        bodyRows.push(<PlanChecklist key="plan-checklist" todos={planItems} />);
    }
    otherSteps.forEach((step) => {
        bodyRows.push(
            <TimelineRow
                key={step.id}
                muted
                icon={stepIcon(step, true)}
                title={step.text}
                detail={step.detail}
            />
        );
    });

    type WorkBlock =
        | { kind: 'tools'; steps: ReasoningStep[] }
        | { kind: 'subagent'; step: ReasoningStep; children: ReasoningStep[] };

    const workBlocks: WorkBlock[] = [];
    let parentToolBatch: ReasoningStep[] = [];
    let openSub: { step: ReasoningStep; children: ReasoningStep[] } | null = null;

    const flushParentTools = () => {
        if (!parentToolBatch.length) return;
        workBlocks.push({ kind: 'tools', steps: parentToolBatch });
        parentToolBatch = [];
    };
    const flushSub = () => {
        if (!openSub) return;
        workBlocks.push({
            kind: 'subagent',
            step: openSub.step,
            children: openSub.children,
        });
        openSub = null;
    };

    const attachToMatchingSub = (tool: ReasoningStep): boolean => {
        if (openSub && viaMatchesSubagent(tool.via, openSub.step)) {
            openSub.children.push(tool);
            return true;
        }
        for (let i = workBlocks.length - 1; i >= 0; i--) {
            const b = workBlocks[i];
            if (b.kind === 'subagent' && viaMatchesSubagent(tool.via, b.step)) {
                b.children.push(tool);
                return true;
            }
        }
        return false;
    };

    workSteps.forEach((step) => {
        if (isSubagentStep(step)) {
            flushParentTools();
            flushSub();
            openSub = { step, children: [] };
            return;
        }
        if (step.via) {
            flushParentTools();
            if (!attachToMatchingSub(step)) {
                // Orphan via — keep visible at parent level with badge
                parentToolBatch.push(step);
            }
            return;
        }
        // Parent-level tool — close any open subagent group first
        flushSub();
        parentToolBatch.push(step);
    });
    flushParentTools();
    flushSub();

    let batchKey = 0;
    workBlocks.forEach((block) => {
        if (block.kind === 'tools') {
            bodyRows.push(
                <ToolsGroup
                    key={`tools-group-${batchKey++}`}
                    steps={block.steps}
                    stepIcon={stepIcon}
                    showVia
                />
            );
        } else {
            bodyRows.push(
                <SubagentGroup
                    key={block.step.id}
                    step={block.step}
                    nestedTools={block.children}
                    stepIcon={stepIcon}
                />
            );
        }
    });

    return (
        <div style={{ marginBottom: 12 }}>
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
                    maxWidth: '100%',
                }}
            >
                {isThinking ? (
                    <LoadingOutlined style={{ fontSize: 12, flexShrink: 0 }} />
                ) : (
                    <BulbOutlined style={{ fontSize: 12, flexShrink: 0 }} />
                )}
                <span style={{ flexShrink: 0 }}>
                    {isThinking
                        ? (isAgentic ? 'Agentic Reasoning...' : 'Thinking...')
                        : (isAgentic ? 'Agentic Reasoning' : 'Thought process')}
                </span>
                {!isExpanded && collapsedBits.length > 0 && (
                    <span style={{
                        fontSize: 11,
                        fontWeight: 400,
                        color: 'var(--color-text-tertiary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        minWidth: 0,
                    }}>
                        · {collapsedBits.join(' · ')}
                    </span>
                )}
                {isExpanded ? (
                    <UpOutlined style={{ fontSize: 10, opacity: 0.6, flexShrink: 0 }} />
                ) : (
                    <DownOutlined style={{ fontSize: 10, opacity: 0.6, flexShrink: 0 }} />
                )}
            </button>

            {isExpanded && (
                <div style={{
                    paddingTop: 6,
                    marginTop: 2,
                    paddingLeft: 12,
                    borderLeft: '1px solid var(--color-border)',
                    marginLeft: 6,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                }}>
                    {bodyRows}

                    {thinkingStep?.text ? (
                        <div style={{
                            fontSize: 12,
                            color: 'var(--color-text-secondary)',
                            whiteSpace: 'pre-wrap',
                        }}>
                            {thinkingStep.text}
                        </div>
                    ) : null}
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

// Footer icon → opens citations sider (full links, not inline expand)
const CitationsTrigger = ({
    citations,
    onOpen,
}: {
    citations: Citation[];
    onOpen: () => void;
}) => {
    if (!citations?.length) return null;
    return (
        <button
            type="button"
            onClick={onOpen}
            title={`${citations.length} source${citations.length === 1 ? '' : 's'}`}
            style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--color-text-secondary)',
                cursor: 'pointer',
                padding: '4px 8px',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                borderRadius: 4,
                opacity: 0.75,
                fontSize: 12,
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.opacity = '1';
                e.currentTarget.style.color = 'var(--color-primary)';
                e.currentTarget.style.background = 'var(--color-surface-hover)';
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '0.75';
                e.currentTarget.style.color = 'var(--color-text-secondary)';
                e.currentTarget.style.background = 'transparent';
            }}
        >
            <LinkOutlined style={{ fontSize: 13 }} />
            <span>{citations.length}</span>
        </button>
    );
};

const CitationsSider = ({
    open,
    onClose,
    citations,
}: {
    open: boolean;
    onClose: () => void;
    citations: Citation[];
}) => (
    <Drawer
        title={`Sources (${citations.length})`}
        placement="right"
        width={400}
        open={open}
        onClose={onClose}
        styles={{
            body: {
                padding: '16px 20px',
                background: 'var(--color-bg)',
            },
            header: {
                background: 'var(--color-surface)',
                borderBottom: '1px solid var(--color-border)',
            },
        }}
    >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {citations.map((citation) => {
                const fullLink = citation.url || undefined;
                const label =
                    citation.title && citation.title !== fullLink
                        ? citation.title
                        : fullLink || citation.title;
                return (
                    <div
                        key={citation.id}
                        style={{
                            paddingBottom: 16,
                            borderBottom: '1px solid var(--color-border-light)',
                        }}
                    >
                        <div style={{
                            display: 'flex',
                            gap: 8,
                            alignItems: 'flex-start',
                            marginBottom: 6,
                        }}>
                            <span style={{
                                color: 'var(--color-text-secondary)',
                                fontSize: 12,
                                fontWeight: 600,
                                flexShrink: 0,
                            }}>
                                [{citation.id}]
                            </span>
                            <div style={{ minWidth: 0, flex: 1 }}>
                                <div style={{
                                    fontSize: 14,
                                    fontWeight: 500,
                                    color: 'var(--color-text)',
                                    marginBottom: fullLink ? 6 : 0,
                                    wordBreak: 'break-word',
                                }}>
                                    {label}
                                </div>
                                {fullLink && (
                                    <a
                                        href={fullLink}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{
                                            color: 'var(--color-primary)',
                                            fontSize: 12,
                                            wordBreak: 'break-all',
                                            lineHeight: 1.45,
                                            display: 'block',
                                        }}
                                    >
                                        {fullLink}
                                    </a>
                                )}
                                {(citation.agent || citation.detail) && (
                                    <div style={{
                                        marginTop: 8,
                                        fontSize: 12,
                                        color: 'var(--color-text-secondary)',
                                        wordBreak: 'break-word',
                                    }}>
                                        {[citation.agent, citation.detail].filter(Boolean).join(' · ')}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    </Drawer>
);

const MessageFooter = ({
    message,
    onOpenCitations,
}: {
    message: Message;
    onOpenCitations: () => void;
}) => (
    <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 8,
        gap: 8,
    }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            {message.agents && message.agents.length > 0 && (
                <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>Agents used:</span>
            )}
            {message.agents && message.agents.map((agentId) => (
                <AgentBadge key={agentId} agentId={agentId} />
            ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
            {message.citations && message.citations.length > 0 && (
                <CitationsTrigger citations={message.citations} onOpen={onOpenCitations} />
            )}
            <CopyButton text={message.content} />
        </div>
    </div>
);

const MessageRenderer = memo(({ message }: MessageRendererProps) => {
    const isUser = message.sender === 'user';
    const isSystem = message.sender === 'system';
    const [citationsOpen, setCitationsOpen] = useState(false);
    const [summaryOpen, setSummaryOpen] = useState(false);

    // Compaction / system notice — horizontal rule with clickable label
    if (isSystem) {
        const isCompacting = Boolean(message.pending);
        const labelText = isCompacting ? 'compacting…' : 'compaction';
        const label = (
            <span style={{
                color: '#c9a227',
                fontSize: 11,
                letterSpacing: '0.04em',
                textTransform: 'lowercase',
                whiteSpace: 'nowrap',
                opacity: isCompacting ? 0.85 : 1,
            }}>
                {labelText}
            </span>
        );

        return (
            <div style={{ margin: '8px 0 16px', width: '100%' }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    width: '100%',
                }}>
                    <div style={{
                        flex: 1,
                        height: 1,
                        background: 'var(--color-border)',
                    }} />
                    {message.compactionSummary && !isCompacting ? (
                        <button
                            type="button"
                            onClick={() => setSummaryOpen((v) => !v)}
                            title={summaryOpen ? 'Hide summary' : 'View summary'}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                padding: 0,
                                margin: 0,
                                cursor: 'pointer',
                                lineHeight: 1,
                            }}
                        >
                            {label}
                        </button>
                    ) : (
                        label
                    )}
                    <div style={{
                        flex: 1,
                        height: 1,
                        background: 'var(--color-border)',
                    }} />
                </div>
                {summaryOpen && message.compactionSummary && !isCompacting ? (
                    <div style={{
                        margin: '10px 0 0',
                        maxHeight: 280,
                        overflow: 'auto',
                        fontSize: 12,
                        color: 'var(--color-text-secondary)',
                        lineHeight: 1.5,
                    }}
                    className="compaction-summary"
                    >
                        <AIResponse content={message.compactionSummary} compact />
                    </div>
                ) : null}
            </div>
        );
    }

    // Determine if thinking is active (running status)
    const isThinking = message.reasoning?.steps?.some(s => s.status === 'running') || false;

    // Auto-manage expand state:
    // - Expand when thinking / plan updates
    // - Do NOT collapse while a plan (todos) is present — plan is the backbone
    const [isReasoningExpanded, setIsReasoningExpanded] = useState(
        message.reasoning?.isExpanded ?? isThinking ?? Boolean(message.todos?.length)
    );

    useEffect(() => {
        const hasPlan = Boolean(message.todos?.length);
        if (message.reasoning || hasPlan) {
            const hasContent = Boolean(message.content);
            const thinkingDone = (message.reasoning?.steps || []).every(
                (s) => s.status === 'complete'
            ) || !(message.reasoning?.steps?.length);

            if (isThinking || hasPlan) {
                setIsReasoningExpanded(true);
            } else if (thinkingDone && hasContent && !hasPlan) {
                setIsReasoningExpanded(false);
            }
        }
    }, [isThinking, message.content, message.reasoning, message.todos]);

    const citationsSider = message.citations && message.citations.length > 0 ? (
        <CitationsSider
            open={citationsOpen}
            onClose={() => setCitationsOpen(false)}
            citations={message.citations}
        />
    ) : null;

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
    if (message.type === 'reasoning' && (message.reasoning || message.todos?.length)) {
        const planBusy = message.todos?.some((t) => t.status === 'in_progress') ?? false;
        return (
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                marginBottom: 12,
                maxWidth: '75%',
            }}>
                <UnifiedReasoningDisplay
                    steps={message.reasoning?.steps || []}
                    todos={message.todos}
                    isExpanded={isReasoningExpanded}
                    onToggle={() => setIsReasoningExpanded(!isReasoningExpanded)}
                    isThinking={isThinking || planBusy}
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

                        <MessageFooter
                            message={message}
                            onOpenCitations={() => setCitationsOpen(true)}
                        />
                    </div>
                )}
                {citationsSider}
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

                {/* Footer - only for AI */}
                {!isUser && (
                    <MessageFooter
                        message={message}
                        onOpenCitations={() => setCitationsOpen(true)}
                    />
                )}
            </div>
            {citationsSider}
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
        JSON.stringify(prevMsg.todos) === JSON.stringify(nextMsg.todos) &&
        JSON.stringify(prevMsg.agents) === JSON.stringify(nextMsg.agents) &&
        JSON.stringify(prevMsg.task) === JSON.stringify(nextMsg.task) &&
        JSON.stringify(prevMsg.attachments) === JSON.stringify(nextMsg.attachments)
    );
});

export default MessageRenderer;
