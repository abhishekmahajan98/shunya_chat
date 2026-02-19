import { useState } from 'react';
import { Button, Dropdown, message, Tooltip, Typography } from 'antd';
import type { MenuProps } from 'antd';
import {
    StarOutlined,
    StarFilled,
    FolderOutlined,
    FileTextOutlined,
    RightOutlined,
    DownOutlined,
    CheckOutlined,
    MoreOutlined,
    TeamOutlined,
    FolderAddOutlined,
    EditOutlined,
    UserAddOutlined,
} from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';
import { useChat, type Space, type SpaceItem } from '../context/ChatContext';
import SpaceIcon from './SpaceIcon';
import AddMembersModal from './AddMembersModal';
import ManageDocumentsModal from './ManageDocumentsModal';
import IconPickerModal from './IconPickerModal';

// Folder Tree Item Component
interface TreeItemProps {
    item: SpaceItem;
    level: number;
    selectedIds: string[];
    onToggleSelect: (id: string, name: string, type: 'folder' | 'document') => void;
    expandedFolders: Set<string>;
    onToggleExpand: (id: string) => void;
}

const TreeItem = ({ item, level, selectedIds, onToggleSelect, expandedFolders, onToggleExpand }: TreeItemProps) => {
    const isFolder = item.type === 'folder';
    const isExpanded = expandedFolders.has(item.id);
    const isSelected = selectedIds.includes(item.id);

    return (
        <>
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '4px 8px',
                    paddingLeft: 12 + level * 16,
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontSize: 12,
                    color: 'var(--color-text)',
                    transition: 'background 0.15s ease',
                    background: isSelected ? 'var(--color-sidebar-active)' : 'transparent',
                }}
                onClick={() => isFolder && item.children && onToggleExpand(item.id)}
                onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.background = 'var(--color-sidebar-hover)';
                }}
                onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.background = 'transparent';
                }}
            >
                {isFolder && (
                    <span style={{ fontSize: 10, color: 'var(--color-text-tertiary)', width: 12 }}>
                        {isExpanded ? <DownOutlined /> : <RightOutlined />}
                    </span>
                )}
                {!isFolder && <span style={{ width: 12 }} />}

                {isFolder ? (
                    <FolderOutlined style={{ fontSize: 13, color: 'var(--color-primary)' }} />
                ) : (
                    <FileTextOutlined style={{ fontSize: 13, color: 'var(--color-text-secondary)' }} />
                )}

                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.name}
                </span>

                {/* Selection checkbox */}
                <div
                    onClick={(e) => {
                        e.stopPropagation();
                        onToggleSelect(item.id, item.name, item.type);
                    }}
                    style={{
                        width: 16,
                        height: 16,
                        borderRadius: 4,
                        border: isSelected ? 'none' : '1px solid var(--color-border)',
                        background: isSelected ? 'var(--color-primary)' : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        flexShrink: 0,
                    }}
                >
                    {isSelected && <CheckOutlined style={{ fontSize: 10, color: 'var(--color-text-inverse)' }} />}
                </div>
            </div>

            {isFolder && isExpanded && item.children && (
                <>
                    {item.children.map((child) => (
                        <TreeItem
                            key={child.id}
                            item={child}
                            level={level + 1}
                            selectedIds={selectedIds}
                            onToggleSelect={onToggleSelect}
                            expandedFolders={expandedFolders}
                            onToggleExpand={onToggleExpand}
                        />
                    ))}
                </>
            )}
        </>
    );
};

