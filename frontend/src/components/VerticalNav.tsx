import { useState, useRef } from 'react';
import { Tooltip, Divider, Dropdown } from 'antd';
import {
    PlusOutlined,
    MessageOutlined,
    FolderOutlined,
    RobotOutlined,
    SunOutlined,
    MoonOutlined,
    UserOutlined,
    LogoutOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';
import { HistoryPanel } from './HistoryPanel';
import { SpacesPanel } from './SpacesPanel';
import { AgentsPanel } from './AgentsPanel';

type PanelType = 'history' | 'spaces' | 'agents' | null;

const NavItem = ({
    icon,
    label,
    onClick,
    onMouseEnter,
    active = false
}: {
    icon: React.ReactNode;
    label: string;
    onClick?: () => void;
    onMouseEnter?: () => void;
    active?: boolean;
}) => {
    return (
        <Tooltip title={label} placement="right">
            <div
                onClick={onClick}
                onMouseEnter={onMouseEnter}
                style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    color: active ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                    background: active ? 'var(--color-primary-subtle)' : 'transparent',
                    fontSize: 20,
                }}
            >
                {icon}
            </div>
        </Tooltip>
    );
};

export const VerticalNav = () => {
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const { clearMessages, setConversationId } = useChat();
    const [activePanel, setActivePanel] = useState<PanelType>(null);
    const [agentsExpanded, setAgentsExpanded] = useState(false);
    const hoverTimeoutRef = useRef<any>(null);

    const handleNewChat = () => {
        clearMessages();
        setConversationId(null);
        navigate('/');
    };

    const handleMouseEnter = (panel: PanelType) => {
        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
        setActivePanel(panel);
    };

    const handleMouseLeave = () => {
        hoverTimeoutRef.current = setTimeout(() => {
            setActivePanel(null);
        }, 100);
    };

    return (
        <div
            style={{ position: 'relative', display: 'flex', height: '100%', zIndex: 100 }}
            onMouseLeave={handleMouseLeave}
        >
            {/* Narrow Icon Bar */}
            <div style={{
                width: 64,
                height: '100%',
                background: 'var(--color-sidebar)',
                borderRight: '1px solid var(--color-border)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '16px 0',
                gap: 12,
                flexShrink: 0,
            }}>
                {/* Logo */}
                <div
                    onClick={() => navigate('/')}
                    style={{
                        fontSize: 24,
                        cursor: 'pointer',
                        marginBottom: 12,
                        transition: 'transform 0.2s',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                >
                    ⚡
                </div>

                {/* Primary Actions */}
                <NavItem
                    icon={<PlusOutlined />}
                    label="New Chat"
                    onClick={handleNewChat}
                />

                <Divider style={{ margin: '4px 0', opacity: 0.6 }} />

                {/* Navigation Panels */}
                <NavItem
                    icon={<MessageOutlined />}
                    label="History"
                    active={activePanel === 'history'}
                    onMouseEnter={() => handleMouseEnter('history')}
                />

                <NavItem
                    icon={<FolderOutlined />}
                    label="Spaces"
                    active={activePanel === 'spaces'}
                    onMouseEnter={() => handleMouseEnter('spaces')}
                />

                <NavItem
                    icon={<RobotOutlined />}
                    label="Agents"
                    active={activePanel === 'agents'}
                    onMouseEnter={() => handleMouseEnter('agents')}
                />

                {/* Bottom Actions */}
                <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
                    <NavItem
                        icon={theme === 'dark' ? <SunOutlined /> : <MoonOutlined />}
                        label={theme === 'dark' ? "Light Mode" : "Dark Mode"}
                        onClick={toggleTheme}
                    />

                    {user && (
                        <Dropdown
                            menu={{
                                items: [
                                    { label: user.email, key: 'email', icon: <UserOutlined />, disabled: true },
                                    { type: 'divider' },
                                    { label: 'Logout', key: 'logout', icon: <LogoutOutlined />, onClick: logout }
                                ]
                            }}
                            placement="topRight"
                            trigger={['click']}
                        >
                            <div style={{ cursor: 'pointer', paddingBottom: 8 }}>
                                <div style={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: '50%',
                                    background: 'linear-gradient(135deg, var(--color-primary) 0%, #D99A20 100%)',
                                    color: '#1A1A1A',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontWeight: 700,
                                    fontSize: 14,
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                                }}>
                                    {user.email?.[0].toUpperCase()}
                                </div>
                            </div>
                        </Dropdown>
                    )}
                </div>
            </div>

            {/* Expanding Side Panel Container */}
            <div
                onMouseEnter={() => {
                    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
                }}
                style={{
                    position: 'absolute',
                    left: 64,
                    top: 0,
                    bottom: 0,
                    width: activePanel ? (activePanel === 'agents' && agentsExpanded ? 1100 : 320) : 0,
                    height: '100%',
                    background: 'var(--color-bg)',
                    borderRight: activePanel ? '1px solid var(--color-border)' : 'none',
                    transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    overflow: 'hidden',
                    zIndex: 99,
                    boxShadow: activePanel ? '8px 0 24px rgba(0,0,0,0.1)' : 'none',
                }}
            >
                <div style={{ width: 1100, height: '100%' }}>
                    {activePanel === 'history' && <HistoryPanel />}
                    {activePanel === 'spaces' && <SpacesPanel />}
                    {activePanel === 'agents' && (
                        <AgentsPanel
                            expanded={agentsExpanded}
                            onToggleExpand={() => setAgentsExpanded(!agentsExpanded)}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};
