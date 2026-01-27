import { useState } from 'react';
import { Button, Input } from 'antd';
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
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useChat, type Space, type SpaceItem } from '../context/ChatContext';

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
  const { theme, toggleTheme } = useTheme();
  const {
    spaces,
    selectedScope,
    setSelectedScope,
    toggleSpacePin,
    spaceSearch,
    setSpaceSearch,
  } = useChat();

  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['folder-work', 'folder-research']));
  const [expandedSpaces, setExpandedSpaces] = useState<Set<string>>(new Set(['personal']));

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
  const allSpaces = filteredSpaces.filter((s) => !s.isPinned);

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
          <span style={{ fontSize: 16 }}>{space.icon}</span>
          <span style={{
            flex: 1,
            fontSize: 14,
            color: 'var(--color-text)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {space.name}
          </span>
          <span style={{
            fontSize: 11,
            color: 'var(--color-text-tertiary)',
            background: 'var(--color-surface-hover)',
            padding: '2px 6px',
            borderRadius: 4,
          }}>
            {space.documentCount}
          </span>
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
          onClick={() => navigate('/')}
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

      {/* Spaces List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: collapsed ? '8px' : '0 12px' }}>
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

        {!collapsed && allSpaces.length > 0 && (
          <>
            <div style={{
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--color-text-tertiary)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              padding: '12px 4px 8px',
            }}>
              All Spaces ({allSpaces.length})
            </div>
            {allSpaces.map(renderSpaceItem)}
          </>
        )}

        {collapsed && spaces.slice(0, 5).map((space) => (
          <div
            key={space.id}
            onClick={() => handleSelectSpace(space)}
            style={{
              width: 40,
              height: 40,
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 18,
              cursor: 'pointer',
              margin: '4px auto',
              background: selectedScope?.spaceId === space.id ? 'var(--color-sidebar-active)' : 'transparent',
              border: selectedScope?.spaceId === space.id ? '1px solid var(--color-primary)' : '1px solid transparent',
            }}
          >
            {space.icon}
          </div>
        ))}
      </div>

      {/* Bottom Actions */}
      <div style={{
        padding: collapsed ? '12px 8px' : '12px 16px',
        borderTop: '1px solid var(--color-border)',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}>
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
    </div>
  );
};

export default AppMenu;
