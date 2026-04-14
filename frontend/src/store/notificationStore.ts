import { create } from 'zustand'

export type NotifType = 'mention' | 'join_request' | 'like' | 'comment'

export interface Notification {
  id: string
  type: NotifType
  from: { name: string; initial: string; color: string }
  postContent?: string
  forumName?: string
  time: string
  read: boolean
  requestStatus?: 'pending' | 'approved' | 'rejected'
}

interface NotifState {
  notifications: Notification[]
  markRead: (id: string) => void
  markAllRead: () => void
  handleRequest: (id: string, action: 'approved' | 'rejected') => void
}

const MOCK_NOTIFS: Notification[] = [
  {
    id: 'n1', type: 'mention', read: false, time: '5分钟前',
    from: { name: '张小明', initial: '张', color: '#667eea' },
    postContent: '我觉得 @你 之前说的方法很有参考价值',
    forumName: 'IT互联网实习交流圈',
  },
  {
    id: 'n2', type: 'join_request', read: false, time: '12分钟前',
    from: { name: '陈思思', initial: '陈', color: '#43e97b' },
    forumName: 'IT互联网实习交流圈',
    requestStatus: 'pending',
  },
  {
    id: 'n3', type: 'like', read: false, time: '30分钟前',
    from: { name: '周静怡', initial: '周', color: '#84fab0' },
    postContent: '刚刚完成了第一个独立需求的上线…',
    forumName: 'IT互联网实习交流圈',
  },
  {
    id: 'n4', type: 'comment', read: false, time: '1小时前',
    from: { name: '吴俊杰', initial: '吴', color: '#f6d365' },
    postContent: '分享一个小经验：实习时主动帮团队…',
    forumName: 'IT互联网实习交流圈',
  },
  {
    id: 'n5', type: 'join_request', read: true, time: '昨天',
    from: { name: '孙浩宇', initial: '孙', color: '#fda085' },
    forumName: '金融行业实习生之家',
    requestStatus: 'pending',
  },
  {
    id: 'n6', type: 'like', read: true, time: '昨天',
    from: { name: '赵雨桐', initial: '赵', color: '#a18cd1' },
    postContent: '实习转正了！从三月投简历到现在…',
    forumName: 'IT互联网实习交流圈',
  },
  {
    id: 'n7', type: 'comment', read: true, time: '2天前',
    from: { name: '林思远', initial: '林', color: '#f7971e' },
    postContent: '大家有没有好用的刷题平台推荐？',
    forumName: 'IT互联网实习交流圈',
  },
]

const useNotifStore = create<NotifState>((set) => ({
  notifications: MOCK_NOTIFS,

  markRead: (id) =>
    set((s) => ({
      notifications: s.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      ),
    })),

  markAllRead: () =>
    set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, read: true })),
    })),

  handleRequest: (id, action) =>
    set((s) => ({
      notifications: s.notifications.map((n) =>
        n.id === id ? { ...n, requestStatus: action, read: true } : n
      ),
    })),
}))

export default useNotifStore
