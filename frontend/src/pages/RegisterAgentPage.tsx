import { useState } from 'react';
import { Layout, Typography, Input, Button, Card, Form, Space, message, AutoComplete } from 'antd';
import {
    ArrowLeftOutlined,
    RobotOutlined,
    GlobalOutlined,
    RocketOutlined,
    InfoCircleOutlined,
    ExperimentOutlined,
    DollarOutlined,
    SafetyCertificateOutlined,
    SettingOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { registerAgent } from '../api';
import IconPickerModal from '../components/IconPickerModal';
import SpaceIcon from '../components/SpaceIcon';

const { Content } = Layout;
const { Title, Text } = Typography;

const RegisterAgentPage = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [iconPickerOpen, setIconPickerOpen] = useState(false);
    const [form] = Form.useForm();
    const [selectedIcon, setSelectedIcon] = useState('robot');

    const onFinish = async (values: any) => {
        setLoading(true);
        try {
            await registerAgent({
                ...values,
                icon: selectedIcon
            });
            message.success('Agent registered successfully!');
            navigate('/');
        } catch (error) {
            console.error('Registration failed:', error);
            message.error('Failed to register agent. ID might be taken.');
        } finally {
            setLoading(false);
        }
    };

    const categoryOptions = [
        { value: 'research', label: (<span><ExperimentOutlined /> Research</span>) },
        { value: 'compliance', label: (<span><SafetyCertificateOutlined /> Compliance</span>) },
        { value: 'finance', label: (<span><DollarOutlined /> Finance</span>) },
        { value: 'automation', label: (<span><SettingOutlined /> Automation</span>) },
    ];

    const handleIconSelect = (icon: string) => {
        setSelectedIcon(icon);
        form.setFieldsValue({ icon });
    };

    return (
        <Layout style={{ minHeight: '100vh', background: 'var(--color-background)' }}>
            <Content style={{ padding: '24px', display: 'flex', justifyContent: 'center' }}>
                <div style={{ maxWidth: 800, width: '100%' }}>
                    {/* Header */}
                    <div style={{ marginBottom: 32, display: 'flex', alignItems: 'center', gap: 16 }}>
                        <Button
                            icon={<ArrowLeftOutlined />}
                            onClick={() => navigate('/')}
                            style={{
                                background: 'transparent',
                                border: '1px solid var(--color-border)',
                                color: 'var(--color-text)'
                            }}
                        />
                        <div>
                            <Title level={2} style={{ margin: 0, color: 'var(--color-text)' }}>Register New Agent</Title>
                            <Text style={{ color: 'var(--color-text-secondary)' }}>
                                Add a new AI capability to the Shunya Chat registry.
                            </Text>
                        </div>
                    </div>

                    <Card
                        style={{
                            background: 'var(--color-surface)',
                            borderColor: 'var(--color-border)',
                        }}
                    >
                        <Form
                            form={form}
                            layout="vertical"
                            onFinish={onFinish}
                            initialValues={{
                                icon: 'robot',
                                category: 'research'
                            }}
                        >
                            <Form.Item
                                name="id"
                                label={<span style={{ color: 'var(--color-text)' }}>Agent ID</span>}
                                rules={[{ required: true, message: 'Please enter a unique ID' }]}
                                help="Unique identifier (e.g., 'web-search', 'compliance-bot')"
                            >
                                <Input
                                    prefix={<RocketOutlined style={{ color: 'var(--color-text-tertiary)' }} />}
                                    placeholder="unique-agent-id"
                                    style={{ background: 'var(--color-background)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                                />
                            </Form.Item>

                            <Form.Item
                                name="name"
                                label={<span style={{ color: 'var(--color-text)' }}>Display Name</span>}
                                rules={[{ required: true, message: 'Please enter a display name' }]}
                            >
                                <Input
                                    prefix={<RobotOutlined style={{ color: 'var(--color-text-tertiary)' }} />}
                                    placeholder="My Awesome Agent"
                                    style={{ background: 'var(--color-background)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                                />
                            </Form.Item>

                            <Space style={{ display: 'flex', width: '100%', alignItems: 'flex-start' }} size={16}>
                                <div style={{ flex: 1 }}>
                                    <Form.Item
                                        name="category"
                                        label={<span style={{ color: 'var(--color-text)' }}>Category</span>}
                                        rules={[{ required: true, message: 'Please select or enter a category' }]}
                                    >
                                        <AutoComplete
                                            options={categoryOptions}
                                            placeholder="Select or type a category"
                                            filterOption={(inputValue, option) =>
                                                option!.value.toUpperCase().indexOf(inputValue.toUpperCase()) !== -1
                                            }
                                            style={{ width: '100%' }}
                                        />
                                    </Form.Item>
                                </div>

                                <div style={{ flex: 1 }}>
                                    <Form.Item
                                        label={<span style={{ color: 'var(--color-text)' }}>Icon</span>}
                                        name="icon" // Hidden field to store icon value
                                    >
                                        <div
                                            onClick={() => setIconPickerOpen(true)}
                                            style={{
                                                height: 32, // Match input height
                                                display: 'flex',
                                                alignItems: 'center',
                                                padding: '4px 11px',
                                                background: 'var(--color-background)',
                                                border: '1px solid var(--color-border)',
                                                borderRadius: 6,
                                                cursor: 'pointer',
                                                gap: 8,
                                                color: 'var(--color-text)'
                                            }}
                                        >
                                            <SpaceIcon icon={selectedIcon} style={{ fontSize: 16, color: 'var(--color-primary)' }} />
                                            <span style={{ flex: 1 }}>{selectedIcon}</span>
                                            <InfoCircleOutlined style={{ color: 'var(--color-text-tertiary)', fontSize: 12 }} />
                                        </div>
                                    </Form.Item>
                                </div>
                            </Space>

                            <Form.Item
                                name="url"
                                label={<span style={{ color: 'var(--color-text)' }}>Service URL</span>}
                                rules={[{ required: true, message: 'Please enter the service URL' }, { type: 'url', message: 'Please enter a valid URL' }]}
                            >
                                <Input
                                    prefix={<GlobalOutlined style={{ color: 'var(--color-text-tertiary)' }} />}
                                    placeholder="http://localhost:8000"
                                    style={{ background: 'var(--color-background)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                                />
                            </Form.Item>

                            <Form.Item
                                name="description"
                                label={<span style={{ color: 'var(--color-text)' }}>Description</span>}
                                rules={[{ required: true, message: 'Please enter a description' }]}
                            >
                                <Input.TextArea
                                    rows={4}
                                    placeholder="Describe what this agent does..."
                                    style={{ background: 'var(--color-background)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                                />
                            </Form.Item>

                            <Form.Item>
                                <Button
                                    type="primary"
                                    htmlType="submit"
                                    loading={loading}
                                    block
                                    size="large"
                                    style={{ marginTop: 16 }}
                                >
                                    Register Agent
                                </Button>
                            </Form.Item>
                        </Form>
                    </Card>
                </div>

                <IconPickerModal
                    open={iconPickerOpen}
                    onClose={() => setIconPickerOpen(false)}
                    onSelect={handleIconSelect}
                    currentIcon={selectedIcon}
                />
            </Content>
        </Layout>
    );
};

export default RegisterAgentPage;
