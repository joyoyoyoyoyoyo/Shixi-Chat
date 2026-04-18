import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  Button, Input, Modal, Form, Select, Switch, Tag, Spin, Upload, message,
  Tooltip, Popconfirm, Avatar, Badge,
} from 'antd'
import {
  PlusOutlined, AppstoreOutlined, LikeOutlined, LikeFilled,
  CommentOutlined, TeamOutlined, SettingOutlined,
  DeleteOutlined, CrownOutlined, SafetyOutlined, SendOutlined,
  CheckOutlined, CloseOutlined, LockOutlined,
  UserAddOutlined, LeftOutlined, BellOutlined,
  PushpinFilled, PushpinOutlined,
} from '@ant-design/icons'
import type { UploadFile, UploadProps } from 'antd'
import { useSidebarHover } from '../../context/SidebarContext'
import useAuthStore from '../../store/authStore'
import {
  getForums, createForum, dissolveForum, joinForum, leaveForum,
  getMembers, setAdmin, removeAdmin, removeMember,
  getJoinRequests, respondRequest,
  getTopics, createTopic, deleteTopic, likeTopic, pinTopic,
  getComments, createComment, deleteComment,
  type ApiForum, type ApiMember, type ApiTopic, type ApiComment, type ApiJoinRequest,
} from '../../api/forum'
import {
  fetchNotifications, fetchUnreadCount, fetchManagementRequests,
  markNotifRead, markAllNotifRead,
  type ApiNotification, type ApiManagementRequest,
} from '../../api/notifications'
import { sendFriendRequest } from '../../api/friends'

const INDUSTRY_OPTIONS = ['互联网', '金融', '教育', '医疗', '制造', '零售', '传媒', '法律', '其他']
const COLOR_OPTIONS = [
  '#667eea', '#fa709a', '#43e97b', '#f6a623', '#4facfe',
  '#a18cd1', '#ff9a9e', '#0ba360', '#f093fb', '#c471ed',
]

