import { useEffect } from 'react'
import { notification } from 'antd'
import useAuthStore from '../store/authStore'
import useChatStore, { Message } from '../store/chatStore'
import { connectSocket, disconnectSocket } from '../socket'

// 负责:
// - 登录后建 socket,登出断开
// - message:new → 写入 chatStore(按 id 去重)
// - presence → 写入 onlineIds
// - typing:update → 写入 typingMap,带兜底超时
// - friend-request:new → 提醒 + 计数 +1
// - 全局维护 socketConnected 状态,供轮询开关使用
export default function useRealtimeChat() {
  const token = useAuthStore((s) => s.token)
  const userId = useAuthStore((s) => s.user?.id)

  useEffect(() => {
    if (!token || !userId) {
      disconnectSocket()
      useChatStore.getState().setSocketConnected(false)
      return
    }

    const socket = connectSocket(token)

    const typingTimers: Record<string, ReturnType<typeof setTimeout> | undefined> = {}

    const onConnect = () => useChatStore.getState().setSocketConnected(true)
    const onDisconnect = () => useChatStore.getState().setSocketConnected(false)

    const onMessageNew = (payload: { conversationId: string; message: { id: string; senderId: string; text: string; time: string; type: string; createdAt: string } }) => {
      const { conversationId, message } = payload
      const [a, b] = conversationId.split('_')
      const friendId = a === userId ? b : a
      const mapped: Message = {
        id: message.id,
        senderId: message.senderId === userId ? 'me' : message.senderId,
        text: message.text,
        time: message.time,
        type: 'text',
        createdAt: message.createdAt,
      }
      useChatStore.setState((s) => {
        const list = s.messages[friendId] ?? []
        // 基于 id 去重;tmp_ 临时 id 替换为正式 id
        if (list.some((m) => m.id === mapped.id)) return s
        // 若存在最近一条 tmp_ 且文本与发送方都相同,替换它(乐观更新落地场景)
        const lastTmpIdx = [...list].reverse().findIndex((m) => m.id.startsWith('tmp_') && m.senderId === mapped.senderId && m.text === mapped.text)
        let newList: Message[]
        if (lastTmpIdx !== -1) {
          const realIdx = list.length - 1 - lastTmpIdx
          newList = [...list]
          newList[realIdx] = mapped
        } else {
          newList = [...list, mapped]
        }
        const nextMessages = { ...s.messages, [friendId]: newList }

        // 若非自己发送 → 增加未读(当前会话由 ChatPage 自行清理)
        const nextUnread = { ...s.unreadMap }
        if (mapped.senderId !== 'me') {
          nextUnread[friendId] = (nextUnread[friendId] ?? 0) + 1
        }
        return {
          messages: nextMessages,
          unreadMap: nextUnread,
          // 直接 +1，而非重新 sum，避免覆盖 clearNavUnread 置零的效果
          unreadTotal: mapped.senderId !== 'me' ? (s.unreadTotal + 1) : s.unreadTotal,
        }
      })
    }

    const onPresenceSnapshot = (payload: { onlineIds: string[] }) => {
      useChatStore.getState().applyPresenceSnapshot(payload.onlineIds)
    }

    const onPresenceUpdate = (payload: { userId: string; online: boolean }) => {
      useChatStore.getState().setOnline(payload.userId, payload.online)
    }

    const onTypingUpdate = (payload: { fromUserId: string; typing: boolean }) => {
      const { fromUserId, typing } = payload
      useChatStore.getState().setTyping(fromUserId, typing)
      if (typingTimers[fromUserId]) clearTimeout(typingTimers[fromUserId])
      if (typing) {
        typingTimers[fromUserId] = setTimeout(() => {
          useChatStore.getState().setTyping(fromUserId, false)
        }, 3000)
      }
    }

    const onFriendRequestNew = (payload: { request: { from: { username: string } } }) => {
      const current = useChatStore.getState().friendRequestCount
      useChatStore.getState().setFriendRequestCount(current + 1)
      notification.info({
        message: '新的好友申请',
        description: `${payload.request.from.username} 想添加你为好友`,
        placement: 'topRight',
      })
    }

    const onFriendRequestResponded = (payload: { action: 'accept' | 'reject' }) => {
      if (payload.action === 'accept') {
        notification.success({
          message: '好友申请已通过',
          description: '对方已接受你的好友申请',
          placement: 'topRight',
        })
      }
    }

    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)
    socket.on('message:new', onMessageNew)
    socket.on('presence:snapshot', onPresenceSnapshot)
    socket.on('presence:update', onPresenceUpdate)
    socket.on('typing:update', onTypingUpdate)
    socket.on('friend-request:new', onFriendRequestNew)
    socket.on('friend-request:responded', onFriendRequestResponded)

    return () => {
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
      socket.off('message:new', onMessageNew)
      socket.off('presence:snapshot', onPresenceSnapshot)
      socket.off('presence:update', onPresenceUpdate)
      socket.off('typing:update', onTypingUpdate)
      socket.off('friend-request:new', onFriendRequestNew)
      socket.off('friend-request:responded', onFriendRequestResponded)
      Object.values(typingTimers).forEach((t) => t && clearTimeout(t))
      disconnectSocket()
      useChatStore.getState().setSocketConnected(false)
    }
  }, [token, userId])
}
