import axios from 'axios'
import useAuthStore from '../store/authStore'

const api = axios.create({ baseURL: '/api' })
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export interface ApiGroup {
  id: string
  name: string
  description: string
  color: string
  ownerId: string
  adminIds: string[]
  members: { id: string; userId: string; username: string; avatar: string }[]
  announcement: string
  isMuted: boolean
  createdAt: string
}

export interface ApiGroupMessage {
  id: string
  groupId: string
  sender: { id: string; userId: string; username: string; avatar: string }
  content: string
  type: 'text' | 'system'
  mentionedUsers: string[]
  isRecalled: boolean
  createdAt: string
}

export const fetchGroups = () => api.get<{ groups: ApiGroup[] }>('/groups')
export const createGroup = (data: { name: string; description?: string; color?: string; memberIds: string[] }) =>
  api.post<{ group: ApiGroup }>('/groups', data)
export const fetchGroupMessages = (groupId: string, before?: string) =>
  api.get<{ messages: ApiGroupMessage[] }>(`/groups/${groupId}/messages`, { params: { before, limit: 50 } })
export const updateGroup = (id: string, data: Partial<ApiGroup>) =>
  api.put<{ group: ApiGroup }>(`/groups/${id}`, data)
export const setAnnouncement = (id: string, announcement: string) =>
  api.put(`/groups/${id}/announcement`, { announcement })
export const setMuted = (id: string, isMuted: boolean) =>
  api.put(`/groups/${id}/mute`, { isMuted })
export const inviteMembers = (id: string, memberIds: string[]) =>
  api.post(`/groups/${id}/invite`, { memberIds })
export const leaveGroup = (id: string) => api.post(`/groups/${id}/leave`)
export const kickMember = (groupId: string, userId: string) =>
  api.delete(`/groups/${groupId}/members/${userId}`)
export const dissolveGroup = (id: string) => api.delete(`/groups/${id}`)
