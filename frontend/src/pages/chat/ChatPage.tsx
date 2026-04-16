import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Input, Button, Tooltip, Badge, Modal, Popover, message, Checkbox, Tabs, Spin, Empty, Tag } from 'antd'
import {
  SmileOutlined, FileOutlined, PictureOutlined, PhoneOutlined, VideoCameraOutlined,
  MoreOutlined, SendOutlined, SearchOutlined, SettingOutlined, EllipsisOutlined,
  MessageOutlined, StopOutlined, DeleteOutlined, PlusOutlined, UserAddOutlined,
  UsergroupAddOutlined, TeamOutlined, ShareAltOutlined, UserSwitchOutlined,
  CheckOutlined, CloseOutlined, CopyOutlined,
} from '@ant-design/icons'
import useAuthStore from '../../store/authStore'
import useChatStore, { Message, Group } from '../../store/chatStore'
import useForumStore from '../../store/forumStore'
import { ALL_FORUMS } from '../../data/forums'
import { useSidebarHover } from '../../context/SidebarContext'
import { useScrollRestore } from '../../hooks/useScrollRestore'
import {
  getFriends, deleteFriend as apiDeleteFriend,
  searchUser, sendFriendRequest, getFriendRequests, respondFriendRequest,
  ApiFriend, ApiRequest,
} from '../../api/friends'
import { postMessage, fetchMessages } from '../../api/messages'

// ── 拼音首字母映射 ──
const PINYIN_MAP: Record<string, string> = {
  '张': 'Z', '李': 'L', '王': 'W', '陈': 'C', '刘': 'L', '赵': 'Z', '孙': 'S',
  '周': 'Z', '吴': 'W', '郑': 'Z', '林': 'L', '黄': 'H', '徐': 'X', '曹': 'C', '韩': 'H',
}
function getInitial(name: string) { return PINYIN_MAP[name[0]] ?? name[0].toUpperCase() }
function groupByInitial(friends: Friend[]) {
  const groups: Record<string, Friend[]> = {}
  friends.forEach((f) => { const k = getInitial(f.name); if (!groups[k]) groups[k] = []; groups[k].push(f) })
  return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b))
}

// 根据字符串生成固定颜色
const AVATAR_COLORS = ['#667eea', '#f093fb', '#4facfe', '#43e97b', '#fa709a', '#a18cd1', '#fda085', '#84fab0', '#f6d365', '#89f7fe', '#f7971e', '#c471ed', '#12c2e9', '#e96c1f', '#56ab2f']
function colorFromId(id: string) { let h = 0; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffffffff; return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length] }

// 将 API 好友数据映射到本地 Friend 格式
// 注意：Mongoose populate 返回的是 _id 字段，axios 序列化后变成 id（JSON.parse 自动映射）
function apiFriendToFriend(f: ApiFriend): Friend {
  const id = (f as any)._id ?? f.id  // 兼容两种情况
  return {
    id: String(id),
    userId: f.userId,
    name: f.username,
    initial: getInitial(f.username),
    color: colorFromId(String(id)),
    online: false,
  }
}

interface Friend {
  id: string       // MongoDB ObjectId，作为会话 key
  userId: string   // 11位数字 ID
  name: string
  initial: string
  color: string
  online: boolean
}

type ActiveConv = { type: 'friend'; data: Friend } | { type: 'group'; data: Group }

// ── 更多菜单 ──
function MoreMenu({
  friend, onChat, onShare, onInvite, onBlock, onUnblock, onDelete, isBlocked,
}: {
  friend: Friend
  onChat?: () => void
  onShare: () => void
  onInvite: () => void
  onBlock: () => void
  onUnblock: () => void
  onDelete: () => void
  isBlocked: boolean
}) {
  const items = [
    ...(onChat ? [{ icon: <MessageOutlined />, label: '聊天', color: undefined, action: onChat }] : []),
    { icon: <ShareAltOutlined />, label: '分享好友至', color: undefined, action: onShare },
    { icon: <UserSwitchOutlined />, label: '邀请好友', color: undefined, action: onInvite },
    isBlocked
      ? { icon: <StopOutlined />, label: '解除拉黑', color: '#52c41a', action: onUnblock }
      : { icon: <StopOutlined />, label: '拉黑好友', color: '#f59e0b', action: onBlock },
    { icon: <DeleteOutlined />, label: '删除好友', color: '#ef4444', action: onDelete },
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 130 }}>
      {items.map((item) => (
        <div key={item.label} onClick={item.action}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 13, color: item.color ?? '#374151', transition: 'background 0.15s' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#f5f6fa')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          {item.icon}<span>{item.label}</span>
        </div>
      ))}
    </div>
  )
}

