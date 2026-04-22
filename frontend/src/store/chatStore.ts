import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { userAwareStorage } from '../utils/userStorage'

export interface Message {
  id: string
  senderId: string
  text: string
  time: string
  type: 'text'
}

export interface Group {
  id: string
  name: string
  memberIds: string[]
  color: string
}

// 群聊消息（与 api/groups.ts 的 ApiGroupMessage 结构一致，避免循环依赖）
export interface GroupMessage {
  id: string
  groupId: string
  sender: { id: string; userId: string; username: string; avatar: string }
  content: string
  type: 'text' | 'system'
  mentionedUsers: string[]
  isRecalled: boolean
  createdAt: string
}

const MAX_GROUP_MSGS = 200   // 每个群最多缓存条数

const INITIAL_MESSAGES: Record<string, Message[]> = {}
const INITIAL_GROUPS: Group[] = []
const INITIAL_GROUP_MESSAGES: Record<string, GroupMessage[]> = {}

function isMockKey(key: string) {
  return /^\d{1,2}$/.test(key) || key === 'g1' || key === 'g2'
}

function computeUnreadMap(msgs: Record<string, Message[]>): Record<string, number> {
  const map: Record<string, number> = {}
  for (const [id, list] of Object.entries(msgs)) {
    if (id.startsWith('g')) continue
    const lastMyIdx = list.map((m) => m.senderId).lastIndexOf('me')
    map[id] = list.slice(lastMyIdx + 1).filter((m) => m.senderId !== 'me').length
  }
  map['1'] = 0
  return map
}

interface ChatState {
  messages: Record<string, Message[]>
  groups: Group[]
  groupMessages: Record<string, GroupMessage[]>   // 持久化群聊记录
  unreadMap: Record<string, number>
  unreadTotal: number
  friendRequestCount: number

  socketConnected: boolean
  onlineIds: Record<string, true>
  typingMap: Record<string, boolean>

  sendMessage: (convId: string, msg: Message) => void
  clearFriendUnread: (friendId: string) => void
  clearNavUnread: () => void
  addGroup: (group: Group) => void
  setFriendRequestCount: (n: number) => void

  // 群聊消息操作
  setGroupMessages: (groupId: string, msgs: GroupMessage[]) => void
  appendGroupMessage: (msg: GroupMessage) => void
  recallGroupMessage: (groupId: string, messageId: string) => void
  replaceGroupTempMsg: (groupId: string, tempId: string, msg: GroupMessage) => void

  setSocketConnected: (connected: boolean) => void
  applyPresenceSnapshot: (ids: string[]) => void
  setOnline: (userId: string, online: boolean) => void
  setTyping: (friendId: string, typing: boolean) => void

  reset: () => void
}

