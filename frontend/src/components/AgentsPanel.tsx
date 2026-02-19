import { useState } from 'react';
import { Button, Input, Tag, Switch, Dropdown, Typography, Modal, message } from 'antd';
import type { MenuProps } from 'antd';
import {
    SearchOutlined,
    StarOutlined,
    StarFilled,
    DownOutlined,
    ClockCircleOutlined,
    MoreOutlined,
    AppstoreOutlined,
    CloseOutlined,
    RightOutlined,
} from '@ant-design/icons';
import { useChat, type Agent, type AgentCategory } from '../context/ChatContext';
import SpaceIcon from './SpaceIcon';

const categoryLabels: Record<AgentCategory, { label: string; icon: string }> = {
    research: { label: 'Research', icon: 'experiment' },
    compliance: { label: 'Compliance', icon: 'safety' },
    finance: { label: 'Finance', icon: 'dollar' },
    automation: { label: 'Automation', icon: 'robot' },
};

const AgentCard = ({
    agent,
    onToggle,
    onToggleFavorite,
    onRequestAccess,
    onShowInfo,
}: {
    agent: Agent;
    onToggle: () => void;
    onToggleFavorite: () => void;
    onRequestAccess: () => void;
    onShowInfo: () => void;
}) => {
    const handleRequest = () => {
        onRequestAccess();
        message.success(`Request sent for ${agent.name}`);
    };

    const menuItems: MenuProps['items'] = [
        {
            key: 'request',
            label: 'Request Access',
            onClick: handleRequest,
        },
    ];

    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '12px',
                borderRadius: 10,
                marginBottom: 6,
                border: agent.isActive ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                background: agent.isActive ? 'var(--color-sidebar-active)' : 'var(--color-surface)',
                transition: 'all 0.2s ease',
                cursor: agent.hasAccess ? 'pointer' : 'default',
                opacity: agent.hasAccess ? 1 : 0.7,
            }}
            onClick={() => {
                onShowInfo();
            }}
        >
            <div style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: agent.isActive ? 'var(--color-primary)' : 'var(--color-surface-hover)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 18,
                flexShrink: 0,
                transition: 'all 0.2s ease',
                position: 'relative',
                color: agent.isActive ? 'var(--color-text-inverse)' : 'var(--color-text-secondary)',
            }}>
                <SpaceIcon icon={agent.icon} style={{ fontSize: 18, color: 'inherit' }} />
                {agent.isBackground && (
                    <ClockCircleOutlined style={{
                        position: 'absolute',
                        bottom: -2,
                        right: -2,
                        fontSize: 10,
                        background: 'var(--color-surface)',
                        borderRadius: '50%',
                        padding: 2,
                        color: 'var(--color-text-secondary)',
                    }} />
                )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    marginBottom: 2,
                }}>
                    <span style={{ fontWeight: 500, fontSize: 13, color: 'var(--color-text)' }}>
                        {agent.name}
                    </span>
                    {agent.isBackground && (
                        <span style={{
                            fontSize: 9,
                            padding: '1px 4px',
                            borderRadius: 3,
                            background: 'var(--color-surface-hover)',
                            color: 'var(--color-text-tertiary)',
                        }}>
                            BG
                        </span>
                    )}
                    {!agent.hasAccess && (
                        <span style={{
                            fontSize: 9,
                            padding: '1px 4px',
                            borderRadius: 3,
                            background: 'var(--color-surface-hover)',
                            color: 'var(--color-text-tertiary)',
                            border: '1px solid var(--color-border)'
                        }}>
                            Locked
                        </span>
                    )}
                </div>
                <div style={{
                    fontSize: 11,
                    color: 'var(--color-text-secondary)',
                    lineHeight: 1.3,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                }}>
                    {agent.description}
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                {agent.hasAccess ? (
                    <>
                        <div
                            onClick={(e) => {
                                e.stopPropagation();
                                onToggleFavorite();
                            }}
                            style={{
                                cursor: 'pointer',
                                color: agent.isFavorite ? 'var(--color-primary)' : 'var(--color-text-tertiary)',
                                fontSize: 12,
                            }}
                        >
                            {agent.isFavorite ? <StarFilled /> : <StarOutlined />}
                        </div>
                        <Switch
                            size="small"
                            checked={agent.isActive}
                            onChange={(_, e) => {
                                e.stopPropagation();
                                onToggle();
                            }}
                        />
                    </>
                ) : (
                    <Dropdown menu={{ items: menuItems }} trigger={['click']} placement="bottomRight">
                        <div
                            onClick={(e) => e.stopPropagation()}
                            style={{
                                cursor: 'pointer',
                                padding: 4,
                                color: 'var(--color-text-tertiary)'
                            }}
                        >
                            <MoreOutlined style={{ fontSize: 16 }} />
                        </div>
                    </Dropdown>
                )}
            </div>
        </div>
    );
};

