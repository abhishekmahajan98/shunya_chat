import { useState } from 'react';
import { Typography, Switch, Input, Skeleton, Modal, Divider, Tag, Button } from 'antd';
import {
  SearchOutlined,
  StarOutlined,
  StarFilled,
  DownOutlined,
  ClockCircleOutlined,
  MoreOutlined,
  ShrinkOutlined,
  RightOutlined,
  AppstoreOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import { useChat, type Agent, type AgentCategory } from '../context/ChatContext';
import SpaceIcon from './SpaceIcon';
import { Dropdown, message } from 'antd';
import type { MenuProps } from 'antd';

interface RightSidebarProps {
  isTablet?: boolean;
  expanded?: boolean;
  onToggleExpand?: () => void;
}

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

      {/* Actions */}
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

const RightSidebar = ({ isTablet = false, expanded = false, onToggleExpand = () => { } }: RightSidebarProps) => {
  const {
    agents,
    isLoadingAgents,
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

  // Filter agents
  const filteredAgents = agents.filter((a) => {
    const matchesSearch = a.name.toLowerCase().includes(agentSearch.toLowerCase()) ||
      a.description.toLowerCase().includes(agentSearch.toLowerCase());
    // Discovery mode (expanded): show all. Normal mode: show only accessed.
    return expanded ? matchesSearch : (a.hasAccess && matchesSearch);
  });

  const favoriteAgents = filteredAgents.filter((a) => a.isFavorite);

  // Group by category
  const categories: AgentCategory[] = ['research', 'compliance', 'finance', 'automation'];
  const agentsByCategory = categories.reduce((acc, cat) => {
    acc[cat] = filteredAgents.filter((a) => a.category === cat && !a.isFavorite);
    return acc;
  }, {} as Record<AgentCategory, Agent[]>);

  const runningTasks = backgroundTasks.filter((t) => t.status === 'running');

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--color-sidebar)',
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

      {/* Header (with Expansion Toggle) */}
      {!isTablet && (
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--color-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          minHeight: 64,
          background: 'var(--color-sidebar)',
        }}>
          {expanded ? (
            // Expanded Header: Marketplace
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Typography.Text strong style={{ fontSize: 18, color: 'var(--color-text)' }}>
                  Agent Marketplace
                </Typography.Text>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 12px',
                    borderRadius: 8,
                    cursor: 'pointer',
                    color: 'var(--color-primary)',
                    background: 'var(--color-primary-bg-hover)',
                    border: '1px solid var(--color-primary-border)',
                    fontSize: 13,
                    fontWeight: 500,
                    transition: 'all 0.2s ease',
                  }}
                  onClick={() => window.location.href = '/register-agent'}
                >
                  + Submit Agent
                </div>

                <div
                  onClick={onToggleExpand}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 12px',
                    borderRadius: 8,
                    cursor: 'pointer',
                    color: 'var(--color-text-secondary)',
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    fontSize: 13,
                    fontWeight: 500,
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--color-surface-hover)';
                    e.currentTarget.style.color = 'var(--color-text)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'var(--color-surface)';
                    e.currentTarget.style.color = 'var(--color-text-secondary)';
                  }}
                >
                  <ShrinkOutlined /> Back to Chat
                </div>
              </div>
            </>
          ) : (
            // Collapsed Header: My Agents
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Typography.Text strong style={{ fontSize: 16, color: 'var(--color-text)' }}>
                  My Agents
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

              <div
                onClick={onToggleExpand}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 10px',
                  borderRadius: 8,
                  cursor: 'pointer',
                  color: 'var(--color-primary)',
                  background: 'var(--color-primary-bg-hover)', // subtle tint or surface
                  border: '1px solid var(--color-primary-border)', // subtle border
                  fontSize: 12,
                  fontWeight: 600,
                  transition: 'all 0.2s ease',
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = '0.8';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = '1';
                }}
                title="Browse Agent Marketplace"
              >
                <AppstoreOutlined style={{ fontSize: 14 }} />
                <span>Browse</span>
              </div>
            </>
          )}
        </div>
      )}

      {/* Search */}
      <div style={{
        padding: expanded ? '12px 24px' : '12px',
        width: '100%',
        transition: 'all 0.3s ease',
      }}>
        <Input
          placeholder={expanded ? "Search for agents to add to your workflow..." : "Search agents..."}
          prefix={<SearchOutlined style={{ color: 'var(--color-text-tertiary)', fontSize: expanded ? 16 : 14 }} />}
          value={agentSearch}
          onChange={(e) => setAgentSearch(e.target.value)}
          size={expanded ? "large" : "middle"}
          style={{
            borderRadius: 8,
            background: 'var(--color-surface)',
            border: expanded ? '1px solid var(--color-border)' : 'none',
            boxShadow: expanded ? '0 2px 8px rgba(0,0,0,0.05)' : 'none',
          }}
        />
      </div>

      {/* Running Background Tasks */}
      {runningTasks.length > 0 && (
        <div style={{ padding: '0 12px 12px' }}>
          <div style={{
            padding: '10px 12px',
            borderRadius: 8,
            background: 'var(--color-sidebar-active)',
            border: '1px solid var(--color-primary)',
          }}>
            <div style={{
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--color-primary)',
              marginBottom: 8,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}>
              <ClockCircleOutlined /> Running Tasks ({runningTasks.length})
            </div>
            {runningTasks.slice(0, 2).map((task) => (
              <div key={task.id} style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 12, color: 'var(--color-text)', marginBottom: 4 }}>
                  {task.agentName}: "{task.query.slice(0, 30)}..."
                </div>
                <div style={{
                  height: 4,
                  borderRadius: 2,
                  background: 'var(--color-border)',
                  overflow: 'hidden',
                }}>
                  <div style={{
                    width: `${task.progress}%`,
                    height: '100%',
                    background: 'var(--color-primary)',
                    transition: 'width 0.3s ease',
                  }} />
                </div>
                {task.willEmail && (
                  <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', marginTop: 4 }}>
                    📧 Will email when done
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Agent List */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: expanded ? '24px' : '0 12px',
      }}>
        {expanded ? (
          // GRID VIEW (Discovery Mode)
          <div className="animate-fade-in">
            {/* Favorites Section */}
            {favoriteAgents.length > 0 && (
              <div style={{ marginBottom: 32 }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 16,
                  paddingBottom: 8,
                  borderBottom: '1px solid var(--color-border)',
                }}>
                  <StarFilled style={{ fontSize: 20, color: 'var(--color-primary)' }} />
                  <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-text)' }}>Favorites</span>
                  <span style={{ fontSize: 14, color: 'var(--color-text-tertiary)' }}>({favoriteAgents.length})</span>
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                  gap: 16,
                }}>
                  {isLoadingAgents ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} style={{ padding: 16, borderRadius: 12, border: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
                        <Skeleton active avatar={{ shape: 'square' }} paragraph={{ rows: 1 }} />
                      </div>
                    ))
                  ) : (
                    favoriteAgents.map((agent) => (
                      <AgentTile
                        key={agent.id}
                        agent={agent}
                        onToggle={() => toggleAgent(agent.id)}
                        onToggleFavorite={() => toggleAgentFavorite(agent.id)}
                        onRequestAccess={() => { }}
                        onShowInfo={() => setSelectedAgentForInfo(agent)}
                      />
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Categories */}
            {categories.map((category) => {
              const categoryAgents = agentsByCategory[category];
              if (categoryAgents.length === 0) return null;
              const { label, icon } = categoryLabels[category];

              return (
                <div key={category} style={{ marginBottom: 32 }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 16,
                    paddingBottom: 8,
                    borderBottom: '1px solid var(--color-border)',
                  }}>
                    <SpaceIcon icon={icon} style={{ fontSize: 20, color: 'var(--color-text-secondary)' }} />
                    <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-text)' }}>{label}</span>
                    <span style={{ fontSize: 14, color: 'var(--color-text-tertiary)' }}>({categoryAgents.length})</span>
                  </div>

                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                    gap: 16,
                  }}>
                    {isLoadingAgents ? (
                      Array.from({ length: 2 }).map((_, i) => (
                        <div key={i} style={{ padding: 16, borderRadius: 12, border: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
                          <Skeleton active avatar={{ shape: 'square' }} paragraph={{ rows: 1 }} />
                        </div>
                      ))
                    ) : (
                      categoryAgents.map((agent) => (
                        <AgentTile
                          key={agent.id}
                          agent={agent}
                          onToggle={() => toggleAgent(agent.id)}
                          onToggleFavorite={() => toggleAgentFavorite(agent.id)}
                          onRequestAccess={() => { }}
                          onShowInfo={() => setSelectedAgentForInfo(agent)}
                        />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          // LIST VIEW (Sidebar Mode)
          <div className="animate-fade-in" style={{ animationDelay: '0.1s' }}>
            {/* Favorites */}
            {favoriteAgents.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: 'var(--color-text-tertiary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  padding: '8px 0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}>
                  <StarFilled style={{ fontSize: 10, color: 'var(--color-primary)' }} /> Favorites
                </div>
                {isLoadingAgents ? (
                  Array.from({ length: 2 }).map((_, i) => (
                    <div key={i} style={{ padding: 12, borderRadius: 10, border: '1px solid var(--color-border)', background: 'var(--color-surface)', marginBottom: 6 }}>
                      <Skeleton active avatar={{ size: 'small', shape: 'square' }} paragraph={{ rows: 1 }} title={false} />
                    </div>
                  ))
                ) : (
                  favoriteAgents.map((agent) => (
                    <AgentCard
                      key={agent.id}
                      agent={agent}
                      onToggle={() => toggleAgent(agent.id)}
                      onToggleFavorite={() => toggleAgentFavorite(agent.id)}
                      onRequestAccess={() => { }}
                      onShowInfo={() => setSelectedAgentForInfo(agent)}
                    />
                  ))
                )}
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
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: 'var(--color-text-tertiary)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      padding: '8px 0',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      cursor: 'pointer',
                    }}
                  >
                    <span style={{
                      fontSize: 10,
                    }}>
                      {isCollapsed ? <RightOutlined /> : <DownOutlined />}
                    </span>
                    <SpaceIcon icon={icon} style={{ fontSize: 14, color: 'var(--color-text-secondary)' }} /> {label}
                    <span style={{
                      fontSize: 10,
                      color: 'var(--color-text-tertiary)',
                      fontWeight: 400,
                    }}>
                      ({categoryAgents.length})
                    </span>
                  </div>
                  {!isCollapsed && (
                    isLoadingAgents ? (
                      Array.from({ length: 2 }).map((_, i) => (
                        <div key={i} style={{ padding: 12, borderRadius: 10, border: '1px solid var(--color-border)', background: 'var(--color-surface)', marginBottom: 6 }}>
                          <Skeleton active avatar={{ size: 'small', shape: 'square' }} paragraph={{ rows: 1 }} title={false} />
                        </div>
                      ))
                    ) : (
                      categoryAgents.map((agent) => (
                        <AgentCard
                          key={agent.id}
                          agent={agent}
                          onToggle={() => toggleAgent(agent.id)}
                          onToggleFavorite={() => toggleAgentFavorite(agent.id)}
                          onRequestAccess={() => { }} // Not needed for accessed agents
                          onShowInfo={() => setSelectedAgentForInfo(agent)}
                        />
                      ))
                    )
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Agent Information Modal */}
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
          <div>
            {/* Modal Header/Banner */}
            <div style={{
              padding: '48px 32px',
              background: 'linear-gradient(135deg, var(--color-primary) 0%, #F59E0B 100%)',
              color: 'var(--color-text-inverse)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 20,
              position: 'relative',
            }}>
              {/* Custom Close Button */}
              <div
                onClick={() => setSelectedAgentForInfo(null)}
                style={{
                  position: 'absolute',
                  top: 16,
                  right: 16,
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: 'rgba(255,255,255,0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  backdropFilter: 'blur(4px)',
                  color: 'white',
                  fontSize: 14,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.2)';
                }}
              >
                <CloseOutlined />
              </div>

              <div style={{
                width: 80,
                height: 80,
                borderRadius: 20,
                background: 'rgba(255,255,255,0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 40,
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255,255,255,0.3)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
              }}>
                <SpaceIcon icon={selectedAgentForInfo.icon} style={{ color: 'white' }} />
              </div>
              <div style={{ textAlign: 'center' }}>
                <Typography.Title
                  level={2}
                  style={{
                    color: 'white',
                    margin: 0,
                    marginBottom: 8,
                    fontFamily: "'Playfair Display', serif",
                    fontSize: 32,
                  }}
                >
                  {selectedAgentForInfo.name}
                </Typography.Title>
                <Tag
                  color="rgba(255,255,255,0.2)"
                  style={{
                    border: 'none',
                    color: 'white',
                    borderRadius: 6,
                    padding: '4px 12px',
                    fontSize: 13,
                    fontWeight: 500,
                  }}
                >
                  {categoryLabels[selectedAgentForInfo.category].label}
                </Tag>
              </div>
            </div>

            {/* Modal Body */}
            <div style={{ padding: 24 }}>
              <Typography.Paragraph style={{ fontSize: 15, color: 'var(--color-text)', lineHeight: 1.6 }}>
                {selectedAgentForInfo.description}
              </Typography.Paragraph>

              <Divider style={{ margin: '20px 0' }} />

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
                <div style={{ flex: 1, minWidth: 120 }}>
                  <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                    ACCESS STATUS
                  </Typography.Text>
                  <Typography.Text strong style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {selectedAgentForInfo.hasAccess ? (
                      <span style={{ color: '#10b981' }}>✓ Granted</span>
                    ) : (
                      <span style={{ color: 'var(--color-text-tertiary)' }}>Locked</span>
                    )}
                  </Typography.Text>
                </div>
                {selectedAgentForInfo.capabilities && selectedAgentForInfo.capabilities.length > 0 && (
                  <div style={{ flex: 2, minWidth: 200 }}>
                    <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
                      CAPABILITIES
                    </Typography.Text>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {selectedAgentForInfo.capabilities.map((cap) => (
                        <Tag key={cap} style={{ borderRadius: 4, margin: 0, textTransform: 'capitalize' }}>
                          {cap}
                        </Tag>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                {selectedAgentForInfo.hasAccess ? (
                  <Button
                    type="primary"
                    block
                    size="large"
                    onClick={() => {
                      if (!selectedAgentForInfo.isActive) toggleAgent(selectedAgentForInfo.id);
                      setSelectedAgentForInfo(null);
                    }}
                    style={{
                      height: 48,
                      borderRadius: 10,
                      background: 'var(--color-primary)',
                      border: 'none',
                    }}
                  >
                    {selectedAgentForInfo.isActive ? 'Using Agent' : 'Enable Agent'}
                  </Button>
                ) : (
                  <Button
                    type="primary"
                    block
                    size="large"
                    onClick={() => {
                      message.success(`Access request sent for ${selectedAgentForInfo.name}`);
                      setSelectedAgentForInfo(null);
                    }}
                    style={{
                      height: 48,
                      borderRadius: 10,
                    }}
                  >
                    Request Access
                  </Button>
                )}
                <Button
                  size="large"
                  icon={selectedAgentForInfo.isFavorite ? <StarFilled /> : <StarOutlined />}
                  onClick={() => toggleAgentFavorite(selectedAgentForInfo.id)}
                  style={{
                    height: 48,
                    width: 48,
                    borderRadius: 10,
                    color: selectedAgentForInfo.isFavorite ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </Modal>

    </div>
  );
};

export default RightSidebar;
