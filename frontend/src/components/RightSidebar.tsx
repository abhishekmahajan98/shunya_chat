import { useState } from 'react';
import { Typography, Switch, Input, Badge } from 'antd';
import {
  SearchOutlined,
  StarOutlined,
  StarFilled,
  DownOutlined,
  RightOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { useChat, type Agent, type AgentCategory } from '../context/ChatContext';

interface RightSidebarProps {
  isTablet?: boolean;
}

const categoryLabels: Record<AgentCategory, { label: string; icon: string }> = {
  research: { label: 'Research', icon: '🧪' },
  compliance: { label: 'Compliance', icon: '📋' },
  finance: { label: 'Finance', icon: '💰' },
  automation: { label: 'Automation', icon: '⚙️' },
};

const AgentCard = ({
  agent,
  onToggle,
  onToggleFavorite
}: {
  agent: Agent;
  onToggle: () => void;
  onToggleFavorite: () => void;
}) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: 10,
      padding: '12px',
      borderRadius: 10,
      marginBottom: 6,
      border: agent.isActive ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
      background: agent.isActive ? 'var(--color-sidebar-active)' : 'var(--color-surface)',
      transition: 'all 0.2s ease',
      cursor: 'pointer',
    }}
    onClick={onToggle}
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
    }}>
      {agent.icon}
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
    </div>
  </div>
);

const RightSidebar = ({ isTablet = false }: RightSidebarProps) => {
  const {
    agents,
    toggleAgent,
    toggleAgentFavorite,
    activeAgents,
    agentSearch,
    setAgentSearch,
    backgroundTasks,
  } = useChat();

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
  const filteredAgents = agents.filter((a) =>
    a.name.toLowerCase().includes(agentSearch.toLowerCase()) ||
    a.description.toLowerCase().includes(agentSearch.toLowerCase())
  );

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
    }}>
      {/* Header */}
      {!isTablet && (
        <div style={{
          padding: '16px',
          borderBottom: '1px solid var(--color-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          minHeight: 60,
        }}>
          <Typography.Text strong style={{ fontSize: 16, color: 'var(--color-text)' }}>
            Agents
          </Typography.Text>
          <Badge count={activeAgents.length} style={{ backgroundColor: 'var(--color-primary)' }}>
            <span style={{
              fontSize: 12,
              color: 'var(--color-text-secondary)',
              padding: '4px 8px',
              borderRadius: 12,
              background: 'var(--color-surface-hover)',
            }}>
              active
            </span>
          </Badge>
        </div>
      )}

      {/* Search */}
      <div style={{ padding: '12px' }}>
        <Input
          placeholder="Search agents..."
          prefix={<SearchOutlined style={{ color: 'var(--color-text-tertiary)' }} />}
          value={agentSearch}
          onChange={(e) => setAgentSearch(e.target.value)}
          style={{
            borderRadius: 8,
            background: 'var(--color-surface)',
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
        padding: '0 12px',
      }}>
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
            {favoriteAgents.map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                onToggle={() => toggleAgent(agent.id)}
                onToggleFavorite={() => toggleAgentFavorite(agent.id)}
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
                <span style={{ fontSize: 10 }}>
                  {isCollapsed ? <RightOutlined /> : <DownOutlined />}
                </span>
                {icon} {label}
                <span style={{
                  fontSize: 10,
                  color: 'var(--color-text-tertiary)',
                  fontWeight: 400,
                }}>
                  ({categoryAgents.length})
                </span>
              </div>
              {!isCollapsed && categoryAgents.map((agent) => (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  onToggle={() => toggleAgent(agent.id)}
                  onToggleFavorite={() => toggleAgentFavorite(agent.id)}
                />
              ))}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div style={{
        padding: '12px',
        borderTop: '1px solid var(--color-border)',
        fontSize: 11,
        color: 'var(--color-text-tertiary)',
        textAlign: 'center',
      }}>
        Toggle agents to enhance your chat
      </div>
    </div>
  );
};

export default RightSidebar;
