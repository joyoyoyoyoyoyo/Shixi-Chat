import { useState } from 'react'
import { useNavigate, useLocation, Outlet } from 'react-router-dom'
import {
  SearchOutlined,
  MessageOutlined,
  ReadOutlined,
  UserOutlined,
  LogoutOutlined,
} from '@ant-design/icons'
import { Modal, Badge } from 'antd'
import useAuthStore from '../store/authStore'
import useChatStore from '../store/chatStore'
import useNotifStore from '../store/notificationStore'
import { SidebarContext } from '../context/SidebarContext'

const NAV_ITEMS = [
  { icon: <SearchOutlined />, label: '发现', path: '/search' },
  { icon: <MessageOutlined />, label: '消息', path: '/chat' },
  { icon: <ReadOutlined />,   label: '论坛', path: '/forum' },
  { icon: <UserOutlined />,   label: '我的', path: '/profile' },
]

export default function MainLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuthStore()
  const chatUnread = useChatStore((s) => s.unreadTotal ?? 0)
  const forumUnread = useNotifStore((s) => s.notifications.filter((n) => !n.read).length)
  const [sidebarHovered, setSidebarHovered] = useState(false)

  const getBadge = (path: string) => {
    if (path === '/chat') return chatUnread
    if (path === '/forum') return forumUnread
    return 0
  }

  const handleLogout = () => {
    Modal.confirm({
      title: '确认退出？',
      content: '退出后需要重新登录才能进入账号。',
      okText: '退出',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: () => {
        logout()
        navigate('/auth')
      },
    })
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#f5f6fa' }}>
      {/* ── 左侧导航栏 ── */}
      <div
        className="sidebar"
        onMouseEnter={() => setSidebarHovered(true)}
        onMouseLeave={() => setSidebarHovered(false)}
      >
        <div className="sidebar-avatar">
          <div className="avatar-circle">
            {user?.username?.[0]?.toUpperCase() ?? 'U'}
          </div>
          <span className="sidebar-label">{user?.username}</span>
        </div>

        <nav style={{ flex: 1, marginTop: 8 }}>
          {NAV_ITEMS.map((item) => {
            const active = location.pathname.startsWith(item.path)
            const badge = getBadge(item.path)
            return (
              <div
                key={item.path}
                className={`sidebar-item ${active ? 'sidebar-item-active' : ''}`}
                onClick={() => navigate(item.path)}
              >
                <span className="sidebar-icon">
                  <Badge dot={badge > 0} offset={[2, -2]} color="#ff4d4f">
                    {item.icon}
                  </Badge>
                </span>
                <span className="sidebar-label">{item.label}</span>
              </div>
            )
          })}
        </nav>

        <div className="sidebar-item sidebar-item-logout" onClick={handleLogout}>
          <span className="sidebar-icon"><LogoutOutlined /></span>
          <span className="sidebar-label">退出</span>
        </div>
      </div>

      {/* ── 右侧内容区 ── */}
      <SidebarContext.Provider value={sidebarHovered}>
        <div style={{ flex: 1, marginLeft: sidebarHovered ? 210 : 64, overflow: 'hidden', display: 'flex', transition: 'margin-left 0.25s cubic-bezier(0.4,0,0.2,1)' }}>
          <Outlet />
        </div>
      </SidebarContext.Provider>
    </div>
  )
}
