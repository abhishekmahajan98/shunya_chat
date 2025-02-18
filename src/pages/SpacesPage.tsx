import React from 'react';
import { Layout, Typography } from 'antd';
import { ThunderboltOutlined } from '@ant-design/icons';

const { Content } = Layout;
const { Title, Paragraph } = Typography;

const SpacesPage: React.FC = () => {
  return (
    <Layout style={{ minHeight: '100vh', background: '#2e2e2e' }}>
      <Content
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '40px',
        }}
      >
        <ThunderboltOutlined style={{ fontSize: '48px', color: '#1890ff' }} />
        <Title level={2} style={{ color: '#fff', marginTop: '16px' }}>
          Spaces
        </Title>
        <Paragraph style={{ color: '#ccc', textAlign: 'center', maxWidth: '600px' }}>
          This is a placeholder page for Spaces. More features will be added soon!
        </Paragraph>
      </Content>
    </Layout>
  );
};

export default SpacesPage;
