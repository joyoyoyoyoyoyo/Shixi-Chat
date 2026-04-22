import { io, Socket } from 'socket.io-client'
import useAuthStore from './store/authStore'
import useChatStore from './store/chatStore'

let socket: Socket | null = null

export function connectSocket(token?: string): Socket {
  // 已有实例直接返回，避免创建第二个连接（connecting 状态也不重建）
  if (socket) return socket

  const authToken = token ?? useAuthStore.getState().token
  socket = io('http://localhost:5001', {
    auth: { token: authToken },
    transports: ['websocket', 'polling'],
  })

  return socket
}

export function getSocket(): Socket | null {
  return socket
}

export function disconnectSocket() {
  socket?.disconnect()
  socket = null
}