const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      messages: INITIAL_MESSAGES,
      groups: INITIAL_GROUPS,
      groupMessages: INITIAL_GROUP_MESSAGES,
      unreadMap: computeUnreadMap(INITIAL_MESSAGES),
      unreadTotal: Object.values(computeUnreadMap(INITIAL_MESSAGES)).reduce((a, b) => a + b, 0),
      friendRequestCount: 0,

      socketConnected: false,
      onlineIds: {},
      typingMap: {},

      sendMessage: (convId, msg) =>
        set((s) => ({
          messages: { ...s.messages, [convId]: [...(s.messages[convId] ?? []), msg] },
        })),

      // 精确减法：仅扣掉该好友的已读数，不从 unreadMap 重新 sum
      clearFriendUnread: (friendId) =>
        set((s) => {
          const cleared = s.unreadMap[friendId] ?? 0
          return {
            unreadMap: { ...s.unreadMap, [friendId]: 0 },
            unreadTotal: Math.max(0, s.unreadTotal - cleared),
          }
        }),

      // 进入聊天页：同时清零导航红点和所有好友未读标记
      clearNavUnread: () =>
        set((s) => ({
          unreadTotal: 0,
          unreadMap: Object.fromEntries(Object.keys(s.unreadMap).map((k) => [k, 0])),
        })),

      addGroup: (group) =>
        set((s) => ({ groups: [...s.groups, group] })),

      setFriendRequestCount: (n) => set({ friendRequestCount: n }),

      // ── 群聊消息操作 ──────────────────────────────────────
      setGroupMessages: (groupId, msgs) =>
        set((s) => ({
          groupMessages: {
            ...s.groupMessages,
            [groupId]: msgs.slice(-MAX_GROUP_MSGS),
          },
        })),

      appendGroupMessage: (msg) =>
        set((s) => {
          const prev = s.groupMessages[msg.groupId] ?? []
          // 去重：已存在相同 id 则跳过
          if (prev.some((m) => m.id === msg.id)) return s
          const next = [...prev, msg].slice(-MAX_GROUP_MSGS)
          return { groupMessages: { ...s.groupMessages, [msg.groupId]: next } }
        }),

      recallGroupMessage: (groupId, messageId) =>
        set((s) => ({
          groupMessages: {
            ...s.groupMessages,
            [groupId]: (s.groupMessages[groupId] ?? []).map((m) =>
              m.id === messageId ? { ...m, isRecalled: true } : m
            ),
          },
        })),

      replaceGroupTempMsg: (groupId, tempId, msg) =>
        set((s) => {
          const prev = s.groupMessages[groupId] ?? []
          // 若真实 id 已存在（socket 事件先到），不重复追加
          if (prev.some((m) => m.id === msg.id)) {
            return {
              groupMessages: {
                ...s.groupMessages,
                [groupId]: prev.filter((m) => m.id !== tempId),
              },
            }
          }
          return {
            groupMessages: {
              ...s.groupMessages,
              [groupId]: prev.map((m) => (m.id === tempId ? msg : m)),
            },
          }
        }),

      // ── 实时状态 ──────────────────────────────────────────
      setSocketConnected: (connected) => set({ socketConnected: connected }),

      applyPresenceSnapshot: (ids) =>
        set(() => ({ onlineIds: Object.fromEntries(ids.map((id) => [id, true as const])) })),

      setOnline: (userId, online) =>
        set((s) => {
          const next = { ...s.onlineIds }
          if (online) next[userId] = true
          else delete next[userId]
          return { onlineIds: next }
        }),

      setTyping: (friendId, typing) =>
        set((s) => ({ typingMap: { ...s.typingMap, [friendId]: typing } })),

      reset: () =>
        set({
          messages: INITIAL_MESSAGES,
          groups: INITIAL_GROUPS,
          groupMessages: INITIAL_GROUP_MESSAGES,
          unreadMap: computeUnreadMap(INITIAL_MESSAGES),
          unreadTotal: Object.values(computeUnreadMap(INITIAL_MESSAGES)).reduce((a, b) => a + b, 0),
          onlineIds: {},
          typingMap: {},
          socketConnected: false,
        }),
    }),
    {
      name: 'shixi-chat',
      storage: createJSONStorage(() => userAwareStorage),
      partialize: (state) => ({
        messages: state.messages,
        groups: state.groups,
        groupMessages: state.groupMessages,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          const cleanMsgs = Object.fromEntries(
            Object.entries(state.messages).filter(([k]) => !isMockKey(k))
          )
          const cleanGroups = state.groups.filter((g) => !isMockKey(g.id))
          // 每个群最多保留 MAX_GROUP_MSGS 条
          const cleanGroupMsgs = Object.fromEntries(
            Object.entries(state.groupMessages ?? {}).map(([k, v]) => [k, v.slice(-MAX_GROUP_MSGS)])
          )
          state.messages = cleanMsgs
          state.groups = cleanGroups
          state.groupMessages = cleanGroupMsgs

          const newMap = computeUnreadMap(cleanMsgs)
          state.unreadMap = newMap
          state.unreadTotal = Object.values(newMap).reduce((a, b) => a + b, 0)
        }
      },
    }
  )
)

export default useChatStore
