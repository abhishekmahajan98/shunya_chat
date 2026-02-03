import React from 'react';
import { Tag, Spin } from 'antd';
import {
    SearchOutlined,
    DatabaseOutlined,
    MailOutlined,
    CheckCircleOutlined,
    LoadingOutlined,
    ExclamationCircleOutlined
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

const statusColors: Record<string, string> = {
    starting: 'processing',
    running: 'processing',
    complete: 'success',
    error: 'error',
};

const AgentStatusIndicator: React.FC<AgentStatusIndicatorProps> = ({ agents }) => {
    if (agents.length === 0) return null;

    return (
        <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px',
            padding: '12px 16px',
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(139, 92, 246, 0.1))',
            borderRadius: '12px',
            marginBottom: '12px',
            border: '1px solid rgba(139, 92, 246, 0.2)',
        }}>
            <span style={{
                fontSize: '12px',
                color: 'rgba(255, 255, 255, 0.6)',
                marginRight: '8px',
                display: 'flex',
                alignItems: 'center',
            }}>
                🤖 Agents:
            </span>
            {agents.map((agent) => (
                <Tag
                    key={agent.agent}
                    icon={
                        agent.status === 'starting' || agent.status === 'running'
                            ? <Spin indicator={<LoadingOutlined style={{ fontSize: 12 }} spin />} size="small" />
                            : agent.status === 'complete'
                                ? <CheckCircleOutlined />
                                : agent.status === 'error'
                                    ? <ExclamationCircleOutlined />
                                    : agentIcons[agent.agent]
                    }
                    color={statusColors[agent.status] || 'default'}
                    style={{
                        borderRadius: '16px',
                        padding: '4px 12px',
                        fontSize: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                    }}
                >
                    {agent.name}
                </Tag>
            ))}
        </div>
    );
};

export default AgentStatusIndicator;
