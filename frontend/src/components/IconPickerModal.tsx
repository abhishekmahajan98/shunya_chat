import { Modal, Tooltip } from 'antd';
import { useTheme } from '../context/ThemeContext';
import { iconCategories, spaceIconMap } from './SpaceIcon';

interface IconPickerModalProps {
    open: boolean;
    onClose: () => void;
    onSelect: (iconName: string) => void;
    currentIcon?: string;
}

const IconPickerModal = ({ open, onClose, onSelect, currentIcon }: IconPickerModalProps) => {
    const { theme } = useTheme();

    const handleSelect = (iconName: string) => {
        onSelect(iconName);
        onClose();
    };

    const styles = {
        category: {
            marginBottom: 20,
        },
        categoryTitle: {
            fontSize: 12,
            fontWeight: 600,
            color: theme === 'dark' ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.65)',
            marginBottom: 10,
            textTransform: 'uppercase' as const,
            letterSpacing: '0.5px',
        },
        iconGrid: {
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(48px, 1fr))',
            gap: 8,
        },
        iconButton: (isSelected: boolean) => ({
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 48,
            height: 48,
            borderRadius: 8,
            border: isSelected
                ? '2px solid #EDAC33'
                : `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
            background: isSelected
                ? theme === 'dark' ? 'rgba(237, 172, 51, 0.15)' : 'rgba(237, 172, 51, 0.1)'
                : 'transparent',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
        }),
    };

    return (
        <Modal
            title="Select Space Icon"
            open={open}
            onCancel={onClose}
            footer={null}
            width={480}
        >
            <div style={{ maxHeight: 400, overflowY: 'auto', paddingRight: 8 }}>
                {Object.entries(iconCategories).map(([category, icons]) => (
                    <div key={category} style={styles.category}>
                        <div style={styles.categoryTitle}>{category}</div>
                        <div style={styles.iconGrid}>
                            {icons.map(iconName => {
                                const isSelected = iconName === currentIcon;
                                const IconComponent = spaceIconMap[iconName];

                                return (
                                    <Tooltip key={iconName} title={iconName.replace(/-/g, ' ')}>
                                        <div
                                            style={styles.iconButton(isSelected)}
                                            onClick={() => handleSelect(iconName)}
                                            onMouseEnter={(e) => {
                                                if (!isSelected) {
                                                    e.currentTarget.style.background = theme === 'dark'
                                                        ? 'rgba(255,255,255,0.06)'
                                                        : 'rgba(0,0,0,0.04)';
                                                }
                                            }}
                                            onMouseLeave={(e) => {
                                                if (!isSelected) {
                                                    e.currentTarget.style.background = 'transparent';
                                                }
                                            }}
                                        >
                                            {IconComponent && (
                                                <IconComponent
                                                    style={{
                                                        fontSize: 20,
                                                        color: isSelected ? '#EDAC33' : theme === 'dark' ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.65)'
                                                    }}
                                                />
                                            )}
                                        </div>
                                    </Tooltip>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </Modal>
    );
};

export default IconPickerModal;
