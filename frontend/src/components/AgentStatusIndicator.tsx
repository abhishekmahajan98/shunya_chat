import React from 'react';
import {
    SearchOutlined,
    DatabaseOutlined,
    MailOutlined,
    CheckOutlined,
    LoadingOutlined
} from '@ant-design/icons';

interface AgentStatus {
    agent: string;
    name: string;
    status: 'starting' | 'running' | 'complete' | 'error';
}

interface AgentStatusIndicatorProps {
    agents: AgentStatus[];
}

const agentIcons: Record<string, React.ReactNode> = {
    search: <SearchOutlined />,
    data: <DatabaseOutlined />,
    email: <MailOutlined />,
};

const AgentStatusIndicator: React.FC<AgentStatusIndicatorProps> = ({ agents }) => {
    if (agents.length === 0) return null;

    return (
        <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '12px',
            color: 'var(--color-text-secondary)',
            marginBottom: '8px',
        }}>
            <span style={{ opacity: 0.7 }}>Using:</span>
            {agents.map((agent) => {
                const isActive = agent.status === 'starting' || agent.status === 'running';
                const isComplete = agent.status === 'complete';

                return (
                    <span
                        key={agent.agent}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            background: isComplete
                                ? 'rgba(16, 185, 129, 0.1)'
                                : 'rgba(139, 92, 246, 0.1)',
                            color: isComplete
                                ? '#10b981'
                                : 'var(--color-text-secondary)',
                            fontSize: '11px',
                            fontWeight: 500,
                            transition: 'all 0.2s ease',
                        }}
                    >
                        {isActive ? (
                            <LoadingOutlined spin style={{ fontSize: '10px' }} />
                        ) : isComplete ? (
                            <CheckOutlined style={{ fontSize: '10px' }} />
                        ) : (
                            agentIcons[agent.agent]
                        )}
                        {agent.name}
                    </span>
                );
            })}
        </div>
    );
};

export default AgentStatusIndicator;
