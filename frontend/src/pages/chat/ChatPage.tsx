import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Input, Button, Tooltip, Badge, Modal, Popover, message, Checkbox, Tabs, Spin, Empty, Tag, Switch, Drawer, Dropdown } from 'antd'
import type { MenuProps } from 'antd'
import {
  SmileOutlined, FileOutlined, PictureOutlined, PhoneOutlined, VideoCameraOutlined,
  MoreOutlined, SendOutlined, SearchOutlined, SettingOutlined, EllipsisOutlined,
  MessageOutlined, StopOutlined, DeleteOutlined, PlusOutlined, UserAddOutlined,
  UsergroupAddOutlined, TeamOutlined, ShareAltOutlined, UserSwitchOutlined,
  CheckOutlined, CloseOutlined, CopyOutlined, BellOutlined, LogoutOutlined,
  InfoCircleOutlined, UndoOutlined,
} from '@ant-design/icons'
import useAuthStore from '../../store/authStore'
import useChatStore, { Message, Group, GroupMessage } from '../../store/chatStore'
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
import {
  fetchGroups, createGroup as apiCreateGroup, fetchGroupMessages,
  setAnnouncement as apiSetAnnouncement, setMuted as apiSetMuted,
  kickMember as apiKickMember, leaveGroup as apiLeaveGroup,
  dissolveGroup as apiDissolveGroup, inviteMembers as apiInviteMembers,
  type ApiGroup,
} from '../../api/groups'
import { getSocket } from '../../socket'

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

