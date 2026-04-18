import axios from 'axios'
import useAuthStore from '../store/authStore'

const api = axios.create({ baseURL: '/api' })
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export interface ApiForum {
  id: string
  name: string
  description: string
  industry: string
  tags: string[]
  image: string
  color: string
  ownerId: string
  adminIds: string[]
  memberCount: number
  isPrivate: boolean
  isMember: boolean
  isOwner: boolean
  isAdmin: boolean
  isPending: boolean
  createdAt: string
}

export interface ApiMember {
  id: string
  userId: string
  username: string
  avatar: string
  role: 'owner' | 'admin' | 'member'
  isFriend: boolean
}

export interface ApiJoinRequest {
  id: string
  user: { id: string; userId: string; username: string; avatar: string }
  createdAt: string
}

export interface ApiTopic {
  id: string
  forumId: string
  title: string
  content: string
  images: string[]
  creator: { id: string; username: string; avatar: string }
  likeCount: number
  isLiked: boolean
  commentCount: number
  isPinned?: boolean
  createdAt: string
}

export interface ApiComment {
  id: string
  topicId: string
  creator: { id: string; username: string; avatar: string }
  content: string
  createdAt: string
}

export const getForums = () => api.get<{ forums: ApiForum[] }>('/forums')
export const createForum = (data: { name: string; description: string; industry: string; color: string; isPrivate: boolean }) =>
  api.post<{ forum: ApiForum }>('/forums', data)
export const updateForum = (id: string, data: Partial<ApiForum>) =>
  api.put<{ forum: ApiForum }>(`/forums/${id}`, data)
export const joinForum = (id: string) => api.post(`/forums/${id}/join`)
export const leaveForum = (id: string) => api.post(`/forums/${id}/leave`)
export const getMembers = (id: string) => api.get<{ members: ApiMember[] }>(`/forums/${id}/members`)
export const setAdmin = (forumId: string, userId: string) => api.post(`/forums/${forumId}/admins/${userId}`)
export const removeAdmin = (forumId: string, userId: string) => api.delete(`/forums/${forumId}/admins/${userId}`)
export const removeMember = (forumId: string, userId: string) => api.delete(`/forums/${forumId}/members/${userId}`)
export const getJoinRequests = (id: string) => api.get<{ requests: ApiJoinRequest[] }>(`/forums/${id}/requests`)
export const respondRequest = (forumId: string, reqId: string, action: 'approve' | 'reject') =>
  api.post(`/forums/${forumId}/requests/${reqId}`, { action })

export const getTopics = (forumId: string) => api.get<{ topics: ApiTopic[] }>(`/topics?forumId=${forumId}`)
export const createTopic = (formData: FormData) => api.post<{ topic: ApiTopic }>('/topics', formData, {
  headers: { 'Content-Type': 'multipart/form-data' }
})
export const dissolveForum = (id: string) => api.delete(`/forums/${id}`)
export const deleteTopic = (id: string) => api.delete(`/topics/${id}`)
export const likeTopic = (id: string) => api.post<{ isLiked: boolean; likeCount: number }>(`/topics/${id}/like`)
export const getComments = (topicId: string) => api.get<{ comments: ApiComment[] }>(`/topics/${topicId}/comments`)
export const createComment = (topicId: string, content: string) =>
  api.post<{ comment: ApiComment }>(`/topics/${topicId}/comments`, { content })
export const deleteComment = (topicId: string, commentId: string) =>
  api.delete(`/topics/${topicId}/comments/${commentId}`)
export const pinTopic = (id: string) => api.post<{ isPinned: boolean }>(`/topics/${id}/pin`)
