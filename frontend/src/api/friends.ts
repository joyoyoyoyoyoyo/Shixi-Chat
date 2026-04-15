import axios from 'axios'
import useAuthStore from '../store/authStore'

const api = axios.create({ baseURL: '/api' })

// 直接从 Zustand store 内存中读取 token（authStore 没有 persist，token 只在内存里）
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export interface ApiFriend {
  id: string       // MongoDB ObjectId
  userId: string   // 11位数字 ID
  username: string
  email: string
  avatar: string
}

export interface ApiRequest {
  id: string       // FriendRequest _id
  from: ApiFriend
  createdAt: string
}

// 搜索用户（通过 11 位 userId 或邮箱）
export const searchUser = (query: string) =>
  api.get<{ user: ApiFriend; isFriend: boolean; isPending: boolean }>('/friends/search', { params: { q: query } })

// 发送好友请求（toUserId 为 MongoDB ObjectId）
export const sendFriendRequest = (toUserId: string) =>
  api.post('/friends/request', { toUserId })

// 获取收到的好友请求
export const getFriendRequests = () =>
  api.get<{ requests: ApiRequest[] }>('/friends/requests')

// 接受 / 拒绝好友请求
export const respondFriendRequest = (requestId: string, action: 'accept' | 'reject') =>
  api.post('/friends/respond', { requestId, action })

// 获取好友列表
export const getFriends = () =>
  api.get<{ friends: ApiFriend[] }>('/friends')

// 删除好友
export const deleteFriend = (friendId: string) =>
  api.delete(`/friends/${friendId}`)
