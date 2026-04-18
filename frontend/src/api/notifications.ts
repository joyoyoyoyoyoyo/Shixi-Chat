import axios from 'axios'
import useAuthStore from '../store/authStore'

const api = axios.create({ baseURL: '/api' })
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export interface ApiNotification {
  id: string
  type: 'like' | 'comment'
  fromUser: { id: string; username: string; avatar: string }
  forumId: string
  topicId: string
  topicTitle: string
  commentContent: string
  read: boolean
  createdAt: string
}

export interface ApiManagementRequest {
  id: string
  forum: { id: string; name: string; color: string }
  user: { id: string; userId: string; username: string; avatar: string }
  createdAt: string
}

export const fetchNotifications = () => api.get<{ notifications: ApiNotification[] }>('/notifications')
export const fetchUnreadCount = () => api.get<{ notifCount: number; requestCount: number; total: number }>('/notifications/unread-count')
export const fetchManagementRequests = () => api.get<{ requests: ApiManagementRequest[] }>('/notifications/management')
export const markNotifRead = (id: string) => api.put(`/notifications/${id}/read`)
export const markAllNotifRead = () => api.put('/notifications/read-all')
