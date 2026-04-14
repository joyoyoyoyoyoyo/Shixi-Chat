import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AuthPage from './pages/auth/AuthPage'
import MainLayout from './layouts/MainLayout'
import SearchPage from './pages/search/SearchPage'
import ChatPage from './pages/chat/ChatPage'
import ForumPage from './pages/forum/ForumPage'
import ProfilePage from './pages/profile/ProfilePage'
import useAuthStore from './store/authStore'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token)
  return token ? <>{children}</> : <Navigate to="/auth" replace />
}

export default function App() {
  const token = useAuthStore((s) => s.token)

  return (
    <BrowserRouter>
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
