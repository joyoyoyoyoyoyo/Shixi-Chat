import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { userAwareStorage } from '../utils/userStorage'

export interface ProfileExtras {
  bio: string                // 个性签名
  school: string             // 学校
  major: string              // 专业
  graduationYear: string     // 毕业年份，如 "2026"
  industry: string           // 目标行业
  location: string           // 所在城市
  skills: string[]           // 技能标签
  internshipCount: number    // 实习次数
  socialLinks: {
    github?: string
    linkedin?: string
    blog?: string
  }
}

const DEFAULT_EXTRAS: ProfileExtras = {
  bio: '',
  school: '',
  major: '',
  graduationYear: '',
  industry: '',
  location: '',
  skills: [],
  internshipCount: 0,
  socialLinks: {},
}

interface ProfileState {
  extras: ProfileExtras
  setExtras: (patch: Partial<ProfileExtras>) => void
  reset: () => void
}

const useProfileStore = create<ProfileState>()(
  persist(
    (set) => ({
      extras: DEFAULT_EXTRAS,
      setExtras: (patch) => set((s) => ({ extras: { ...s.extras, ...patch } })),
      reset: () => set({ extras: DEFAULT_EXTRAS }),
    }),
    {
      name: 'shixi-profile',
      storage: createJSONStorage(() => userAwareStorage),
    }
  )
)

export default useProfileStore
