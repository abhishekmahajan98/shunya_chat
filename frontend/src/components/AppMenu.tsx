import { useState } from 'react';
import { Button, Input, Dropdown, message, Popconfirm } from 'antd';
import type { MenuProps } from 'antd';
import {
  PlusOutlined,
  SunOutlined,
  MoonOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  SearchOutlined,
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
  LogoutOutlined,
  UserOutlined,
  MessageOutlined,
  LoadingOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useChat, type Space, type SpaceItem } from '../context/ChatContext';
import SpaceIcon from './SpaceIcon';
import AddMembersModal from './AddMembersModal';
import ManageDocumentsModal from './ManageDocumentsModal';
import IconPickerModal from './IconPickerModal';

interface AppMenuProps {
  collapsed: boolean;
  isTablet?: boolean;
  onCollapseToggle?: () => void;
}

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
          padding: '6px 8px',
          paddingLeft: 12 + level * 16,
          borderRadius: 6,
          cursor: 'pointer',
          fontSize: 13,
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
          <FolderOutlined style={{ fontSize: 14, color: 'var(--color-primary)' }} />
        ) : (
          <FileTextOutlined style={{ fontSize: 14, color: 'var(--color-text-secondary)' }} />
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
            width: 18,
            height: 18,
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

const AppMenu = ({ collapsed, isTablet, onCollapseToggle }: AppMenuProps) => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const {
    spaces,
    selectedScope,
    setSelectedScope,
    toggleSpacePin,
    spaceSearch,
    setSpaceSearch,
    updateSpace,
    clearMessages,
    setConversationId,
    // History
    conversations,
    loadConversation,
    conversationId,
    hasMoreHistory,
    loadMoreHistory,
    isLoadingHistory,
  } = useChat();

  const [sidebarTab, setSidebarTab] = useState<'chats' | 'spaces'>('chats');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['folder-work', 'folder-research']));
  const [expandedSpaces, setExpandedSpaces] = useState<Set<string>>(new Set(['personal']));
  const [membersModalSpace, setMembersModalSpace] = useState<Space | null>(null);
  const [documentsModalSpace, setDocumentsModalSpace] = useState<Space | null>(null);
  const [iconPickerSpace, setIconPickerSpace] = useState<Space | null>(null);

  const openMembersModal = (space: Space) => {
    setMembersModalSpace(space);
  };

  const openDocumentsModal = (space: Space) => {
    setDocumentsModalSpace(space);
  };

  const handleIconChange = (space: Space, newIcon: string) => {
    updateSpace(space.id, { icon: newIcon });
  };

  const toggleFolderExpand = (id: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSpaceExpand = (id: string) => {
    setExpandedSpaces((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectSpace = (space: Space) => {
    setSelectedScope({
      spaceId: space.id,
      spaceName: space.name,
      selectedItems: [],
    });
  };

  const handleToggleSelectItem = (id: string, name: string, type: 'folder' | 'document') => {
    if (!selectedScope) return;

    setSelectedScope({
      ...selectedScope,
      selectedItems: selectedScope.selectedItems.some((i) => i.id === id)
        ? selectedScope.selectedItems.filter((i) => i.id !== id)
        : [...selectedScope.selectedItems, { id, name, type }],
    });
  };

  // Filter spaces based on search
  const filteredSpaces = spaces.filter((s) =>
    s.name.toLowerCase().includes(spaceSearch.toLowerCase())
  );

  const pinnedSpaces = filteredSpaces.filter((s) => s.isPinned);
  const unpinnedSpaces = filteredSpaces.filter((s) => !s.isPinned);
  const mySpaces = unpinnedSpaces.filter((s) => s.ownerId === 'current-user' || s.isPersonal);
  const joinedSpaces = unpinnedSpaces.filter((s) =>
    s.ownerId !== 'current-user' &&
    !s.isPersonal &&
    s.members?.some(m => m.userId === 'current-user')
  );
  const discoverableSpaces = unpinnedSpaces.filter((s) =>
    s.ownerId !== 'current-user' &&
    !s.isPersonal &&
    !s.members?.some(m => m.userId === 'current-user')
  );

  const handleRequestJoin = (space: Space) => {
    message.success(`Request sent to join ${space.name}`);
  };

  const renderSpaceItem = (space: Space) => {
    const isSelected = selectedScope?.spaceId === space.id;
    const isExpanded = expandedSpaces.has(space.id);
    const hasChildren = space.isPersonal && space.children;

    return (
      <div key={space.id}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 10px',
            borderRadius: 8,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            background: isSelected && !hasChildren ? 'var(--color-sidebar-active)' : 'transparent',
            borderLeft: isSelected ? '2px solid var(--color-primary)' : '2px solid transparent',
            marginLeft: -2,
          }}
          onClick={() => {
            handleSelectSpace(space);
            if (hasChildren) toggleSpaceExpand(space.id);
          }}
          onMouseEnter={(e) => {
            if (!isSelected || hasChildren) e.currentTarget.style.background = 'var(--color-sidebar-hover)';
          }}
          onMouseLeave={(e) => {
            if (!isSelected || hasChildren) e.currentTarget.style.background = isSelected && !hasChildren ? 'var(--color-sidebar-active)' : 'transparent';
          }}
        >
          {hasChildren && (
            <span style={{ fontSize: 10, color: 'var(--color-text-tertiary)' }}>
              {isExpanded ? <DownOutlined /> : <RightOutlined />}
            </span>
          )}
          <SpaceIcon icon={space.icon} style={{ fontSize: 16, color: 'var(--color-primary)' }} />
          <span style={{
            flex: 1,
            fontSize: 14,
            color: 'var(--color-text)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}>
            {space.name}
          </span>

          {/* 3-dot menu for non-personal spaces */}
          {!space.isPersonal && (
            <Dropdown
              menu={{
                items: [
                  {
                    key: 'members',
                    icon: <TeamOutlined />,
                    label: 'Add Members',
                    onClick: () => openMembersModal(space),
                  },
                  {
                    key: 'documents',
                    icon: <FolderAddOutlined />,
                    label: 'Manage Documents',
                    onClick: () => openDocumentsModal(space),
                  },
                  ...(space.ownerId === 'current-user' ? [
                    { type: 'divider' as const },
                    {
                      key: 'change-icon',
                      icon: <EditOutlined />,
                      label: 'Change Icon',
                      onClick: () => setIconPickerSpace(space),
                    },
                  ] : []),
                ] as MenuProps['items'],
              }}
              trigger={['click']}
              placement="bottomRight"
            >
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  cursor: 'pointer',
                  color: 'var(--color-text-tertiary)',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '2px',
                  borderRadius: 4,
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-primary)'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-text-tertiary)'}
              >
                <MoreOutlined style={{ fontSize: 14 }} />
              </div>
            </Dropdown>
          )}

          <div
            onClick={(e) => {
              e.stopPropagation();
              toggleSpacePin(space.id);
            }}
            style={{ cursor: 'pointer', color: space.isPinned ? 'var(--color-primary)' : 'var(--color-text-tertiary)' }}
          >
            {space.isPinned ? <StarFilled style={{ fontSize: 12 }} /> : <StarOutlined style={{ fontSize: 12 }} />}
          </div>
        </div>

        {/* Folder tree for personal space */}
        {hasChildren && isExpanded && space.children && (
          <div style={{ marginLeft: 8, borderLeft: '1px solid var(--color-border)', paddingLeft: 8, marginBottom: 8 }}>
            {space.children.map((item) => (
              <TreeItem
                key={item.id}
                item={item}
                level={0}
                selectedIds={selectedScope?.selectedItems.map((i) => i.id) || []}
                onToggleSelect={handleToggleSelectItem}
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
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: 'var(--color-sidebar)',
    }}>
      {/* Header */}
      {!isTablet && (
        <div style={{
          padding: collapsed ? '16px 8px' : '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          borderBottom: '1px solid var(--color-border)',
          minHeight: 60,
        }}>
          {collapsed ? (
            <span style={{ fontSize: 24 }}>⚡</span>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 24 }}>⚡</span>
              <span style={{ fontWeight: 600, fontSize: 16, color: 'var(--color-text)' }}>
                Shunya Chat
              </span>
            </div>
          )}
        </div>
      )}

      {/* New Chat Button */}
      <div style={{ padding: collapsed ? '12px 8px' : '12px 16px' }}>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            clearMessages();
            setConversationId(null);
            navigate('/');
          }}
          style={{
            width: '100%',
            borderRadius: 8,
            height: 40,
            background: 'var(--color-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          {!collapsed && 'New Chat'}
        </Button>
      </div>

      {/* Search */}
      {!collapsed && (
        <div style={{ padding: '0 16px 12px' }}>
          <Input
            placeholder="Search spaces..."
            prefix={<SearchOutlined style={{ color: 'var(--color-text-tertiary)' }} />}
            value={spaceSearch}
            onChange={(e) => setSpaceSearch(e.target.value)}
            style={{
              borderRadius: 8,
              background: 'var(--color-surface)',
            }}
          />
        </div>
      )}

      {/* Tab Toggle */}
      {!collapsed && (
        <div style={{
          display: 'flex',
          padding: '0 12px 12px',
          gap: 4,
        }}>
          <button
            onClick={() => setSidebarTab('chats')}
            style={{
              flex: 1,
              padding: '8px 12px',
              border: 'none',
              borderRadius: 6,
              background: sidebarTab === 'chats' ? 'var(--color-primary)' : 'var(--color-surface)',
              color: sidebarTab === 'chats' ? 'var(--color-text-inverse)' : 'var(--color-text-secondary)',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            Chats
          </button>
          <button
            onClick={() => setSidebarTab('spaces')}
            style={{
              flex: 1,
              padding: '8px 12px',
              border: 'none',
              borderRadius: 6,
              background: sidebarTab === 'spaces' ? 'var(--color-primary)' : 'var(--color-surface)',
              color: sidebarTab === 'spaces' ? 'var(--color-text-inverse)' : 'var(--color-text-secondary)',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            Spaces
          </button>
        </div>
      )}

      {/* History List - only show when Chats tab is active */}
      <div style={{
        padding: collapsed ? '8px' : '0 12px',
        flex: 1,
        overflowY: 'auto',
        display: (sidebarTab === 'chats' || collapsed) ? 'block' : 'none',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {conversations.map(chat => (
            <div
              key={chat.id}
              onClick={() => loadConversation(chat.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 10px',
                borderRadius: 8,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                background: conversationId === chat.id ? 'var(--color-sidebar-active)' : 'transparent',
                borderLeft: conversationId === chat.id ? '2px solid var(--color-primary)' : '2px solid transparent',
                marginLeft: -2,
              }}
              onMouseEnter={(e) => {
                if (conversationId !== chat.id) e.currentTarget.style.background = 'var(--color-sidebar-hover)';
              }}
              onMouseLeave={(e) => {
                if (conversationId !== chat.id) e.currentTarget.style.background = 'transparent';
              }}
            >
              <MessageOutlined style={{ fontSize: 16, color: conversationId === chat.id ? 'var(--color-primary)' : 'var(--color-text-tertiary)' }} />
              {!collapsed && (
                <span style={{
                  flex: 1,
                  fontSize: 14,
                  color: conversationId === chat.id ? 'var(--color-text)' : 'var(--color-text-secondary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {chat.title || 'New Chat'}
                </span>
              )}
            </div>
          ))}
          {conversations.length === 0 && !collapsed && (
            <div style={{ padding: '8px 12px', color: 'var(--color-text-tertiary)', fontSize: 13, fontStyle: 'italic' }}>
              No recent chats
            </div>
          )}
          {hasMoreHistory && conversations.length > 0 && !collapsed && (
            <Button
              type="text"
              size="small"
              onClick={loadMoreHistory}
              loading={isLoadingHistory}
              style={{
                width: '100%',
                color: 'var(--color-text-tertiary)',
                fontSize: 12,
                marginTop: 4,
              }}
            >
              {isLoadingHistory ? 'Loading...' : 'Load More'}
            </Button>
          )}
        </div>
      </div>

      {/* Spaces List - only show when Spaces tab is active */}
      <div style={{ flex: 1, overflowY: 'auto', padding: collapsed ? '8px' : '0 12px', display: (sidebarTab === 'spaces' || collapsed) ? 'block' : 'none' }}>
        {!collapsed && pinnedSpaces.length > 0 && (
          <>
            <div style={{
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--color-text-tertiary)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              padding: '8px 4px',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}>
              <StarFilled style={{ fontSize: 10 }} /> Pinned
            </div>
            {pinnedSpaces.map(renderSpaceItem)}
          </>
        )}

        {!collapsed && mySpaces.length > 0 && (
          <>
            <div style={{
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--color-text-tertiary)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              padding: '12px 4px 8px',
            }}>
              Owned Spaces ({mySpaces.length})
            </div>
            {mySpaces.map(renderSpaceItem)}
          </>
        )}

        {!collapsed && joinedSpaces.length > 0 && (
          <>
            <div style={{
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--color-text-tertiary)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              padding: '12px 4px 8px',
            }}>
              Joined Spaces ({joinedSpaces.length})
            </div>
            {joinedSpaces.map(renderSpaceItem)}
          </>
        )}

        {!collapsed && discoverableSpaces.length > 0 && (
          <>
            <div style={{
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--color-text-tertiary)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              padding: '12px 4px 8px',
            }}>
              Discover Spaces ({discoverableSpaces.length})
            </div>
            {discoverableSpaces.map(space => (
              <div key={space.id} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 10px',
                borderRadius: 8,
                cursor: 'default', // Not clickable for navigation
                background: 'transparent',
                marginLeft: -2,
                opacity: 0.8,
              }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-sidebar-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <SpaceIcon icon={space.icon} style={{ fontSize: 16, color: 'var(--color-text-tertiary)' }} />
                <span style={{
                  flex: 1,
                  fontSize: 14,
                  color: 'var(--color-text-secondary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {space.name}
                </span>
                <Popconfirm
                  title={`Request to join ${space.name}?`}
                  onConfirm={() => handleRequestJoin(space)}
                  okText="Request"
                  cancelText="Cancel"
                >
                  <Button
                    type="text"
                    size="small"
                    icon={<UserAddOutlined />}
                    title="Request to Join"
                    style={{ color: 'var(--color-text-tertiary)' }}
                  />
                </Popconfirm>
              </div>
            ))}
          </>
        )}

      </div>

      {/* Bottom Actions */}
      <div style={{
        padding: collapsed ? '12px 8px' : '12px 16px',
        borderTop: '1px solid var(--color-border)',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}>
        {/* User Profile */}
        {user && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'space-between',
            padding: collapsed ? '8px' : '8px 12px',
            marginBottom: 8,
            background: 'var(--color-surface-hover)',
            borderRadius: 8,
            border: '1px solid var(--color-border)',
          }}>
            {collapsed ? (
              <Dropdown
                menu={{
                  items: [
                    { label: user.email, key: 'email', icon: <UserOutlined />, disabled: true },
                    { type: 'divider' },
                    { label: 'Logout', key: 'logout', icon: <LogoutOutlined />, onClick: logout }
                  ]
                }}
                placement="bottomRight"
              >
                <div style={{ cursor: 'pointer', display: 'flex', justifyContent: 'center', width: '100%' }}>
                  <div style={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, var(--color-primary) 0%, #D99A20 100%)',
                    color: '#1A1A1A',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: 12,
                  }}>
                    {user.email?.[0].toUpperCase()}
                  </div>
                </div>
              </Dropdown>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden' }}>
                  <div style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, var(--color-primary) 0%, #D99A20 100%)',
                    color: '#1A1A1A',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: 13,
                    flexShrink: 0,
                  }}>
                    {user.email?.[0].toUpperCase()}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {user.name || 'User'}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {user.email}
                    </span>
                  </div>
                </div>
                <Button
                  type="text"
                  icon={<LogoutOutlined />}
                  size="small"
                  onClick={logout}
                  title="Logout"
                  style={{ color: 'var(--color-text-secondary)', minWidth: 28 }}
                />
              </>
            )}
          </div>
        )}

        <button
          onClick={toggleTheme}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-start',
            gap: 12,
            padding: collapsed ? '10px' : '10px 16px',
            border: '1px solid var(--color-border)',
            borderRadius: 8,
            background: 'transparent',
            color: 'var(--color-text)',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            width: '100%',
          }}
          onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--color-primary)'}
          onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--color-border)'}
        >
          {theme === 'dark' ? <SunOutlined style={{ fontSize: 16 }} /> : <MoonOutlined style={{ fontSize: 16 }} />}
          {!collapsed && <span style={{ fontSize: 14 }}>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>}
        </button>

        {!isTablet && onCollapseToggle && (
          <button
            onClick={onCollapseToggle}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: collapsed ? 'center' : 'flex-start',
              gap: 12,
              padding: collapsed ? '10px' : '10px 16px',
              border: 'none',
              borderRadius: 8,
              background: 'transparent',
              color: 'var(--color-text-secondary)',
              cursor: 'pointer',
              width: '100%',
            }}
          >
            {collapsed ? <MenuUnfoldOutlined style={{ fontSize: 16 }} /> : <MenuFoldOutlined style={{ fontSize: 16 }} />}
            {!collapsed && <span style={{ fontSize: 14 }}>Collapse</span>}
          </button>
        )}

        {!collapsed && (
          <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', textAlign: 'center', paddingTop: 8 }}>
            Built with ⚡ by Abhishek
          </div>
        )}
      </div>

      {/* Members Modal */}
      <AddMembersModal
        spaceId={membersModalSpace?.id || null}
        open={!!membersModalSpace}
        onClose={() => setMembersModalSpace(null)}
      />

      {/* Documents Modal */}
      <ManageDocumentsModal
        spaceId={documentsModalSpace?.id || null}
        open={!!documentsModalSpace}
        onClose={() => setDocumentsModalSpace(null)}
      />

      {/* Icon Picker Modal */}
      <IconPickerModal
        open={!!iconPickerSpace}
        onClose={() => setIconPickerSpace(null)}
        onSelect={(icon) => iconPickerSpace && handleIconChange(iconPickerSpace, icon)}
        currentIcon={iconPickerSpace?.icon}
      />
    </div>
  );
};

export default AppMenu;