const AgentTile = ({
    agent,
    onToggle,
    onToggleFavorite,
    onRequestAccess,
    onShowInfo,
}: {
    agent: Agent;
    onToggle: () => void;
    onToggleFavorite: () => void;
    onRequestAccess: () => void;
    onShowInfo: () => void;
}) => {
    const handleRequest = () => {
        onRequestAccess();
        message.success(`Request sent for ${agent.name}`);
    };

    const menuItems: MenuProps['items'] = [
        {
            key: 'request',
            label: 'Request Access',
            onClick: handleRequest,
        },
    ];

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                padding: '16px',
                borderRadius: 12,
                border: agent.isActive ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                background: agent.isActive ? 'var(--color-sidebar-active)' : 'var(--color-surface)',
                transition: 'all 0.2s ease',
                cursor: agent.hasAccess ? 'pointer' : 'default',
                opacity: agent.hasAccess ? 1 : 0.8,
                height: '100%',
                position: 'relative',
            }}
            onClick={() => {
                onShowInfo();
            }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div style={{
                    width: 40,
                    height: 40,
                    borderRadius: 8,
                    background: agent.isActive ? 'var(--color-primary)' : 'var(--color-surface-hover)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 20,
                    color: agent.isActive ? 'var(--color-text-inverse)' : 'var(--color-text-secondary)',
                }}>
                    <SpaceIcon icon={agent.icon} style={{ fontSize: 20, color: 'inherit' }} />
                </div>

                {agent.hasAccess ? (
                    <div
                        onClick={(e) => {
                            e.stopPropagation();
                            onToggleFavorite();
                        }}
                        style={{
                            cursor: 'pointer',
                            color: agent.isFavorite ? 'var(--color-primary)' : 'var(--color-text-tertiary)',
                            fontSize: 16,
                        }}
                    >
                        {agent.isFavorite ? <StarFilled /> : <StarOutlined />}
                    </div>
                ) : (
                    <Dropdown menu={{ items: menuItems }} trigger={['click']} placement="bottomRight">
                        <div
                            onClick={(e) => e.stopPropagation()}
                            style={{
                                cursor: 'pointer',
                                padding: 4,
                                color: 'var(--color-text-tertiary)'
                            }}
                        >
                            <MoreOutlined style={{ fontSize: 20 }} />
                        </div>
                    </Dropdown>
                )}
            </div>

            <div style={{ marginBottom: 4 }}>
                <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--color-text)' }}>
                    {agent.name}
                </span>
                {!agent.hasAccess && (
                    <span style={{
                        fontSize: 10,
                        padding: '2px 6px',
                        borderRadius: 4,
                        background: 'var(--color-surface-hover)',
                        color: 'var(--color-text-tertiary)',
                        border: '1px solid var(--color-border)',
                        marginLeft: 8,
                        verticalAlign: 'middle'
                    }}>
                        Locked
                    </span>
                )}
            </div>

            <div style={{
                fontSize: 12,
                color: 'var(--color-text-secondary)',
                lineHeight: 1.4,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical',
                marginBottom: 12,
                flex: 1,
            }}>
                {agent.description}
            </div>

            {agent.hasAccess && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'auto' }}>
                    <Switch
                        size="small"
                        checked={agent.isActive}
                        onChange={(_, e) => {
                            e.stopPropagation();
                            onToggle();
                        }}
                    />
                </div>
            )}
        </div>
    );
};

