import { create } from 'zustand'

interface User {
  id: string
  username: string
  email: string
  avatar: string
}

interface AuthState {
  token: string | null
  user: User | null
  setAuth: (token: string, user: User) => void
  logout: () => void
}

const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  setAuth: (token, user) => set({ token, user }),
  logout: () => set({ token: null, user: null }),
}))

export default useAuthStore
