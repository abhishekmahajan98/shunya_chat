import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import 'antd/dist/reset.css'; // or 'antd/dist/antd.css' if using antd v4
import './global_ant_design.css'; // Import our global overrides
import { ConfigProvider, theme } from 'antd';

const { darkAlgorithm } = theme;

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <ConfigProvider
        theme={{
          algorithm: darkAlgorithm,
          token: {
            colorPrimary: '#555555',
            colorBgBase: '#2e2e2e',
            colorText: '#cccccc',
          },
        }}
      >
        <App />
      </ConfigProvider>
    </BrowserRouter>
  </React.StrictMode>
);