export default function ChatPage() {
  const { user } = useAuthStore()
  const { messages, groups, unreadMap, sendMessage, clearFriendUnread, clearNavUnread, addGroup, setFriendRequestCount } = useChatStore()
  const { joinedIds } = useForumStore()
  const sidebarHovered = useSidebarHover()

  useEffect(() => { clearNavUnread() }, [])

  // ── 好友列表（从后端加载）──
  const [friends, setFriends] = useState<Friend[]>([])
  const [friendsLoading, setFriendsLoading] = useState(true)
  const [blockedIds, setBlockedIds] = useState<Set<string>>(new Set())
  const [activeConv, setActiveConv] = useState<ActiveConv | null>(null)
  const [inputText, setInputText] = useState('')
  const [friendSearch, setFriendSearch] = useState('')
  const [friendListOpen, setFriendListOpen] = useState(false)

  // 加号菜单
  const [plusMenuOpen, setPlusMenuOpen] = useState(false)
  const [plusMenuPos, setPlusMenuPos] = useState({ top: 0, left: 0 })
  const plusBtnRef = useRef<HTMLSpanElement>(null)
  const autoCloseRef = useRef<number | null>(null)
  const leaveRef = useRef<number | null>(null)

  // 添加好友弹窗
  const [addFriendOpen, setAddFriendOpen] = useState(false)
  const [addFriendTab, setAddFriendTab] = useState('search')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResult, setSearchResult] = useState<(ApiFriend & { isFriend: boolean; isPending: boolean }) | null>(null)  // merged from res.data.user + res.data.isFriend/isPending
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [sendingRequest, setSendingRequest] = useState(false)
  const [requests, setRequests] = useState<ApiRequest[]>([])
  const [requestsLoading, setRequestsLoading] = useState(false)
  const [respondingId, setRespondingId] = useState<string | null>(null)

  // 创建群聊弹窗
  const [createGroupOpen, setCreateGroupOpen] = useState(false)
  const [groupName, setGroupName] = useState('')
  const [selectedForGroup, setSelectedForGroup] = useState<string[]>([])

  // 分享好友弹窗
  const [shareModal, setShareModal] = useState<{ open: boolean; target: Friend | null }>({ open: false, target: null })
  const [shareSelectedFriends, setShareSelectedFriends] = useState<string[]>([])
  const [shareSelectedForum, setShareSelectedForum] = useState<number | null>(null)

  // 邀请好友弹窗
  const [inviteModal, setInviteModal] = useState<{ open: boolean; target: Friend | null }>({ open: false, target: null })
  const [inviteSelectedGroup, setInviteSelectedGroup] = useState<string | null>(null)
  const [inviteSelectedForum, setInviteSelectedForum] = useState<number | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesBoxRef = useRef<HTMLDivElement>(null)
  const friendListScrollRef = useRef<HTMLDivElement>(null)
  const prevConvIdRef = useRef<string>('')
  // 记录每个好友会话最后一条消息的时间，用于增量轮询
  const lastMsgTimeRef = useRef<Record<string, string>>({})
  useScrollRestore('/chat-friends', friendListScrollRef)

  const friendMap = Object.fromEntries(friends.map((f) => [f.id, f]))
  const joinedForums = ALL_FORUMS.filter((f) => joinedIds.includes(f.id))
  const filteredFriends = friends.filter((f) => f.name.includes(friendSearch))
  const groupedFriends = groupByInitial(friends)
  const allInitials = groupedFriends.map(([k]) => k)

  const currentId = activeConv?.data.id ?? ''
  const currentMessages: Message[] = messages[currentId] ?? []

  // ── API 消息 → chatStore Message 格式 ──
  const toStoreMsg = useCallback((m: { id: string; senderId: string; text: string; type: string; time: string }): Message => ({
    id: m.id,
    senderId: m.senderId === user?.id ? 'me' : m.senderId,
    text: m.text,
    time: m.time,
    type: 'text',
  }), [user?.id])

  // ── 从后端加载某好友的全量消息 ──
  const loadMessages = useCallback(async (friendId: string) => {
    try {
      const res = await fetchMessages(friendId)
      const msgs = res.data.messages
      if (msgs.length > 0) {
        // 用后端数据完整替换本地缓存
        useChatStore.setState((s) => ({
          messages: { ...s.messages, [friendId]: msgs.map(toStoreMsg) },
        }))
        lastMsgTimeRef.current[friendId] = msgs[msgs.length - 1].createdAt
      }
    } catch { /* 静默 */ }
  }, [toStoreMsg])

  // ── 轮询好友申请数量（用于导航红点）──
  const pollRequestCount = useCallback(async () => {
    try {
      const res = await getFriendRequests()
      setFriendRequestCount(res.data.requests.length)
    } catch { /* 静默 */ }
  }, [setFriendRequestCount])

  useEffect(() => {
    pollRequestCount()
    const timer = setInterval(pollRequestCount, 30000)
    return () => clearInterval(timer)
  }, [pollRequestCount])

  // ── 加载好友列表 ──
  const loadFriends = useCallback(async () => {
    try {
      setFriendsLoading(true)
      const res = await getFriends()
      const list = res.data.friends.map(apiFriendToFriend)
      setFriends(list)
      if (!activeConv && list.length > 0) {
        setActiveConv({ type: 'friend', data: list[0] })
      }
    } catch {
      // 静默失败
    } finally {
      setFriendsLoading(false)
    }
  }, [])

  useEffect(() => { loadFriends() }, [loadFriends])

  const activeFriendId = activeConv?.type === 'friend' ? activeConv.data.id : null

  // ── 切换好友会话时拉取历史消息 ──
  useEffect(() => {
    if (activeFriendId) loadMessages(activeFriendId)
  }, [activeFriendId, loadMessages])

  // ── 定时轮询：每 5 秒拉取当前好友会话的新消息 ──
  useEffect(() => {
    if (!activeFriendId) return
    const friendId = activeFriendId

    const poll = async () => {
      try {
        const since = lastMsgTimeRef.current[friendId]
        const res = await fetchMessages(friendId, since)
        const newMsgs = res.data.messages
        if (newMsgs.length === 0) return

        useChatStore.setState((s) => {
          const existing = s.messages[friendId] ?? []
          const existingIds = new Set(existing.map((m) => m.id))
          const toAdd = newMsgs
            .filter((m) => !existingIds.has(m.id))
            .map(toStoreMsg)
          if (toAdd.length === 0) return s
          return { messages: { ...s.messages, [friendId]: [...existing, ...toAdd] } }
        })
        lastMsgTimeRef.current[friendId] = newMsgs[newMsgs.length - 1].createdAt
      } catch { /* 静默 */ }
    }

    const timer = setInterval(poll, 5000)
    return () => clearInterval(timer)
  }, [activeFriendId, toStoreMsg])

  // ── 消息区滚动 ──
  useEffect(() => {
    const box = messagesBoxRef.current
    if (!box) return
    if (currentId !== prevConvIdRef.current) {
      box.scrollTop = box.scrollHeight
      prevConvIdRef.current = currentId
    } else {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [activeConv, messages])

  // ── 选中会话 ──
  const selectFriend = (friend: Friend) => {
    setActiveConv({ type: 'friend', data: friend })
    clearFriendUnread(friend.id)
  }
  const selectGroup = (group: Group) => {
    setActiveConv({ type: 'group', data: group })
  }

  // ── 发送消息 ──
  const handleSend = async () => {
    const text = inputText.trim()
    if (!text) { message.warning('禁止发送空内容'); return }
    setInputText('')

    const time = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    const tempId = `tmp_${Date.now()}`

    if (activeConv?.type === 'friend') {
      const friendId = activeConv.data.id
      // 乐观更新：立即显示
      sendMessage(friendId, { id: tempId, senderId: 'me', text, time, type: 'text' })
      try {
        const res = await postMessage(friendId, text)
        const saved = res.data.message
        // 用服务端 id 替换临时 id，并记录时间戳
        useChatStore.setState((s) => ({
          messages: {
            ...s.messages,
            [friendId]: (s.messages[friendId] ?? []).map((m) =>
              m.id === tempId ? { ...m, id: saved.id } : m
            ),
          },
        }))
        lastMsgTimeRef.current[friendId] = saved.createdAt
      } catch {
        message.error('消息发送失败，请重试')
        // 回滚乐观更新
        useChatStore.setState((s) => ({
          messages: {
            ...s.messages,
            [friendId]: (s.messages[friendId] ?? []).filter((m) => m.id !== tempId),
          },
        }))
      }
    } else {
      // 群聊：仅本地
      sendMessage(currentId, { id: tempId, senderId: 'me', text, time, type: 'text' })
    }
  }

  // ── 加号菜单 ──
  const handlePlusClick = () => {
    if (plusBtnRef.current) {
      const rect = plusBtnRef.current.getBoundingClientRect()
      setPlusMenuPos({ top: rect.bottom + 8, left: rect.left })
    }
    setPlusMenuOpen(true)
    if (autoCloseRef.current) clearTimeout(autoCloseRef.current)
    autoCloseRef.current = window.setTimeout(() => setPlusMenuOpen(false), 1000)
  }
  const handlePlusMenuEnter = () => {
    if (autoCloseRef.current) clearTimeout(autoCloseRef.current)
    if (leaveRef.current) clearTimeout(leaveRef.current)
  }
  const handlePlusMenuLeave = () => {
    leaveRef.current = window.setTimeout(() => setPlusMenuOpen(false), 500)
  }

  // ── 搜索用户 ──
  const handleSearch = async () => {
    const q = searchQuery.trim()
    if (!q) { setSearchError('请输入用户 ID 或邮箱'); return }
    setSearchLoading(true)
    setSearchResult(null)
    setSearchError('')
    try {
      const res = await searchUser(q)
      setSearchResult({ ...res.data.user, isFriend: res.data.isFriend, isPending: res.data.isPending })
    } catch (err: any) {
      setSearchError(err?.response?.data?.message ?? '未找到该用户')
    } finally {
      setSearchLoading(false)
    }
  }

  // ── 发送好友请求 ──
  const handleSendRequest = async (toId: string) => {
    setSendingRequest(true)
    try {
      await sendFriendRequest(toId)
      message.success('好友申请已发送')
      setSearchResult((prev) => prev ? { ...prev, isPending: true } : prev)
    } catch (err: any) {
      message.error(err?.response?.data?.message ?? '发送失败')
    } finally {
      setSendingRequest(false)
    }
  }

  // ── 加载好友请求 ──
  const loadRequests = async () => {
    setRequestsLoading(true)
    try {
      const res = await getFriendRequests()
      setRequests(res.data.requests)
    } catch {
      // 静默
    } finally {
      setRequestsLoading(false)
    }
  }

  // ── 接受 / 拒绝好友请求 ──
  const handleRespond = async (requestId: string, action: 'accept' | 'reject') => {
    setRespondingId(requestId)
    try {
      await respondFriendRequest(requestId, action)
      if (action === 'accept') {
        message.success('已接受好友申请')
        await loadFriends()
      } else {
        message.info('已拒绝申请')
      }
      setRequests((prev) => {
        const next = prev.filter((r) => r.id !== requestId)
        setFriendRequestCount(next.length)
        return next
      })
    } catch (err: any) {
      message.error(err?.response?.data?.message ?? '操作失败')
    } finally {
      setRespondingId(null)
    }
  }

  // ── 删除 / 拉黑 ──
  const handleDelete = (friend: Friend) => {
    Modal.confirm({
      title: `删除好友 ${friend.name}？`,
      content: '删除后将无法接收该好友的消息，聊天记录也会清除。',
      okText: '删除', cancelText: '取消', okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await apiDeleteFriend(friend.id)
          setFriends((prev) => prev.filter((f) => f.id !== friend.id))
          if (activeConv?.type === 'friend' && activeConv.data.id === friend.id) {
            const remaining = friends.filter((f) => f.id !== friend.id)
            setActiveConv(remaining.length > 0 ? { type: 'friend', data: remaining[0] } : null)
          }
          message.success(`已删除好友 ${friend.name}`)
        } catch {
          message.error('删除失败，请稍后重试')
        }
      },
    })
  }
  const handleBlock = (friend: Friend) => {
    Modal.confirm({
      title: `拉黑 ${friend.name}？`,
      content: '拉黑后对方将无法给你发送消息。',
      okText: '拉黑', cancelText: '取消', okButtonProps: { danger: true },
      onOk: () => { setBlockedIds((prev) => new Set([...prev, friend.id])); message.success(`已拉黑 ${friend.name}`) },
    })
  }
  const handleUnblock = (friend: Friend) => {
    setBlockedIds((prev) => { const next = new Set(prev); next.delete(friend.id); return next })
    message.success(`已解除拉黑 ${friend.name}`)
  }

  // ── 创建群聊 ──
  const handleCreateGroup = () => {
    if (!groupName.trim()) { message.warning('请输入群聊名称'); return }
    if (selectedForGroup.length === 0) { message.warning('请至少选择一名成员'); return }
    const newGroup: Group = {
      id: `g${Date.now()}`,
      name: groupName.trim(),
      memberIds: selectedForGroup,
      color: ['#667eea', '#43e97b', '#fa709a', '#f6a623', '#4facfe'][Math.floor(Math.random() * 5)],
    }
    addGroup(newGroup)
    setCreateGroupOpen(false)
    setGroupName('')
    setSelectedForGroup([])
    setActiveConv({ type: 'group', data: newGroup })
    message.success(`群聊「${newGroup.name}」创建成功`)
  }

  // ── 分享好友 ──
  const handleShare = () => {
    if (shareSelectedFriends.length === 0 && shareSelectedForum === null) {
      message.warning('请选择分享目标'); return
    }
    const count = shareSelectedFriends.length + (shareSelectedForum !== null ? 1 : 0)
    message.success(`已分享给 ${count} 个目标`)
    setShareModal({ open: false, target: null })
    setShareSelectedFriends([])
    setShareSelectedForum(null)
  }

  // ── 邀请好友 ──
  const handleInvite = () => {
    if (inviteSelectedGroup === null && inviteSelectedForum === null) {
      message.warning('请选择邀请目标'); return
    }
    message.success(`已发送邀请`)
    setInviteModal({ open: false, target: null })
    setInviteSelectedGroup(null)
    setInviteSelectedForum(null)
  }

  // ── 更多菜单渲染 ──
  const renderMoreMenu = (friend: Friend, withChat?: () => void) => (
    <MoreMenu
      friend={friend}
      onChat={withChat}
      onShare={() => { setShareModal({ open: true, target: friend }); setShareSelectedFriends([]); setShareSelectedForum(null) }}
      onInvite={() => { setInviteModal({ open: true, target: friend }); setInviteSelectedGroup(null); setInviteSelectedForum(null) }}
      onBlock={() => handleBlock(friend)}
      onUnblock={() => handleUnblock(friend)}
      onDelete={() => handleDelete(friend)}
      isBlocked={blockedIds.has(friend.id)}
    />
  )

  const activeFriend = activeFriendId ? (activeConv?.type === 'friend' ? activeConv.data : null) : null
  const activeGroup  = activeConv?.type === 'group'  ? activeConv.data : null

  return (
    <div style={{ display: 'flex', flex: 1, height: '100vh', overflow: 'hidden' }}>

      {/* ── 左侧列表栏 ── */}
      <div style={{ width: sidebarHovered ? 114 : 260, borderRight: '1px solid #d0d3de', background: '#fff', display: 'flex', flexDirection: 'column', flexShrink: 0, overflowX: 'hidden', transition: 'width 0.25s cubic-bezier(0.4,0,0.2,1)' }}>
        {/* 顶部标题 + 工具 */}
        <div style={{ padding: sidebarHovered ? '12px 8px 8px' : '20px 16px 12px', transition: 'padding 0.25s', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: '#1a1a2e', margin: 0 }}>消息</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <PlusOutlined ref={plusBtnRef} onClick={handlePlusClick}
                style={{ fontSize: 16, color: plusMenuOpen ? '#667eea' : '#9ca3af', cursor: 'pointer', transition: 'color 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#667eea')}
                onMouseLeave={e => { if (!plusMenuOpen) e.currentTarget.style.color = '#9ca3af' }}
              />
              <Tooltip title="好友列表">
                <SettingOutlined onClick={() => setFriendListOpen(true)}
                  style={{ fontSize: 17, color: '#9ca3af', cursor: 'pointer', transition: 'color 0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#667eea')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#9ca3af')}
                />
              </Tooltip>
            </div>
          </div>
          <Input size="small" placeholder="搜索好友"
            prefix={<SearchOutlined style={{ color: '#9ca3af', fontSize: 12 }} />}
            value={friendSearch} onChange={(e) => setFriendSearch(e.target.value)}
            style={{ borderRadius: 20, fontSize: 13 }}
          />
        </div>

        <div ref={friendListScrollRef} style={{ flex: 1, overflowY: 'auto' }}>
          {/* 群聊区 */}
          {groups.filter((g) => !friendSearch || g.name.includes(friendSearch)).length > 0 && (
            <>
              <div style={{ padding: '4px 16px', fontSize: 11, color: '#9ca3af', fontWeight: 600, letterSpacing: 1 }}>群聊</div>
              {groups.filter((g) => !friendSearch || g.name.includes(friendSearch)).map((group) => (
                <div key={group.id}
                  className={`friend-item ${activeConv?.data.id === group.id ? 'friend-item-active' : ''}`}
                  style={{ padding: sidebarHovered ? '10px 8px' : '10px 16px', transition: 'padding 0.25s', cursor: 'pointer' }}
                  onClick={() => selectGroup(group)}
                >
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: group.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
                    <TeamOutlined />
                  </div>
                  <div style={{ flex: 1, minWidth: 0, marginLeft: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: '#1a1a2e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{group.name}</span>
                      <span style={{ fontSize: 11, color: '#9ca3af', flexShrink: 0, marginLeft: 4 }}>{group.memberIds.length + 1}人</span>
                    </div>
                    <div style={{ fontSize: 12, color: '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: sidebarHovered ? 50 : 140 }}>
                      {(() => { const m = messages[group.id]; return m && m.length > 0 ? m[m.length - 1].text : '暂无消息' })()}
                    </div>
                  </div>
                </div>
              ))}
              <div style={{ margin: '4px 16px', borderTop: '1px solid #f0f0f0' }} />
              <div style={{ padding: '4px 16px', fontSize: 11, color: '#9ca3af', fontWeight: 600, letterSpacing: 1 }}>好友</div>
            </>
          )}

          {/* 好友区 */}
          {friendsLoading ? (
            <div style={{ textAlign: 'center', padding: '30px 0' }}><Spin size="small" /></div>
          ) : filteredFriends.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px 16px', color: '#9ca3af', fontSize: 13 }}>
              {friends.length === 0 ? '暂无好友，点击 + 添加' : '没有匹配的好友'}
            </div>
          ) : (
            filteredFriends.map((friend) => (
              <div key={friend.id}
                className={`friend-item ${activeConv?.data.id === friend.id ? 'friend-item-active' : ''}`}
                style={{ padding: sidebarHovered ? '10px 8px' : '10px 16px', transition: 'padding 0.25s', opacity: blockedIds.has(friend.id) ? 0.45 : 1 }}
                onClick={() => selectFriend(friend)}
              >
                <Badge dot={friend.online && !blockedIds.has(friend.id)} color="#52c41a" offset={[-2, 36]}>
                  <div className="friend-avatar" style={{ background: friend.color }}>{friend.initial}</div>
                </Badge>
                <div style={{ flex: 1, minWidth: 0, marginLeft: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: sidebarHovered ? 12 : 14, fontWeight: 600, color: '#1a1a2e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', transition: 'font-size 0.25s' }}>
                      {friend.name}{blockedIds.has(friend.id) && <span style={{ fontSize: 10, color: '#f59e0b', marginLeft: 4 }}>已拉黑</span>}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
                    <span style={{ fontSize: 12, color: '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: sidebarHovered ? 50 : 140 }}>
                      {(() => { const m = messages[friend.id]; return m && m.length > 0 ? m[m.length - 1].text : '' })()}
                    </span>
                    {(unreadMap[friend.id] ?? 0) > 0 && (
                      <div style={{ minWidth: 18, height: 18, borderRadius: 9, background: '#667eea', color: '#fff', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>
                        {unreadMap[friend.id]}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── 聊天窗口 ── */}
      {activeConv ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#fff', overflow: 'hidden' }}>
          {/* 顶部栏 */}
          <div style={{ padding: '0 24px', height: 60, background: '#f7f8fc', borderBottom: '1px solid #d0d3de', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {activeGroup ? (
                <div style={{ width: 36, height: 36, borderRadius: 8, background: activeGroup.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 16 }}>
                  <TeamOutlined />
                </div>
              ) : (
                <div className="friend-avatar" style={{ background: activeFriend!.color, width: 36, height: 36, fontSize: 14 }}>
                  {activeFriend!.initial}
                </div>
              )}
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#1a1a2e' }}>
                  {activeGroup ? activeGroup.name : activeFriend!.name}
                </div>
                <div style={{ fontSize: 12, color: '#9ca3af' }}>
                  {activeGroup
                    ? `${activeGroup.memberIds.length + 1} 位成员`
                    : (activeFriend!.online ? <span style={{ color: '#52c41a' }}>在线</span> : '离线')}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 16, color: '#9ca3af' }}>
              <Tooltip title="语音通话"><PhoneOutlined style={{ fontSize: 18, cursor: 'pointer' }} /></Tooltip>
              <Tooltip title="视频通话"><VideoCameraOutlined style={{ fontSize: 18, cursor: 'pointer' }} /></Tooltip>
              {activeFriend && (
                <Popover trigger="click" placement="bottomRight"
                  content={renderMoreMenu(activeFriend)}
                >
                  <Tooltip title="更多"><MoreOutlined style={{ fontSize: 18, cursor: 'pointer' }} /></Tooltip>
                </Popover>
              )}
              {activeGroup && (
                <Popover trigger="click" placement="bottomRight" content={
                  <div style={{ minWidth: 130 }}>
                    {[
                      { label: '查看群成员', action: () => message.info('群成员：' + activeGroup.memberIds.map(id => friendMap[id]?.name ?? id).join('、')) },
                      { label: '退出群聊', color: '#ef4444', action: () => Modal.confirm({ title: '退出群聊？', okText: '退出', cancelText: '取消', okButtonProps: { danger: true }, onOk: () => message.success('已退出群聊') }) },
                    ].map((item) => (
                      <div key={item.label} onClick={item.action}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 13, color: item.color ?? '#374151', transition: 'background 0.15s' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#f5f6fa')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        {item.label}
                      </div>
                    ))}
                  </div>
                }>
                  <Tooltip title="更多"><MoreOutlined style={{ fontSize: 18, cursor: 'pointer' }} /></Tooltip>
                </Popover>
              )}
            </div>
          </div>

          {/* 消息记录 */}
          <div ref={messagesBoxRef} style={{ flex: 15, overflowY: 'auto', padding: '20px 24px 28px', display: 'flex', flexDirection: 'column', gap: 12, background: '#f0f2f8' }}>
            {currentMessages.map((msg) => {
              const isMe = msg.senderId === 'me'
              const sender = !isMe ? (friendMap[msg.senderId] ?? null) : null
              return (
                <div key={msg.id} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start', alignItems: 'flex-end', gap: 8 }}>
                  {!isMe && (
                    <div className="friend-avatar" style={{ background: sender?.color ?? '#9ca3af', width: 32, height: 32, fontSize: 12, flexShrink: 0 }}>
                      {sender?.initial ?? '?'}
                    </div>
                  )}
                  <div style={{ maxWidth: '60%' }}>
                    {activeGroup && !isMe && sender && (
                      <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 3 }}>{sender.name}</div>
                    )}
                    <div style={{ padding: '10px 14px', borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px', background: isMe ? '#667eea' : '#fff', color: isMe ? '#fff' : '#1a1a2e', fontSize: 14, lineHeight: 1.6, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', wordBreak: 'break-word' }}>
                      {msg.text}
                    </div>
                    <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4, textAlign: isMe ? 'right' : 'left' }}>{msg.time}</div>
                  </div>
                  {isMe && (
                    <div className="friend-avatar" style={{ background: '#667eea', width: 32, height: 32, fontSize: 12, flexShrink: 0 }}>
                      {user?.username?.[0]?.toUpperCase() ?? 'U'}
                    </div>
                  )}
                </div>
              )
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* 工具栏 */}
          <div style={{ flexShrink: 0, height: 44, background: '#fff', borderTop: '1px solid #d0d3de', display: 'flex', alignItems: 'center', padding: '0 20px', gap: 20 }}>
            <Tooltip title="发送表情"><SmileOutlined style={{ fontSize: 20, color: '#9ca3af', cursor: 'pointer' }} /></Tooltip>
            <Tooltip title="发送图片"><PictureOutlined style={{ fontSize: 20, color: '#9ca3af', cursor: 'pointer' }} /></Tooltip>
            <Tooltip title="发送文件"><FileOutlined style={{ fontSize: 20, color: '#9ca3af', cursor: 'pointer' }} /></Tooltip>
          </div>

          {/* 输入框 */}
          <div style={{ flex: 4, background: '#fff', display: 'flex', flexDirection: 'column', padding: '12px 20px 16px', borderTop: '1px solid #f0f0f0' }}>
            <Input.TextArea value={inputText} onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
              placeholder="输入消息... (Enter 发送，Shift+Enter 换行)"
              autoSize={false} style={{ flex: 1, resize: 'none', border: 'none', outline: 'none', fontSize: 14, padding: 0, boxShadow: 'none' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
              <Button type="primary" icon={<SendOutlined />} onClick={handleSend}
                style={{ background: '#667eea', border: 'none', borderRadius: 20, padding: '0 20px' }}>
                发送
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: 14 }}>
          {friendsLoading ? <Spin /> : '选择一个好友或群聊开始聊天'}
        </div>
      )}

      {/* ── 加号菜单（Portal）── */}
      {plusMenuOpen && createPortal(
        <div onMouseEnter={handlePlusMenuEnter} onMouseLeave={handlePlusMenuLeave}
          style={{ position: 'fixed', top: plusMenuPos.top, left: plusMenuPos.left, background: '#fff', borderRadius: 8, boxShadow: '0 4px 20px rgba(0,0,0,0.12)', border: '1px solid #f0f0f0', padding: '4px 0', minWidth: 140, zIndex: 9999 }}
        >
          {[
            {
              icon: <UserAddOutlined />, label: '添加好友',
              action: () => {
                setPlusMenuOpen(false)
                setAddFriendOpen(true)
                setAddFriendTab('search')
                setSearchQuery('')
                setSearchResult(null)
                setSearchError('')
              },
            },
            { icon: <UsergroupAddOutlined />, label: '创建群聊', action: () => { setPlusMenuOpen(false); setCreateGroupOpen(true) } },
          ].map((item) => (
            <div key={item.label} onClick={item.action}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', cursor: 'pointer', fontSize: 13, color: '#374151', transition: 'background 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#f5f6fa')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <span style={{ color: '#667eea' }}>{item.icon}</span><span>{item.label}</span>
            </div>
          ))}
        </div>,
        document.body
      )}

      {/* ── 添加好友弹窗 ── */}
      <Modal
        title="添加好友"
        open={addFriendOpen}
        onCancel={() => setAddFriendOpen(false)}
        footer={null}
        width={440}
      >
        {/* 展示自己的 ID */}
        {user?.userId && (
          <div style={{ background: '#f5f6fa', borderRadius: 8, padding: '10px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <span style={{ fontSize: 12, color: '#9ca3af' }}>我的 ID（分享给好友）</span>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e', letterSpacing: 2 }}>{user.userId}</div>
            </div>
            <Button size="small" icon={<CopyOutlined />} type="text"
              onClick={() => { navigator.clipboard.writeText(user.userId); message.success('ID 已复制') }}
            >复制</Button>
          </div>
        )}

        <Tabs
          activeKey={addFriendTab}
          onChange={(k) => {
            setAddFriendTab(k)
            if (k === 'requests') loadRequests()
          }}
          items={[
            {
              key: 'search',
              label: '搜索用户',
              children: (
                <div>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                    <Input
                      placeholder="输入 11 位用户 ID 或邮箱"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onPressEnter={handleSearch}
                      prefix={<SearchOutlined style={{ color: '#9ca3af' }} />}
                      style={{ borderRadius: 8 }}
                    />
                    <Button type="primary" onClick={handleSearch} loading={searchLoading}
                      style={{ background: '#667eea', border: 'none', borderRadius: 8 }}>
                      搜索
                    </Button>
                  </div>

                  {searchLoading && <div style={{ textAlign: 'center', padding: '20px 0' }}><Spin /></div>}

                  {searchError && !searchLoading && (
                    <div style={{ textAlign: 'center', color: '#9ca3af', padding: '20px 0', fontSize: 14 }}>{searchError}</div>
                  )}

                  {searchResult && !searchLoading && (
                    <div style={{ border: '1px solid #f0f0f0', borderRadius: 12, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
                      <div style={{ width: 48, height: 48, borderRadius: 12, background: colorFromId(searchResult.id), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 20, fontWeight: 700, flexShrink: 0 }}>
                        {getInitial(searchResult.username)}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 15, fontWeight: 600, color: '#1a1a2e' }}>{searchResult.username}</div>
                        <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>ID: {searchResult.userId}</div>
                        {searchResult.isFriend && <Tag color="green" style={{ marginTop: 4 }}>已是好友</Tag>}
                      </div>
                      {!searchResult.isFriend && (
                        searchResult.isPending ? (
                          <Button disabled style={{ borderRadius: 20 }}>已申请</Button>
                        ) : (
                          <Button type="primary" loading={sendingRequest}
                            onClick={() => handleSendRequest(searchResult.id)}
                            style={{ background: '#667eea', border: 'none', borderRadius: 20 }}>
                            添加好友
                          </Button>
                        )
                      )}
                      {searchResult.isFriend && (
                        <Button onClick={() => {
                          const f = friends.find(f => f.id === searchResult.id)
                          if (f) { selectFriend(f); setAddFriendOpen(false) }
                        }} style={{ borderRadius: 20 }}>发消息</Button>
                      )}
                    </div>
                  )}
                </div>
              ),
            },
            {
              key: 'requests',
              label: '好友申请',
              children: (
                <div style={{ minHeight: 120 }}>
                  {requestsLoading && <div style={{ textAlign: 'center', padding: '30px 0' }}><Spin /></div>}
                  {!requestsLoading && requests.length === 0 && (
                    <Empty description="暂无好友申请" style={{ padding: '20px 0' }} />
                  )}
                  {!requestsLoading && requests.map((req) => (
                    <div key={req.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 4px', borderBottom: '1px solid #f5f5f5' }}>
                      <div style={{ width: 42, height: 42, borderRadius: 10, background: colorFromId((req.from as any)._id ?? req.from.id), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 17, fontWeight: 700, flexShrink: 0 }}>
                        {getInitial(req.from.username)}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a2e' }}>{req.from.username}</div>
                        <div style={{ fontSize: 12, color: '#9ca3af' }}>ID: {req.from.userId}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <Button
                          size="small" type="primary" icon={<CheckOutlined />}
                          loading={respondingId === req.id}
                          onClick={() => handleRespond(req.id, 'accept')}
                          style={{ background: '#667eea', border: 'none', borderRadius: 16 }}
                        >接受</Button>
                        <Button
                          size="small" icon={<CloseOutlined />}
                          loading={respondingId === req.id}
                          onClick={() => handleRespond(req.id, 'reject')}
                          style={{ borderRadius: 16 }}
                        >拒绝</Button>
                      </div>
                    </div>
                  ))}
                </div>
              ),
            },
          ]}
        />
      </Modal>

      {/* ── 好友列表弹窗 ── */}
      <Modal title="好友列表" open={friendListOpen} onCancel={() => setFriendListOpen(false)} footer={null} width={400}
        styles={{ body: { padding: 0, maxHeight: '82vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' } }}
      >
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0' }}>
          <Input placeholder="搜索好友姓名..." prefix={<SearchOutlined style={{ color: '#9ca3af' }} />} allowClear
            value={friendSearch} onChange={(e) => setFriendSearch(e.target.value)} style={{ borderRadius: 20 }} />
        </div>
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
            {groupedFriends
              .map(([initial, fs]) => ({ initial, fs: fs.filter((f) => f.name.includes(friendSearch)) }))
              .filter(({ fs }) => fs.length > 0)
              .map(({ initial, fs }) => (
                <div key={initial}>
                  <div id={`group-${initial}`} style={{ padding: '6px 20px', fontSize: 12, fontWeight: 700, color: '#9ca3af', background: '#f9fafb', letterSpacing: 1 }}>{initial}</div>
                  {fs.map((friend) => (
                    <div key={friend.id} style={{ display: 'flex', alignItems: 'center', padding: '10px 20px', transition: 'background 0.15s', cursor: 'default', opacity: blockedIds.has(friend.id) ? 0.5 : 1 }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#f5f6fa')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <Badge dot={friend.online} color="#52c41a" offset={[-2, 36]}>
                        <div className="friend-avatar" style={{ background: friend.color, width: 38, height: 38, fontSize: 15 }}>{friend.initial}</div>
                      </Badge>
                      <div style={{ flex: 1, marginLeft: 12 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a2e' }}>
                          {friend.name}{blockedIds.has(friend.id) && <span style={{ fontSize: 10, color: '#f59e0b', marginLeft: 6 }}>已拉黑</span>}
                        </div>
                        <div style={{ fontSize: 12, color: '#9ca3af' }}>ID: {friend.userId}</div>
                      </div>
                      <Popover trigger="click" placement="left"
                        content={renderMoreMenu(friend, () => { selectFriend(friend); setFriendListOpen(false) })}
                      >
                        <EllipsisOutlined style={{ fontSize: 18, color: '#9ca3af', padding: '4px 8px', borderRadius: 6, cursor: 'pointer' }} />
                      </Popover>
                    </div>
                  ))}
                </div>
              ))}
          </div>
          <div style={{ width: 28, background: '#f9fafb', borderLeft: '1px solid #f0f0f0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '8px 0', gap: 2, flexShrink: 0 }}>
            {'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((letter) => {
              const active = allInitials.includes(letter)
              return (
                <span key={letter} onClick={() => { if (!active) return; document.getElementById(`group-${letter}`)?.scrollIntoView({ behavior: 'smooth' }) }}
                  style={{ fontSize: 11, fontWeight: active ? 700 : 400, color: active ? '#667eea' : '#d1d5db', cursor: active ? 'pointer' : 'default', lineHeight: 1.4, userSelect: 'none' }}>
                  {letter}
                </span>
              )
            })}
          </div>
        </div>
      </Modal>

      {/* ── 创建群聊弹窗 ── */}
      <Modal title="创建群聊" open={createGroupOpen} onCancel={() => { setCreateGroupOpen(false); setGroupName(''); setSelectedForGroup([]) }}
        onOk={handleCreateGroup} okText="创建" cancelText="取消" okButtonProps={{ style: { background: '#667eea', border: 'none' } }} width={420}
      >
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 6 }}>群聊名称</div>
          <Input placeholder="请输入群聊名称" value={groupName} onChange={(e) => setGroupName(e.target.value)} maxLength={20} style={{ borderRadius: 8 }} />
        </div>
        <div>
          <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 8 }}>选择成员（{selectedForGroup.length} 人已选）</div>
          <div style={{ maxHeight: 280, overflowY: 'auto', border: '1px solid #f0f0f0', borderRadius: 8 }}>
            {friends.length === 0 && <div style={{ textAlign: 'center', color: '#9ca3af', padding: '20px 0', fontSize: 13 }}>暂无好友可选</div>}
            {friends.map((friend) => (
              <div key={friend.id} style={{ display: 'flex', alignItems: 'center', padding: '10px 16px', cursor: 'pointer', transition: 'background 0.15s' }}
                onClick={() => setSelectedForGroup((prev) => prev.includes(friend.id) ? prev.filter(id => id !== friend.id) : [...prev, friend.id])}
                onMouseEnter={e => (e.currentTarget.style.background = '#f5f6fa')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <Checkbox checked={selectedForGroup.includes(friend.id)} style={{ marginRight: 12 }} />
                <div className="friend-avatar" style={{ background: friend.color, width: 32, height: 32, fontSize: 13 }}>{friend.initial}</div>
                <span style={{ marginLeft: 10, fontSize: 14 }}>{friend.name}</span>
                {friend.online && <Badge dot color="#52c41a" style={{ marginLeft: 6 }} />}
              </div>
            ))}
          </div>
        </div>
      </Modal>

      {/* ── 分享好友至弹窗 ── */}
      <Modal title={`分享 ${shareModal.target?.name ?? ''} 的名片`} open={shareModal.open}
        onCancel={() => setShareModal({ open: false, target: null })}
        onOk={handleShare} okText="发送" cancelText="取消"
        okButtonProps={{ style: { background: '#667eea', border: 'none' } }} width={420}
      >
        <Tabs items={[
          {
            key: 'friend', label: '发送给好友',
            children: (
              <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                {friends.filter((f) => f.id !== shareModal.target?.id).map((friend) => (
                  <div key={friend.id} style={{ display: 'flex', alignItems: 'center', padding: '8px 4px', cursor: 'pointer', transition: 'background 0.15s', borderRadius: 8 }}
                    onClick={() => setShareSelectedFriends((prev) => prev.includes(friend.id) ? prev.filter(id => id !== friend.id) : [...prev, friend.id])}
                    onMouseEnter={e => (e.currentTarget.style.background = '#f5f6fa')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <Checkbox checked={shareSelectedFriends.includes(friend.id)} style={{ marginRight: 12 }} />
                    <div className="friend-avatar" style={{ background: friend.color, width: 32, height: 32, fontSize: 13 }}>{friend.initial}</div>
                    <span style={{ marginLeft: 10, fontSize: 14 }}>{friend.name}</span>
                  </div>
                ))}
              </div>
            ),
          },
          {
            key: 'forum', label: '分享到论坛',
            children: (
              <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                {joinedForums.length === 0 && <div style={{ textAlign: 'center', color: '#9ca3af', padding: '24px 0' }}>还未加入任何论坛</div>}
                {joinedForums.map((forum) => (
                  <div key={forum.id} style={{ display: 'flex', alignItems: 'center', padding: '8px 4px', cursor: 'pointer', transition: 'background 0.15s', borderRadius: 8 }}
                    onClick={() => setShareSelectedForum(shareSelectedForum === forum.id ? null : forum.id)}
                    onMouseEnter={e => (e.currentTarget.style.background = '#f5f6fa')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <Checkbox checked={shareSelectedForum === forum.id} style={{ marginRight: 12 }} />
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: forum.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13, fontWeight: 700 }}>{forum.industry[0]}</div>
                    <span style={{ marginLeft: 10, fontSize: 14 }}>{forum.title}</span>
                  </div>
                ))}
              </div>
            ),
          },
        ]} />
      </Modal>

      {/* ── 邀请好友弹窗 ── */}
      <Modal title={`邀请 ${inviteModal.target?.name ?? ''}`} open={inviteModal.open}
        onCancel={() => setInviteModal({ open: false, target: null })}
        onOk={handleInvite} okText="发送邀请" cancelText="取消"
        okButtonProps={{ style: { background: '#667eea', border: 'none' } }} width={420}
      >
        <Tabs items={[
          {
            key: 'group', label: '邀请进群',
            children: (
              <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                {groups.length === 0 && <div style={{ textAlign: 'center', color: '#9ca3af', padding: '24px 0' }}>还没有群聊，先去创建一个吧</div>}
                {groups.map((group) => (
                  <div key={group.id} style={{ display: 'flex', alignItems: 'center', padding: '8px 4px', cursor: 'pointer', transition: 'background 0.15s', borderRadius: 8 }}
                    onClick={() => setInviteSelectedGroup(inviteSelectedGroup === group.id ? null : group.id)}
                    onMouseEnter={e => (e.currentTarget.style.background = '#f5f6fa')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <Checkbox checked={inviteSelectedGroup === group.id} style={{ marginRight: 12 }} />
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: group.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}><TeamOutlined /></div>
                    <div style={{ marginLeft: 10 }}>
                      <div style={{ fontSize: 14 }}>{group.name}</div>
                      <div style={{ fontSize: 12, color: '#9ca3af' }}>{group.memberIds.length + 1} 位成员</div>
                    </div>
                  </div>
                ))}
              </div>
            ),
          },
          {
            key: 'forum', label: '邀请进论坛',
            children: (
              <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                {joinedForums.length === 0 && <div style={{ textAlign: 'center', color: '#9ca3af', padding: '24px 0' }}>还未加入任何论坛</div>}
                {joinedForums.map((forum) => (
                  <div key={forum.id} style={{ display: 'flex', alignItems: 'center', padding: '8px 4px', cursor: 'pointer', transition: 'background 0.15s', borderRadius: 8 }}
                    onClick={() => setInviteSelectedForum(inviteSelectedForum === forum.id ? null : forum.id)}
                    onMouseEnter={e => (e.currentTarget.style.background = '#f5f6fa')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <Checkbox checked={inviteSelectedForum === forum.id} style={{ marginRight: 12 }} />
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: forum.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13, fontWeight: 700 }}>{forum.industry[0]}</div>
                    <span style={{ marginLeft: 10, fontSize: 14 }}>{forum.title}</span>
                  </div>
                ))}
              </div>
            ),
          },
        ]} />
      </Modal>
    </div>
  )
}
