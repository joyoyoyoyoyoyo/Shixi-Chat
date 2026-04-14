import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Input, Button, Tooltip, Badge, Modal, Popover, message, Checkbox, Tabs } from 'antd'
import {
  SmileOutlined, FileOutlined, PictureOutlined, PhoneOutlined, VideoCameraOutlined,
  MoreOutlined, SendOutlined, SearchOutlined, SettingOutlined, EllipsisOutlined,
  MessageOutlined, StopOutlined, DeleteOutlined, PlusOutlined, UserAddOutlined,
  UsergroupAddOutlined, TeamOutlined, ShareAltOutlined, UserSwitchOutlined,
} from '@ant-design/icons'
import useAuthStore from '../../store/authStore'
import useChatStore, { Message, Group } from '../../store/chatStore'
import useForumStore from '../../store/forumStore'
import { ALL_FORUMS } from '../../data/forums'
import { useSidebarHover } from '../../context/SidebarContext'

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

interface Friend {
  id: string; name: string; initial: string; color: string
  lastMessage: string; time: string; online: boolean; unread: number
}

const MOCK_FRIENDS: Friend[] = [
  { id: '1',  name: '张小明', initial: '张', color: '#667eea', lastMessage: '', time: '10:32', online: true,  unread: 2 },
  { id: '2',  name: '李晓雯', initial: '李', color: '#f093fb', lastMessage: '', time: '09:15', online: true,  unread: 0 },
  { id: '3',  name: '王大伟', initial: '王', color: '#4facfe', lastMessage: '', time: '昨天',  online: false, unread: 1 },
  { id: '4',  name: '陈思思', initial: '陈', color: '#43e97b', lastMessage: '', time: '昨天',  online: false, unread: 0 },
  { id: '5',  name: '刘浩然', initial: '刘', color: '#fa709a', lastMessage: '', time: '周一',  online: true,  unread: 0 },
  { id: '6',  name: '赵雨桐', initial: '赵', color: '#a18cd1', lastMessage: '', time: '周一',  online: true,  unread: 3 },
  { id: '7',  name: '孙浩宇', initial: '孙', color: '#fda085', lastMessage: '', time: '周二',  online: false, unread: 0 },
  { id: '8',  name: '周静怡', initial: '周', color: '#84fab0', lastMessage: '', time: '周二',  online: true,  unread: 1 },
  { id: '9',  name: '吴俊杰', initial: '吴', color: '#f6d365', lastMessage: '', time: '周三',  online: false, unread: 0 },
  { id: '10', name: '郑梦琪', initial: '郑', color: '#89f7fe', lastMessage: '', time: '周三',  online: true,  unread: 2 },
  { id: '11', name: '林思远', initial: '林', color: '#f7971e', lastMessage: '', time: '周四',  online: false, unread: 0 },
  { id: '12', name: '黄子涵', initial: '黄', color: '#c471ed', lastMessage: '', time: '周四',  online: true,  unread: 0 },
  { id: '13', name: '徐嘉怡', initial: '徐', color: '#12c2e9', lastMessage: '', time: '上周',  online: false, unread: 0 },
  { id: '14', name: '曹子墨', initial: '曹', color: '#e96c1f', lastMessage: '', time: '上周',  online: false, unread: 0 },
  { id: '15', name: '韩冰洁', initial: '韩', color: '#56ab2f', lastMessage: '', time: '更早',  online: false, unread: 0 },
]

type ActiveConv = { type: 'friend'; data: Friend } | { type: 'group'; data: Group }