export const SpacesPanel = () => {
    const { user } = useAuth();
    const {
        spaces,
        selectedScope,
        setSelectedScope,
        toggleSpacePin,
        updateSpace,
        fetchSpaceDetails,
    } = useChat();

    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
    const [expandedSpaces, setExpandedSpaces] = useState<Set<string>>(new Set(['personal']));
    const [membersModalSpace, setMembersModalSpace] = useState<Space | null>(null);
    const [documentsModalSpace, setDocumentsModalSpace] = useState<Space | null>(null);
    const [iconPickerSpace, setIconPickerSpace] = useState<Space | null>(null);

    const toggleFolderExpand = (id: string) => {
        setExpandedFolders((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleSpaceExpand = async (id: string) => {
        const space = spaces.find(s => s.id === id);
        if (!expandedSpaces.has(id) && !space?.children) {
            await fetchSpaceDetails(id);
        }
        setExpandedSpaces((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleSelectSpace = (space: Space) => {
        if (selectedScope?.spaceId === space.id && selectedScope.selectedItems.length === 0) {
            setSelectedScope(null);
        } else {
            setSelectedScope({
                spaceId: space.id,
                spaceName: space.name,
                selectedItems: [],
            });
        }
    };

    const handleToggleSelectItem = (spaceId: string, spaceName: string, id: string, name: string, type: 'folder' | 'document') => {
        let currentScope = selectedScope;
        if (!currentScope || currentScope.spaceId !== spaceId) {
            currentScope = { spaceId, spaceName, selectedItems: [] };
        }

        const currentSpace = spaces.find(s => s.id === spaceId);
        if (!currentSpace) return;

        const findItem = (items: SpaceItem[], targetId: string): SpaceItem | null => {
            for (const item of items) {
                if (item.id === targetId) return item;
                if (item.children) {
                    const found = findItem(item.children, targetId);
                    if (found) return found;
                }
            }
            return null;
        };

        const collectAll = (item: SpaceItem, list: { id: string; name: string; type: 'folder' | 'document' }[] = []) => {
            list.push({ id: item.id, name: item.name, type: item.type });
            if (item.children) {
                item.children.forEach(child => collectAll(child, list));
            }
            return list;
        };

        const targetItem = type === 'folder' ? findItem(currentSpace.children || [], id) : null;
        const itemsToToggle = (type === 'folder' && targetItem) ? collectAll(targetItem) : [{ id, name, type }];
        const idsToToggleSet = new Set(itemsToToggle.map(i => i.id));
        const isRemoving = currentScope.selectedItems.some((i) => i.id === id);

        if (isRemoving) {
            const nextItems = currentScope.selectedItems.filter((i) => !idsToToggleSet.has(i.id));
            setSelectedScope(nextItems.length === 0 ? null : { ...currentScope, selectedItems: nextItems });
        } else {
            const currentlySelectedIds = new Set(currentScope.selectedItems.map(i => i.id));
            const newItems = itemsToToggle.filter(item => !currentlySelectedIds.has(item.id));
            setSelectedScope({ ...currentScope, selectedItems: [...currentScope.selectedItems, ...newItems] });
        }
    };

    const pinnedSpaces = spaces.filter((s) => s.isPinned);
    const unpinnedSpaces = spaces.filter((s) => !s.isPinned);
    const mySpaces = unpinnedSpaces.filter((s) => s.ownerId === user?.id || s.isPersonal);
    const joinedSpaces = unpinnedSpaces.filter((s) => s.ownerId !== user?.id && !s.isPersonal && s.members?.some(m => m.userId === user?.id));
    const discoverableSpaces = unpinnedSpaces.filter((s) => s.ownerId !== user?.id && !s.isPersonal && s.type !== 'personal' && !s.members?.some(m => m.userId === user?.id));

    const renderSpaceItem = (space: Space) => {
        const isSelected = selectedScope?.spaceId === space.id;
        const isExpanded = expandedSpaces.has(space.id);
        const hasSpecificSelection = isSelected && selectedScope.selectedItems.length > 0;

        return (
            <div key={space.id}>
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '8px 10px',
                        borderRadius: 8,
                        transition: 'all 0.15s ease',
                        background: (isSelected && !hasSpecificSelection) ? 'var(--color-sidebar-active)' : 'transparent',
                        borderLeft: isSelected ? '2px solid var(--color-primary)' : '2px solid transparent',
                        marginLeft: -2,
                    }}
                    onMouseEnter={(e) => { if (!isSelected || hasSpecificSelection) e.currentTarget.style.background = 'var(--color-sidebar-hover)'; }}
                    onMouseLeave={(e) => { if (!isSelected || hasSpecificSelection) e.currentTarget.style.background = 'transparent'; }}
                >
                    <span
                        onClick={(e) => { e.stopPropagation(); toggleSpaceExpand(space.id); }}
                        style={{ fontSize: 10, color: 'var(--color-text-tertiary)', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', borderRadius: 4 }}
                    >
                        {isExpanded ? <DownOutlined /> : <RightOutlined />}
                    </span>
                    <div
                        onClick={() => handleSelectSpace(space)}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, cursor: 'pointer', overflow: 'hidden' }}
                    >
                        <SpaceIcon icon={space.icon} style={{ fontSize: 16, color: 'var(--color-primary)' }} />
                        <span style={{ fontSize: 14, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {space.name}
                        </span>
                    </div>

                    {(space.ownerId === user?.id || space.isPersonal) && (
                        <Dropdown
                            menu={{
                                items: [
                                    ...(space.type === 'shared' ? [{ key: 'members', icon: <TeamOutlined />, label: 'Add Members', onClick: () => setMembersModalSpace(space) }] : []),
                                    { key: 'documents', icon: <FolderAddOutlined />, label: 'Manage Documents', onClick: () => setDocumentsModalSpace(space) },
                                    { type: 'divider' },
                                    { key: 'change-icon', icon: <EditOutlined />, label: 'Change Icon', onClick: () => setIconPickerSpace(space) },
                                ] as MenuProps['items'],
                            }}
                            trigger={['click']}
                        >
                            <div style={{ cursor: 'pointer', color: 'var(--color-text-tertiary)', padding: '2px' }}>
                                <MoreOutlined style={{ fontSize: 14 }} />
                            </div>
                        </Dropdown>
                    )}

                    <div
                        onClick={(e) => { e.stopPropagation(); toggleSpacePin(space.id); }}
                        style={{ cursor: 'pointer', color: space.isPinned ? 'var(--color-primary)' : 'var(--color-text-tertiary)' }}
                    >
                        {space.isPinned ? <StarFilled style={{ fontSize: 12 }} /> : <StarOutlined style={{ fontSize: 12 }} />}
                    </div>
                </div>

                {isExpanded && space.children && (
                    <div style={{ marginLeft: 8, borderLeft: '1px solid var(--color-border)', paddingLeft: 8, marginBottom: 8 }}>
                        {space.children.map((item) => (
                            <TreeItem
                                key={item.id}
                                item={item}
                                level={0}
                                selectedIds={selectedScope?.selectedItems.map(i => i.id) || []}
                                onToggleSelect={(id, name, type) => handleToggleSelectItem(space.id, space.name, id, name, type)}
                                expandedFolders={expandedFolders}
                                onToggleExpand={toggleFolderExpand}
                            />
                        ))}
                    </div>
                )}
            </div>
        );
    };

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
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)', minHeight: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography.Text strong style={{ fontSize: 16 }}>Spaces</Typography.Text>
                <Button
                    type="text"
                    size="small"
                    disabled={!selectedScope}
                    onClick={() => setSelectedScope(null)}
                    style={{ fontSize: 11, color: selectedScope ? 'var(--color-primary)' : 'var(--color-text-tertiary)' }}
                >
                    Reset Selection
                </Button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
                {pinnedSpaces.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', padding: '8px 4px' }}>
                            <StarFilled style={{ fontSize: 10 }} /> Pinned
                        </div>
                        {pinnedSpaces.map(renderSpaceItem)}
                    </div>
                )}

                {mySpaces.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', padding: '8px 4px' }}>
                            Owned Spaces ({mySpaces.length})
                        </div>
                        {mySpaces.map(renderSpaceItem)}
                    </div>
                )}

                {joinedSpaces.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', padding: '8px 4px' }}>
                            Joined Spaces ({joinedSpaces.length})
                        </div>
                        {joinedSpaces.map(renderSpaceItem)}
                    </div>
                )}

                {discoverableSpaces.length > 0 && (
                    <div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', padding: '8px 4px' }}>
                            Discover Spaces
                        </div>
                        {discoverableSpaces.map(space => (
                            <div key={space.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', opacity: 0.8 }}>
                                <SpaceIcon icon={space.icon} style={{ fontSize: 16 }} />
                                <span style={{ flex: 1, fontSize: 14 }}>{space.name}</span>
                                <Tooltip title="Request to Join">
                                    <Button type="text" size="small" icon={<UserAddOutlined />} onClick={() => message.success(`Request sent to join ${space.name}`)} />
                                </Tooltip>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <AddMembersModal spaceId={membersModalSpace?.id || null} open={!!membersModalSpace} onClose={() => setMembersModalSpace(null)} />
            <ManageDocumentsModal spaceId={documentsModalSpace?.id || null} open={!!documentsModalSpace} onClose={() => setDocumentsModalSpace(null)} />
            <IconPickerModal open={!!iconPickerSpace} onClose={() => setIconPickerSpace(null)} onSelect={(icon) => iconPickerSpace && updateSpace(iconPickerSpace.id, { icon })} currentIcon={iconPickerSpace?.icon} />
        </div>
    );
};
