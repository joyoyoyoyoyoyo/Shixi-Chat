import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

api.interceptors.request.use((config) => {
  const raw = localStorage.getItem('auth-storage')
  const token = raw ? JSON.parse(raw)?.state?.token : null
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
