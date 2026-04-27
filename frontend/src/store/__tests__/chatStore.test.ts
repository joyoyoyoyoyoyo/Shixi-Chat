/**
 * chatStore 未读红点逻辑单元测试
 *
 * 用法：
 *   cd frontend
 *   npm i -D vitest jsdom @testing-library/jest-dom
 *   在 package.json 的 scripts 加：  "test": "vitest run"
 *   npx vitest run src/store/__tests__/chatStore.test.ts
 */
import { describe, it, expect, beforeEach } from 'vitest'
import useChatStore, { Message } from '../chatStore'
import { setCurrentUserId } from '../../utils/userStorage'

function mkMsg(id: string, senderId: string, text = 't'): Message {
  return { id, senderId, text, time: '00:00', type: 'text' }
}

// 绕过 persist（不登录则 userAwareStorage 不写）
setCurrentUserId(null as unknown as string)

describe('chatStore 未读红点', () => {
  beforeEach(() => {
    useChatStore.getState().reset()
  })

  it('clearNavUnread 同时清零 unreadTotal 和 unreadMap 所有项', () => {
    useChatStore.setState({
      unreadMap: { u1: 3, u2: 5 },
      unreadTotal: 8,
    })
    useChatStore.getState().clearNavUnread()
    const s = useChatStore.getState()
    expect(s.unreadTotal).toBe(0)
    expect(s.unreadMap.u1).toBe(0)
    expect(s.unreadMap.u2).toBe(0)
  })

  it('clearFriendUnread 精确减法，不影响其它好友', () => {
    useChatStore.setState({
      unreadMap: { u1: 3, u2: 5 },
      unreadTotal: 8,
    })
    useChatStore.getState().clearFriendUnread('u1')
    const s = useChatStore.getState()
    expect(s.unreadMap.u1).toBe(0)
    expect(s.unreadMap.u2).toBe(5)
    expect(s.unreadTotal).toBe(5)
  })

  it('clearFriendUnread 不会让 unreadTotal 变负', () => {
    useChatStore.setState({ unreadMap: { u1: 10 }, unreadTotal: 2 })
    useChatStore.getState().clearFriendUnread('u1')
    expect(useChatStore.getState().unreadTotal).toBe(0)
  })

  it('reset 后未读归零', () => {
    useChatStore.setState({ unreadTotal: 9, unreadMap: { a: 9 } })
    useChatStore.getState().reset()
    expect(useChatStore.getState().unreadTotal).toBe(0)
  })

  it('sendMessage 追加消息到会话', () => {
    useChatStore.getState().sendMessage('u1', mkMsg('m1', 'me'))
    expect(useChatStore.getState().messages.u1).toHaveLength(1)
  })

  it('appendGroupMessage 去重', () => {
    const m: any = { id: 'g1', groupId: 'gA', sender: { id: 's', userId: 's', username: 'x', avatar: '' }, content: 'c', type: 'text', mentionedUsers: [], isRecalled: false, createdAt: '' }
    useChatStore.getState().appendGroupMessage(m)
    useChatStore.getState().appendGroupMessage(m)
    expect(useChatStore.getState().groupMessages.gA).toHaveLength(1)
  })

  it('recallGroupMessage 标记为已撤回', () => {
    const m: any = { id: 'g1', groupId: 'gA', sender: { id: 's', userId: 's', username: 'x', avatar: '' }, content: 'c', type: 'text', mentionedUsers: [], isRecalled: false, createdAt: '' }
    useChatStore.getState().appendGroupMessage(m)
    useChatStore.getState().recallGroupMessage('gA', 'g1')
    expect(useChatStore.getState().groupMessages.gA[0].isRecalled).toBe(true)
  })
})

describe('unreadTotal 独立计数器（模拟 useRealtimeChat 收到消息）', () => {
  beforeEach(() => useChatStore.getState().reset())

  it('收到对方消息应 +1，不因 sum 覆盖已 clear 的 total', () => {
    // 先模拟：已有未读，但用户进过聊天页 → clearNavUnread 清零了 total，unreadMap 里还可能有残留
    useChatStore.setState({ unreadMap: { u1: 0, u2: 0 }, unreadTotal: 0, messages: { u1: [] } })

    // 复刻 useRealtimeChat 的 setState 逻辑：直接 +1
    const simulateIncoming = (friendId: string, senderIsMe: boolean) => {
      useChatStore.setState((s) => {
        const list = s.messages[friendId] ?? []
        const mapped = mkMsg('m' + Math.random(), senderIsMe ? 'me' : friendId)
        const nextMessages = { ...s.messages, [friendId]: [...list, mapped] }
        const nextUnread = { ...s.unreadMap }
        if (!senderIsMe) nextUnread[friendId] = (nextUnread[friendId] ?? 0) + 1
        return {
          messages: nextMessages,
          unreadMap: nextUnread,
          unreadTotal: !senderIsMe ? s.unreadTotal + 1 : s.unreadTotal,
        }
      })
    }

    simulateIncoming('u1', false)
    simulateIncoming('u1', false)
    simulateIncoming('u2', false)
    simulateIncoming('u2', true) // 自己发送不增加

    const s = useChatStore.getState()
    expect(s.unreadTotal).toBe(3)
    expect(s.unreadMap.u1).toBe(2)
    expect(s.unreadMap.u2).toBe(1)
  })
})
