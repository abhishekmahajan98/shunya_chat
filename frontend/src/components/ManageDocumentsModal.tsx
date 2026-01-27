import { useState, useEffect } from 'react';
import { Modal, Input, Button, Empty, message, Segmented, Tooltip } from 'antd';
import {
    FileTextOutlined,
    DeleteOutlined,
    PlusOutlined,
    FolderOutlined,
    FolderAddOutlined,
    RightOutlined,
    DownOutlined,
    HomeOutlined,
} from '@ant-design/icons';
import { useTheme } from '../context/ThemeContext';
import { useChat, type SpaceItem } from '../context/ChatContext';
import SpaceIcon from './SpaceIcon';

interface ManageDocumentsModalProps {
    spaceId: string | null;
    open: boolean;
    onClose: () => void;
}

const ManageDocumentsModal = ({ spaceId, open, onClose }: ManageDocumentsModalProps) => {
    const { theme } = useTheme();
    const {
        spaces,
        addDocumentToSpace,
        removeDocumentFromSpace,
    } = useChat();

    const [newItemName, setNewItemName] = useState('');
    const [newItemType, setNewItemType] = useState<'document' | 'folder'>('document');
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
    const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null); // null means root

    // Get the latest space data from context
    const space = spaces.find(s => s.id === spaceId);

    // Reset form when modal closes
    useEffect(() => {
        if (!open) {
            setNewItemName('');
            setNewItemType('document');
            setExpandedFolders(new Set());
            setSelectedFolderId(null);
        }
    }, [open]);

    if (!spaceId || !space) return null;

    const isOwner = space.ownerId === 'current-user';
    const isAdmin = space.members?.some(m => m.userId === 'current-user' && m.role === 'admin');
    const canManageDocs = isOwner || isAdmin || space.members?.some(m => m.userId === 'current-user' && m.role === 'editor');

    const handleAddItem = () => {
        if (!newItemName.trim() || !canManageDocs) return;
        const itemId = `${newItemType}-${Date.now()}`;
        const newItem: SpaceItem = {
            id: itemId,
            name: newItemName.trim(),
            type: newItemType,
            ...(newItemType === 'document' ? { size: Math.floor(Math.random() * 500) + 10 } : { children: [] }),
        };
        addDocumentToSpace(space.id, newItem, selectedFolderId || undefined);
        setNewItemName('');
        // Expand the target folder so the user sees the new item
        if (selectedFolderId) {
            setExpandedFolders(prev => new Set(prev).add(selectedFolderId));
        }
        message.success(`${newItemType === 'folder' ? 'Folder' : 'Document'} added`);
    };

    const handleRemoveItem = (itemId: string) => {
        if (!canManageDocs) return;
        removeDocumentFromSpace(space.id, itemId);
        // If we deleted the currently selected folder, reset selection to root
        if (selectedFolderId === itemId) {
            setSelectedFolderId(null);
        }
        message.success('Item removed');
    };

    const toggleFolder = (folderId: string) => {
        setExpandedFolders(prev => {
            const next = new Set(prev);
            if (next.has(folderId)) next.delete(folderId);
            else next.add(folderId);
            return next;
        });
    };

    // Helper to find folder name for display
    const findFolderName = (items: SpaceItem[], id: string): string => {
        for (const item of items) {
            if (item.id === id) return item.name;
            if (item.children) {
                const found = findFolderName(item.children, id);
                if (found) return found;
            }
        }
        return '';
    };

    const selectedFolderName = selectedFolderId
        ? findFolderName(space.children || [], selectedFolderId)
        : 'Root (Top Level)';

    // Render tree item recursively
    const renderTreeItem = (item: SpaceItem, level: number = 0) => {
        const isFolder = item.type === 'folder';
        const isExpanded = expandedFolders.has(item.id);
        const isSelected = selectedFolderId === item.id;

        return (
            <div key={item.id}>
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        paddingLeft: 12 + level * 20,
                        borderRadius: 6,
                        marginBottom: 2,
                        background: isSelected
                            ? (theme === 'dark' ? 'rgba(237, 172, 51, 0.15)' : 'rgba(237, 172, 51, 0.1)')
                            : (theme === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)'),
                        border: isSelected
                            ? '1px solid #EDAC33'
                            : '1px solid transparent',
                        transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                        if (!isSelected) {
                            e.currentTarget.style.background = theme === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)';
                        }
                    }}
                    onMouseLeave={(e) => {
                        if (!isSelected) {
                            e.currentTarget.style.background = theme === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)';
                        }
                    }}
                >
                    <div
                        style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', flex: 1 }}
                        onClick={() => {
                            if (isFolder) {
                                // If clicking a folder, verify if we are toggling or selecting
                                // For now, let's make single click select, and icon click toggle
                                setSelectedFolderId(item.id);
                            } else {
                                // Clicking a document doesn't select it as a container, obviously
                            }
                        }}
                    >
                        {isFolder && (
                            <div
                                onClick={(e) => {
                                    e.stopPropagation();
                                    toggleFolder(item.id);
                                }}
                                style={{
                                    padding: 4,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center'
                                }}
                            >
                                <span style={{ fontSize: 10, color: theme === 'dark' ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)', width: 12 }}>
                                    {isExpanded ? <DownOutlined /> : <RightOutlined />}
                                </span>
                            </div>
                        )}
                        {!isFolder && <span style={{ width: 20 }} />}

                        {isFolder ? (
                            <FolderOutlined style={{ fontSize: 16, color: '#EDAC33' }} />
                        ) : (
                            <FileTextOutlined style={{ fontSize: 16, color: theme === 'dark' ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.65)' }} />
                        )}

                        <span style={{ flex: 1 }}>{item.name}</span>

                        {!isFolder && item.size && (
                            <span style={{ fontSize: 11, color: theme === 'dark' ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)' }}>
                                {item.size} KB
                            </span>
                        )}
                        {isFolder && item.children && (
                            <span style={{ fontSize: 11, color: theme === 'dark' ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)' }}>
                                {item.children.length} items
                            </span>
                        )}
                    </div>
                    {canManageDocs && (
                        <Button
                            type="text"
                            danger
                            icon={<DeleteOutlined />}
                            onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveItem(item.id);
                            }}
                            size="small"
                        />
                    )}
                </div>
                {isFolder && isExpanded && item.children && item.children.length > 0 && (
                    <div style={{ marginLeft: 0 }}>
                        {item.children.map(child => renderTreeItem(child, level + 1))}
                    </div>
                )}
            </div>
        );
    };

    const styles = {
        header: {
            display: 'flex',
            alignItems: 'center',
            gap: 12,
        },
        spaceIcon: {
            fontSize: 20,
            color: '#EDAC33',
        },
        addSection: {
            display: 'flex',
            flexDirection: 'column' as const,
            gap: 12,
            marginBottom: 16,
            padding: 16,
            background: theme === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
            borderRadius: 8,
            border: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
        },
        targetFolder: {
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 12,
            color: theme === 'dark' ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.65)',
            marginBottom: 4,
        }
    };

    return (
        <Modal
            title={
                <div style={styles.header}>
                    <SpaceIcon icon={space.icon} style={styles.spaceIcon} />
                    <span>{space.name} - Documents</span>
                </div>
            }
            open={open}
            onCancel={onClose}
            footer={null}
            width={600}
        >
            {/* Add Document/Folder Section */}
            {canManageDocs && (
                <div style={styles.addSection}>
                    <div style={styles.targetFolder}>
                        <span>Adding to:</span>
                        <div
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                padding: '2px 8px',
                                background: theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                                borderRadius: 4,
                                fontWeight: 500,
                            }}
                        >
                            {selectedFolderId ? <FolderOutlined /> : <HomeOutlined />}
                            {selectedFolderName}
                            {selectedFolderId && (
                                <Tooltip title="Clear selection (add to root)">
                                    <DeleteOutlined
                                        style={{ cursor: 'pointer', fontSize: 10, marginLeft: 4 }}
                                        onClick={() => setSelectedFolderId(null)}
                                    />
                                </Tooltip>
                            )}
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8 }}>
                        <Segmented
                            options={[
                                { label: <span><FileTextOutlined style={{ marginRight: 4 }} />Doc</span>, value: 'document' },
                                { label: <span><FolderAddOutlined style={{ marginRight: 4 }} />Folder</span>, value: 'folder' },
                            ]}
                            value={newItemType}
                            onChange={(value) => setNewItemType(value as 'document' | 'folder')}
                            size="middle"
                        />
                        <Input
                            placeholder={newItemType === 'folder' ? 'New folder name' : 'Document name (e.g., Report.pdf)'}
                            value={newItemName}
                            onChange={(e) => setNewItemName(e.target.value)}
                            onPressEnter={handleAddItem}
                            style={{ flex: 1 }}
                        />
                        <Button
                            type="primary"
                            icon={<PlusOutlined />}
                            onClick={handleAddItem}
                            disabled={!newItemName.trim()}
                            style={{ background: '#EDAC33', borderColor: '#EDAC33' }}
                        >
                            Add
                        </Button>
                    </div>
                </div>
            )}

            {/* Documents/Folders Tree */}
            <div style={{
                maxHeight: 400,
                overflowY: 'auto',
                border: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
                borderRadius: 8,
                padding: 8,
            }}>
                {space.children && space.children.length > 0 ? (
                    space.children.map(item => renderTreeItem(item))
                ) : (
                    <Empty
                        description="No documents or folders yet"
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        style={{ padding: '40px 0' }}
                    />
                )}
            </div>
        </Modal>
    );
};

export default ManageDocumentsModal;
