import React, { useState, useEffect } from 'react';
import {
    List, Upload, Typography,
    Tag, Spin, Empty, message
} from 'antd';
import {
    InboxOutlined, FileOutlined,
    SyncOutlined, CheckCircleOutlined,
    ExclamationCircleOutlined
} from '@ant-design/icons';
import { getSpace, uploadDocumentToSpace, Document } from '../api';

const { Dragger } = Upload;
const { Text, Title } = Typography;

interface SpaceManagerProps {
    spaceId: string;
}

const SpaceManager: React.FC<SpaceManagerProps> = ({ spaceId }) => {
    const [loading, setLoading] = useState(true);
    const [documents, setDocuments] = useState<Document[]>([]);
    const [spaceName, setSpaceName] = useState('');

    const fetchSpaceData = async () => {
        try {
            const data = await getSpace(spaceId);
            setSpaceName(data.name);
            setDocuments(data.documents);
        } catch (error) {
            message.error('Failed to load space documents');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSpaceData();

        // Polling for processing status
        const interval = setInterval(() => {
            const hasProcessing = documents.some(d => d.status === 'processing');
            if (hasProcessing) {
                fetchSpaceData();
            }
        }, 3000);

        return () => clearInterval(interval);
    }, [spaceId, documents]);

    const handleUpload = async (file: File) => {
        try {
            await uploadDocumentToSpace(spaceId, file);
            message.success(`${file.name} uploaded and is being indexed.`);
            fetchSpaceData();
        } catch (error) {
            message.error(`Failed to upload ${file.name}`);
        }
        return false; // Prevent default upload
    };

    const getStatusTag = (status: string) => {
        switch (status) {
            case 'completed':
                return <Tag color="success" icon={<CheckCircleOutlined />}>Ready</Tag>;
            case 'processing':
                return <Tag color="processing" icon={<SyncOutlined spin />}>Indexing</Tag>;
            case 'error':
                return <Tag color="error" icon={<ExclamationCircleOutlined />}>Error</Tag>;
            default:
                return <Tag>{status}</Tag>;
        }
    };

    if (loading) return <div style={{ textAlign: 'center', padding: 40 }}><Spin size="large" /></div>;

    return (
        <div style={{ padding: '0 24px' }}>
            <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Title level={4} style={{ margin: 0 }}>{spaceName} Documents</Title>
                <Text type="secondary">{documents.length} files indexed</Text>
            </div>

            <Dragger
                multiple={false}
                beforeUpload={handleUpload}
                showUploadList={false}
                style={{ marginBottom: 24, background: 'var(--color-bg-secondary)', border: '1px dashed var(--color-border)' }}
            >
                <p className="ant-upload-drag-icon">
                    <InboxOutlined style={{ color: 'var(--color-primary)' }} />
                </p>
                <p className="ant-upload-text">Click or drag file to this area to upload</p>
                <p className="ant-upload-hint">
                    Support for PDF, DOCX, and TXT. Files are automatically indexed for RAG.
                </p>
            </Dragger>

            <List
                itemLayout="horizontal"
                dataSource={documents}
                locale={{ emptyText: <Empty description="No documents in this space yet." /> }}
                renderItem={(doc) => (
                    <List.Item
                        actions={[getStatusTag(doc.status)]}
                        style={{ background: 'var(--color-bg-secondary)', borderRadius: 8, padding: '12px 16px', marginBottom: 8, border: '1px solid var(--color-border)' }}
                    >
                        <List.Item.Meta
                            avatar={<FileOutlined style={{ fontSize: 24, color: 'var(--color-primary)' }} />}
                            title={<Text strong>{doc.name}</Text>}
                            description={`${(doc.size_bytes ? doc.size_bytes / 1024 : 0).toFixed(1)} KB • Uploaded ${new Date(doc.created_at).toLocaleDateString()}`}
                        />
                    </List.Item>
                )}
            />
        </div>
    );
};

export default SpaceManager;
