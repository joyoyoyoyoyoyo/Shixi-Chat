export interface Forum {
  id: number
  title: string
  description: string
  image: string
  industry: string
  author: string
  members: number
  posts: number
  tags: string[]
  color: string
}

export const ALL_FORUMS: Forum[] = [
  {
    id: 1, title: 'IT互联网实习交流圈', industry: 'IT', color: '#667eea',
    description: '聚集各大互联网公司实习生，分享大厂面经、项目心得，探讨技术成长路径，一起卷向更好的 offer。',
    image: 'https://picsum.photos/seed/it-forum/800/500',
    author: 'TechTalker', members: 3280, posts: 892, tags: ['互联网', '大厂', '技术'],
  },
  {
    id: 2, title: '金融行业实习生之家', industry: '金融', color: '#f6a623',
    description: '投行、基金、券商、银行……无论你在哪个赛道，这里都有人陪你一起熬过最难的实习季。',
    image: 'https://picsum.photos/seed/finance-forum/800/500',
    author: 'FinanceGuru', members: 2140, posts: 567, tags: ['投行', '基金', '金融'],
  },
  {
    id: 3, title: '医疗健康实习交流', industry: '医疗', color: '#43e97b',
    description: '医学生、药学生、医疗器械……分享临床实习心得，讨论职业规划，互相鼓励走过实习之路。',
    image: 'https://picsum.photos/seed/medical-forum/800/500',
    author: 'MedIntern', members: 980, posts: 234, tags: ['医学', '临床', '健康'],
  },
  {
    id: 4, title: '教育行业实习分享', industry: '教育', color: '#a18cd1',
    description: '教培、在线教育、高校……无论是做助教还是运营，这里记录每一个教育人的成长故事。',
    image: 'https://picsum.photos/seed/education-forum/800/500',
    author: 'EduShare', members: 1560, posts: 420, tags: ['教育', '在线教育', '助教'],
  },
  {
    id: 5, title: '快消零售实习圈子', industry: '零售', color: '#fa709a',
    description: '宝洁、联合利华、名创优品……分享快消实习的日常，从货架陈列到品牌策略，都在这里聊。',
    image: 'https://picsum.photos/seed/retail-forum/800/500',
    author: 'RetailLife', members: 760, posts: 198, tags: ['快消', '零售', '品牌'],
  },
  {
    id: 6, title: '制造业与工程实习', industry: '制造', color: '#4facfe',
    description: '汽车、新能源、芯片制造……工厂一线到研发中心，记录工程师成长的每一步。',
    image: 'https://picsum.photos/seed/manufacturing-forum/800/500',
    author: 'EngineerHub', members: 640, posts: 156, tags: ['制造', '工程', '新能源'],
  },
]
