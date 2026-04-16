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

const INITIAL_MESSAGES: Record<string, Message[]> = {}

const INITIAL_GROUPS: Group[] = []

// 判断是否为旧的假数据 key（纯数字 '1'~'15' 或 'g1'/'g2'）
function isMockKey(key: string) {
  return /^\d{1,2}$/.test(key) || key === 'g1' || key === 'g2'
}

function computeUnreadMap(msgs: Record<string, Message[]>): Record<string, number> {
  const map: Record<string, number> = {}
  for (const [id, list] of Object.entries(msgs)) {
    if (id.startsWith('g')) continue  // 群聊不计未读
    const lastMyIdx = list.map((m) => m.senderId).lastIndexOf('me')
    map[id] = list.slice(lastMyIdx + 1).filter((m) => m.senderId !== 'me').length
  }
  map['1'] = 0  // 默认打开第一个好友，清掉其未读
  return map
}

interface ChatState {
  messages: Record<string, Message[]>
  groups: Group[]
  unreadMap: Record<string, number>
  unreadTotal: number
  friendRequestCount: number   // 待处理好友申请数（不持久化）

  sendMessage: (convId: string, msg: Message) => void
  clearFriendUnread: (friendId: string) => void
  clearNavUnread: () => void
  addGroup: (group: Group) => void
  setFriendRequestCount: (n: number) => void
  reset: () => void
}

const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      messages: INITIAL_MESSAGES,
      groups: INITIAL_GROUPS,
      unreadMap: computeUnreadMap(INITIAL_MESSAGES),
      unreadTotal: Object.values(computeUnreadMap(INITIAL_MESSAGES)).reduce((a, b) => a + b, 0),
      friendRequestCount: 0,

      sendMessage: (convId, msg) =>
        set((s) => ({
          messages: { ...s.messages, [convId]: [...(s.messages[convId] ?? []), msg] },
        })),

      clearFriendUnread: (friendId) =>
        set((s) => {
          const newMap = { ...s.unreadMap, [friendId]: 0 }
          return { unreadMap: newMap, unreadTotal: Object.values(newMap).reduce((a, b) => a + b, 0) }
        }),

      clearNavUnread: () => set({ unreadTotal: 0 }),

      addGroup: (group) =>
        set((s) => ({ groups: [...s.groups, group] })),

      setFriendRequestCount: (n) => set({ friendRequestCount: n }),

      reset: () => set({
        messages: INITIAL_MESSAGES,
        groups: INITIAL_GROUPS,
        unreadMap: computeUnreadMap(INITIAL_MESSAGES),
        unreadTotal: Object.values(computeUnreadMap(INITIAL_MESSAGES)).reduce((a, b) => a + b, 0),
      }),
    }),
    {
      name: 'shixi-chat',
      storage: createJSONStorage(() => userAwareStorage),
      partialize: (state) => ({ messages: state.messages, groups: state.groups }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          // 过滤掉旧的假数据（纯数字 ID '1'~'15' 及 'g1'/'g2'）
          const cleanMsgs = Object.fromEntries(
            Object.entries(state.messages).filter(([k]) => !isMockKey(k))
          )
          const cleanGroups = state.groups.filter((g) => !isMockKey(g.id))
          state.messages = cleanMsgs
          state.groups = cleanGroups

          const newMap = computeUnreadMap(cleanMsgs)
          state.unreadMap = newMap
          state.unreadTotal = Object.values(newMap).reduce((a, b) => a + b, 0)
        }
      },
    }
  )
)

export default useChatStore
