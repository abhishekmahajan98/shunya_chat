import React from 'react';
import { List as AntList, Checkbox as AntCheckbox, Typography as AntTypography, Button as AntButton, Empty as AntEmpty } from 'antd';
import { FolderOutlined, CloseOutlined } from '@ant-design/icons';
import { useChat } from '../context/ChatContext';

const { Text } = AntTypography;

const ScopeSelector: React.FC = () => {
    const {
        spaces,
        selectedScope,
        setSelectedScope
    } = useChat();

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
                                marginBottom: 4
                            }}
                            onClick={() => handleToggleSpace(space.id, space.name)}
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
            )}

            <div style={{ marginTop: 12, padding: '8px 12px', background: 'var(--color-bg-secondary)', borderRadius: 8, fontSize: 12 }}>
                <Text type="secondary">
                    Selecting a space will enable RAG retrieval. The AI will prioritize information from these documents.
                </Text>
            </div>
        </div>
    );
};

export default ScopeSelector;
