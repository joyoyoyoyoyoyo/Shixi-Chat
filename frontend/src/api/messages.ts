import axios from 'axios'
import useAuthStore from '../store/authStore'

const api = axios.create({ baseURL: '/api' })

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export interface ApiMessage {
  id: string
  senderId: string   // MongoDB ObjectId 字符串
  text: string
  type: string
  time: string
  createdAt: string
}

// 发送消息
export const postMessage = (friendId: string, text: string) =>
  api.post<{ message: ApiMessage }>('/messages', { friendId, text })

// 拉取消息（since 为 ISO 时间字符串，不传则拉全量）
export const fetchMessages = (friendId: string, since?: string) =>
  api.get<{ messages: ApiMessage[] }>(`/messages/${friendId}`, {
    params: since ? { since } : {},
  })
