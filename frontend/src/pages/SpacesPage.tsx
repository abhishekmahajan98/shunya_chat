import { Layout, Typography } from 'antd';
import { AppstoreOutlined } from '@ant-design/icons';

const { Content } = Layout;
const { Title, Paragraph } = Typography;

const SpacesPage = () => {
  return (
    <Layout style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
      <Content style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '60px 24px',
      }}>
        <div style={{
          width: 80,
          height: 80,
          borderRadius: 20,
          background: 'var(--color-primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 24,
        }}>
          <AppstoreOutlined style={{ fontSize: 36, color: 'var(--color-text-inverse)' }} />
        </div>
        <Title level={2} style={{ color: 'var(--color-text)', marginBottom: 8 }}>
          Spaces
        </Title>
        <Paragraph style={{
          color: 'var(--color-text-secondary)',
          textAlign: 'center',
          maxWidth: 400,
        }}>
          Organize your conversations and projects into dedicated spaces. Coming soon!
        </Paragraph>

        {/* Placeholder Cards */}
        <div style={{
          display: 'flex',
          gap: 16,
          marginTop: 40,
          flexWrap: 'wrap',
          justifyContent: 'center',
        }}>
          {['Personal', 'Work', 'Research'].map((space, i) => (
            <div
              key={i}
              style={{
                width: 160,
                height: 100,
                border: '1px dashed var(--color-border)',
                borderRadius: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-text-secondary)',
                fontSize: 14,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-primary)';
                e.currentTarget.style.color = 'var(--color-primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-border)';
                e.currentTarget.style.color = 'var(--color-text-secondary)';
              }}
            >
              + {space}
            </div>
          ))}
        </div>
      </Content>
    </Layout>
  );
};

export default SpacesPage;
