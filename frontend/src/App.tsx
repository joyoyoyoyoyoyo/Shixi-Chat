import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AuthPage from './pages/auth/AuthPage'
import MainLayout from './layouts/MainLayout'
import SearchPage from './pages/search/SearchPage'
import ChatPage from './pages/chat/ChatPage'
import ForumPage from './pages/forum/ForumPage'
import ProfilePage from './pages/profile/ProfilePage'
import useAuthStore from './store/authStore'
import useChatStore from './store/chatStore'
import useForumStore from './store/forumStore'
import useNotifStore from './store/notificationStore'
import useProfileStore from './store/profileStore'
import { setCurrentUserId } from './utils/userStorage'
import useRealtimeChat from './hooks/useRealtimeChat'

// 监听登录/登出，切换用户数据
function UserDataSync() {
  const user = useAuthStore((s) => s.user)

  useEffect(() => {
    if (user?.id) {
      // 设置用户 ID → 之后的 storage 读写都走 key:userId
      setCurrentUserId(user.id)
      // 重新从 localStorage 加载该用户的数据
      useChatStore.persist.rehydrate()
      useForumStore.persist.rehydrate()
      useNotifStore.persist.rehydrate()
      useProfileStore.persist.rehydrate()
    } else {
      // 登出：清除 ID，将所有 store 恢复初始状态
      setCurrentUserId(null)
      useChatStore.getState().reset()
      useForumStore.getState().reset()
      useNotifStore.getState().reset()
      useProfileStore.getState().reset()
    }
  }, [user?.id])

  return null
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token)
  return token ? <>{children}</> : <Navigate to="/auth" replace />
}

export default function App() {
  const token = useAuthStore((s) => s.token)

  useRealtimeChat()

  return (
    <BrowserRouter>
      <UserDataSync />
      <Routes>
        <Route path="/auth" element={token ? <Navigate to="/search" replace /> : <AuthPage />} />
        <Route
          path="/"
          element={<ProtectedRoute><MainLayout /></ProtectedRoute>}
        >
          <Route index element={<Navigate to="/search" replace />} />
          <Route path="search" element={<SearchPage />} />
          <Route path="chat" element={<ChatPage />} />
          <Route path="forum" element={<ForumPage />} />
          <Route path="profile" element={<ProfilePage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
