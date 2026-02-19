import { Button, Skeleton, Typography } from 'antd';
import { MessageOutlined } from '@ant-design/icons';
import { useChat } from '../context/ChatContext';

export const HistoryPanel = () => {
    const {
        conversations,
        loadConversation,
        conversationId,
        hasMoreHistory,
        loadMoreHistory,
        isLoadingHistory,
    } = useChat();

    return (
        <div style={{
            height: '100%',
            width: 320,
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--color-bg)',
            color: 'var(--color-text)',
            overflowX: 'hidden',
        }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)', minHeight: 64, display: 'flex', alignItems: 'center' }}>
                <Typography.Text strong style={{ fontSize: 16 }}>Chat History</Typography.Text>
            </div>

            <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '12px',
            }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {isLoadingHistory && conversations.length === 0 ? (
                        Array.from({ length: 8 }).map((_, i) => (
                            <div key={i} style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                                <Skeleton.Button active size="small" style={{ width: 180, height: 16, borderRadius: 4 }} />
                                <Skeleton.Button active size="small" style={{ width: 100, height: 12, borderRadius: 4 }} />
                            </div>
                        ))
                    ) : (
                        conversations.map(chat => (
                            <div
                                key={chat.id}
                                onClick={() => loadConversation(chat.id)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 12,
                                    padding: '10px 12px',
                                    borderRadius: 8,
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease',
                                    background: conversationId === chat.id ? 'var(--color-sidebar-active)' : 'transparent',
                                    borderLeft: conversationId === chat.id ? '3px solid var(--color-primary)' : '3px solid transparent',
                                    marginBottom: 2,
                                }}
                                onMouseEnter={(e) => {
                                    if (conversationId !== chat.id) e.currentTarget.style.background = 'var(--color-sidebar-hover)';
                                }}
                                onMouseLeave={(e) => {
                                    if (conversationId !== chat.id) e.currentTarget.style.background = 'transparent';
                                }}
                            >
                                <MessageOutlined style={{
                                    fontSize: 16,
                                    color: conversationId === chat.id ? 'var(--color-primary)' : 'var(--color-text-tertiary)'
                                }} />
                                <span style={{
                                    flex: 1,
                                    fontSize: 14,
                                    color: conversationId === chat.id ? 'var(--color-text)' : 'var(--color-text-secondary)',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                }}>
                                    {chat.title || 'Untitled Chat'}
                                </span>
                            </div>
                        ))
                    )}

                    {!isLoadingHistory && conversations.length === 0 && (
                        <div style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: 13 }}>
                            No recent chats found
                        </div>
                    )}

                    {hasMoreHistory && conversations.length > 0 && (
                        <Button
                            type="text"
                            size="small"
                            onClick={loadMoreHistory}
                            loading={isLoadingHistory}
                            style={{
                                width: '100%',
                                color: 'var(--color-primary)',
                                fontSize: 12,
                                marginTop: 12,
                            }}
                        >
                            Load More
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
};
