import { useState, useEffect } from 'react';
import { Modal, Select, Button, List, Avatar, Empty, message } from 'antd';
import {
    UserOutlined,
    DeleteOutlined,
    PlusOutlined,
    CrownOutlined,
} from '@ant-design/icons';
import { useTheme } from '../context/ThemeContext';
import { useChat, type MemberRole, mockUsers } from '../context/ChatContext';
import SpaceIcon from './SpaceIcon';

interface AddMembersModalProps {
    spaceId: string | null;
    open: boolean;
    onClose: () => void;
}

const AddMembersModal = ({ spaceId, open, onClose }: AddMembersModalProps) => {
    const { theme } = useTheme();
    const {
        spaces,
        addSpaceMember,
        removeSpaceMember,
        updateMemberRole,
    } = useChat();

    const [newMemberId, setNewMemberId] = useState<string | null>(null);
    const [newMemberRole, setNewMemberRole] = useState<MemberRole>('viewer');

    // Get the latest space data from context
    const space = spaces.find(s => s.id === spaceId);

    // Reset form when modal closes
    useEffect(() => {
        if (!open) {
            setNewMemberId(null);
            setNewMemberRole('viewer');
        }
    }, [open]);

    if (!spaceId || !space) return null;

    const isOwner = space.ownerId === 'current-user';
    const isAdmin = space.members?.some(m => m.userId === 'current-user' && m.role === 'admin');
    const canManageMembers = isOwner || isAdmin;

    // Get available users (not already members and not the owner)
    const existingMemberIds = new Set([
        space.ownerId,
        ...(space.members?.map(m => m.userId) || []),
    ]);
    const availableUsers = mockUsers.filter(u => !existingMemberIds.has(u.id));

    const handleAddMember = () => {
        if (!newMemberId || !canManageMembers) return;
        addSpaceMember(space.id, newMemberId, newMemberRole);
        setNewMemberId(null);
        setNewMemberRole('viewer');
        message.success('Member added successfully');
    };

    const handleRemoveMember = (userId: string) => {
        if (!canManageMembers) return;
        removeSpaceMember(space.id, userId);
        message.success('Member removed');
    };

    const handleRoleChange = (userId: string, newRole: MemberRole) => {
        if (!canManageMembers) return;
        updateMemberRole(space.id, userId, newRole);
    };

    const roleOptions = [
        { value: 'viewer', label: 'Viewer' },
        { value: 'editor', label: 'Editor' },
        { value: 'admin', label: 'Admin' },
    ];

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
        ownerBadge: {
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '4px 12px',
            borderRadius: 16,
            background: theme === 'dark' ? 'rgba(237, 172, 51, 0.15)' : 'rgba(237, 172, 51, 0.1)',
            color: '#EDAC33',
            fontSize: 12,
            fontWeight: 500,
            marginBottom: 16,
        },
        addSection: {
            display: 'flex',
            gap: 8,
            marginBottom: 16,
            flexWrap: 'wrap' as const,
        },
        memberItem: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 0',
            borderBottom: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
        },
        memberInfo: {
            display: 'flex',
            alignItems: 'center',
            gap: 12,
        },
        memberName: {
            fontWeight: 500,
        },
        memberEmail: {
            fontSize: 12,
            color: theme === 'dark' ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)',
        },
        memberActions: {
            display: 'flex',
            alignItems: 'center',
            gap: 8,
        },
    };

    return (
        <Modal
            title={
                <div style={styles.header}>
                    <SpaceIcon icon={space.icon} style={styles.spaceIcon} />
                    <span>{space.name} - Members</span>
                </div>
            }
            open={open}
            onCancel={onClose}
            footer={null}
            width={520}
        >
            {/* Owner Badge */}
            <div style={styles.ownerBadge}>
                <CrownOutlined />
                Owner: {space.owner?.name || 'Unknown'}
                {isOwner && ' (You)'}
            </div>

            {/* Add Member Section */}
            {canManageMembers && availableUsers.length > 0 && (
                <div style={styles.addSection}>
                    <Select
                        placeholder="Select user to add..."
                        value={newMemberId}
                        onChange={setNewMemberId}
                        style={{ flex: 1, minWidth: 150 }}
                        options={availableUsers.map(u => ({
                            value: u.id,
                            label: u.name,
                        }))}
                        allowClear
                    />
                    <Select
                        value={newMemberRole}
                        onChange={setNewMemberRole}
                        style={{ width: 100 }}
                        options={roleOptions}
                    />
                    <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={handleAddMember}
                        disabled={!newMemberId}
                        style={{ background: '#EDAC33', borderColor: '#EDAC33' }}
                    >
                        Add
                    </Button>
                </div>
            )}

            {/* No more users message */}
            {canManageMembers && availableUsers.length === 0 && (
                <div style={{
                    padding: '12px 16px',
                    background: theme === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                    borderRadius: 8,
                    marginBottom: 16,
                    fontSize: 13,
                    color: theme === 'dark' ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.65)',
                }}>
                    All available users have been added to this space.
                </div>
            )}

            {/* Members List */}
            {space.members && space.members.length > 0 ? (
                <List
                    dataSource={space.members}
                    renderItem={(member) => (
                        <div style={styles.memberItem}>
                            <div style={styles.memberInfo}>
                                <Avatar icon={<UserOutlined />} />
                                <div>
                                    <div style={styles.memberName}>
                                        {member.user.name}
                                        {member.userId === 'current-user' && ' (You)'}
                                    </div>
                                    <div style={styles.memberEmail}>{member.user.email}</div>
                                </div>
                            </div>
                            <div style={styles.memberActions}>
                                {canManageMembers ? (
                                    <>
                                        <Select
                                            value={member.role}
                                            onChange={(role) => handleRoleChange(member.userId, role)}
                                            style={{ width: 100 }}
                                            options={roleOptions}
                                            size="small"
                                        />
                                        <Button
                                            type="text"
                                            danger
                                            icon={<DeleteOutlined />}
                                            onClick={() => handleRemoveMember(member.userId)}
                                            size="small"
                                        />
                                    </>
                                ) : (
                                    <span style={{
                                        textTransform: 'capitalize',
                                        color: theme === 'dark' ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.65)',
                                    }}>
                                        {member.role}
                                    </span>
                                )}
                            </div>
                        </div>
                    )}
                />
            ) : (
                <Empty description="No members yet" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}
        </Modal>
    );
};

export default AddMembersModal;
