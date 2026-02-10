import { useState, useEffect } from 'react';
import { Modal, Empty, message, Upload, Button, Input, Tooltip } from 'antd';
import {
    DeleteOutlined,
    FileTextOutlined,
    FolderOutlined,
    FolderAddOutlined,
    UploadOutlined,
    HomeOutlined,
    RightOutlined,
    DownOutlined,
    CheckCircleOutlined,
    ClockCircleOutlined,
    ExclamationCircleOutlined,
} from '@ant-design/icons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useChat, type SpaceItem, type Space } from '../context/ChatContext';
import SpaceIcon from './SpaceIcon';

const { Dragger } = Upload;

interface ManageDocumentsModalProps {
    spaceId: string | null;
    open: boolean;
    onClose: () => void;
}

const ManageDocumentsModal = ({ spaceId, open, onClose }: ManageDocumentsModalProps) => {
    const { theme } = useTheme();
    const { user } = useAuth();
    const {
        spaces,
        uploadDocument,
        createFolder,
        removeDocumentFromSpace,
    } = useChat();

    const [isUploading, setIsUploading] = useState(false);
    const [localSpace, setLocalSpace] = useState<Space | null>(null);
    const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
    const [isCreatingFolder, setIsCreatingFolder] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');

    // Fetch space details including documents when modal opens
    const fetchDetails = async () => {
        if (!spaceId) return;
        const { getSpace } = await import('../api');
        try {
            const data = await getSpace(spaceId);

            // Build tree from flat list
            const buildTree = (docs: any[], parentId: string | null = null): SpaceItem[] => {
                return docs
                    .filter(d => (d.parent_id === parentId))
                    .map(d => ({
                        id: d.id,
                        name: d.name,
                        type: d.type as 'document' | 'folder',
                        status: d.status,
                        size: d.size_bytes ? d.size_bytes / 1024 : 0,
                        children: d.type === 'folder' ? buildTree(docs, d.id) : undefined
                    }));
            };

            const mappedItems = buildTree(data.documents);

            setLocalSpace({
                ...data,
                icon: data.type === 'personal' ? 'user' : 'folder',
                isPinned: false,
                isPersonal: data.type === 'personal',
                type: data.type || 'shared',
                documentCount: data.documents.filter((d: any) => d.type === 'document').length,
                children: mappedItems,
                ownerId: data.owner_id,
            } as Space);
        } catch (error) {
            console.error('Failed to fetch space details:', error);
            message.error('Failed to load documents');
        }
    };

    useEffect(() => {
        if (open && spaceId) {
            fetchDetails();
        } else if (!open) {
            setLocalSpace(null);
            setSelectedFolderId(null);
            setExpandedFolders(new Set());
            setIsCreatingFolder(false);
        }
    }, [open, spaceId]);

    const space = localSpace || spaces.find(s => s.id === spaceId);

    if (!spaceId || !space) return null;

    const isOwner = space.ownerId === user?.id;
    const isAdmin = space.members?.some(m => m.userId === user?.id && m.role === 'admin');
    const canManageDocs = isOwner || isAdmin || space.members?.some(m => m.userId === user?.id && m.role === 'editor');

    const handleUpload = async (file: File) => {
        if (!canManageDocs) return;
        setIsUploading(true);
        try {
            await uploadDocument(space.id, file, selectedFolderId || undefined);
            message.success(`${file.name} uploaded successfully`);
            await fetchDetails();
        } catch (error) {
            message.error(`Failed to upload ${file.name}`);
        } finally {
            setIsUploading(false);
        }
        return false;
    };

    const handleCreateFolder = async () => {
        if (!newFolderName.trim() || !canManageDocs) return;
        try {
            await createFolder(space.id, newFolderName, selectedFolderId || undefined);
            message.success(`Folder "${newFolderName}" created`);
            setNewFolderName('');
            setIsCreatingFolder(false);
            await fetchDetails();
        } catch (error) {
            message.error('Failed to create folder');
        }
    };

    const handleRemoveItem = async (itemId: string) => {
        if (!canManageDocs) return;
        try {
            await removeDocumentFromSpace(space.id, itemId);
            message.success('Item removed');
            await fetchDetails();
        } catch (error) {
            message.error('Failed to remove item');
        }
    };

    const toggleFolder = (folderId: string) => {
        setExpandedFolders(prev => {
            const next = new Set(prev);
            if (next.has(folderId)) next.delete(folderId);
            else next.add(folderId);
            return next;
        });
    };

    const renderTreeItem = (item: SpaceItem, level: number = 0) => {
        const isFolder = item.type === 'folder';
        const isSelected = selectedFolderId === item.id;
        const isExpanded = expandedFolders.has(item.id);

        return (
            <div key={item.id}>
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '6px 10px',
                        paddingLeft: 10 + level * 20,
                        borderRadius: 6,
                        marginBottom: 2,
                        background: isSelected
                            ? (theme === 'dark' ? 'rgba(237, 172, 51, 0.15)' : 'rgba(237, 172, 51, 0.1)')
                            : 'transparent',
                        border: isSelected ? '1px solid #EDAC33' : '1px solid transparent',
                        cursor: isFolder ? 'pointer' : 'default',
                        transition: 'all 0.15s ease',
                    }}
                    onClick={() => {
                        if (isFolder) setSelectedFolderId(item.id);
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, overflow: 'hidden' }}>
                        {isFolder && (
                            <div onClick={(e) => { e.stopPropagation(); toggleFolder(item.id); }} style={{ display: 'flex', alignItems: 'center', padding: 2 }}>
                                {isExpanded ? <DownOutlined style={{ fontSize: 10 }} /> : <RightOutlined style={{ fontSize: 10 }} />}
                            </div>
                        )}
                        {!isFolder && <div style={{ width: 14 }} />}

                        {isFolder ? (
                            <FolderOutlined style={{ color: '#EDAC33' }} />
                        ) : (
                            <FileTextOutlined style={{ color: theme === 'dark' ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)' }} />
                        )}
                        <span style={{
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            fontSize: 13,
                            color: theme === 'dark' ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.85)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8
                        }}>
                            {item.name}
                            {!isFolder && item.status && (
                                <Tooltip title={`Status: ${item.status}`}>
                                    {item.status === 'completed' && <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 12 }} />}
                                    {item.status === 'processing' && <ClockCircleOutlined style={{ color: '#faad14', fontSize: 12 }} />}
                                    {item.status === 'error' && <ExclamationCircleOutlined style={{ color: '#ff4d4f', fontSize: 12 }} />}
                                </Tooltip>
                            )}
                        </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        {!isFolder && item.size && (
                            <span style={{ fontSize: 11, color: theme === 'dark' ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)' }}>
                                {item.size < 1024 ? `${item.size.toFixed(1)} KB` : `${(item.size / 1024).toFixed(1)} MB`}
                            </span>
                        )}
                        {canManageDocs && (
                            <Tooltip title="Delete">
                                <DeleteOutlined
                                    style={{ color: 'rgba(255,255,255,0.25)', cursor: 'pointer' }}
                                    onMouseEnter={e => e.currentTarget.style.color = '#ff4d4f'}
                                    onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.25)'}
                                    onClick={(e) => { e.stopPropagation(); handleRemoveItem(item.id); }}
                                />
                            </Tooltip>
                        )}
                    </div>
                </div>
                {isFolder && isExpanded && item.children && item.children.length > 0 && (
                    <div>
                        {item.children.map(child => renderTreeItem(child, level + 1))}
                    </div>
                )}
            </div>
        );
    };

    // Helper to find folder name for target indicator
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

    const targetLabel = selectedFolderId ? findFolderName(space.children || [], selectedFolderId) : 'Root';

    return (
        <Modal
            title={
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <SpaceIcon icon={space.icon} style={{ fontSize: 20, color: '#EDAC33' }} />
                    <span>{space.name} - Documents</span>
                </div>
            }
            open={open}
            onCancel={onClose}
            footer={null}
            width={700}
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Upload & Create Folder Actions */}
                {canManageDocs && (
                    <div style={{
                        background: theme === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
                        padding: 16,
                        borderRadius: 12,
                        border: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>Target:</span>
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    background: theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                                    padding: '4px 10px',
                                    borderRadius: 6,
                                    fontSize: 12,
                                    fontWeight: 500,
                                    color: '#EDAC33'
                                }}>
                                    {selectedFolderId ? <FolderOutlined /> : <HomeOutlined />}
                                    {targetLabel}
                                    {selectedFolderId && (
                                        <Tooltip title="Reset to Root">
                                            <DeleteOutlined
                                                style={{ fontSize: 10, marginLeft: 4, cursor: 'pointer', color: 'rgba(255,255,255,0.3)' }}
                                                onClick={() => setSelectedFolderId(null)}
                                            />
                                        </Tooltip>
                                    )}
                                </div>
                            </div>

                            {!isCreatingFolder ? (
                                <Button
                                    type="text"
                                    size="small"
                                    icon={<FolderAddOutlined />}
                                    onClick={() => setIsCreatingFolder(true)}
                                    style={{ color: '#EDAC33' }}
                                >
                                    New Folder
                                </Button>
                            ) : (
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <Input
                                        size="small"
                                        placeholder="Folder name"
                                        value={newFolderName}
                                        onChange={e => setNewFolderName(e.target.value)}
                                        onPressEnter={handleCreateFolder}
                                        autoFocus
                                        style={{ width: 140 }}
                                    />
                                    <Button size="small" type="primary" onClick={handleCreateFolder} style={{ background: '#EDAC33', borderColor: '#EDAC33' }}>Create</Button>
                                    <Button size="small" type="text" onClick={() => { setIsCreatingFolder(false); setNewFolderName(''); }}>Cancel</Button>
                                </div>
                            )}
                        </div>

                        <Dragger
                            multiple={true}
                            beforeUpload={handleUpload}
                            showUploadList={true}
                            disabled={isUploading}
                            style={{ background: 'transparent' }}
                        >
                            <p className="ant-upload-drag-icon">
                                <UploadOutlined style={{ color: '#EDAC33', fontSize: 24 }} />
                            </p>
                            <p className="ant-upload-text" style={{ fontSize: 14 }}>Drag files here to upload to <b>{targetLabel}</b></p>
                            <p className="ant-upload-hint" style={{ fontSize: 12, opacity: 0.5 }}>
                                PDFs, Docs, or text files for knowledge extraction.
                            </p>
                        </Dragger>
                    </div>
                )}

                {/* Documents Tree */}
                <div style={{
                    maxHeight: 400,
                    overflowY: 'auto',
                    border: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
                    borderRadius: 12,
                    padding: 8,
                }}>
                    <div style={{ padding: '4px 10px', fontSize: 11, color: 'var(--color-text-tertiary)', display: 'flex', justifyContent: 'space-between' }}>
                        <span>NAME</span>
                        <span>SIZE / ACTIONS</span>
                    </div>
                    <div style={{ height: 1, background: theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', margin: '4px 0 8px' }} />

                    {space.children && space.children.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {space.children.map(item => renderTreeItem(item))}
                        </div>
                    ) : (
                        <Empty
                            description="This space is empty"
                            image={Empty.PRESENTED_IMAGE_SIMPLE}
                            style={{ padding: '60px 0' }}
                        />
                    )}
                </div>
            </div>
        </Modal>
    );
};

export default ManageDocumentsModal;