// 聊天气泡时间格式：今天 HH:mm / 昨天 HH:mm / 本周 周X HH:mm / M月D日 HH:mm / YYYY年M月D日 HH:mm
function formatChatTime(input?: string): string {
  if (!input) return ''
  // 兼容旧数据：若是 "HH:mm" 字符串，直接原样返回
  if (/^\d{1,2}:\d{2}$/.test(input)) return input
  const d = new Date(input)
  if (isNaN(d.getTime())) return input
  const now = new Date()
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 86400000)
  if (sameDay(d, now)) return hm
  if (sameDay(d, yesterday)) return `昨天 ${hm}`
  const diffDays = Math.floor((today.getTime() - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 86400000)
  if (diffDays > 0 && diffDays < 7) {
    const wkDays = ['日', '一', '二', '三', '四', '五', '六']
    return `周${wkDays[d.getDay()]} ${hm}`
  }
  if (d.getFullYear() === now.getFullYear()) return `${d.getMonth() + 1}月${d.getDate()}日 ${hm}`
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${hm}`
}

// 群组预设色
const GROUP_COLORS = ['#667eea', '#fa709a', '#43e97b', '#f6a623', '#4facfe', '#a18cd1']

// 将 API 好友数据映射到本地 Friend 格式
function apiFriendToFriend(f: ApiFriend): Friend {
  const id = (f as any)._id ?? f.id
  return {
    id: String(id),
    userId: f.userId,
    name: f.username,
    initial: getInitial(f.username),
    color: colorFromId(String(id)),
    online: false,
  }
}

// 高亮 @mention
function renderWithMentions(text: string) {
  const parts = text.split(/(@\S+)/g)
  return parts.map((part, i) =>
    part.startsWith('@')
      ? <span key={i} style={{ color: '#667eea', fontWeight: 600 }}>{part}</span>
      : <span key={i}>{part}</span>
  )
}

interface Friend {
  id: string
  userId: string
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
  const {
    messages, groups, groupMessages,
    unreadMap, onlineIds, typingMap, socketConnected,
    sendMessage, clearFriendUnread, clearNavUnread, addGroup, setFriendRequestCount,
    setGroupMessages: storeSetGroupMessages,
    appendGroupMessage, recallGroupMessage, replaceGroupTempMsg,
  } = useChatStore()
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
  const [searchResult, setSearchResult] = useState<(ApiFriend & { isFriend: boolean; isPending: boolean }) | null>(null)
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
  const [selectedGroupColor, setSelectedGroupColor] = useState(GROUP_COLORS[0])
  const [creatingGroup, setCreatingGroup] = useState(false)

  // 分享好友弹窗
  const [shareModal, setShareModal] = useState<{ open: boolean; target: Friend | null }>({ open: false, target: null })
  const [shareSelectedFriends, setShareSelectedFriends] = useState<string[]>([])
  const [shareSelectedForum, setShareSelectedForum] = useState<number | null>(null)

  // 邀请好友弹窗
  const [inviteModal, setInviteModal] = useState<{ open: boolean; target: Friend | null }>({ open: false, target: null })
  const [inviteSelectedGroup, setInviteSelectedGroup] = useState<string | null>(null)
  const [inviteSelectedForum, setInviteSelectedForum] = useState<number | null>(null)

  // ── 群聊状态 ──
  const [apiGroups, setApiGroups] = useState<ApiGroup[]>([])
  const [groupsLoading, setGroupsLoading] = useState(false)
  const [groupInput, setGroupInput] = useState('')
  const [groupInfoOpen, setGroupInfoOpen] = useState(false)

  // 左侧 tab
  const [leftTab, setLeftTab] = useState<'friends' | 'groups'>('friends')

  // @mention
  const [mentionOpen, setMentionOpen] = useState(false)
  const [mentionKeyword, setMentionKeyword] = useState('')
  const [mentionedIds, setMentionedIds] = useState<string[]>([])
  const groupInputRef = useRef<HTMLTextAreaElement>(null)

  // 群管理面板
  const [announcementInput, setAnnouncementInput] = useState('')
  const [savingAnnouncement, setSavingAnnouncement] = useState(false)
  const [togglingMute, setTogglingMute] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesBoxRef = useRef<HTMLDivElement>(null)
  const groupMessagesEndRef = useRef<HTMLDivElement>(null)
  const groupMessagesBoxRef = useRef<HTMLDivElement>(null)
  const friendListScrollRef = useRef<HTMLDivElement>(null)
  const prevConvIdRef = useRef<string>('')
  const lastMsgTimeRef = useRef<Record<string, string>>({})
  useScrollRestore('/chat-friends', friendListScrollRef)

  const friendMap = Object.fromEntries(friends.map((f) => [f.id, f]))
  const joinedForums = ALL_FORUMS.filter((f) => joinedIds.includes(f.id))
  const filteredFriends = friends.filter((f) => f.name.includes(friendSearch))
  const groupedFriends = groupByInitial(friends)
  const allInitials = groupedFriends.map(([k]) => k)

  const currentId = activeConv?.data.id ?? ''
  const currentMessages: Message[] = messages[currentId] ?? []

  const activeGroupId = activeConv?.type === 'group' ? activeConv.data.id : null
  const activeApiGroup = activeGroupId ? apiGroups.find(g => g.id === activeGroupId) ?? null : null

  // ── API 消息 → chatStore Message 格式 ──
  const toStoreMsg = useCallback((m: { id: string; senderId: string; text: string; type: string; time: string; createdAt?: string }): Message => ({
    id: m.id,
    senderId: m.senderId === user?.id ? 'me' : m.senderId,
    text: m.text,
    time: m.time,
    type: 'text',
    createdAt: m.createdAt,
  }), [user?.id])

  // ── 从后端加载某好友的全量消息 ──
  const loadMessages = useCallback(async (friendId: string) => {
    try {
      const res = await fetchMessages(friendId)
      const msgs = res.data.messages
      if (msgs.length > 0) {
        useChatStore.setState((s) => ({
          messages: { ...s.messages, [friendId]: msgs.map(toStoreMsg) },
        }))
        lastMsgTimeRef.current[friendId] = msgs[msgs.length - 1].createdAt
      }
    } catch { }
  }, [toStoreMsg])

  // ── 轮询好友申请数量 ──
  const pollRequestCount = useCallback(async () => {
    try {
      const res = await getFriendRequests()
      setFriendRequestCount(res.data.requests.length)
    } catch { }
  }, [setFriendRequestCount])

  useEffect(() => {
    pollRequestCount()
    if (socketConnected) return
    const timer = setInterval(pollRequestCount, 30000)
    return () => clearInterval(timer)
  }, [pollRequestCount, socketConnected])

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
    } catch { }
    finally { setFriendsLoading(false) }
  }, [])

  useEffect(() => { loadFriends() }, [loadFriends])

  // ── 加载群组列表 ──
  const loadGroups = useCallback(async () => {
    try {
      setGroupsLoading(true)
      const res = await fetchGroups()
      setApiGroups(res.data.groups)
      // 后端在 socket 连接时已自动加入群 room，无需客户端主动 emit
    } catch { }
    finally { setGroupsLoading(false) }
  }, [])

  useEffect(() => { loadGroups() }, [loadGroups])

  // ── 切换好友会话时拉取历史消息 ──
  const activeFriendId = activeConv?.type === 'friend' ? activeConv.data.id : null

  useEffect(() => {
    if (activeFriendId) loadMessages(activeFriendId)
  }, [activeFriendId, loadMessages])

  // ── 切换群聊时加载群消息（有本地缓存则跳过，否则从后端拉取）──
  useEffect(() => {
    if (!activeGroupId) return
    if (groupMessages[activeGroupId]?.length) return   // 本地已有，直接用
    fetchGroupMessages(activeGroupId)
      .then(res => storeSetGroupMessages(activeGroupId, res.data.messages))
      .catch(() => { })
  }, [activeGroupId])

  // ── 群消息自动滚动 ──
  useEffect(() => {
    if (activeGroupId) {
      groupMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [groupMessages, activeGroupId])

  // ── 群聊 Socket 事件（私聊事件由 useRealtimeChat 统一管理，不在此重复注册）──
  // 用 socketConnected 作为依赖，确保断线重连后重新绑定
  // 用具名 handler 传给 sock.off()，只移除自己的监听器，不影响 useRealtimeChat 的 handler
  useEffect(() => {
    const sock = getSocket()
    if (!sock || !socketConnected) return

    const onGroupMessage = (msg: GroupMessage) => {
      const myId = useAuthStore.getState().user?.id
      if (msg.sender.id === myId) return   // 自己发的由乐观更新+ack处理
      appendGroupMessage(msg)
    }

    const onGroupRecalled = ({ messageId, groupId }: { messageId: string; groupId: string }) => {
      recallGroupMessage(groupId, messageId)
    }

    const onGroupKicked = ({ groupId }: { groupId: string }) => {
      setApiGroups(prev => prev.filter(g => g.id !== groupId))
      setActiveConv(prev =>
        prev?.type === 'group' && prev.data.id === groupId ? null : prev
      )
      message.warning('你已被移出群聊')
    }

    const onGroupDissolved = ({ groupId }: { groupId: string }) => {
      setApiGroups(prev => prev.filter(g => g.id !== groupId))
      setActiveConv(prev =>
        prev?.type === 'group' && prev.data.id === groupId ? null : prev
      )
      message.warning('该群已解散')
    }

    sock.on('group:message:new', onGroupMessage)
    sock.on('group:message:recalled', onGroupRecalled)
    sock.on('group:kicked', onGroupKicked)
    sock.on('group:dissolved', onGroupDissolved)

    return () => {
      // 精确移除自己的 handler，不影响其他 useEffect 的监听器
      sock.off('group:message:new', onGroupMessage)
      sock.off('group:message:recalled', onGroupRecalled)
      sock.off('group:kicked', onGroupKicked)
      sock.off('group:dissolved', onGroupDissolved)
    }
  }, [socketConnected])

  // ── 定时轮询:每 5 秒拉取当前好友会话的新消息(Socket 在线时跳过)──
  useEffect(() => {
    if (!activeFriendId) return
    if (socketConnected) return
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
          const toAdd = newMsgs.filter((m) => !existingIds.has(m.id)).map(toStoreMsg)
          if (toAdd.length === 0) return s
          return { messages: { ...s.messages, [friendId]: [...existing, ...toAdd] } }
        })
        lastMsgTimeRef.current[friendId] = newMsgs[newMsgs.length - 1].createdAt
      } catch { }
    }
    const timer = setInterval(poll, 5000)
    return () => clearInterval(timer)
  }, [activeFriendId, toStoreMsg, socketConnected])

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
  const selectApiGroup = (g: ApiGroup) => {
    setActiveConv({
      type: 'group',
      data: { id: g.id, name: g.name, memberIds: g.members.map(m => m.id), color: g.color },
    })
    setGroupInfoOpen(false)
  }

  // ── 发送私聊消息 ──
  const handleSend = async () => {
    const text = inputText.trim()
    if (!text) { message.warning('禁止发送空内容'); return }
    setInputText('')
    const time = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    const createdAt = new Date().toISOString()
    const tempId = `tmp_${Date.now()}`

    if (activeConv?.type === 'friend') {
      const friendId = activeConv.data.id
      sendMessage(friendId, { id: tempId, senderId: 'me', text, time, type: 'text', createdAt })
      const sock = getSocket()
      sock?.emit('typing:stop', { friendId })
      const rollback = () => {
        message.error('消息发送失败，请重试')
        useChatStore.setState((s) => ({
          messages: { ...s.messages, [friendId]: (s.messages[friendId] ?? []).filter((m) => m.id !== tempId) },
        }))
      }
      const applyServerMsg = (saved: { id: string; createdAt: string }) => {
        useChatStore.setState((s) => ({
          messages: { ...s.messages, [friendId]: (s.messages[friendId] ?? []).map((m) => m.id === tempId ? { ...m, id: saved.id } : m) },
        }))
        lastMsgTimeRef.current[friendId] = saved.createdAt
      }
      if (sock && sock.connected) {
        sock.emit('message:send', { friendId, text }, (ack: { message?: { id: string; createdAt: string }; error?: string }) => {
          if (ack?.error || !ack?.message) { rollback(); return }
          applyServerMsg(ack.message)
        })
      } else {
        try {
          const res = await postMessage(friendId, text)
          applyServerMsg(res.data.message)
        } catch { rollback() }
      }
    }
  }

  // ── 气泡操作：复制文本 ──
  const handleCopyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      message.success('已复制')
    } catch {
      message.error('复制失败')
    }
  }

  // ── 气泡操作：引用（私聊） ──
  const handleQuotePrivate = (text: string, sender: string) => {
    const quoted = text.split('\n').map((l) => `> ${l}`).join('\n')
    setInputText((prev) => `${quoted}\n— ${sender}\n${prev}`)
  }

  // ── 气泡操作：引用（群聊） ──
  const handleQuoteGroup = (text: string, sender: string) => {
    const quoted = text.split('\n').map((l) => `> ${l}`).join('\n')
    setGroupInput((prev) => `${quoted}\n— ${sender}\n${prev}`)
  }

  // ── 气泡操作：撤回（私聊，仅自己 2 分钟内） ──
  const handlePrivateRecall = (msg: Message) => {
    if (!activeConv || activeConv.type !== 'friend') return
    const friendId = activeConv.data.id
    Modal.confirm({
      title: '撤回这条消息？',
      content: '撤回后内容将不再显示',
      okText: '撤回',
      cancelText: '取消',
      onOk: () => {
        useChatStore.setState((s) => ({
          messages: {
            ...s.messages,
            [friendId]: (s.messages[friendId] ?? []).map((m) =>
              m.id === msg.id ? { ...m, recalled: true, text: '' } : m
            ),
          },
        }))
      },
    })
  }

  // ── 气泡操作：删除（私聊，仅本地） ──
  const handlePrivateDelete = (msg: Message) => {
    if (!activeConv || activeConv.type !== 'friend') return
    const friendId = activeConv.data.id
    Modal.confirm({
      title: '删除这条消息？',
      content: '仅在本地删除，对方仍可看到',
      okText: '删除',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: () => {
        useChatStore.setState((s) => ({
          messages: {
            ...s.messages,
            [friendId]: (s.messages[friendId] ?? []).filter((m) => m.id !== msg.id),
          },
        }))
      },
    })
  }

  // ── 气泡操作：删除（群聊，仅本地） ──
  const handleGroupDelete = (msg: GroupMessage) => {
    if (!activeGroupId) return
    Modal.confirm({
      title: '删除这条消息？',
      content: '仅在本地删除，对方仍可看到',
      okText: '删除',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: () => {
        useChatStore.setState((s) => ({
          groupMessages: {
            ...s.groupMessages,
            [activeGroupId]: (s.groupMessages[activeGroupId] ?? []).filter((m) => m.id !== msg.id),
          },
        }))
      },
    })
  }

  // ── 私聊气泡右键菜单构建 ──
  const buildPrivateBubbleMenu = (msg: Message, isMe: boolean, senderName: string): MenuProps['items'] => {
    if (msg.recalled) return [{ key: 'del', label: '删除', icon: <DeleteOutlined /> }]
    const within2min = msg.createdAt ? (Date.now() - new Date(msg.createdAt).getTime() < 2 * 60 * 1000) : false
    const items: MenuProps['items'] = [
      { key: 'copy', label: '复制', icon: <CopyOutlined /> },
      { key: 'quote', label: '引用', icon: <MessageOutlined /> },
    ]
    if (isMe && within2min && !msg.id.startsWith('tmp_')) {
      items.push({ key: 'recall', label: '撤回', icon: <UndoOutlined /> })
    }
    items.push({ key: 'del', label: '删除', icon: <DeleteOutlined />, danger: true })
    return items
  }

  const handlePrivateBubbleMenu = (key: string, msg: Message, senderName: string) => {
    if (key === 'copy') handleCopyText(msg.text)
    else if (key === 'quote') handleQuotePrivate(msg.text, senderName)
    else if (key === 'recall') handlePrivateRecall(msg)
    else if (key === 'del') handlePrivateDelete(msg)
  }

  // ── 群聊气泡右键菜单构建 ──
  const buildGroupBubbleMenu = (msg: GroupMessage, isMe: boolean): MenuProps['items'] => {
    if (msg.isRecalled) return [{ key: 'del', label: '删除', icon: <DeleteOutlined /> }]
    const within2min = Date.now() - new Date(msg.createdAt).getTime() < 2 * 60 * 1000
    const items: MenuProps['items'] = [
      { key: 'copy', label: '复制', icon: <CopyOutlined /> },
      { key: 'quote', label: '引用', icon: <MessageOutlined /> },
    ]
    if (isMe && within2min && !msg.id.startsWith('tmp_')) {
      items.push({ key: 'recall', label: '撤回', icon: <UndoOutlined /> })
    }
    items.push({ key: 'del', label: '删除', icon: <DeleteOutlined />, danger: true })
    return items
  }

  const handleGroupBubbleMenu = (key: string, msg: GroupMessage) => {
    if (key === 'copy') handleCopyText(msg.content)
    else if (key === 'quote') handleQuoteGroup(msg.content, msg.sender.username)
    else if (key === 'recall') handleRecall(msg)
    else if (key === 'del') handleGroupDelete(msg)
  }

  // ── 发送群消息 ──
  const handleGroupSend = () => {
    if (!activeGroupId || !groupInput.trim()) return
    const sock = getSocket()
    const tempId = `tmp_${Date.now()}`
    const tempMsg: GroupMessage = {
      id: tempId,
      groupId: activeGroupId,
      sender: { id: user!.id, userId: user!.userId || '', username: user!.username, avatar: '' },
      content: groupInput.trim(),
      type: 'text',
      mentionedUsers: mentionedIds,
      isRecalled: false,
      createdAt: new Date().toISOString(),
    }
    appendGroupMessage(tempMsg)   // 乐观写入 store（持久化）
    setGroupInput('')
    setMentionedIds([])
    setMentionOpen(false)

    if (sock?.connected) {
      sock.emit('group:message:send', { groupId: activeGroupId, content: tempMsg.content, mentionedUserIds: mentionedIds }, (ack: any) => {
        if (ack?.error) {
          message.error(ack.error)
          // 发送失败：从 store 移除临时消息
          useChatStore.setState((s) => ({
            groupMessages: {
              ...s.groupMessages,
              [activeGroupId]: (s.groupMessages[activeGroupId] ?? []).filter(m => m.id !== tempId),
            },
          }))
          return
        }
        if (ack?.message) {
          replaceGroupTempMsg(activeGroupId, tempId, ack.message)
        }
      })
    } else {
      message.error('未连接到服务器，请刷新页面')
      useChatStore.setState((s) => ({
        groupMessages: {
          ...s.groupMessages,
          [activeGroupId]: (s.groupMessages[activeGroupId] ?? []).filter(m => m.id !== tempId),
        },
      }))
    }
  }

  // ── 撤回群消息 ──
  const handleRecall = (msg: GroupMessage) => {
    if (!activeGroupId) return
    const sock = getSocket()
    sock?.emit('group:message:recall', { messageId: msg.id, groupId: activeGroupId }, (ack: any) => {
      if (ack?.error) message.error(ack.error)
      else recallGroupMessage(activeGroupId, msg.id)  // 立即本地更新
    })
  }

  // ── @mention 逻辑 ──
  const handleGroupInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    setGroupInput(val)
    const lastAt = val.lastIndexOf('@')
    if (lastAt !== -1) {
      const afterAt = val.slice(lastAt + 1)
      if (!afterAt.includes(' ') && !afterAt.includes('\n')) {
        setMentionKeyword(afterAt)
        setMentionOpen(true)
        return
      }
    }
    setMentionOpen(false)
    setMentionKeyword('')
  }

  const handleMentionSelect = (member: { id: string; username: string }) => {
    const lastAt = groupInput.lastIndexOf('@')
    const newText = groupInput.slice(0, lastAt) + `@${member.username} `
    setGroupInput(newText)
    setMentionedIds(prev => prev.includes(member.id) ? prev : [...prev, member.id])
    setMentionOpen(false)
    setMentionKeyword('')
    groupInputRef.current?.focus()
  }

  const mentionMembers = activeApiGroup
    ? activeApiGroup.members
        .filter(m => m.id !== user?.id && m.username.toLowerCase().includes(mentionKeyword.toLowerCase()))
        .slice(0, 8)
    : []

  // ── typing 节流 ──
  const typingStateRef = useRef<{ sent: boolean; timer: number | null }>({ sent: false, timer: null })
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value)
    if (activeConv?.type !== 'friend') return
    const sock = getSocket()
    if (!sock || !sock.connected) return
    const friendId = activeConv.data.id
    if (!typingStateRef.current.sent) {
      sock.emit('typing:start', { friendId })
      typingStateRef.current.sent = true
    }
    if (typingStateRef.current.timer) clearTimeout(typingStateRef.current.timer)
    typingStateRef.current.timer = window.setTimeout(() => {
      sock.emit('typing:stop', { friendId })
      typingStateRef.current.sent = false
    }, 1000)
  }

  useEffect(() => {
    typingStateRef.current.sent = false
    if (typingStateRef.current.timer) { clearTimeout(typingStateRef.current.timer); typingStateRef.current.timer = null }
  }, [activeFriendId])

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
    setSearchLoading(true); setSearchResult(null); setSearchError('')
    try {
      const res = await searchUser(q)
      setSearchResult({ ...res.data.user, isFriend: res.data.isFriend, isPending: res.data.isPending })
    } catch (err: any) {
      setSearchError(err?.response?.data?.message ?? '未找到该用户')
    } finally { setSearchLoading(false) }
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
    } finally { setSendingRequest(false) }
  }

  // ── 加载好友请求 ──
  const loadRequests = async () => {
    setRequestsLoading(true)
    try { const res = await getFriendRequests(); setRequests(res.data.requests) }
    catch { }
    finally { setRequestsLoading(false) }
  }

  // ── 接受 / 拒绝好友请求 ──
  const handleRespond = async (requestId: string, action: 'accept' | 'reject') => {
    setRespondingId(requestId)
    try {
      await respondFriendRequest(requestId, action)
      if (action === 'accept') { message.success('已接受好友申请'); await loadFriends() }
      else { message.info('已拒绝申请') }
      setRequests((prev) => { const next = prev.filter((r) => r.id !== requestId); setFriendRequestCount(next.length); return next })
    } catch (err: any) {
      message.error(err?.response?.data?.message ?? '操作失败')
    } finally { setRespondingId(null) }
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
        } catch { message.error('删除失败，请稍后重试') }
      },
    })
  }
  const handleBlock = (friend: Friend) => {
    Modal.confirm({
      title: `拉黑 ${friend.name}？`, content: '拉黑后对方将无法给你发送消息。',
      okText: '拉黑', cancelText: '取消', okButtonProps: { danger: true },
      onOk: () => { setBlockedIds((prev) => new Set([...prev, friend.id])); message.success(`已拉黑 ${friend.name}`) },
    })
  }
  const handleUnblock = (friend: Friend) => {
    setBlockedIds((prev) => { const next = new Set(prev); next.delete(friend.id); return next })
    message.success(`已解除拉黑 ${friend.name}`)
  }

  // ── 创建群聊（真实 API）──
  const handleCreateGroup = async () => {
    if (!groupName.trim()) { message.warning('请输入群聊名称'); return }
    if (selectedForGroup.length === 0) { message.warning('请至少选择一名成员'); return }
    setCreatingGroup(true)
    try {
      const res = await apiCreateGroup({ name: groupName.trim(), memberIds: selectedForGroup, color: selectedGroupColor })
      const newGroup = res.data.group
      setApiGroups(prev => [newGroup, ...prev])
      // join socket room
      const sock = getSocket()
      if (sock?.connected) {
        sock.emit('group:join_rooms', { groupIds: [newGroup.id] })
      }
      setCreateGroupOpen(false)
      setGroupName('')
      setSelectedForGroup([])
      setSelectedGroupColor(GROUP_COLORS[0])
      // 进入群聊
      selectApiGroup(newGroup)
      setLeftTab('groups')
      message.success(`群聊「${newGroup.name}」创建成功`)
    } catch (err: any) {
      message.error(err?.response?.data?.message ?? '创建失败')
    } finally { setCreatingGroup(false) }
  }

  // ── 群管理操作 ──
  const handleSaveAnnouncement = async () => {
    if (!activeGroupId) return
    setSavingAnnouncement(true)
    try {
      await apiSetAnnouncement(activeGroupId, announcementInput)
      setApiGroups(prev => prev.map(g => g.id === activeGroupId ? { ...g, announcement: announcementInput } : g))
      message.success('公告已更新')
    } catch (err: any) {
      message.error(err?.response?.data?.message ?? '更新失败')
    } finally { setSavingAnnouncement(false) }
  }

  const handleToggleMute = async (isMuted: boolean) => {
    if (!activeGroupId) return
    setTogglingMute(true)
    try {
      await apiSetMuted(activeGroupId, isMuted)
      setApiGroups(prev => prev.map(g => g.id === activeGroupId ? { ...g, isMuted } : g))
    } catch (err: any) {
      message.error(err?.response?.data?.message ?? '操作失败')
    } finally { setTogglingMute(false) }
  }

  const handleKickMember = (memberId: string, username: string) => {
    if (!activeGroupId) return
    Modal.confirm({
      title: `踢出 ${username}？`, okText: '踢出', cancelText: '取消', okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await apiKickMember(activeGroupId, memberId)
          setApiGroups(prev => prev.map(g =>
            g.id === activeGroupId
              ? { ...g, members: g.members.filter(m => m.id !== memberId) }
              : g
          ))
          message.success(`已踢出 ${username}`)
        } catch (err: any) {
          message.error(err?.response?.data?.message ?? '操作失败')
        }
      },
    })
  }

  const handleLeaveGroup = () => {
    if (!activeGroupId || !activeApiGroup) return
    const isOwner = activeApiGroup.ownerId === user?.id
    if (isOwner) {
      Modal.confirm({
        title: '解散群聊', content: '解散后所有消息将被清除，确定吗？',
        okText: '解散', cancelText: '取消', okButtonProps: { danger: true },
        onOk: async () => {
          try {
            await apiDissolveGroup(activeGroupId)
            setApiGroups(prev => prev.filter(g => g.id !== activeGroupId))
            setActiveConv(null)
            setGroupInfoOpen(false)
            message.success('群已解散')
          } catch (err: any) {
            message.error(err?.response?.data?.message ?? '操作失败')
          }
        },
      })
    } else {
      Modal.confirm({
        title: '退出群聊？', okText: '退出', cancelText: '取消', okButtonProps: { danger: true },
        onOk: async () => {
          try {
            await apiLeaveGroup(activeGroupId)
            setApiGroups(prev => prev.filter(g => g.id !== activeGroupId))
            setActiveConv(null)
            setGroupInfoOpen(false)
            message.success('已退出群聊')
          } catch (err: any) {
            message.error(err?.response?.data?.message ?? '操作失败')
          }
        },
      })
    }
  }

  // ── 分享好友 ──
  const handleShare = () => {
    if (shareSelectedFriends.length === 0 && shareSelectedForum === null) { message.warning('请选择分享目标'); return }
    const count = shareSelectedFriends.length + (shareSelectedForum !== null ? 1 : 0)
    message.success(`已分享给 ${count} 个目标`)
    setShareModal({ open: false, target: null }); setShareSelectedFriends([]); setShareSelectedForum(null)
  }

  // ── 邀请好友 ──
  const handleInvite = () => {
    if (inviteSelectedGroup === null && inviteSelectedForum === null) { message.warning('请选择邀请目标'); return }
    message.success('已发送邀请')
    setInviteModal({ open: false, target: null }); setInviteSelectedGroup(null); setInviteSelectedForum(null)
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

  const isGroupOwnerOrAdmin = activeApiGroup
    ? activeApiGroup.ownerId === user?.id || activeApiGroup.adminIds.includes(user?.id ?? '')
    : false

  const isGroupMuted = activeApiGroup?.isMuted ?? false
  const canSendInGroup = !isGroupMuted || isGroupOwnerOrAdmin

  // 当群信息面板打开时同步公告输入框
  useEffect(() => {
    if (groupInfoOpen && activeApiGroup) {
      setAnnouncementInput(activeApiGroup.announcement || '')
    }
  }, [groupInfoOpen, activeApiGroup])

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

          {/* 左侧 Tab */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 10, background: '#f5f6fa', borderRadius: 8, padding: 3 }}>
            {(['friends', 'groups'] as const).map(tab => (
              <button key={tab} onClick={() => setLeftTab(tab)}
                style={{
                  flex: 1, border: 'none', cursor: 'pointer', borderRadius: 6, padding: '4px 0', fontSize: 12, fontWeight: 600,
                  background: leftTab === tab ? '#fff' : 'transparent',
                  color: leftTab === tab ? '#667eea' : '#9ca3af',
                  boxShadow: leftTab === tab ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                  transition: 'all 0.15s',
                }}
              >
                {tab === 'friends' ? '私聊' : '群聊'}
              </button>
            ))}
          </div>

          <Input size="small" placeholder={leftTab === 'friends' ? '搜索好友' : '搜索群聊'}
            prefix={<SearchOutlined style={{ color: '#9ca3af', fontSize: 12 }} />}
            value={friendSearch} onChange={(e) => setFriendSearch(e.target.value)}
            style={{ borderRadius: 20, fontSize: 13 }}
          />
        </div>

        <div ref={friendListScrollRef} style={{ flex: 1, overflowY: 'auto' }}>
          {leftTab === 'friends' ? (
            /* ── 好友列表 ── */
            friendsLoading ? (
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
                  <Badge dot={!!onlineIds[friend.id] && !blockedIds.has(friend.id)} color="#52c41a" offset={[-2, 36]}>
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
            )
          ) : (
            /* ── 群聊列表 ── */
            <div>
              {groupsLoading ? (
                <div style={{ textAlign: 'center', padding: '30px 0' }}><Spin size="small" /></div>
              ) : apiGroups.filter(g => !friendSearch || g.name.includes(friendSearch)).length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px 16px', color: '#9ca3af', fontSize: 13 }}>暂无群聊，点击下方创建</div>
              ) : (
                apiGroups.filter(g => !friendSearch || g.name.includes(friendSearch)).map(g => (
                  <div key={g.id}
                    className={`friend-item ${activeConv?.data.id === g.id ? 'friend-item-active' : ''}`}
                    style={{ padding: sidebarHovered ? '10px 8px' : '10px 16px', transition: 'padding 0.25s', cursor: 'pointer' }}
                    onClick={() => selectApiGroup(g)}
                  >
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: g.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
                      <TeamOutlined />
                    </div>
                    <div style={{ flex: 1, minWidth: 0, marginLeft: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: '#1a1a2e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.name}</span>
                        <span style={{ fontSize: 11, color: '#9ca3af', flexShrink: 0, marginLeft: 4 }}>{g.members.length}人</span>
                      </div>
                      <div style={{ fontSize: 12, color: '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: sidebarHovered ? 50 : 140 }}>
                        {(() => { const msgs = groupMessages[g.id]; return msgs && msgs.length > 0 ? msgs[msgs.length - 1].content : '暂无消息' })()}
                      </div>
                    </div>
                  </div>
                ))
              )}
              <div style={{ padding: '12px 16px' }}>
                <Button block icon={<UsergroupAddOutlined />} onClick={() => setCreateGroupOpen(true)}
                  style={{ borderRadius: 8, color: '#667eea', borderColor: '#667eea' }}>
                  创建群聊
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── 聊天窗口 ── */}
      {activeConv ? (
        activeConv.type === 'friend' ? (
          /* ── 私聊窗口 ── */
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#fff', overflow: 'hidden' }}>
            {/* 顶部栏 */}
            <div style={{ padding: '0 24px', height: 60, background: '#f7f8fc', borderBottom: '1px solid #d0d3de', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div className="friend-avatar" style={{ background: activeFriend!.color, width: 36, height: 36, fontSize: 14 }}>
                  {activeFriend!.initial}
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#1a1a2e' }}>{activeFriend!.name}</div>
                  <div style={{ fontSize: 12, color: '#9ca3af' }}>
                    {typingMap[activeFriend!.id]
                      ? <span style={{ color: '#667eea' }}>正在输入…</span>
                      : (onlineIds[activeFriend!.id] ? <span style={{ color: '#52c41a' }}>在线</span> : '离线')}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 16, color: '#9ca3af' }}>
                <Tooltip title="语音通话"><PhoneOutlined style={{ fontSize: 18, cursor: 'pointer' }} /></Tooltip>
                <Tooltip title="视频通话"><VideoCameraOutlined style={{ fontSize: 18, cursor: 'pointer' }} /></Tooltip>
                <Popover trigger="click" placement="bottomRight" content={renderMoreMenu(activeFriend!)}>
                  <Tooltip title="更多"><MoreOutlined style={{ fontSize: 18, cursor: 'pointer' }} /></Tooltip>
                </Popover>
              </div>
            </div>

            {/* 消息记录 */}
            <div ref={messagesBoxRef} style={{ flex: 15, overflowY: 'auto', padding: '20px 24px 28px', display: 'flex', flexDirection: 'column', gap: 12, background: '#f0f2f8' }}>
              {currentMessages.map((msg) => {
                const isMe = msg.senderId === 'me'
                const sender = !isMe ? (friendMap[msg.senderId] ?? null) : null
                const senderName = isMe ? (user?.username ?? '我') : (sender?.name ?? '对方')

                // 撤回提示气泡（居中）
                if (msg.recalled) {
                  return (
                    <div key={msg.id} style={{ textAlign: 'center', color: '#9ca3af', fontSize: 12, padding: '4px 0' }}>
                      {isMe ? '你撤回了一条消息' : `${senderName} 撤回了一条消息`}
                    </div>
                  )
                }

                return (
                  <div key={msg.id} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start', alignItems: 'flex-end', gap: 8 }}>
                    {!isMe && (
                      <div className="friend-avatar" style={{ background: sender?.color ?? '#9ca3af', width: 32, height: 32, fontSize: 12, flexShrink: 0 }}>
                        {sender?.initial ?? '?'}
                      </div>
                    )}
                    <div style={{ maxWidth: '60%' }}>
                      <Dropdown
                        trigger={['contextMenu']}
                        menu={{
                          items: buildPrivateBubbleMenu(msg, isMe, senderName),
                          onClick: ({ key }) => handlePrivateBubbleMenu(key, msg, senderName),
                        }}
                      >
                        <div style={{ padding: '10px 14px', borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px', background: isMe ? '#667eea' : '#fff', color: isMe ? '#fff' : '#1a1a2e', fontSize: 14, lineHeight: 1.6, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', wordBreak: 'break-word', whiteSpace: 'pre-wrap', cursor: 'context-menu' }}>
                          {msg.text}
                        </div>
                      </Dropdown>
                      <Tooltip title={msg.createdAt ? new Date(msg.createdAt).toLocaleString('zh-CN') : ''} placement={isMe ? 'left' : 'right'}>
                        <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4, textAlign: isMe ? 'right' : 'left', cursor: 'default' }}>
                          {formatChatTime(msg.createdAt ?? msg.time)}
                        </div>
                      </Tooltip>
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
              <Input.TextArea value={inputText} onChange={handleInputChange}
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
          /* ── 群聊窗口 ── */
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#fff', overflow: 'hidden' }}>
              {/* 顶部栏 */}
              <div style={{ padding: '0 24px', height: 60, background: '#f7f8fc', borderBottom: '1px solid #d0d3de', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: activeGroup!.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 16 }}>
                    <TeamOutlined />
                  </div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: '#1a1a2e' }}>{activeGroup!.name}</div>
                    <div style={{ fontSize: 12, color: '#9ca3af' }}>
                      {activeApiGroup ? `${activeApiGroup.members.length} 位成员` : `${activeGroup!.memberIds.length} 位成员`}
                      {isGroupMuted && <span style={{ marginLeft: 6, color: '#f59e0b' }}>全员禁言中</span>}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', color: '#9ca3af' }}>
                  <Tooltip title="语音通话"><PhoneOutlined style={{ fontSize: 18, cursor: 'pointer' }} /></Tooltip>
                  <Tooltip title="视频通话"><VideoCameraOutlined style={{ fontSize: 18, cursor: 'pointer' }} /></Tooltip>
                  <Tooltip title="群信息">
                    <InfoCircleOutlined
                      style={{ fontSize: 18, cursor: 'pointer', color: groupInfoOpen ? '#667eea' : '#9ca3af' }}
                      onClick={() => setGroupInfoOpen(o => !o)}
                    />
                  </Tooltip>
                </div>
              </div>

              {/* 群公告横幅 */}
              {activeApiGroup?.announcement && (
                <div style={{ padding: '8px 20px', background: '#fffbe6', borderBottom: '1px solid #ffe58f', display: 'flex', alignItems: 'flex-start', gap: 8, flexShrink: 0 }}>
                  <BellOutlined style={{ color: '#faad14', marginTop: 2, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: '#5f4000', flex: 1 }}>{activeApiGroup.announcement}</span>
                </div>
              )}

              {/* 群消息列表 */}
              <div ref={groupMessagesBoxRef} style={{ flex: 1, overflowY: 'auto', padding: '20px 24px 16px', display: 'flex', flexDirection: 'column', gap: 12, background: '#f0f2f8' }}>
                {(groupMessages[activeGroupId!] ?? []).length === 0 && (
                  <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: 13, padding: '40px 0' }}>暂无消息，发送第一条消息吧</div>
                )}
                {(groupMessages[activeGroupId!] ?? []).map((msg) => {
                  const isMe = msg.sender.id === user?.id
                  const canRecall = isMe && !msg.isRecalled && (Date.now() - new Date(msg.createdAt).getTime() < 2 * 60 * 1000)
                  const senderColor = colorFromId(msg.sender.id)
                  const senderInitial = getInitial(msg.sender.username || '?')

                  if (msg.isRecalled) {
                    return (
                      <div key={msg.id} style={{ textAlign: 'center', color: '#9ca3af', fontSize: 12, padding: '4px 0' }}>
                        {msg.sender.username} 撤回了一条消息
                      </div>
                    )
                  }

                  if (msg.type === 'system') {
                    return (
                      <div key={msg.id} style={{ textAlign: 'center', color: '#9ca3af', fontSize: 12, padding: '4px 0' }}>
                        {msg.content}
                      </div>
                    )
                  }

                  return (
                    <div key={msg.id}
                      className="group-msg-row"
                      style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start', alignItems: 'flex-end', gap: 8 }}
                    >
                      {!isMe && (
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: senderColor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                          {senderInitial}
                        </div>
                      )}
                      <div style={{ maxWidth: '60%' }}>
                        {!isMe && (
                          <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 3 }}>{msg.sender.username}</div>
                        )}
                        <div style={{ position: 'relative' }}>
                          <Dropdown
                            trigger={['contextMenu']}
                            menu={{
                              items: buildGroupBubbleMenu(msg, isMe),
                              onClick: ({ key }) => handleGroupBubbleMenu(key, msg),
                            }}
                          >
                            <div style={{ padding: '10px 14px', borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px', background: isMe ? '#667eea' : '#fff', color: isMe ? '#fff' : '#1a1a2e', fontSize: 14, lineHeight: 1.6, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', wordBreak: 'break-word', whiteSpace: 'pre-wrap', cursor: 'context-menu' }}>
                              {renderWithMentions(msg.content)}
                            </div>
                          </Dropdown>
                          {canRecall && (
                            <Tooltip title="撤回">
                              <button
                                className="recall-btn"
                                onClick={() => handleRecall(msg)}
                                style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', right: isMe ? 'calc(100% + 6px)' : 'auto', left: isMe ? 'auto' : 'calc(100% + 6px)', background: 'rgba(0,0,0,0.05)', border: 'none', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', opacity: 0, transition: 'opacity 0.15s' }}
                              >
                                <UndoOutlined style={{ fontSize: 12, color: '#9ca3af' }} />
                              </button>
                            </Tooltip>
                          )}
                        </div>
                        <Tooltip title={new Date(msg.createdAt).toLocaleString('zh-CN')} placement={isMe ? 'left' : 'right'}>
                          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4, textAlign: isMe ? 'right' : 'left', cursor: 'default' }}>
                            {formatChatTime(msg.createdAt)}
                          </div>
                        </Tooltip>
                      </div>
                      {isMe && (
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#667eea', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                          {user?.username?.[0]?.toUpperCase() ?? 'U'}
                        </div>
                      )}
                    </div>
                  )
                })}
                <div ref={groupMessagesEndRef} />
              </div>

              {/* 工具栏 */}
              <div style={{ flexShrink: 0, height: 44, background: '#fff', borderTop: '1px solid #d0d3de', display: 'flex', alignItems: 'center', padding: '0 20px', gap: 20 }}>
                <Tooltip title="发送表情"><SmileOutlined style={{ fontSize: 20, color: '#9ca3af', cursor: 'pointer' }} /></Tooltip>
                <Tooltip title="发送图片"><PictureOutlined style={{ fontSize: 20, color: '#9ca3af', cursor: 'pointer' }} /></Tooltip>
                <Tooltip title="发送文件"><FileOutlined style={{ fontSize: 20, color: '#9ca3af', cursor: 'pointer' }} /></Tooltip>
              </div>

              {/* 群输入框 + @mention */}
              <div style={{ flexShrink: 0, background: '#fff', display: 'flex', flexDirection: 'column', padding: '12px 20px 16px', borderTop: '1px solid #f0f0f0', position: 'relative' }}>
                {/* @mention 浮层 */}
                {mentionOpen && mentionMembers.length > 0 && (
                  <div style={{ position: 'absolute', bottom: '100%', left: 20, background: '#fff', boxShadow: '0 4px 20px rgba(0,0,0,0.12)', border: '1px solid #f0f0f0', borderRadius: 8, padding: '4px 0', zIndex: 100, minWidth: 180, maxHeight: 220, overflowY: 'auto' }}>
                    {mentionMembers.map(m => (
                      <div key={m.id}
                        onClick={() => handleMentionSelect(m)}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 14px', cursor: 'pointer', transition: 'background 0.15s' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#f5f6fa')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <div style={{ width: 26, height: 26, borderRadius: '50%', background: colorFromId(m.id), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                          {getInitial(m.username)}
                        </div>
                        <span style={{ fontSize: 13, color: '#374151' }}>{m.username}</span>
                      </div>
                    ))}
                  </div>
                )}

                {!canSendInGroup ? (
                  <div style={{ padding: '16px 0', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>全员禁言中，无法发言</div>
                ) : (
                  <>
                    <textarea
                      ref={groupInputRef}
                      value={groupInput}
                      onChange={handleGroupInputChange}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleGroupSend() } }}
                      placeholder="输入消息... 输入 @ 提及成员 (Enter 发送，Shift+Enter 换行)"
                      style={{ flex: 1, resize: 'none', border: 'none', outline: 'none', fontSize: 14, padding: 0, minHeight: 60, fontFamily: 'inherit', lineHeight: 1.6 }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                      <Button type="primary" icon={<SendOutlined />} onClick={handleGroupSend}
                        style={{ background: '#667eea', border: 'none', borderRadius: 20, padding: '0 20px' }}>
                        发送
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* ── 群信息侧边栏 ── */}
            {groupInfoOpen && activeApiGroup && (
              <div style={{ width: 300, borderLeft: '1px solid #d0d3de', background: '#fafafa', display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0 }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 700, fontSize: 15, color: '#1a1a2e' }}>群信息</span>
                  <CloseOutlined style={{ cursor: 'pointer', color: '#9ca3af' }} onClick={() => setGroupInfoOpen(false)} />
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
                  {/* 群名称 */}
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 6, fontWeight: 600 }}>群名称</div>
                    <div style={{ fontSize: 14, color: '#1a1a2e', fontWeight: 600 }}>{activeApiGroup.name}</div>
                  </div>

                  {/* 群公告 */}
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 6, fontWeight: 600 }}>群公告</div>
                    {isGroupOwnerOrAdmin ? (
                      <div>
                        <Input.TextArea
                          value={announcementInput}
                          onChange={e => setAnnouncementInput(e.target.value)}
                          placeholder="输入群公告..."
                          rows={3}
                          style={{ borderRadius: 8, fontSize: 13, marginBottom: 8 }}
                        />
                        <Button size="small" type="primary" loading={savingAnnouncement}
                          onClick={handleSaveAnnouncement}
                          style={{ background: '#667eea', border: 'none', borderRadius: 6 }}>
                          保存公告
                        </Button>
                      </div>
                    ) : (
                      <div style={{ fontSize: 13, color: '#374151' }}>{activeApiGroup.announcement || '暂无公告'}</div>
                    )}
                  </div>

                  {/* 全员禁言 */}
                  {isGroupOwnerOrAdmin && (
                    <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontSize: 12, color: '#9ca3af', fontWeight: 600 }}>全员禁言</div>
                        <div style={{ fontSize: 12, color: '#9ca3af' }}>开启后普通成员无法发言</div>
                      </div>
                      <Switch
                        checked={activeApiGroup.isMuted}
                        loading={togglingMute}
                        onChange={handleToggleMute}
                        checkedChildren="禁言"
                        unCheckedChildren="正常"
                      />
                    </div>
                  )}

                  {/* 成员列表 */}
                  <div>
                    <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 10, fontWeight: 600 }}>
                      成员（{activeApiGroup.members.length}人）
                    </div>
                    {activeApiGroup.members.map(m => {
                      const isOwner = m.id === activeApiGroup.ownerId
                      const isAdmin = activeApiGroup.adminIds.includes(m.id)
                      const isMe = m.id === user?.id
                      const canKick = isGroupOwnerOrAdmin && !isOwner && !isMe
                      return (
                        <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
                          <div style={{ width: 32, height: 32, borderRadius: '50%', background: colorFromId(m.id), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
                            {getInitial(m.username)}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e', display: 'flex', alignItems: 'center', gap: 4 }}>
                              {m.username}
                              {isOwner && <Tag color="gold" style={{ fontSize: 10, padding: '0 4px', lineHeight: '16px' }}>群主</Tag>}
                              {isAdmin && !isOwner && <Tag color="blue" style={{ fontSize: 10, padding: '0 4px', lineHeight: '16px' }}>管理</Tag>}
                            </div>
                            <div style={{ fontSize: 11, color: '#9ca3af' }}>ID: {m.userId}</div>
                          </div>
                          {canKick && (
                            <Tooltip title="踢出">
                              <LogoutOutlined
                                style={{ color: '#ef4444', cursor: 'pointer', fontSize: 14 }}
                                onClick={() => handleKickMember(m.id, m.username)}
                              />
                            </Tooltip>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* 底部操作 */}
                <div style={{ padding: '12px 20px', borderTop: '1px solid #f0f0f0' }}>
                  <Button
                    block danger
                    icon={activeApiGroup.ownerId === user?.id ? <DeleteOutlined /> : <LogoutOutlined />}
                    onClick={handleLeaveGroup}
                    style={{ borderRadius: 8 }}
                  >
                    {activeApiGroup.ownerId === user?.id ? '解散群聊' : '退出群聊'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )
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
                setPlusMenuOpen(false); setAddFriendOpen(true); setAddFriendTab('search')
                setSearchQuery(''); setSearchResult(null); setSearchError('')
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
      <Modal title="添加好友" open={addFriendOpen} onCancel={() => setAddFriendOpen(false)} footer={null} width={440}>
        {user?.userId && (
          <div style={{ background: '#f5f6fa', borderRadius: 8, padding: '10px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <span style={{ fontSize: 12, color: '#9ca3af' }}>我的 ID（分享给好友）</span>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e', letterSpacing: 2 }}>{user.userId}</div>
            </div>
            <Button size="small" icon={<CopyOutlined />} type="text"
              onClick={() => { navigator.clipboard.writeText(user.userId); message.success('ID 已复制') }}>复制</Button>
          </div>
        )}
        <Tabs activeKey={addFriendTab} onChange={(k) => { setAddFriendTab(k); if (k === 'requests') loadRequests() }}
          items={[
            {
              key: 'search', label: '搜索用户',
              children: (
                <div>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                    <Input placeholder="输入 11 位用户 ID 或邮箱" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onPressEnter={handleSearch}
                      prefix={<SearchOutlined style={{ color: '#9ca3af' }} />} style={{ borderRadius: 8 }} />
                    <Button type="primary" onClick={handleSearch} loading={searchLoading} style={{ background: '#667eea', border: 'none', borderRadius: 8 }}>搜索</Button>
                  </div>
                  {searchLoading && <div style={{ textAlign: 'center', padding: '20px 0' }}><Spin /></div>}
                  {searchError && !searchLoading && <div style={{ textAlign: 'center', color: '#9ca3af', padding: '20px 0', fontSize: 14 }}>{searchError}</div>}
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
                        searchResult.isPending
                          ? <Button disabled style={{ borderRadius: 20 }}>已申请</Button>
                          : <Button type="primary" loading={sendingRequest} onClick={() => handleSendRequest(searchResult.id)} style={{ background: '#667eea', border: 'none', borderRadius: 20 }}>添加好友</Button>
                      )}
                      {searchResult.isFriend && (
                        <Button onClick={() => { const f = friends.find(f => f.id === searchResult.id); if (f) { selectFriend(f); setAddFriendOpen(false) } }} style={{ borderRadius: 20 }}>发消息</Button>
                      )}
                    </div>
                  )}
                </div>
              ),
            },
            {
              key: 'requests', label: '好友申请',
              children: (
                <div style={{ minHeight: 120 }}>
                  {requestsLoading && <div style={{ textAlign: 'center', padding: '30px 0' }}><Spin /></div>}
                  {!requestsLoading && requests.length === 0 && <Empty description="暂无好友申请" style={{ padding: '20px 0' }} />}
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
                        <Button size="small" type="primary" icon={<CheckOutlined />} loading={respondingId === req.id} onClick={() => handleRespond(req.id, 'accept')} style={{ background: '#667eea', border: 'none', borderRadius: 16 }}>接受</Button>
                        <Button size="small" icon={<CloseOutlined />} loading={respondingId === req.id} onClick={() => handleRespond(req.id, 'reject')} style={{ borderRadius: 16 }}>拒绝</Button>
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
            value={friendSearch} onChange={e => setFriendSearch(e.target.value)} style={{ borderRadius: 20 }} />
        </div>
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
            {groupedFriends.map(([initial, fs]) => ({ initial, fs: fs.filter(f => f.name.includes(friendSearch)) }))
              .filter(({ fs }) => fs.length > 0)
              .map(({ initial, fs }) => (
                <div key={initial}>
                  <div id={`group-${initial}`} style={{ padding: '6px 20px', fontSize: 12, fontWeight: 700, color: '#9ca3af', background: '#f9fafb', letterSpacing: 1 }}>{initial}</div>
                  {fs.map(friend => (
                    <div key={friend.id} style={{ display: 'flex', alignItems: 'center', padding: '10px 20px', transition: 'background 0.15s', cursor: 'default', opacity: blockedIds.has(friend.id) ? 0.5 : 1 }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#f5f6fa')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <Badge dot={!!onlineIds[friend.id]} color="#52c41a" offset={[-2, 36]}>
                        <div className="friend-avatar" style={{ background: friend.color, width: 38, height: 38, fontSize: 15 }}>{friend.initial}</div>
                      </Badge>
                      <div style={{ flex: 1, marginLeft: 12 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a2e' }}>
                          {friend.name}{blockedIds.has(friend.id) && <span style={{ fontSize: 10, color: '#f59e0b', marginLeft: 6 }}>已拉黑</span>}
                        </div>
                        <div style={{ fontSize: 12, color: '#9ca3af' }}>ID: {friend.userId}</div>
                      </div>
                      <Popover trigger="click" placement="left" content={renderMoreMenu(friend, () => { selectFriend(friend); setFriendListOpen(false) })}>
                        <EllipsisOutlined style={{ fontSize: 18, color: '#9ca3af', padding: '4px 8px', borderRadius: 6, cursor: 'pointer' }} />
                      </Popover>
                    </div>
                  ))}
                </div>
              ))}
          </div>
          <div style={{ width: 28, background: '#f9fafb', borderLeft: '1px solid #f0f0f0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '8px 0', gap: 2, flexShrink: 0 }}>
            {'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(letter => {
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

      {/* ── 创建群聊弹窗（真实 API）── */}
      <Modal title="创建群聊" open={createGroupOpen}
        onCancel={() => { setCreateGroupOpen(false); setGroupName(''); setSelectedForGroup([]); setSelectedGroupColor(GROUP_COLORS[0]) }}
        onOk={handleCreateGroup} okText="创建" cancelText="取消"
        okButtonProps={{ style: { background: '#667eea', border: 'none' }, loading: creatingGroup }}
        width={420}
      >
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 6 }}>群聊名称</div>
          <Input placeholder="请输入群聊名称" value={groupName} onChange={e => setGroupName(e.target.value)} maxLength={20} style={{ borderRadius: 8 }} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 8 }}>群聊颜色</div>
          <div style={{ display: 'flex', gap: 10 }}>
            {GROUP_COLORS.map(c => (
              <div key={c} onClick={() => setSelectedGroupColor(c)}
                style={{ width: 28, height: 28, borderRadius: '50%', background: c, cursor: 'pointer', border: selectedGroupColor === c ? '3px solid #333' : '3px solid transparent', boxSizing: 'border-box', transition: 'border 0.15s' }}
              />
            ))}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 8 }}>选择成员（{selectedForGroup.length} 人已选）</div>
          <div style={{ maxHeight: 280, overflowY: 'auto', border: '1px solid #f0f0f0', borderRadius: 8 }}>
            {friends.length === 0 && <div style={{ textAlign: 'center', color: '#9ca3af', padding: '20px 0', fontSize: 13 }}>暂无好友可选</div>}
            {friends.map(friend => (
              <div key={friend.id} style={{ display: 'flex', alignItems: 'center', padding: '10px 16px', cursor: 'pointer', transition: 'background 0.15s' }}
                onClick={() => setSelectedForGroup(prev => prev.includes(friend.id) ? prev.filter(id => id !== friend.id) : [...prev, friend.id])}
                onMouseEnter={e => (e.currentTarget.style.background = '#f5f6fa')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <Checkbox checked={selectedForGroup.includes(friend.id)} style={{ marginRight: 12 }} />
                <div className="friend-avatar" style={{ background: friend.color, width: 32, height: 32, fontSize: 13 }}>{friend.initial}</div>
                <span style={{ marginLeft: 10, fontSize: 14 }}>{friend.name}</span>
                {onlineIds[friend.id] && <Badge dot color="#52c41a" style={{ marginLeft: 6 }} />}
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
                {friends.filter(f => f.id !== shareModal.target?.id).map(friend => (
                  <div key={friend.id} style={{ display: 'flex', alignItems: 'center', padding: '8px 4px', cursor: 'pointer', transition: 'background 0.15s', borderRadius: 8 }}
                    onClick={() => setShareSelectedFriends(prev => prev.includes(friend.id) ? prev.filter(id => id !== friend.id) : [...prev, friend.id])}
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
                {joinedForums.map(forum => (
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
                {apiGroups.length === 0 && <div style={{ textAlign: 'center', color: '#9ca3af', padding: '24px 0' }}>还没有群聊，先去创建一个吧</div>}
                {apiGroups.map(g => (
                  <div key={g.id} style={{ display: 'flex', alignItems: 'center', padding: '8px 4px', cursor: 'pointer', transition: 'background 0.15s', borderRadius: 8 }}
                    onClick={() => setInviteSelectedGroup(inviteSelectedGroup === g.id ? null : g.id)}
                    onMouseEnter={e => (e.currentTarget.style.background = '#f5f6fa')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <Checkbox checked={inviteSelectedGroup === g.id} style={{ marginRight: 12 }} />
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: g.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}><TeamOutlined /></div>
                    <div style={{ marginLeft: 10 }}>
                      <div style={{ fontSize: 14 }}>{g.name}</div>
                      <div style={{ fontSize: 12, color: '#9ca3af' }}>{g.members.length} 位成员</div>
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
                {joinedForums.map(forum => (
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

      {/* 群消息 hover 显示撤回按钮的全局样式 */}
      <style>{`
        .group-msg-row:hover .recall-btn {
          opacity: 1 !important;
        }
      `}</style>
    </div>
  )
}
