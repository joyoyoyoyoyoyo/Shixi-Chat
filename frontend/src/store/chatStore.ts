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

const INITIAL_MESSAGES: Record<string, Message[]> = {
  '1': [
    { id: '1', senderId: '1',  text: '嘿，你最近实习怎么样？',               time: '10:20', type: 'text' },
    { id: '2', senderId: 'me', text: '还不错，项目挺有意思的，就是加班多了点', time: '10:22', type: 'text' },
    { id: '3', senderId: '1',  text: '哈哈，大厂都这样，习惯就好了',           time: '10:25', type: 'text' },
    { id: '4', senderId: 'me', text: '你那边呢？听说你去了腾讯？',             time: '10:28', type: 'text' },
    { id: '5', senderId: '1',  text: '对呀！下周我们约出来聊聊吧',             time: '10:30', type: 'text' },
    { id: '6', senderId: '1',  text: '好的，明天见！',                         time: '10:32', type: 'text' },
  ],
  '2':  [
    { id: '1', senderId: '2',  text: '那份实习报告你做完了吗', time: '09:15', type: 'text' },
    { id: '2', senderId: 'me', text: '还没呢，今晚肝完',       time: '09:16', type: 'text' },
  ],
  '3':  [{ id: '1', senderId: '3',  text: '周末一起去爬山？',                time: '昨天 18:00', type: 'text' }],
  '4':  [
    { id: '1', senderId: '4',  text: '你好，我是陈思思！',    time: '昨天 14:00', type: 'text' },
    { id: '2', senderId: 'me', text: '你好！很高兴认识你',    time: '昨天 14:05', type: 'text' },
  ],
  '5':  [
    { id: '1', senderId: '5',  text: '面试通过了吗？',        time: '周一', type: 'text' },
    { id: '2', senderId: 'me', text: '通过了！下周入职',       time: '周一', type: 'text' },
    { id: '3', senderId: '5',  text: '太棒了，恭喜！',        time: '周一', type: 'text' },
  ],
  '6':  [{ id: '1', senderId: '6',  text: '今天导师让我独立做需求了，好紧张',  time: '周一', type: 'text' }],
  '7':  [{ id: '1', senderId: 'me', text: '发给我吧，我帮你看看',             time: '周二', type: 'text' }],
  '8':  [{ id: '1', senderId: '8',  text: '我拿到字节的offer了！开心死了',    time: '周二', type: 'text' }],
  '9':  [{ id: '1', senderId: '9',  text: '下周一起去参加校园招聘会？',        time: '周三', type: 'text' }],
  '10': [{ id: '1', senderId: '10', text: '你们公司实习好玩吗，讲讲呗',       time: '周三', type: 'text' }],
  '11': [{ id: '1', senderId: '11', text: '代码review终于通过了，累死了',     time: '周四', type: 'text' }],
  '12': [{ id: '1', senderId: '12', text: '周五下班一起去吃饭怎么样',          time: '周四', type: 'text' }],
  '13': [{ id: '1', senderId: '13', text: '实习结束了好不舍得，哭了',          time: '上周',  type: 'text' }],
  '14': [{ id: '1', senderId: 'me', text: '这个框架我用过，挺好上手的',        time: '上周',  type: 'text' }],
  '15': [{ id: '1', senderId: '15', text: '转正消息还没下来，等得好焦虑',      time: '更早',  type: 'text' }],
  // 群聊消息
  'g1': [
    { id: '1', senderId: '1',  text: '大家好，欢迎加入实习生互助群！', time: '昨天 10:00', type: 'text' },
    { id: '2', senderId: '2',  text: '大家好！有什么问题都可以互相帮助', time: '昨天 10:02', type: 'text' },
    { id: '3', senderId: 'me', text: '大家好！很高兴认识大家',         time: '昨天 10:05', type: 'text' },
    { id: '4', senderId: '6',  text: '我刚拿到字节实习offer，好激动！', time: '昨天 14:30', type: 'text' },
  ],
  'g2': [
    { id: '1', senderId: '5',  text: '有人在用 React 18 的新特性吗？', time: '周一', type: 'text' },
    { id: '2', senderId: 'me', text: '用了 Suspense，挺好用的',        time: '周一', type: 'text' },
    { id: '3', senderId: '11', text: '推荐一下官方文档，写得很清楚',   time: '周一', type: 'text' },
  ],
}

const INITIAL_GROUPS: Group[] = [
  { id: 'g1', name: '实习生互助群',   memberIds: ['1', '2', '6'], color: '#667eea' },
  { id: 'g2', name: '前端开发交流群', memberIds: ['5', '11'],     color: '#43e97b' },
]

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

  sendMessage: (convId: string, msg: Message) => void
  clearFriendUnread: (friendId: string) => void
  clearNavUnread: () => void
  addGroup: (group: Group) => void
  reset: () => void
}

const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      messages: INITIAL_MESSAGES,
      groups: INITIAL_GROUPS,
      unreadMap: computeUnreadMap(INITIAL_MESSAGES),
      unreadTotal: Object.values(computeUnreadMap(INITIAL_MESSAGES)).reduce((a, b) => a + b, 0),

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
          const newMap = computeUnreadMap(state.messages)
          state.unreadMap = newMap
          state.unreadTotal = Object.values(newMap).reduce((a, b) => a + b, 0)
        }
      },
    }
  )
)

export default useChatStore
