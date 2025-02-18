import React from 'react';
import { Layout, Typography } from 'antd';
import { SettingOutlined } from '@ant-design/icons';

const { Content } = Layout;
const { Title, Paragraph } = Typography;

const SettingsPage: React.FC = () => {
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
        <SettingOutlined style={{ fontSize: '48px', color: '#1890ff' }} />
        <Title level={2} style={{ color: '#fff', marginTop: '16px' }}>
          Settings
        </Title>
        <Paragraph style={{ color: '#ccc', textAlign: 'center', maxWidth: '600px' }}>
          This is a placeholder page for Settings. More configuration options will be available soon!
        </Paragraph>
      </Content>
    </Layout>
  );
};

export default SettingsPage;
