import React from 'react';
import { List as AntList, Checkbox as AntCheckbox, Typography as AntTypography, Button as AntButton, Empty as AntEmpty } from 'antd';
import { FolderOutlined, CloseOutlined, FileTextOutlined } from '@ant-design/icons';
import { useChat } from '../context/ChatContext';

const { Text } = AntTypography;

const ScopeSelector: React.FC = () => {
    const {
        spaces,
        selectedScope,
        setSelectedScope
    } = useChat();

    const selectedDocuments = React.useMemo(() =>
        selectedScope?.selectedItems.filter(i => i.type === 'document') || []
        , [selectedScope]);

    const handleToggleSpace = (spaceId: string, spaceName: string) => {
        if (selectedScope?.spaceId === spaceId) {
            setSelectedScope(null);
        } else {
            setSelectedScope({
                spaceId,
                spaceName,
                selectedItems: [] // Select whole space by default
            });
        }
    };

    return (
        <div style={{ width: 320 }}>
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0 0 12px',
                borderBottom: '1px solid var(--color-border)',
                marginBottom: 8
            }}>
                <Text strong>Selected Knowledge Space</Text>
                {selectedScope && (
                    <AntButton
                        size="small"
                        type="text"
                        danger
                        icon={<CloseOutlined />}
                        onClick={() => setSelectedScope(null)}
                    >
                        Clear
                    </AntButton>
                )}
            </div>

            {spaces.length === 0 ? (
                <AntEmpty description="No spaces available. Create one in the Spaces tab." />
            ) : (
                <>
                    {selectedScope && selectedDocuments.length > 0 && (
                        <div style={{ marginBottom: 16 }}>
                            <div style={{ marginBottom: 8 }}>
                                <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Selected Documents in {selectedScope.spaceName}</Text>
                            </div>
                            <div style={{
                                maxHeight: 200,
                                overflowY: 'auto',
                                border: '1px solid var(--color-border)',
                                borderRadius: 8,
                                background: 'var(--color-bg-tertiary)'
                            }}>
                                <AntList
                                    size="small"
                                    dataSource={selectedDocuments}
                                    renderItem={(item) => (
                                        <AntList.Item
                                            key={item.id}
                                            style={{ padding: '6px 10px', borderBottom: '1px solid var(--color-border-light)' }}
                                            actions={[
                                                <AntButton
                                                    key="remove"
                                                    type="text"
                                                    size="small"
                                                    icon={<CloseOutlined style={{ fontSize: 10 }} />}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedScope({
                                                            ...selectedScope,
                                                            selectedItems: selectedScope.selectedItems.filter(i => i.id !== item.id)
                                                        });
                                                    }}
                                                />
                                            ]}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                                                <FileTextOutlined style={{ color: 'var(--color-text-secondary)', fontSize: 12 }} />
                                                <Text style={{ fontSize: 12 }} ellipsis>{item.name}</Text>
                                            </div>
                                        </AntList.Item>
                                    )}
                                />
                            </div>
                            <div style={{ marginTop: 8 }}>
                                <AntButton
                                    block
                                    size="small"
                                    onClick={() => setSelectedScope({ ...selectedScope, selectedItems: [] })}
                                >
                                    Switch to Entire Space
                                </AntButton>
                            </div>
                        </div>
                    )}

                    <div style={{ marginBottom: 8 }}>
                        <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            {selectedDocuments.length ? 'Switch Space' : 'Knowledge Spaces'}
                        </Text>
                    </div>
                    <AntList
                        size="small"
                        dataSource={spaces}
                        renderItem={(space) => (
                            <AntList.Item
                                style={{
                                    cursor: 'pointer',
                                    background: selectedScope?.spaceId === space.id ? 'var(--color-primary-subtle)' : 'transparent',
                                    borderRadius: 8,
                                    padding: '8px 12px',
                                    border: 'none',
                                    marginBottom: 4,
                                    transition: 'all 0.2s ease'
                                }}
                                onClick={() => handleToggleSpace(space.id, space.name)}
                                onMouseEnter={(e) => {
                                    if (selectedScope?.spaceId !== space.id) e.currentTarget.style.background = 'var(--color-bg-secondary)';
                                }}
                                onMouseLeave={(e) => {
                                    if (selectedScope?.spaceId !== space.id) e.currentTarget.style.background = 'transparent';
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <FolderOutlined style={{
                                        color: selectedScope?.spaceId === space.id ? 'var(--color-primary)' : 'inherit'
                                    }} />
                                    <Text strong={selectedScope?.spaceId === space.id}>{space.name}</Text>
                                </div>
                                <AntCheckbox
                                    checked={selectedScope?.spaceId === space.id}
                                    style={{ pointerEvents: 'none' }}
                                />
                            </AntList.Item>
                        )}
                    />
                </>
            )}

            <div style={{ marginTop: 12, padding: '8px 12px', background: 'var(--color-bg-secondary)', borderRadius: 8, fontSize: 12 }}>
                <Text type="secondary">
                    Documents in the selected scope are used to ground AI responses with your private data.
                </Text>
            </div>
        </div>
    );
};

export default ScopeSelector;