// ── 更多菜单选项 ──
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
  const { messages, groups, unreadMap, sendMessage, clearFriendUnread, clearNavUnread, addGroup } = useChatStore()
  const { joinedIds } = useForumStore()
  const sidebarHovered = useSidebarHover()

  useEffect(() => { clearNavUnread() }, [])

  const [friends, setFriends] = useState<Friend[]>(MOCK_FRIENDS)
  const [blockedIds, setBlockedIds] = useState<Set<string>>(new Set())
  const [activeConv, setActiveConv] = useState<ActiveConv>({ type: 'friend', data: MOCK_FRIENDS[0] })
  const [inputText, setInputText] = useState('')
  const [friendSearch, setFriendSearch] = useState('')
  const [friendListOpen, setFriendListOpen] = useState(false)

  // 加号菜单
  const [plusMenuOpen, setPlusMenuOpen] = useState(false)
  const [plusMenuPos, setPlusMenuPos] = useState({ top: 0, left: 0 })
  const plusBtnRef = useRef<HTMLSpanElement>(null)
  const autoCloseRef = useRef<number | null>(null)
  const leaveRef = useRef<number | null>(null)

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
  const friendMap = Object.fromEntries(friends.map((f) => [f.id, f]))
  const joinedForums = ALL_FORUMS.filter((f) => joinedIds.includes(f.id))
  const filteredFriends = friends.filter((f) => f.name.includes(friendSearch))
  const groupedFriends = groupByInitial(friends)
  const allInitials = groupedFriends.map(([k]) => k)

  const currentId = activeConv?.data.id ?? ''
  const currentMessages: Message[] = messages[currentId] ?? []

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
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
  const handleSend = () => {
    if (!inputText.trim()) { message.warning('禁止发送空内容'); return }
    sendMessage(currentId, {
      id: Date.now().toString(),
      senderId: 'me',
      text: inputText.trim(),
      time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
      type: 'text',
    })
    setInputText('')
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

  // ── 删除 / 拉黑 ──
  const handleDelete = (friend: Friend) => {
    Modal.confirm({
      title: `删除好友 ${friend.name}？`,
      content: '删除后将无法接收该好友的消息，聊天记录也会清除。',
      okText: '删除', cancelText: '取消', okButtonProps: { danger: true },
      onOk: () => {
        setFriends((prev) => prev.filter((f) => f.id !== friend.id))
        if (activeConv?.type === 'friend' && activeConv.data.id === friend.id) {
          const remaining = friends.filter((f) => f.id !== friend.id)
          setActiveConv(remaining.length > 0 ? { type: 'friend', data: remaining[0] } : { type: 'friend', data: MOCK_FRIENDS[0] })
        }
        message.success(`已删除好友 ${friend.name}`)
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

  // ── 渲染更多菜单内容（供好友列表和顶部栏共用）──
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

  const activeFriend = activeConv?.type === 'friend' ? activeConv.data : null
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

        <div style={{ flex: 1, overflowY: 'auto' }}>
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
          {filteredFriends.map((friend) => (
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
                  <span style={{ fontSize: sidebarHovered ? 10 : 11, color: '#9ca3af', flexShrink: 0, marginLeft: 4 }}>{friend.time}</span>
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
          ))}
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
          <div style={{ flex: 15, overflowY: 'auto', padding: '20px 24px 28px', display: 'flex', flexDirection: 'column', gap: 12, background: '#f0f2f8' }}>
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
          选择一个好友或群聊开始聊天
        </div>
      )}

      {/* ── 加号菜单（Portal）── */}
      {plusMenuOpen && createPortal(
        <div onMouseEnter={handlePlusMenuEnter} onMouseLeave={handlePlusMenuLeave}
          style={{ position: 'fixed', top: plusMenuPos.top, left: plusMenuPos.left, background: '#fff', borderRadius: 8, boxShadow: '0 4px 20px rgba(0,0,0,0.12)', border: '1px solid #f0f0f0', padding: '4px 0', minWidth: 140, zIndex: 9999 }}
        >
          {[
            { icon: <UserAddOutlined />, label: '添加好友', action: () => { setPlusMenuOpen(false); message.info('添加好友功能开发中') } },
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
                        <div style={{ fontSize: 12, color: friend.online ? '#52c41a' : '#9ca3af' }}>{friend.online ? '在线' : '离线'}</div>
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
