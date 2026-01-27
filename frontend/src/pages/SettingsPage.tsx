import { Layout, Typography, Switch } from 'antd';
import { SettingOutlined, SunOutlined, MoonOutlined } from '@ant-design/icons';
import { useTheme } from '../context/ThemeContext';

const { Content } = Layout;
const { Title, Paragraph } = Typography;

const SettingsPage = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <Layout style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
      <Content style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '60px 24px',
      }}>
        <div style={{ maxWidth: 600, width: '100%' }}>
          {/* Header */}
          <div style={{
            textAlign: 'center',
            marginBottom: 48,
          }}>
            <div style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              background: 'var(--color-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
            }}>
              <SettingOutlined style={{ fontSize: 28, color: 'var(--color-text-inverse)' }} />
            </div>
            <Title level={2} style={{ color: 'var(--color-text)', margin: 0 }}>
              Settings
            </Title>
            <Paragraph style={{ color: 'var(--color-text-secondary)', marginTop: 8 }}>
              Customize your Shunya Chat experience
            </Paragraph>
          </div>

          {/* Settings Cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Theme Setting */}
            <div style={{
              padding: '20px 24px',
              border: '1px solid var(--color-border)',
              borderRadius: 12,
              background: 'var(--color-surface)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: 'var(--color-surface-hover)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  {theme === 'dark' ? (
                    <MoonOutlined style={{ fontSize: 18, color: 'var(--color-primary)' }} />
                  ) : (
                    <SunOutlined style={{ fontSize: 18, color: 'var(--color-primary)' }} />
                  )}
                </div>
                <div>
                  <div style={{ fontWeight: 500, color: 'var(--color-text)' }}>
                    Appearance
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                    {theme === 'dark' ? 'Dark mode enabled' : 'Light mode enabled'}
                  </div>
                </div>
              </div>
              <Switch
                checked={theme === 'dark'}
                onChange={toggleTheme}
                checkedChildren={<MoonOutlined />}
                unCheckedChildren={<SunOutlined />}
              />
            </div>

            {/* Placeholder Settings */}
            {[
              { title: 'Notifications', desc: 'Manage notification preferences' },
              { title: 'Data & Privacy', desc: 'Control your data and privacy settings' },
              { title: 'Keyboard Shortcuts', desc: 'View and customize shortcuts' },
            ].map((item, i) => (
              <div
                key={i}
                style={{
                  padding: '20px 24px',
                  border: '1px solid var(--color-border)',
                  borderRadius: 12,
                  background: 'var(--color-surface)',
                  cursor: 'pointer',
                  transition: 'border-color 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-primary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-border)';
                }}
              >
                <div style={{ fontWeight: 500, color: 'var(--color-text)' }}>
                  {item.title}
                </div>
                <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 4 }}>
                  {item.desc}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Content>
    </Layout>
  );
};

export default SettingsPage;