export const AgentsPanel = ({
    expanded = false,
    onToggleExpand = () => { }
}: {
    expanded?: boolean;
    onToggleExpand?: () => void;
}) => {
    const {
        agents,
        toggleAgent,
        toggleAgentFavorite,
        activeAgents,
        agentSearch,
        setAgentSearch,
        backgroundTasks,
    } = useChat();

    const [selectedAgentForInfo, setSelectedAgentForInfo] = useState<Agent | null>(null);
    const [collapsedCategories, setCollapsedCategories] = useState<Set<AgentCategory>>(new Set());

    const toggleCategory = (category: AgentCategory) => {
        setCollapsedCategories((prev) => {
            const next = new Set(prev);
            if (next.has(category)) next.delete(category);
            else next.add(category);
            return next;
        });
    };

    const filteredAgents = agents.filter((a) => {
        const matchesSearch = a.name.toLowerCase().includes(agentSearch.toLowerCase()) ||
            a.description.toLowerCase().includes(agentSearch.toLowerCase());
        return expanded ? matchesSearch : (a.hasAccess && matchesSearch);
    });

    const favoriteAgents = filteredAgents.filter((a) => a.isFavorite);
    const categories: AgentCategory[] = ['research', 'compliance', 'finance', 'automation'];
    const agentsByCategory = categories.reduce((acc, cat) => {
        acc[cat] = filteredAgents.filter((a) => a.category === cat && !a.isFavorite);
        return acc;
    }, {} as Record<AgentCategory, Agent[]>);

    const runningTasks = backgroundTasks.filter((t) => t.status === 'running');

    return (
        <div style={{
            height: '100%',
            width: expanded ? '100%' : 320,
            maxWidth: '90vw',
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--color-bg)',
            color: 'var(--color-text)',
            overflowX: 'hidden',
        }}>
            <style>
                {`
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .animate-fade-in {
            animation: fadeIn 0.4s ease-out forwards;
          }
        `}
            </style>

            {/* Header */}
            <div style={{
                padding: '16px 20px',
                borderBottom: '1px solid var(--color-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                minHeight: 64,
                background: 'var(--color-surface)',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Typography.Text strong style={{ fontSize: 16 }}>
                        {expanded ? 'Agent Marketplace' : 'My Agents'}
                    </Typography.Text>
                    <div style={{
                        background: 'var(--color-surface-hover)',
                        color: 'var(--color-text-secondary)',
                        padding: '2px 8px',
                        borderRadius: 12,
                        fontSize: 12,
                        fontWeight: 600,
                        border: '1px solid var(--color-border)',
                    }}>
                        {activeAgents.length}
                    </div>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                    {expanded && (
                        <Button
                            type="text"
                            size="small"
                            onClick={() => window.location.href = '/register-agent'}
                            style={{ color: 'var(--color-primary)', fontSize: 12, fontWeight: 600 }}
                        >
                            + Submit Agent
                        </Button>
                    )}
                    <Button
                        type="text"
                        size="small"
                        onClick={onToggleExpand}
                        icon={expanded ? <CloseOutlined /> : <AppstoreOutlined />}
                        style={{ color: 'var(--color-primary)', fontWeight: 600 }}
                    >
                        {expanded ? '' : 'Browse'}
                    </Button>
                </div>
            </div>

            {/* Search */}
            <div style={{ padding: '12px' }}>
                <Input
                    placeholder={expanded ? "Search for agents..." : "Search my agents..."}
                    prefix={<SearchOutlined style={{ color: 'var(--color-text-tertiary)' }} />}
                    value={agentSearch}
                    onChange={(e) => setAgentSearch(e.target.value)}
                    size="middle"
                    style={{
                        borderRadius: 8,
                        background: 'var(--color-surface)',
                        border: 'none',
                    }}
                />
            </div>

            {/* Running Tasks */}
            {runningTasks.length > 0 && (
                <div style={{ padding: '0 12px 12px' }}>
                    <div style={{
                        padding: '10px 12px',
                        borderRadius: 8,
                        background: 'var(--color-sidebar-active)',
                        border: '1px solid var(--color-primary)',
                    }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-primary)', marginBottom: 8 }}>
                            <ClockCircleOutlined /> Running Tasks ({runningTasks.length})
                        </div>
                        {runningTasks.slice(0, 2).map((task) => (
                            <div key={task.id} style={{ marginBottom: 8 }}>
                                <div style={{ fontSize: 12, color: 'var(--color-text)', marginBottom: 4 }}>
                                    {task.agentName}: "{task.query.slice(0, 30)}..."
                                </div>
                                <div style={{ height: 4, borderRadius: 2, background: 'var(--color-border)', overflow: 'hidden' }}>
                                    <div style={{ width: `${task.progress}%`, height: '100%', background: 'var(--color-primary)' }} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Agent List */}
            <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '0 12px 24px',
            }}>
                {expanded ? (
                    <div className="animate-fade-in">
                        {/* Favorites in Expanded Mode */}
                        {favoriteAgents.length > 0 && (
                            <div style={{ marginBottom: 32 }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', padding: '12px 0 16px', borderBottom: '1px solid var(--color-border)', marginBottom: 20 }}>
                                    <StarFilled style={{ fontSize: 12, color: 'var(--color-primary)' }} /> Favorite Agents
                                </div>
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                                    gap: 20,
                                }}>
                                    {favoriteAgents.map((agent) => (
                                        <AgentTile
                                            key={agent.id}
                                            agent={agent}
                                            onToggle={() => toggleAgent(agent.id)}
                                            onToggleFavorite={() => toggleAgentFavorite(agent.id)}
                                            onRequestAccess={() => { }}
                                            onShowInfo={() => setSelectedAgentForInfo(agent)}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Categories in Expanded Mode */}
                        {categories.map((category) => {
                            const categoryAgents = agentsByCategory[category];
                            if (categoryAgents.length === 0) return null;
                            const { label, icon } = categoryLabels[category];

                            return (
                                <div key={category} style={{ marginBottom: 40 }}>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', padding: '12px 0 16px', borderBottom: '1px solid var(--color-border)', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <SpaceIcon icon={icon} style={{ fontSize: 18 }} /> {label} Agents
                                    </div>
                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                                        gap: 20,
                                    }}>
                                        {categoryAgents.map((agent) => (
                                            <AgentTile
                                                key={agent.id}
                                                agent={agent}
                                                onToggle={() => toggleAgent(agent.id)}
                                                onToggleFavorite={() => toggleAgentFavorite(agent.id)}
                                                onRequestAccess={() => { }}
                                                onShowInfo={() => setSelectedAgentForInfo(agent)}
                                            />
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="animate-fade-in">
                        {/* Favorites */}
                        {favoriteAgents.length > 0 && (
                            <div style={{ marginBottom: 16 }}>
                                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', padding: '8px 0' }}>
                                    <StarFilled style={{ fontSize: 10, color: 'var(--color-primary)' }} /> Favorites
                                </div>
                                {favoriteAgents.map((agent) => (
                                    <AgentCard
                                        key={agent.id}
                                        agent={agent}
                                        onToggle={() => toggleAgent(agent.id)}
                                        onToggleFavorite={() => toggleAgentFavorite(agent.id)}
                                        onRequestAccess={() => { }}
                                        onShowInfo={() => setSelectedAgentForInfo(agent)}
                                    />
                                ))}
                            </div>
                        )}

                        {/* Categories */}
                        {categories.map((category) => {
                            const categoryAgents = agentsByCategory[category];
                            if (categoryAgents.length === 0) return null;
                            const isCollapsed = collapsedCategories.has(category);
                            const { label, icon } = categoryLabels[category];

                            return (
                                <div key={category} style={{ marginBottom: 12 }}>
                                    <div
                                        onClick={() => toggleCategory(category)}
                                        style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', padding: '8px 0', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
                                    >
                                        {isCollapsed ? <RightOutlined style={{ fontSize: 10 }} /> : <DownOutlined style={{ fontSize: 10 }} />}
                                        <SpaceIcon icon={icon} style={{ fontSize: 14 }} /> {label}
                                    </div>
                                    {!isCollapsed && categoryAgents.map((agent) => (
                                        <AgentCard
                                            key={agent.id}
                                            agent={agent}
                                            onToggle={() => toggleAgent(agent.id)}
                                            onToggleFavorite={() => toggleAgentFavorite(agent.id)}
                                            onRequestAccess={() => { }}
                                            onShowInfo={() => setSelectedAgentForInfo(agent)}
                                        />
                                    ))}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Agent Info Modal */}
            <Modal
                title={null}
                open={!!selectedAgentForInfo}
                onCancel={() => setSelectedAgentForInfo(null)}
                footer={null}
                width={640}
                centered
                closable={false}
                styles={{
                    mask: { backdropFilter: 'blur(4px)' },
                    body: { padding: 0, overflow: 'hidden', background: 'var(--color-surface)' }
                }}
            >
                {selectedAgentForInfo && (
                    <div style={{ position: 'relative' }}>
                        <div style={{
                            padding: '48px 32px',
                            background: 'linear-gradient(135deg, var(--color-primary) 0%, #F59E0B 100%)',
                            color: 'white',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 16
                        }}>
                            <div
                                onClick={() => setSelectedAgentForInfo(null)}
                                style={{ position: 'absolute', top: 16, right: 16, cursor: 'pointer', color: 'white' }}
                            >
                                <CloseOutlined />
                            </div>
                            <div style={{ width: 80, height: 80, borderRadius: 20, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40, border: '1px solid rgba(255,255,255,0.3)' }}>
                                <SpaceIcon icon={selectedAgentForInfo.icon} />
                            </div>
                            <Typography.Title level={2} style={{ color: 'white', margin: 0 }}>{selectedAgentForInfo.name}</Typography.Title>
                            <Tag color="rgba(255,255,255,0.2)" style={{ border: 'none', color: 'white' }}>{categoryLabels[selectedAgentForInfo.category].label}</Tag>
                        </div>
                        <div style={{ padding: 24 }}>
                            <Typography.Paragraph>{selectedAgentForInfo.description}</Typography.Paragraph>
                            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
                                <Button type="primary" block size="large" onClick={() => { if (!selectedAgentForInfo.isActive) toggleAgent(selectedAgentForInfo.id); setSelectedAgentForInfo(null); }}>
                                    {selectedAgentForInfo.isActive ? 'Using Agent' : 'Enable Agent'}
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};
