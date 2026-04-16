import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

interface User {
  id: string
  userId: string
  username: string
  email: string
  avatar: string
}

interface AuthState {
  token: string | null
  user: User | null
  /** setAuth: remember=true → 关闭浏览器后仍保持登录（写 localStorage）
   *          remember=false → 仅当前会话（写 sessionStorage，F5 不退出，关浏览器后需重新登录） */
  setAuth: (token: string, user: User, remember?: boolean) => void
  logout: () => void
}

const STORAGE_KEY = 'auth-storage'

/**
 * 混合存储：
 * - getItem  → 先读 sessionStorage，没有再读 localStorage（支持"记住我"恢复）
 * - setItem  → 只写 sessionStorage（确保 F5 不退出）
 * - removeItem → 两处都清除
 */
const hybridStorage = {
  getItem: (name: string): string | null =>
    sessionStorage.getItem(name) ?? localStorage.getItem(name),
  setItem: (name: string, value: string) =>
    sessionStorage.setItem(name, value),
  removeItem: (name: string) => {
    sessionStorage.removeItem(name)
    localStorage.removeItem(name)
  },
}

const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,

      setAuth: (token, user, remember = false) => {
        set({ token, user })
        if (remember) {
          // 额外写入 localStorage，下次打开浏览器仍可恢复
          localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({ state: { token, user }, version: 0 })
          )
        }
      },

      logout: () => {
        set({ token: null, user: null })
        sessionStorage.removeItem(STORAGE_KEY)
        localStorage.removeItem(STORAGE_KEY)
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => hybridStorage),
    }
  )
)

export default useAuthStore
