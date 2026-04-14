import React from 'react'
import ReactDOM from 'react-dom/client'
import { ConfigProvider, message } from 'antd'

message.config({ maxCount: 3 })
import zhCN from 'antd/locale/zh_CN'
import App from './App.tsx'
import './styles/index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: '#667eea',
          borderRadius: 8,
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif",
        },
      }}
    >
      <App />
    </ConfigProvider>
  </React.StrictMode>
)