type MainTab = 'topics' | 'members' | 'requests'
type NotifTab = 'like' | 'comment' | 'at' | 'management'
type SortMode = 'latest' | 'hot' | 'comments'

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return '刚刚'
  if (m < 60) return `${m}分钟前`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}小时前`
  const d = Math.floor(h / 24)
  return `${d}天前`
}

function AvatarCircle({ name, avatar, size = 36, color = '#667eea' }: { name: string; avatar?: string; size?: number; color?: string }) {
  if (avatar) {
    return <img src={`/uploads/avatars/${avatar}`} alt={name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
  }
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: size * 0.4, flexShrink: 0 }}>
      {name?.[0]?.toUpperCase() || 'U'}
    </div>
  )
}

export default function ForumPage() {
  const { user } = useAuthStore()
  const sidebarHovered = useSidebarHover()

  // ── State ──────────────────────────────────────────────────────────────────
  const [forums, setForums] = useState<ApiForum[]>([])
  const [forumsLoading, setForumsLoading] = useState(true)

  const [activeForum, setActiveForum] = useState<ApiForum | null>(null)
  const [mainTab, setMainTab] = useState<MainTab>('topics')

  // Topics
  const [topics, setTopics] = useState<ApiTopic[]>([])
  const [topicsLoading, setTopicsLoading] = useState(false)
  const [activeTopic, setActiveTopic] = useState<ApiTopic | null>(null)
  const [sortMode, setSortMode] = useState<SortMode>('latest')
  const [topicSearch, setTopicSearch] = useState('')

  // Comments
  const [comments, setComments] = useState<ApiComment[]>([])
  const [commentsLoading, setCommentsLoading] = useState(false)
  const [commentInput, setCommentInput] = useState('')
  const [commentSubmitting, setCommentSubmitting] = useState(false)

  // Members
  const [members, setMembers] = useState<ApiMember[]>([])
  const [membersLoading, setMembersLoading] = useState(false)

  // Join Requests
  const [joinRequests, setJoinRequests] = useState<ApiJoinRequest[]>([])
  const [requestsLoading, setRequestsLoading] = useState(false)

  // Discover panel
  const [showDiscover, setShowDiscover] = useState(false)

  // Modals
  const [createForumOpen, setCreateForumOpen] = useState(false)
  const [createForumLoading, setCreateForumLoading] = useState(false)
  const [createForumForm] = Form.useForm()
  const [forumColor, setForumColor] = useState(COLOR_OPTIONS[0])
  const [forumPrivate, setForumPrivate] = useState(true)

  const [createTopicOpen, setCreateTopicOpen] = useState(false)
  const [createTopicLoading, setCreateTopicLoading] = useState(false)
  const [createTopicForm] = Form.useForm()
  const [topicImages, setTopicImages] = useState<UploadFile[]>([])

  // Notifications
  const [notifPanelOpen, setNotifPanelOpen] = useState(false)
  const [notifTab, setNotifTab] = useState<NotifTab>('like')
  const [notifications, setNotifications] = useState<ApiNotification[]>([])
  const [mgmtRequests, setMgmtRequests] = useState<ApiManagementRequest[]>([])
  const [unreadCount, setUnreadCount] = useState({ notifCount: 0, requestCount: 0, total: 0 })
  const [notifLoading, setNotifLoading] = useState(false)
  const bellRef = useRef<HTMLButtonElement>(null)
  const notifPanelRef = useRef<HTMLDivElement>(null)
  const [bellRect, setBellRect] = useState<DOMRect | null>(null)

  // ── Load forums ────────────────────────────────────────────────────────────
  const loadForums = useCallback(async () => {
    try {
      setForumsLoading(true)
      const res = await getForums()
      setForums(res.data.forums)
    } catch {
      message.error('加载论坛失败')
    } finally {
      setForumsLoading(false)
    }
  }, [])

  useEffect(() => { loadForums() }, [loadForums])

  // ── Poll unread count ──────────────────────────────────────────────────────
  const loadUnreadCount = useCallback(async () => {
    try {
      const res = await fetchUnreadCount()
      setUnreadCount(res.data)
    } catch {
      // silently ignore
    }
  }, [])

  useEffect(() => {
    loadUnreadCount()
    const timer = setInterval(loadUnreadCount, 30000)
    return () => clearInterval(timer)
  }, [loadUnreadCount])

  // ── Close notif panel on outside click ────────────────────────────────────
  useEffect(() => {
    if (!notifPanelOpen) return
    const handler = (e: MouseEvent) => {
      if (
        notifPanelRef.current && !notifPanelRef.current.contains(e.target as Node) &&
        bellRef.current && !bellRef.current.contains(e.target as Node)
      ) {
        setNotifPanelOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [notifPanelOpen])

  // ── Load notification data ─────────────────────────────────────────────────
  const loadNotifData = useCallback(async () => {
    try {
      setNotifLoading(true)
      const [notifRes, mgmtRes] = await Promise.all([
        fetchNotifications(),
        fetchManagementRequests(),
      ])
      setNotifications(notifRes.data.notifications)
      setMgmtRequests(mgmtRes.data.requests)
    } catch {
      // silently ignore
    } finally {
      setNotifLoading(false)
    }
  }, [])

  const handleBellClick = () => {
    if (!notifPanelOpen) {
      if (bellRef.current) setBellRect(bellRef.current.getBoundingClientRect())
      loadNotifData()
    }
    setNotifPanelOpen((prev) => !prev)
  }

  const handleMarkAllRead = async () => {
    try {
      await markAllNotifRead()
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
      loadUnreadCount()
    } catch {
      message.error('操作失败')
    }
  }

  const handleMarkOneRead = async (id: string) => {
    try {
      await markNotifRead(id)
      setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n))
      loadUnreadCount()
    } catch {
      // silently ignore
    }
  }

  const handleMgmtRespond = async (forumId: string, reqId: string, action: 'approve' | 'reject') => {
    try {
      await respondRequest(forumId, reqId, action)
      setMgmtRequests((prev) => prev.filter((r) => r.id !== reqId))
      loadUnreadCount()
      if (action === 'approve') loadForums()
    } catch (err: any) {
      message.error(err.response?.data?.message || '操作失败')
    }
  }

  // ── Load topics ────────────────────────────────────────────────────────────
  const loadTopics = useCallback(async (forumId: string) => {
    try {
      setTopicsLoading(true)
      setActiveTopic(null)
      const res = await getTopics(forumId)
      setTopics(res.data.topics)
    } catch {
      message.error('加载话题失败')
    } finally {
      setTopicsLoading(false)
    }
  }, [])

  // ── Load members ───────────────────────────────────────────────────────────
  const loadMembers = useCallback(async (forumId: string) => {
    try {
      setMembersLoading(true)
      const res = await getMembers(forumId)
      setMembers(res.data.members)
    } catch {
      message.error('加载成员失败')
    } finally {
      setMembersLoading(false)
    }
  }, [])

  // ── Load join requests ─────────────────────────────────────────────────────
  const loadRequests = useCallback(async (forumId: string) => {
    try {
      setRequestsLoading(true)
      const res = await getJoinRequests(forumId)
      setJoinRequests(res.data.requests)
    } catch {
      message.error('加载申请失败')
    } finally {
      setRequestsLoading(false)
    }
  }, [])

  // ── Load comments ──────────────────────────────────────────────────────────
  const loadComments = useCallback(async (topicId: string) => {
    try {
      setCommentsLoading(true)
      const res = await getComments(topicId)
      setComments(res.data.comments)
    } catch {
      message.error('加载评论失败')
    } finally {
      setCommentsLoading(false)
    }
  }, [])

  // ── Select forum ───────────────────────────────────────────────────────────
  const handleSelectForum = (forum: ApiForum) => {
    setActiveForum(forum)
    setMainTab('topics')
    setShowDiscover(false)
    setActiveTopic(null)
    setComments([])
    setTopicSearch('')
    setSortMode('latest')
    loadTopics(forum.id)
  }

  // ── Tab switch ─────────────────────────────────────────────────────────────
  const handleTabChange = (tab: MainTab) => {
    setMainTab(tab)
    setActiveTopic(null)
    if (!activeForum) return
    if (tab === 'members') loadMembers(activeForum.id)
    if (tab === 'requests') loadRequests(activeForum.id)
  }

  // ── Select topic ───────────────────────────────────────────────────────────
  const handleSelectTopic = (topic: ApiTopic) => {
    setActiveTopic(topic)
    loadComments(topic.id)
  }

  // ── Like topic ─────────────────────────────────────────────────────────────
  const handleLike = async (topic: ApiTopic, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      const res = await likeTopic(topic.id)
      const update = (t: ApiTopic) =>
        t.id === topic.id ? { ...t, isLiked: res.data.isLiked, likeCount: res.data.likeCount } : t
      setTopics((prev) => prev.map(update))
      if (activeTopic?.id === topic.id) setActiveTopic((prev) => prev ? update(prev) : prev)
    } catch {
      message.error('操作失败')
    }
  }

  // ── Pin topic ──────────────────────────────────────────────────────────────
  const handlePin = async (topic: ApiTopic, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      const res = await pinTopic(topic.id)
      const update = (t: ApiTopic) =>
        t.id === topic.id ? { ...t, isPinned: res.data.isPinned } : t
      setTopics((prev) => prev.map(update))
      if (activeTopic?.id === topic.id) setActiveTopic((prev) => prev ? update(prev) : prev)
    } catch {
      message.error('置顶操作失败')
    }
  }

  // ── Delete topic ───────────────────────────────────────────────────────────
  const handleDeleteTopic = async (topicId: string) => {
    try {
      await deleteTopic(topicId)
      setTopics((prev) => prev.filter((t) => t.id !== topicId))
      if (activeTopic?.id === topicId) setActiveTopic(null)
      message.success('删除成功')
    } catch {
      message.error('删除失败')
    }
  }

  // ── Submit comment ─────────────────────────────────────────────────────────
  const handleSubmitComment = async () => {
    if (!activeTopic || !commentInput.trim()) return
    try {
      setCommentSubmitting(true)
      const res = await createComment(activeTopic.id, commentInput.trim())
      setComments((prev) => [...prev, res.data.comment])
      setCommentInput('')
      // Update comment count
      const update = (t: ApiTopic) =>
        t.id === activeTopic.id ? { ...t, commentCount: t.commentCount + 1 } : t
      setTopics((prev) => prev.map(update))
      setActiveTopic((prev) => prev ? { ...prev, commentCount: prev.commentCount + 1 } : prev)
    } catch {
      message.error('评论失败')
    } finally {
      setCommentSubmitting(false)
    }
  }

  // ── Delete comment ─────────────────────────────────────────────────────────
  const handleDeleteComment = async (commentId: string) => {
    if (!activeTopic) return
    try {
      await deleteComment(activeTopic.id, commentId)
      setComments((prev) => prev.filter((c) => c.id !== commentId))
      const update = (t: ApiTopic) =>
        t.id === activeTopic.id ? { ...t, commentCount: Math.max(0, t.commentCount - 1) } : t
      setTopics((prev) => prev.map(update))
      setActiveTopic((prev) => prev ? { ...prev, commentCount: Math.max(0, prev.commentCount - 1) } : prev)
      message.success('删除成功')
    } catch {
      message.error('删除失败')
    }
  }

  // ── Join / Leave forum ─────────────────────────────────────────────────────
  const handleJoin = async (forum: ApiForum) => {
    try {
      const res = await joinForum(forum.id)
      message.success(res.data.message || '操作成功')
      loadForums()
    } catch (err: any) {
      message.error(err.response?.data?.message || '操作失败')
    }
  }

  const handleLeave = async () => {
    if (!activeForum) return
    try {
      await leaveForum(activeForum.id)
      message.success('已退出论坛')
      setActiveForum(null)
      loadForums()
    } catch (err: any) {
      message.error(err.response?.data?.message || '操作失败')
    }
  }

  const handleDissolve = async () => {
    if (!activeForum) return
    try {
      await dissolveForum(activeForum.id)
      message.success('论坛已解散')
      setActiveForum(null)
      setTopics([])
      setMembers([])
      setJoinRequests([])
      loadForums()
    } catch (err: any) {
      message.error(err.response?.data?.message || '解散失败')
    }
  }

  // ── Member actions ─────────────────────────────────────────────────────────
  const handleSetAdmin = async (memberId: string) => {
    if (!activeForum) return
    try {
      await setAdmin(activeForum.id, memberId)
      message.success('设置成功')
      loadMembers(activeForum.id)
    } catch (err: any) {
      message.error(err.response?.data?.message || '操作失败')
    }
  }

  const handleRemoveAdmin = async (memberId: string) => {
    if (!activeForum) return
    try {
      await removeAdmin(activeForum.id, memberId)
      message.success('已移除管理员')
      loadMembers(activeForum.id)
    } catch (err: any) {
      message.error(err.response?.data?.message || '操作失败')
    }
  }

  const handleRemoveMember = async (memberId: string) => {
    if (!activeForum) return
    try {
      await removeMember(activeForum.id, memberId)
      message.success('已移除成员')
      loadMembers(activeForum.id)
    } catch (err: any) {
      message.error(err.response?.data?.message || '操作失败')
    }
  }

  const handleAddFriend = async (member: ApiMember) => {
    try {
      await sendFriendRequest(member.id)
      message.success(`已向 ${member.username} 发送好友申请`)
    } catch (err: any) {
      message.error(err.response?.data?.message || '发送失败')
    }
  }

  // ── Join requests ──────────────────────────────────────────────────────────
  const handleRespond = async (reqId: string, action: 'approve' | 'reject') => {
    if (!activeForum) return
    try {
      const res = await respondRequest(activeForum.id, reqId, action)
      message.success(res.data.message || '操作成功')
      setJoinRequests((prev) => prev.filter((r) => r.id !== reqId))
      if (action === 'approve') loadForums()
    } catch (err: any) {
      message.error(err.response?.data?.message || '操作失败')
    }
  }

  // ── Create forum ───────────────────────────────────────────────────────────
  const handleCreateForum = async () => {
    try {
      const values = await createForumForm.validateFields()
      setCreateForumLoading(true)
      const res = await createForum({ ...values, color: forumColor, isPrivate: forumPrivate })
      const newForum = res.data.forum
      setCreateForumOpen(false)
      createForumForm.resetFields()
      setForumColor(COLOR_OPTIONS[0])
      setForumPrivate(true)
      message.success('论坛创建成功')
      setForums((prev) => [newForum, ...prev.filter((f) => f.id !== newForum.id)])
      handleSelectForum(newForum)
      loadForums()
    } catch (err: any) {
      if (err.response) message.error(err.response.data?.message || '创建失败')
    } finally {
      setCreateForumLoading(false)
    }
  }

  // ── Create topic ───────────────────────────────────────────────────────────
  const handleCreateTopic = async () => {
    if (!activeForum) return
    try {
      const values = await createTopicForm.validateFields()
      setCreateTopicLoading(true)
      const formData = new FormData()
      formData.append('forumId', activeForum.id)
      formData.append('title', values.title)
      formData.append('content', values.content || '')
      topicImages.forEach((f) => {
        if (f.originFileObj) formData.append('images', f.originFileObj)
      })
      const res = await createTopic(formData)
      setTopics((prev) => [res.data.topic, ...prev])
      setCreateTopicOpen(false)
      createTopicForm.resetFields()
      setTopicImages([])
      message.success('发布成功')
    } catch (err: any) {
      if (err.response) message.error(err.response.data?.message || '发布失败')
    } finally {
      setCreateTopicLoading(false)
    }
  }

  // ── Derived data ───────────────────────────────────────────────────────────
  const joinedForums = forums.filter((f) => f.isMember)
  const unjoinedForums = forums.filter((f) => !f.isMember)
  const isOwnerOrAdmin = activeForum
    ? (activeForum.isOwner || activeForum.isAdmin)
    : false

  const uid = user?.id || ''

  // ── Sorted + filtered topics ───────────────────────────────────────────────
  const sortedFilteredTopics = (() => {
    let filtered = topics
    if (topicSearch.trim()) {
      const q = topicSearch.trim().toLowerCase()
      filtered = filtered.filter((t) =>
        t.title.toLowerCase().includes(q) || t.content.toLowerCase().includes(q)
      )
    }
    const pinned = filtered.filter((t) => t.isPinned)
    const unpinned = filtered.filter((t) => !t.isPinned)
    const sortFn = (a: ApiTopic, b: ApiTopic) => {
      if (sortMode === 'hot') return b.likeCount - a.likeCount
      if (sortMode === 'comments') return b.commentCount - a.commentCount
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    }
    return [...pinned.sort(sortFn), ...unpinned.sort(sortFn)]
  })()

  // ── Notification counts ────────────────────────────────────────────────────
  const likeNotifs = notifications.filter((n) => n.type === 'like')
  const commentNotifs = notifications.filter((n) => n.type === 'comment')
  const unreadLike = likeNotifs.filter((n) => !n.read).length
  const unreadComment = commentNotifs.filter((n) => !n.read).length

  // ── Upload props ───────────────────────────────────────────────────────────
  const uploadProps: UploadProps = {
    fileList: topicImages,
    beforeUpload: () => false,
    onChange: ({ fileList }) => setTopicImages(fileList),
    accept: 'image/*',
    listType: 'picture-card',
    multiple: true,
    maxCount: 9,
  }

  // ── Notification panel position ────────────────────────────────────────────
  const panelStyle: React.CSSProperties = bellRect
    ? {
        position: 'fixed',
        top: bellRect.bottom + 8,
        left: Math.min(bellRect.left, window.innerWidth - 396),
        width: 380,
        maxHeight: 540,
        zIndex: 9999,
        background: '#fff',
        borderRadius: 12,
        boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }
    : { display: 'none' }

  // ──────────────────────────────────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flex: 1, height: '100vh', overflow: 'hidden' }}>

      {/* ── Left: Forum Nav ────────────────────────────────────────────────── */}
      <div style={{
        width: sidebarHovered ? 94 : 240,
        borderRight: '1px solid #d0d3de',
        background: '#fff',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        overflowX: 'hidden',
        transition: 'width 0.25s cubic-bezier(0.4,0,0.2,1)',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 16px 12px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
          <h3 style={{ fontSize: 17, fontWeight: 700, color: '#1a1a2e', margin: 0, whiteSpace: 'nowrap' }}>论坛</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <Tooltip title="通知">
              <Badge count={unreadCount.total} size="small" offset={[-2, 2]}>
                <button
                  ref={bellRef}
                  onClick={handleBellClick}
                  style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid #e5e7eb', background: notifPanelOpen ? '#f0f0ff' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
                >
                  <BellOutlined style={{ fontSize: 14, color: '#667eea' }} />
                </button>
              </Badge>
            </Tooltip>
            <Tooltip title="创建论坛">
              <button
                onClick={() => setCreateForumOpen(true)}
                style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
              >
                <PlusOutlined style={{ fontSize: 14, color: '#667eea' }} />
              </button>
            </Tooltip>
          </div>
        </div>

        {/* Forum list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {forumsLoading ? (
            <div style={{ textAlign: 'center', padding: 20 }}><Spin size="small" /></div>
          ) : (
            <>
              {joinedForums.map((forum) => (
                <div
                  key={forum.id}
                  onClick={() => handleSelectForum(forum)}
                  className={`forum-nav-item ${activeForum?.id === forum.id && !showDiscover ? 'forum-nav-item-active' : ''}`}
                  style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', cursor: 'pointer' }}
                >
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: forum.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#fff', fontSize: 14, fontWeight: 700 }}>
                    {forum.name[0]}
                  </div>
                  <div style={{ marginLeft: 10, overflow: 'hidden', flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{forum.name}</div>
                    <div style={{ fontSize: 11, color: '#9ca3af', whiteSpace: 'nowrap' }}>{forum.memberCount} 成员 {forum.isPrivate ? '🔒' : ''}</div>
                  </div>
                </div>
              ))}
              {joinedForums.length === 0 && (
                <div style={{ padding: '16px', fontSize: 12, color: '#9ca3af', textAlign: 'center' }}>还没有加入论坛</div>
              )}
            </>
          )}
        </div>

        {/* Discover button */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid #f0f0f0' }}>
          <Button
            icon={<AppstoreOutlined />}
            size="small"
            block
            onClick={() => { setShowDiscover(true); setActiveForum(null) }}
            style={{ borderRadius: 20, fontSize: 12, color: '#667eea', borderColor: '#667eea' }}
          >
            <span>发现论坛</span>
          </Button>
        </div>
      </div>

      {/* ── Notification Panel (Portal) ────────────────────────────────────── */}
      {notifPanelOpen && createPortal(
        <div ref={notifPanelRef} style={panelStyle}>
          {/* Panel header */}
          <div style={{ padding: '14px 16px 0', borderBottom: '1px solid #f0f0f0', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e' }}>通知</span>
              <button
                onClick={handleMarkAllRead}
                style={{ fontSize: 12, color: '#667eea', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 8px', borderRadius: 8, transition: 'background 0.15s' }}
              >
                全部已读
              </button>
            </div>
            {/* Tabs */}
            <div style={{ display: 'flex', gap: 0 }}>
              {([
                { key: 'like' as NotifTab, label: '谁赞了我', count: unreadLike },
                { key: 'comment' as NotifTab, label: '收到评论', count: unreadComment },
                { key: 'at' as NotifTab, label: '收到@', count: 0 },
                { key: 'management' as NotifTab, label: '论坛管理', count: unreadCount.requestCount },
              ]).map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setNotifTab(tab.key)}
                  style={{
                    padding: '8px 12px',
                    background: 'none',
                    border: 'none',
                    borderBottom: notifTab === tab.key ? '2px solid #667eea' : '2px solid transparent',
                    cursor: 'pointer',
                    fontSize: 13,
                    color: notifTab === tab.key ? '#667eea' : '#6b7280',
                    fontWeight: notifTab === tab.key ? 600 : 400,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {tab.label}
                  {tab.count > 0 && (
                    <span style={{ background: '#ff4d4f', color: '#fff', borderRadius: 10, fontSize: 10, padding: '0 5px', lineHeight: '16px', minWidth: 16, textAlign: 'center' }}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Panel body */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {notifLoading ? (
              <div style={{ textAlign: 'center', padding: 32 }}><Spin size="small" /></div>
            ) : notifTab === 'like' ? (
              likeNotifs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 32, color: '#9ca3af', fontSize: 13 }}>暂无点赞通知</div>
              ) : (
                likeNotifs.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => handleMarkOneRead(n.id)}
                    style={{ padding: '12px 16px', display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', background: n.read ? '#fff' : '#f5f6ff', borderBottom: '1px solid #f9fafb', transition: 'background 0.15s' }}
                  >
                    {!n.read && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#667eea', flexShrink: 0, marginTop: 6 }} />}
                    {n.read && <div style={{ width: 8, flexShrink: 0 }} />}
                    <AvatarCircle name={n.fromUser.username} avatar={n.fromUser.avatar} size={36} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: '#374151' }}>
                        <span style={{ fontWeight: 600, color: '#1a1a2e' }}>{n.fromUser.username}</span>
                        {' 赞了你的话题'}
                      </div>
                      {n.topicTitle && (
                        <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {n.topicTitle}
                        </div>
                      )}
                      <div style={{ fontSize: 11, color: '#c0c0c0', marginTop: 2 }}>{timeAgo(n.createdAt)}</div>
                    </div>
                  </div>
                ))
              )
            ) : notifTab === 'comment' ? (
              commentNotifs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 32, color: '#9ca3af', fontSize: 13 }}>暂无评论通知</div>
              ) : (
                commentNotifs.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => handleMarkOneRead(n.id)}
                    style={{ padding: '12px 16px', display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', background: n.read ? '#fff' : '#f5f6ff', borderBottom: '1px solid #f9fafb', transition: 'background 0.15s' }}
                  >
                    {!n.read && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#667eea', flexShrink: 0, marginTop: 6 }} />}
                    {n.read && <div style={{ width: 8, flexShrink: 0 }} />}
                    <AvatarCircle name={n.fromUser.username} avatar={n.fromUser.avatar} size={36} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: '#374151' }}>
                        <span style={{ fontWeight: 600, color: '#1a1a2e' }}>{n.fromUser.username}</span>
                        {' 评论了你的话题'}
                      </div>
                      {n.topicTitle && (
                        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {n.topicTitle}
                        </div>
                      )}
                      {n.commentContent && (
                        <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          "{n.commentContent}"
                        </div>
                      )}
                      <div style={{ fontSize: 11, color: '#c0c0c0', marginTop: 2 }}>{timeAgo(n.createdAt)}</div>
                    </div>
                  </div>
                ))
              )
            ) : notifTab === 'at' ? (
              <div style={{ textAlign: 'center', padding: 32, color: '#9ca3af', fontSize: 13 }}>暂未实现</div>
            ) : (
              /* management */
              mgmtRequests.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 32, color: '#9ca3af', fontSize: 13 }}>暂无待处理的申请</div>
              ) : (
                mgmtRequests.map((r) => (
                  <div key={r.id} style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid #f9fafb' }}>
                    <AvatarCircle name={r.user.username} avatar={r.user.avatar} size={36} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.user.username}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                        <span style={{ fontSize: 11, background: r.forum.color, color: '#fff', padding: '1px 6px', borderRadius: 8 }}>{r.forum.name}</span>
                        <span style={{ fontSize: 11, color: '#9ca3af' }}>{timeAgo(r.createdAt)}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <Button size="small" type="primary" icon={<CheckOutlined />} onClick={() => handleMgmtRespond(r.forum.id, r.id, 'approve')} style={{ background: '#667eea', border: 'none', borderRadius: 12, fontSize: 12 }}>同意</Button>
                      <Button size="small" danger icon={<CloseOutlined />} onClick={() => handleMgmtRespond(r.forum.id, r.id, 'reject')} style={{ borderRadius: 12, fontSize: 12 }}>拒绝</Button>
                    </div>
                  </div>
                ))
              )
            )}
          </div>
        </div>,
        document.body
      )}

      {/* ── Main Area ──────────────────────────────────────────────────────── */}
      {showDiscover ? (
        /* Discover Panel */
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#f5f6fa', overflow: 'hidden' }}>
          <div style={{ background: '#fff', borderBottom: '1px solid #d0d3de', padding: '0 32px', height: 64, display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
            <button onClick={() => setShowDiscover(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#667eea', fontSize: 14 }}>
              <LeftOutlined style={{ marginRight: 4 }} /> 返回
            </button>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#1a1a2e' }}>发现论坛</div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 32px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
              {forums.map((forum) => (
                <div key={forum.id} style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
                  <div style={{ height: 6, background: forum.color }} />
                  <div style={{ padding: '16px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                      <div style={{ width: 44, height: 44, borderRadius: 10, background: forum.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 18 }}>
                        {forum.name[0]}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 15, color: '#1a1a2e', display: 'flex', alignItems: 'center', gap: 6 }}>
                          {forum.name}
                          {forum.isPrivate && <LockOutlined style={{ fontSize: 12, color: '#9ca3af' }} />}
                        </div>
                        <div style={{ fontSize: 12, color: '#9ca3af' }}>{forum.industry} · {forum.memberCount} 成员</div>
                      </div>
                    </div>
                    <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 12, minHeight: 36, lineHeight: 1.6 }}>{forum.description || '暂无简介'}</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                      {(forum.tags || []).map((t) => (
                        <span key={t} style={{ fontSize: 11, color: '#667eea', background: '#eef0ff', padding: '2px 8px', borderRadius: 10 }}>#{t}</span>
                      ))}
                    </div>
                    {forum.isMember ? (
                      <Button size="small" block style={{ borderRadius: 20 }} onClick={() => handleSelectForum(forum)}>进入论坛</Button>
                    ) : forum.isPending ? (
                      <Button size="small" block disabled style={{ borderRadius: 20 }}>申请中...</Button>
                    ) : (
                      <Button size="small" type="primary" block style={{ borderRadius: 20, background: '#667eea', border: 'none' }} onClick={() => handleJoin(forum)}>
                        {forum.isPrivate ? '申请加入' : '加入'}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              {forums.length === 0 && !forumsLoading && (
                <div style={{ gridColumn: '1/-1', textAlign: 'center', color: '#9ca3af', padding: 40 }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>🏛️</div>
                  还没有论坛，来创建第一个吧
                </div>
              )}
            </div>
          </div>
        </div>
      ) : activeForum ? (
        /* Forum Detail */
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#f5f6fa' }}>

          {/* Forum Header */}
          <div style={{ background: '#fff', borderBottom: '1px solid #d0d3de', padding: '0 24px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: activeForum.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 16 }}>
                {activeForum.name[0]}
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#1a1a2e', display: 'flex', alignItems: 'center', gap: 6 }}>
                  {activeForum.name}
                  {activeForum.isPrivate && <LockOutlined style={{ fontSize: 13, color: '#9ca3af' }} />}
                  {activeForum.isOwner && <Tag color="gold" style={{ fontSize: 11, marginLeft: 4 }}>群主</Tag>}
                  {activeForum.isAdmin && !activeForum.isOwner && <Tag color="blue" style={{ fontSize: 11, marginLeft: 4 }}>管理员</Tag>}
                </div>
                <div style={{ fontSize: 12, color: '#9ca3af' }}>{activeForum.memberCount} 成员</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {activeForum.isOwner ? (
                <Popconfirm
                  title={
                    <div>
                      <div style={{ fontWeight: 600, marginBottom: 4 }}>确认解散「{activeForum.name}」？</div>
                      <div style={{ fontSize: 12, color: '#9ca3af' }}>所有话题、评论、成员记录将被永久删除，无法恢复。</div>
                    </div>
                  }
                  onConfirm={handleDissolve}
                  okText="确认解散"
                  cancelText="取消"
                  okButtonProps={{ danger: true }}
                >
                  <Button size="small" danger style={{ borderRadius: 16, fontSize: 12 }}>解散论坛</Button>
                </Popconfirm>
              ) : (
                <Popconfirm title="确认退出该论坛？" onConfirm={handleLeave} okText="退出" cancelText="取消">
                  <Button size="small" danger style={{ borderRadius: 16, fontSize: 12 }}>退出论坛</Button>
                </Popconfirm>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div style={{ background: '#fff', borderBottom: '1px solid #d0d3de', padding: '0 24px', display: 'flex', alignItems: 'center', gap: 0, flexShrink: 0 }}>
            {([
              { key: 'topics', label: '话题', icon: <CommentOutlined /> },
              { key: 'members', label: '成员', icon: <TeamOutlined /> },
              ...(isOwnerOrAdmin ? [{ key: 'requests', label: `申请${joinRequests.length > 0 ? ` (${joinRequests.length})` : ''}`, icon: <SettingOutlined /> }] : []),
            ] as { key: MainTab; label: string; icon: React.ReactNode }[]).map((tab) => (
              <button
                key={tab.key}
                onClick={() => handleTabChange(tab.key)}
                style={{ padding: '12px 20px', background: 'none', border: 'none', borderBottom: mainTab === tab.key ? '2px solid #667eea' : '2px solid transparent', cursor: 'pointer', fontSize: 14, color: mainTab === tab.key ? '#667eea' : '#6b7280', fontWeight: mainTab === tab.key ? 600 : 400, display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.15s' }}
              >
                {tab.icon}{tab.label}
              </button>
            ))}

            {mainTab === 'topics' && (
              <div style={{ marginLeft: 'auto' }}>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  size="small"
                  onClick={() => setCreateTopicOpen(true)}
                  style={{ background: '#667eea', border: 'none', borderRadius: 16, fontSize: 13 }}
                >
                  发帖
                </Button>
              </div>
            )}
          </div>

          {/* Tab Content */}
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

            {/* ── Topics Tab ── */}
            {mainTab === 'topics' && (
              <>
                {/* Topic List */}
                <div style={{ width: activeTopic ? 380 : '100%', flexShrink: 0, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 12, transition: 'width 0.2s' }}>
                  {/* Search + Sort toolbar */}
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                    <Input
                      placeholder="搜索话题..."
                      value={topicSearch}
                      onChange={(e) => setTopicSearch(e.target.value)}
                      style={{ borderRadius: 20, fontSize: 13, flex: 1 }}
                      allowClear
                    />
                    <Select
                      value={sortMode}
                      onChange={(v) => setSortMode(v)}
                      style={{ width: 96 }}
                      size="small"
                      options={[
                        { value: 'latest', label: '最新' },
                        { value: 'hot', label: '最热' },
                        { value: 'comments', label: '最多评论' },
                      ]}
                    />
                  </div>

                  {topicsLoading ? (
                    <div style={{ textAlign: 'center', paddingTop: 60 }}><Spin /></div>
                  ) : sortedFilteredTopics.length === 0 ? (
                    <div style={{ textAlign: 'center', paddingTop: 80, color: '#9ca3af', fontSize: 14 }}>
                      <div style={{ fontSize: 40, marginBottom: 12 }}>📝</div>
                      {topicSearch ? '没有找到相关话题' : '还没有话题，来发第一帖吧'}
                    </div>
                  ) : (
                    sortedFilteredTopics.map((topic) => {
                      const isActive = activeTopic?.id === topic.id
                      const canDelete = topic.creator.id === uid || activeForum.isOwner || activeForum.isAdmin
                      return (
                        <div
                          key={topic.id}
                          onClick={() => handleSelectTopic(topic)}
                          style={{ background: '#fff', borderRadius: 12, padding: '16px 20px', boxShadow: isActive ? '0 0 0 2px #667eea' : '0 1px 6px rgba(0,0,0,0.06)', cursor: 'pointer', transition: 'all 0.15s' }}
                        >
                          {/* Pinned tag */}
                          {topic.isPinned && (
                            <div style={{ marginBottom: 6 }}>
                              <span style={{ fontSize: 11, color: '#667eea', background: '#eef0ff', padding: '2px 8px', borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                <PushpinFilled style={{ fontSize: 10 }} /> 置顶
                              </span>
                            </div>
                          )}

                          {/* Creator row */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <AvatarCircle name={topic.creator.username} avatar={topic.creator.avatar} size={32} />
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e' }}>{topic.creator.username}</div>
                                <div style={{ fontSize: 11, color: '#9ca3af' }}>{timeAgo(topic.createdAt)}</div>
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              {isOwnerOrAdmin && (
                                <Tooltip title={topic.isPinned ? '取消置顶' : '置顶话题'}>
                                  <Button
                                    type="text"
                                    size="small"
                                    icon={topic.isPinned ? <PushpinFilled style={{ color: '#667eea' }} /> : <PushpinOutlined style={{ color: '#9ca3af' }} />}
                                    style={{ fontSize: 12 }}
                                    onClick={(e) => handlePin(topic, e)}
                                  />
                                </Tooltip>
                              )}
                              {canDelete && (
                                <Popconfirm title="确认删除该话题？" onConfirm={() => handleDeleteTopic(topic.id)} okText="删除" cancelText="取消">
                                  <Button type="text" size="small" danger icon={<DeleteOutlined />} style={{ fontSize: 12 }} onClick={(e) => e.stopPropagation()} />
                                </Popconfirm>
                              )}
                            </div>
                          </div>

                          {/* Title & content */}
                          <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e', marginBottom: 6 }}>{topic.title}</div>
                          {topic.content && (
                            <div style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.6, marginBottom: 10, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                              {topic.content}
                            </div>
                          )}

                          {/* Images preview */}
                          {topic.images.length > 0 && (
                            <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
                              {topic.images.slice(0, 3).map((img, i) => (
                                <img key={i} src={`/uploads/topics/${img}`} alt="" style={{ width: 72, height: 72, borderRadius: 6, objectFit: 'cover' }} />
                              ))}
                              {topic.images.length > 3 && (
                                <div style={{ width: 72, height: 72, borderRadius: 6, background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: '#9ca3af' }}>+{topic.images.length - 3}</div>
                              )}
                            </div>
                          )}

                          {/* Actions */}
                          <div style={{ display: 'flex', gap: 20, borderTop: '1px solid #f9fafb', paddingTop: 10 }}>
                            <button onClick={(e) => handleLike(topic, e)} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: topic.isLiked ? '#667eea' : '#9ca3af', padding: 0 }}>
                              {topic.isLiked ? <LikeFilled /> : <LikeOutlined />} {topic.likeCount}
                            </button>
                            <button style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#9ca3af', padding: 0 }}>
                              <CommentOutlined /> {topic.commentCount}
                            </button>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>

                {/* Topic Detail Panel */}
                {activeTopic && (
                  <div style={{ flex: 1, borderLeft: '1px solid #e5e7eb', background: '#fff', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    {/* Detail Header */}
                    <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: 10 }}>
                      <button onClick={() => setActiveTopic(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#667eea', display: 'flex', alignItems: 'center' }}>
                        <LeftOutlined />
                      </button>
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{activeTopic.title}</div>
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
                      {/* Creator */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                        <AvatarCircle name={activeTopic.creator.username} avatar={activeTopic.creator.avatar} size={40} />
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a2e' }}>{activeTopic.creator.username}</div>
                          <div style={{ fontSize: 12, color: '#9ca3af' }}>{timeAgo(activeTopic.createdAt)}</div>
                        </div>
                      </div>

                      {/* Content */}
                      {activeTopic.content && (
                        <div style={{ fontSize: 14, color: '#374151', lineHeight: 1.8, marginBottom: 16, whiteSpace: 'pre-wrap' }}>{activeTopic.content}</div>
                      )}

                      {/* Images */}
                      {activeTopic.images.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                          {activeTopic.images.map((img, i) => (
                            <img key={i} src={`/uploads/topics/${img}`} alt="" style={{ maxWidth: '100%', maxHeight: 240, borderRadius: 8, objectFit: 'cover', cursor: 'zoom-in' }}
                              onClick={() => window.open(`/uploads/topics/${img}`, '_blank')}
                            />
                          ))}
                        </div>
                      )}

                      {/* Like row */}
                      <div style={{ display: 'flex', gap: 20, marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid #f0f0f0' }}>
                        <button onClick={(e) => handleLike(activeTopic, e)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: activeTopic.isLiked ? '#667eea' : '#9ca3af', padding: 0 }}>
                          {activeTopic.isLiked ? <LikeFilled style={{ fontSize: 18 }} /> : <LikeOutlined style={{ fontSize: 18 }} />}
                          <span>{activeTopic.likeCount} 赞</span>
                        </button>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, color: '#9ca3af' }}>
                          <CommentOutlined style={{ fontSize: 18 }} /> {activeTopic.commentCount} 评论
                        </span>
                      </div>

                      {/* Comments */}
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a2e', marginBottom: 12 }}>评论</div>
                      {commentsLoading ? (
                        <div style={{ textAlign: 'center', padding: 20 }}><Spin size="small" /></div>
                      ) : comments.length === 0 ? (
                        <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: 13, padding: '16px 0' }}>暂无评论，来发第一条吧</div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
                          {comments.map((c) => {
                            const canDeleteComment = c.creator.id === uid || activeForum.isOwner || activeForum.isAdmin || activeTopic.creator.id === uid
                            return (
                              <div key={c.id} style={{ display: 'flex', gap: 10 }}>
                                <AvatarCircle name={c.creator.username} avatar={c.creator.avatar} size={32} />
                                <div style={{ flex: 1, background: '#f9fafb', borderRadius: 8, padding: '10px 12px' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                                    <span style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e' }}>{c.creator.username}</span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                      <span style={{ fontSize: 11, color: '#9ca3af' }}>{timeAgo(c.createdAt)}</span>
                                      {canDeleteComment && (
                                        <Popconfirm title="删除该评论？" onConfirm={() => handleDeleteComment(c.id)} okText="删除" cancelText="取消">
                                          <Button type="text" size="small" danger icon={<DeleteOutlined />} style={{ fontSize: 11, padding: '0 4px', height: 20 }} />
                                        </Popconfirm>
                                      )}
                                    </div>
                                  </div>
                                  <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{c.content}</div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>

                    {/* Comment Input */}
                    <div style={{ padding: '12px 16px', borderTop: '1px solid #f0f0f0', display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                      <AvatarCircle name={user?.username || 'U'} size={32} />
                      <Input.TextArea
                        value={commentInput}
                        onChange={(e) => setCommentInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmitComment() } }}
                        placeholder="写下你的评论... (Enter 发送)"
                        autoSize={{ minRows: 1, maxRows: 4 }}
                        style={{ borderRadius: 8, fontSize: 13, flex: 1, resize: 'none' }}
                      />
                      <Button
                        type="primary"
                        icon={<SendOutlined />}
                        loading={commentSubmitting}
                        onClick={handleSubmitComment}
                        style={{ background: '#667eea', border: 'none', borderRadius: 8, height: 36 }}
                      />
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ── Members Tab ── */}
            {mainTab === 'members' && (
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
                {membersLoading ? (
                  <div style={{ textAlign: 'center', paddingTop: 60 }}><Spin /></div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {members.map((m) => {
                      const isMe = m.id === uid
                      const canManage = (activeForum.isOwner || activeForum.isAdmin) && !isMe
                      return (
                        <div key={m.id} style={{ background: '#fff', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                          <AvatarCircle name={m.username} avatar={m.avatar} size={40} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontSize: 14, fontWeight: 600, color: '#1a1a2e' }}>{m.username}</span>
                              {m.role === 'owner' && <Tag color="gold" icon={<CrownOutlined />} style={{ fontSize: 11 }}>群主</Tag>}
                              {m.role === 'admin' && <Tag color="blue" icon={<SafetyOutlined />} style={{ fontSize: 11 }}>管理员</Tag>}
                              {isMe && <Tag style={{ fontSize: 11 }}>我</Tag>}
                            </div>
                            <div style={{ fontSize: 12, color: '#9ca3af' }}>ID: {m.userId}</div>
                          </div>
                          <div style={{ display: 'flex', gap: 6 }}>
                            {!isMe && !m.isFriend && (
                              <Tooltip title="加好友">
                                <Button size="small" icon={<UserAddOutlined />} onClick={() => handleAddFriend(m)} style={{ borderRadius: 16, fontSize: 12, color: '#667eea', borderColor: '#667eea' }} />
                              </Tooltip>
                            )}
                            {canManage && activeForum.isOwner && (
                              m.role === 'admin' ? (
                                <Tooltip title="撤销管理员">
                                  <Popconfirm title={`撤销 ${m.username} 的管理员？`} onConfirm={() => handleRemoveAdmin(m.id)} okText="撤销" cancelText="取消">
                                    <Button size="small" icon={<SafetyOutlined />} style={{ borderRadius: 16, fontSize: 12, borderColor: '#faad14', color: '#faad14' }} />
                                  </Popconfirm>
                                </Tooltip>
                              ) : m.role !== 'owner' && (
                                <Tooltip title="设为管理员">
                                  <Popconfirm title={`设 ${m.username} 为管理员？`} onConfirm={() => handleSetAdmin(m.id)} okText="设置" cancelText="取消">
                                    <Button size="small" icon={<SafetyOutlined />} style={{ borderRadius: 16, fontSize: 12 }} />
                                  </Popconfirm>
                                </Tooltip>
                              )
                            )}
                            {canManage && m.role !== 'owner' && (
                              <Tooltip title="移出论坛">
                                <Popconfirm title={`将 ${m.username} 移出论坛？`} onConfirm={() => handleRemoveMember(m.id)} okText="移出" cancelText="取消">
                                  <Button size="small" danger icon={<DeleteOutlined />} style={{ borderRadius: 16, fontSize: 12 }} />
                                </Popconfirm>
                              </Tooltip>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── Requests Tab ── */}
            {mainTab === 'requests' && (
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
                {requestsLoading ? (
                  <div style={{ textAlign: 'center', paddingTop: 60 }}><Spin /></div>
                ) : joinRequests.length === 0 ? (
                  <div style={{ textAlign: 'center', paddingTop: 80, color: '#9ca3af', fontSize: 14 }}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
                    暂无待处理的申请
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {joinRequests.map((r) => (
                      <div key={r.id} style={{ background: '#fff', borderRadius: 10, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                        <AvatarCircle name={r.user.username} avatar={r.user.avatar} size={40} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a2e' }}>{r.user.username}</div>
                          <div style={{ fontSize: 12, color: '#9ca3af' }}>ID: {r.user.userId} · {timeAgo(r.createdAt)}</div>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <Button size="small" type="primary" icon={<CheckOutlined />} onClick={() => handleRespond(r.id, 'approve')} style={{ background: '#667eea', border: 'none', borderRadius: 16, fontSize: 12 }}>同意</Button>
                          <Button size="small" danger icon={<CloseOutlined />} onClick={() => handleRespond(r.id, 'reject')} style={{ borderRadius: 16, fontSize: 12 }}>拒绝</Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Empty state */
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f6fa', flexDirection: 'column', gap: 16 }}>
          <div style={{ fontSize: 64 }}>🏛️</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: '#1a1a2e' }}>欢迎来到论坛</div>
          <div style={{ fontSize: 14, color: '#9ca3af' }}>在左侧选择一个论坛，或加入新论坛</div>
          <div style={{ display: 'flex', gap: 12 }}>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateForumOpen(true)} style={{ background: '#667eea', border: 'none', borderRadius: 20 }}>创建论坛</Button>
            <Button icon={<AppstoreOutlined />} onClick={() => setShowDiscover(true)} style={{ borderRadius: 20 }}>发现论坛</Button>
          </div>
        </div>
      )}

      {/* ── Create Forum Modal ─────────────────────────────────────────────── */}
      <Modal
        title="创建论坛"
        open={createForumOpen}
        onCancel={() => { setCreateForumOpen(false); createForumForm.resetFields() }}
        onOk={handleCreateForum}
        confirmLoading={createForumLoading}
        okText="创建"
        cancelText="取消"
        okButtonProps={{ style: { background: '#667eea', border: 'none' } }}
        width={480}
      >
        <Form form={createForumForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label="论坛名称" rules={[{ required: true, message: '请输入论坛名称' }]}>
            <Input placeholder="给你的论坛起个名字" maxLength={30} showCount />
          </Form.Item>
          <Form.Item name="description" label="简介">
            <Input.TextArea placeholder="描述一下这个论坛..." maxLength={200} showCount autoSize={{ minRows: 2, maxRows: 4 }} />
          </Form.Item>
          <Form.Item name="industry" label="行业" rules={[{ required: true, message: '请选择行业' }]}>
            <Select placeholder="选择行业" options={INDUSTRY_OPTIONS.map((o) => ({ value: o, label: o }))} />
          </Form.Item>
          <Form.Item name="tags" label="标签">
            <Select mode="tags" placeholder="添加标签（回车确认）" maxTagCount={5} />
          </Form.Item>
          <Form.Item label="主题色">
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {COLOR_OPTIONS.map((c) => (
                <div
                  key={c}
                  onClick={() => setForumColor(c)}
                  style={{ width: 28, height: 28, borderRadius: '50%', background: c, cursor: 'pointer', border: forumColor === c ? '3px solid #1a1a2e' : '3px solid transparent', transition: 'border 0.15s' }}
                />
              ))}
            </div>
          </Form.Item>
          <Form.Item label="加入方式">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Switch
                checked={!forumPrivate}
                onChange={(open) => setForumPrivate(!open)}
              />
              <span style={{ fontSize: 13, color: forumPrivate ? '#374151' : '#667eea', fontWeight: 500 }}>
                {forumPrivate ? '🔒 需要群主/管理员审批才能加入（推荐）' : '🌐 任何人可直接加入，无需审批'}
              </span>
            </div>
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Create Topic Modal ─────────────────────────────────────────────── */}
      <Modal
        title={`发帖 · ${activeForum?.name || ''}`}
        open={createTopicOpen}
        onCancel={() => { setCreateTopicOpen(false); createTopicForm.resetFields(); setTopicImages([]) }}
        onOk={handleCreateTopic}
        confirmLoading={createTopicLoading}
        okText="发布"
        cancelText="取消"
        okButtonProps={{ style: { background: '#667eea', border: 'none' } }}
        width={560}
      >
        <Form form={createTopicForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入标题' }]}>
            <Input placeholder="给话题起一个标题" maxLength={100} showCount />
          </Form.Item>
          <Form.Item name="content" label="内容">
            <Input.TextArea placeholder="分享你的想法..." autoSize={{ minRows: 4, maxRows: 10 }} maxLength={5000} showCount />
          </Form.Item>
          <Form.Item label="图片（最多9张）">
            <Upload {...uploadProps}>
              {topicImages.length < 9 && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <PlusOutlined />
                  <div style={{ fontSize: 12 }}>上传图片</div>
                </div>
              )}
            </Upload>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
