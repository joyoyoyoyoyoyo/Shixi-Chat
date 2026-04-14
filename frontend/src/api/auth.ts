import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

api.interceptors.request.use((config) => {
  const raw = localStorage.getItem('auth-storage')
  const token = raw ? JSON.parse(raw)?.state?.token : null
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export const sendCode = (email: string) =>
  api.post('/auth/send-code', { email })

export const register = (data: {
  username: string
  email: string
  password: string
  code: string
}) => api.post('/auth/register', data)

export const login = (data: { email: string; password: string }) =>
  api.post('/auth/login', data)

export const getMe = () => api.get('/auth/me')
