import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { userAwareStorage } from '../utils/userStorage'

export interface Post {
  id: string
  forumId: number
  author: { name: string; initial: string; color: string }
  content: string
  time: string
  likes: number
  comments: number
  liked: boolean
  tags: string[]
  image?: string
}

export interface Comment {
  id: string
  postId: string
  author: { name: string; initial: string; color: string }
  content: string
  time: string
}

interface ForumState {
  joinedIds: number[]
  posts: Post[]
  comments: Comment[]
  join: (id: number) => void
  leave: (id: number) => void
  toggleLike: (postId: string) => void
  addComment: (postId: string, content: string, author: { name: string; initial: string; color: string }) => void
  reset: () => void
}

const MOCK_POSTS: Post[] = [
  {
    id: 'p1', forumId: 1,
    author: { name: '张小明', initial: '张', color: '#667eea' },
    content: '刚刚完成了第一个独立需求的上线，从设计到联调到发布，整整两周，终于看到自己写的代码跑在线上了！实习的感觉太真实了。',
    time: '10分钟前', likes: 42, comments: 8, liked: false, tags: ['成长', '后端'],
  },
  {
    id: 'p2', forumId: 2,
    author: { name: '郑梦琪', initial: '郑', color: '#89f7fe' },
    content: '今天第一次参加了部门的晨会，听到那些基金经理讨论仓位调整，感觉自己像是在看另一个世界。实习第三天，还在适应中。',
    time: '32分钟前', likes: 27, comments: 5, liked: false, tags: ['金融', '新人'],
    image: 'https://picsum.photos/seed/post-finance/800/400',
  },
  {
    id: 'p3', forumId: 1,
    author: { name: '林思远', initial: '林', color: '#f7971e' },
    content: '大家有没有好用的刷题平台推荐？准备找实习，算法这块有点薄弱，想系统练习一下。',
    time: '1小时前', likes: 63, comments: 21, liked: false, tags: ['算法', '求推荐'],
  },
  {
    id: 'p4', forumId: 3,
    author: { name: '周静怡', initial: '周', color: '#84fab0' },
    content: '今天跟着主任查房，第一次真正意义上和患者对话。课本上的知识在那一刻忽然都活了，有点激动有点紧张，这大概就是学医的意义吧。',
    time: '2小时前', likes: 89, comments: 14, liked: false, tags: ['临床', '医学生'],
    image: 'https://picsum.photos/seed/post-medical/800/400',
  },
  {
    id: 'p5', forumId: 1,
    author: { name: '吴俊杰', initial: '吴', color: '#f6d365' },
    content: '分享一个小经验：实习时主动帮团队做一些"没人做"的脏活累活，比如整理文档、跑环境、写测试，反而会被记住。不要只等着分配任务。',
    time: '3小时前', likes: 156, comments: 33, liked: false, tags: ['经验', '心得'],
  },
  {
    id: 'p6', forumId: 4,
    author: { name: '赵雨桐', initial: '赵', color: '#a18cd1' },
    content: '做教育运营实习两个月，整理了一份用户增长的数据报告，没想到被总监直接拿去汇报了。虽然没署名，但还是很开心能创造价值。',
    time: '5小时前', likes: 74, comments: 9, liked: false, tags: ['运营', '教育'],
  },
  {
    id: 'p7', forumId: 2,
    author: { name: '孙浩宇', initial: '孙', color: '#fda085' },
    content: '有没有在券商实习的同学？想请教一下研报的写作规范，我这边导师说我的逻辑链不够清晰，但没有细说，有点迷茫。',
    time: '昨天 18:30', likes: 31, comments: 17, liked: false, tags: ['券商', '研报'],
  },
  {
    id: 'p8', forumId: 1,
    author: { name: '黄子涵', initial: '黄', color: '#c471ed' },
    content: '实习转正了！从三月投简历到现在，经历了笔试、三轮技术面、HR面，终于尘埃落定。感谢这个论坛里给过我建议的所有人🎉',
    time: '昨天 14:00', likes: 312, comments: 56, liked: false, tags: ['转正', '喜报'],
    image: 'https://picsum.photos/seed/post-offer/800/400',
  },
]

const MOCK_COMMENTS: Comment[] = [
  { id: 'c1', postId: 'p1', author: { name: '李晓雯', initial: '李', color: '#f093fb' }, content: '恭喜！第一个需求上线是里程碑时刻，我当时也超激动的', time: '8分钟前' },
  { id: 'c2', postId: 'p1', author: { name: '王大伟', initial: '王', color: '#4facfe' }, content: '有什么踩坑的地方可以分享一下吗？', time: '6分钟前' },
  { id: 'c3', postId: 'p3', author: { name: '赵雨桐', initial: '赵', color: '#a18cd1' }, content: 'LeetCode + 代码随想录组合拳，亲测有效', time: '55分钟前' },
  { id: 'c4', postId: 'p3', author: { name: '刘浩然', initial: '刘', color: '#fa709a' }, content: '牛客的专项练习也不错，按标签刷', time: '50分钟前' },
  { id: 'c5', postId: 'p5', author: { name: '周静怡', initial: '周', color: '#84fab0' }, content: '太真实了，主动性真的很重要', time: '2小时前' },
  { id: 'c6', postId: 'p8', author: { name: '孙浩宇', initial: '孙', color: '#fda085' }, content: '恭喜恭喜！！我也在努力冲', time: '昨天' },
  { id: 'c7', postId: 'p8', author: { name: '林思远', initial: '林', color: '#f7971e' }, content: '你是哪个部门的？求经验帖', time: '昨天' },
]

const useForumStore = create<ForumState>()(
  persist(
    (set) => ({
      joinedIds: [1, 2],
      posts: MOCK_POSTS,
      comments: MOCK_COMMENTS,

      join: (id) => set((s) => ({ joinedIds: [...s.joinedIds, id] })),
      leave: (id) => set((s) => ({ joinedIds: s.joinedIds.filter((i) => i !== id) })),

      toggleLike: (postId) =>
        set((s) => ({
          posts: s.posts.map((p) =>
            p.id === postId
              ? { ...p, liked: !p.liked, likes: p.liked ? p.likes - 1 : p.likes + 1 }
              : p
          ),
        })),

      addComment: (postId, content, author) =>
        set((s) => ({
          comments: [
            ...s.comments,
            { id: `c${Date.now()}`, postId, author, content, time: '刚刚' },
          ],
          posts: s.posts.map((p) =>
            p.id === postId ? { ...p, comments: p.comments + 1 } : p
          ),
        })),

      reset: () => set({ joinedIds: [1, 2] }),
    }),
    {
      name: 'shixi-forum',
      storage: createJSONStorage(() => userAwareStorage),
      partialize: (s) => ({ joinedIds: s.joinedIds }),
    }
  )
)

export default useForumStore
