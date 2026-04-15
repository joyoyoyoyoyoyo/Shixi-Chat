import { useState, useRef } from 'react'
import { useScrollRestore } from '../../hooks/useScrollRestore'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { Tag, Button, Badge, Input } from 'antd'
import {
  AppstoreOutlined, LikeOutlined, LikeFilled,
  CommentOutlined, ShareAltOutlined, PlusOutlined,
  BellOutlined, CheckOutlined, CloseOutlined, SendOutlined,
} from '@ant-design/icons'
import useForumStore from '../../store/forumStore'
import useNotifStore, { Notification } from '../../store/notificationStore'
import useAuthStore from '../../store/authStore'
import { ALL_FORUMS } from '../../data/forums'
import { useSidebarHover } from '../../context/SidebarContext'

const NOTIF_LABEL: Record<string, string> = {
  mention: '在帖子中提到了你',
  like: '赞了你的帖子',
  comment: '评论了你的帖子',
  join_request: '申请加入',
}
const NOTIF_COLOR: Record<string, string> = {
  mention: '#667eea', like: '#fa709a', comment: '#43e97b', join_request: '#f6a623',
}

type NotifTab = 'like' | 'comment' | 'mention' | 'join_request'
const NOTIF_TABS: { key: NotifTab; label: string }[] = [
  { key: 'like',         label: '谁赞了我' },
  { key: 'comment',      label: '收到评论' },
  { key: 'mention',      label: '收到@'   },
  { key: 'join_request', label: '论坛管理' },
]

export default function ForumPage() {
  const navigate = useNavigate()
  const { joinedIds, posts, comments, toggleLike, addComment } = useForumStore()
  const { notifications, markRead, markAllRead, handleRequest } = useNotifStore()
  const { user } = useAuthStore()
  const sidebarHovered = useSidebarHover()

  const [activeForumId, setActiveForumId] = useState<number | 'all'>('all')
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({})
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({})

  // 铃铛面板
  const [bellOpen, setBellOpen] = useState(false)
  const [bellPos, setBellPos] = useState({ top: 0, left: 0 })
  const [activeTab, setActiveTab] = useState<NotifTab>('like')
  const bellRef = useRef<HTMLButtonElement>(null)
  const feedScrollRef = useRef<HTMLDivElement>(null)
  const navScrollRef  = useRef<HTMLDivElement>(null)
  useScrollRestore('/forum-feed', feedScrollRef)
  useScrollRestore('/forum-nav',  navScrollRef)

  const unreadCount = notifications.filter((n) => !n.read).length
  const joinedForums = ALL_FORUMS.filter((f) => joinedIds.includes(f.id))
  const visiblePosts = posts.filter((p) =>
    activeForumId === 'all' ? joinedIds.includes(p.forumId) : p.forumId === activeForumId
  )
  const activeForumInfo = activeForumId !== 'all'
    ? ALL_FORUMS.find((f) => f.id === activeForumId) : null

  const handleBellClick = () => {
    if (bellRef.current) {
      const rect = bellRef.current.getBoundingClientRect()
      setBellPos({ top: rect.bottom + 8, left: rect.left })
    }
    setBellOpen((v) => !v)
  }

  const handleSendComment = (postId: string) => {
    const text = commentInputs[postId]?.trim()
    if (!text) return
    addComment(postId, text, {
      name: user?.username ?? '我',
      initial: user?.username?.[0]?.toUpperCase() ?? 'U',
      color: '#667eea',
    })
    setCommentInputs((prev) => ({ ...prev, [postId]: '' }))
  }

  const toggleComments = (postId: string) => {
    setExpandedComments((prev) => ({ ...prev, [postId]: !prev[postId] }))
  }

  return (
    <div style={{ display: 'flex', flex: 1, height: '100vh', overflow: 'hidden' }}>

      {/* ── 左侧论坛导航 ── */}
      <div style={{ width: sidebarHovered ? 94 : 240, borderRight: '1px solid #d0d3de', background: '#fff', display: 'flex', flexDirection: 'column', flexShrink: 0, overflowX: 'hidden', transition: 'width 0.25s cubic-bezier(0.4,0,0.2,1)' }}>
        <div style={{ padding: '20px 16px 12px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ fontSize: 17, fontWeight: 700, color: '#1a1a2e', margin: 0, whiteSpace: 'nowrap' }}>论坛</h3>
          <Badge count={unreadCount} size="small" offset={[-2, 2]}>
            <button
              ref={bellRef}
              onClick={handleBellClick}
              style={{ width: 30, height: 30, borderRadius: 8, border: bellOpen ? '1px solid #667eea' : '1px solid #e5e7eb', background: bellOpen ? '#eef0ff' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.15s', flexShrink: 0 }}
            >
              <BellOutlined style={{ fontSize: 15, color: bellOpen ? '#667eea' : '#9ca3af' }} />
            </button>
          </Badge>
        </div>

        <div ref={navScrollRef} style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          <div
            className={`forum-nav-item ${activeForumId === 'all' ? 'forum-nav-item-active' : ''}`}
            style={{ padding: '10px 16px' }}
            onClick={() => setActiveForumId('all')}
          >
            <div style={{ width: 38, height: 38, borderRadius: 10, background: '#f0f2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <AppstoreOutlined style={{ fontSize: 18, color: '#667eea' }} />
            </div>
            <div style={{ marginLeft: 10 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a2e', whiteSpace: 'nowrap' }}>全部</div>
              <div style={{ fontSize: 12, color: '#9ca3af', whiteSpace: 'nowrap' }}>{joinedIds.length} 个论坛</div>
            </div>
          </div>

          <div style={{ margin: '6px 16px', borderTop: '1px solid #f0f0f0' }} />

          {joinedForums.length === 0 ? (
            <div style={{ padding: '20px 16px', fontSize: 12, color: '#9ca3af', textAlign: 'center' }}>还没有加入任何论坛</div>
          ) : (
            joinedForums.map((forum) => (
              <div
                key={forum.id}
                className={`forum-nav-item ${activeForumId === forum.id ? 'forum-nav-item-active' : ''}`}
                style={{ padding: '10px 16px' }}
                onClick={() => setActiveForumId(forum.id)}
              >
                <div style={{ width: 38, height: 38, borderRadius: 10, background: forum.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#fff', fontSize: 13, fontWeight: 700 }}>
                  {forum.industry[0]}
                </div>
                <div style={{ marginLeft: 10, overflow: 'hidden', flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{forum.title}</div>
                  <div style={{ fontSize: 11, color: '#9ca3af', whiteSpace: 'nowrap' }}>{forum.members.toLocaleString()} 成员</div>
                </div>
              </div>
            ))
          )}
        </div>

        <div style={{ padding: '12px 16px', borderTop: '1px solid #f0f0f0' }}>
          <Button icon={<PlusOutlined />} size="small" block onClick={() => navigate('/search')}
            style={{ borderRadius: 20, fontSize: 12, color: '#667eea', borderColor: '#667eea' }}>
            <span>发现更多论坛</span>
          </Button>
        </div>
      </div>

      {/* ── 右侧帖子流 ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#f5f6fa' }}>

        {/* 顶部信息栏 */}
        <div style={{ background: '#fff', borderBottom: '1px solid #d0d3de', padding: '0 32px', height: 64, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          {activeForumInfo ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: activeForumInfo.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700 }}>
                {activeForumInfo.industry[0]}
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#1a1a2e' }}>{activeForumInfo.title}</div>
                <div style={{ fontSize: 12, color: '#9ca3af' }}>{activeForumInfo.members.toLocaleString()} 成员 · {activeForumInfo.posts} 帖子</div>
              </div>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#1a1a2e' }}>全部</div>
              <div style={{ fontSize: 12, color: '#9ca3af' }}>来自 {joinedIds.length} 个已加入论坛的动态</div>
            </div>
          )}
        </div>

        {/* 帖子流 */}
        <div ref={feedScrollRef} style={{ flex: 1, overflowY: 'auto', padding: '20px 32px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {visiblePosts.length === 0 ? (
            <div style={{ textAlign: 'center', marginTop: 80, color: '#9ca3af', fontSize: 14 }}>
              暂无内容，去发现页加入更多论坛吧
            </div>
          ) : (
            visiblePosts.map((post) => {
              const forum = ALL_FORUMS.find((f) => f.id === post.forumId)
              const postComments = comments.filter((c) => c.postId === post.id)
              const isExpanded = expandedComments[post.id]

              return (
                <div key={post.id} style={{ background: '#fff', borderRadius: 12, padding: '20px 24px', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
                  {/* 作者信息 */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 40, height: 40, borderRadius: '50%', background: post.author.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 15, flexShrink: 0 }}>
                        {post.author.initial}
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a2e' }}>{post.author.name}</div>
                        <div style={{ fontSize: 12, color: '#9ca3af' }}>{post.time}</div>
                      </div>
                    </div>
                    {activeForumId === 'all' && forum && (
                      <Tag color={forum.color} style={{ fontSize: 11 }}>{forum.industry} · {forum.title}</Tag>
                    )}
                  </div>

                  {/* 正文 */}
                  <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.8, margin: '0 0 12px' }}>{post.content}</p>

                  {/* 图片 */}
                  {post.image && (
                    <div style={{ marginBottom: 12, borderRadius: 8, overflow: 'hidden' }}>
                      <img src={post.image} alt="" style={{ width: '100%', maxHeight: 280, objectFit: 'cover', display: 'block' }} />
                    </div>
                  )}

                  {/* 标签 */}
                  <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
                    {post.tags.map((tag) => (
                      <span key={tag} style={{ fontSize: 12, color: '#667eea', background: '#eef0ff', padding: '2px 10px', borderRadius: 12 }}>#{tag}</span>
                    ))}
                  </div>

                  {/* 操作栏 */}
                  <div style={{ display: 'flex', gap: 24, borderTop: '1px solid #f0f0f0', paddingTop: 12, marginBottom: isExpanded ? 16 : 0 }}>
                    <button onClick={() => toggleLike(post.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: post.liked ? '#667eea' : '#9ca3af', padding: 0, transition: 'color 0.15s' }}>
                      {post.liked ? <LikeFilled style={{ fontSize: 16 }} /> : <LikeOutlined style={{ fontSize: 16 }} />}{post.likes}
                    </button>
                    <button onClick={() => toggleComments(post.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: isExpanded ? '#667eea' : '#9ca3af', padding: 0, transition: 'color 0.15s' }}>
                      <CommentOutlined style={{ fontSize: 16 }} />{post.comments}
                    </button>
                    <button style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#9ca3af', padding: 0 }}>
                      <ShareAltOutlined style={{ fontSize: 16 }} />分享
                    </button>
                  </div>

                  {/* 评论区 */}
                  {isExpanded && (
                    <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 16 }}>
                      {/* 评论列表 */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
                        {postComments.length === 0 ? (
                          <div style={{ fontSize: 13, color: '#9ca3af', textAlign: 'center', padding: '8px 0' }}>暂无评论，来发表第一条吧</div>
                        ) : (
                          postComments.map((c) => (
                            <div key={c.id} style={{ display: 'flex', gap: 10 }}>
                              <div style={{ width: 32, height: 32, borderRadius: '50%', background: c.author.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                                {c.author.initial}
                              </div>
                              <div style={{ flex: 1, background: '#f9fafb', borderRadius: 8, padding: '8px 12px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                  <span style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e' }}>{c.author.name}</span>
                                  <span style={{ fontSize: 11, color: '#9ca3af' }}>{c.time}</span>
                                </div>
                                <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.6 }}>{c.content}</div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>

                      {/* 发表评论 */}
                      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#667eea', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                          {user?.username?.[0]?.toUpperCase() ?? 'U'}
                        </div>
                        <Input.TextArea
                          value={commentInputs[post.id] ?? ''}
                          onChange={(e) => setCommentInputs((prev) => ({ ...prev, [post.id]: e.target.value }))}
                          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendComment(post.id) } }}
                          placeholder="发表评论... (Enter 发送)"
                          autoSize={{ minRows: 1, maxRows: 4 }}
                          style={{ borderRadius: 8, fontSize: 13, flex: 1, resize: 'none' }}
                        />
                        <Button
                          type="primary"
                          icon={<SendOutlined />}
                          onClick={() => handleSendComment(post.id)}
                          style={{ background: '#667eea', border: 'none', borderRadius: 8, height: 36 }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* ── 通知面板（Portal）── */}
      {bellOpen && createPortal(
        <>
          {/* 遮罩 */}
          <div onClick={() => setBellOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 9998 }} />
          {/* 面板 */}
          <div style={{ position: 'fixed', top: bellPos.top, left: bellPos.left, width: 360, maxHeight: 540, background: '#fff', borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.14)', border: '1px solid #f0f0f0', zIndex: 9999, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

            {/* 面板头 */}
            <div style={{ padding: '14px 20px 0', borderBottom: '1px solid #f0f0f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e' }}>
                  通知
                  {unreadCount > 0 && <span style={{ fontSize: 12, color: '#667eea', marginLeft: 6 }}>{unreadCount} 条未读</span>}
                </span>
                {unreadCount > 0 && (
                  <button onClick={markAllRead} style={{ fontSize: 12, color: '#667eea', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>全部已读</button>
                )}
              </div>
              {/* 分类 Tab */}
              <div style={{ display: 'flex', gap: 0 }}>
                {NOTIF_TABS.map((tab) => {
                  const tabUnread = notifications.filter((n) => n.type === tab.key && !n.read).length
                  const isActive = activeTab === tab.key
                  return (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key)}
                      style={{ flex: 1, padding: '8px 4px', background: 'none', border: 'none', borderBottom: isActive ? '2px solid #667eea' : '2px solid transparent', cursor: 'pointer', fontSize: 13, color: isActive ? '#667eea' : '#6b7280', fontWeight: isActive ? 600 : 400, transition: 'all 0.15s', position: 'relative' }}
                    >
                      {tab.label}
                      {tabUnread > 0 && (
                        <span style={{ position: 'absolute', top: 4, right: 6, width: 16, height: 16, borderRadius: '50%', background: '#fa709a', color: '#fff', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                          {tabUnread > 9 ? '9+' : tabUnread}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* 通知列表 */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {(() => {
                const filtered = notifications.filter((n) => n.type === activeTab)
                if (filtered.length === 0) {
                  return <div style={{ textAlign: 'center', padding: '48px 0', color: '#9ca3af', fontSize: 13 }}>暂无通知</div>
                }
                return filtered.map((n: Notification) => (
                  <div
                    key={n.id}
                    onClick={() => markRead(n.id)}
                    style={{ padding: '14px 20px', background: n.read ? '#fff' : '#f8f9ff', borderBottom: '1px solid #f9fafb', cursor: 'pointer', transition: 'background 0.15s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#f5f6fa')}
                    onMouseLeave={e => (e.currentTarget.style.background = n.read ? '#fff' : '#f8f9ff')}
                  >
                    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      {/* 头像 + 类型色点 */}
                      <div style={{ position: 'relative', flexShrink: 0 }}>
                        <div style={{ width: 38, height: 38, borderRadius: '50%', background: n.from.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 14 }}>
                          {n.from.initial}
                        </div>
                        <div style={{ position: 'absolute', bottom: 0, right: 0, width: 14, height: 14, borderRadius: '50%', background: NOTIF_COLOR[n.type], border: '2px solid #fff' }} />
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.6 }}>
                          <span style={{ fontWeight: 600 }}>{n.from.name}</span>
                          {n.type === 'join_request'
                            ? <> 申请加入 <span style={{ color: '#667eea' }}>{n.forumName}</span></>
                            : <> {NOTIF_LABEL[n.type]}</>
                          }
                        </div>
                        {n.postContent && (
                          <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>"{n.postContent}"</div>
                        )}
                        <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>{n.time}</div>

                        {/* 加入申请操作按钮 */}
                        {n.type === 'join_request' && n.requestStatus === 'pending' && (
                          <div style={{ display: 'flex', gap: 8, marginTop: 10 }} onClick={(e) => e.stopPropagation()}>
                            <Button size="small" type="primary" icon={<CheckOutlined />}
                              onClick={() => handleRequest(n.id, 'approved')}
                              style={{ background: '#667eea', border: 'none', borderRadius: 16, fontSize: 12 }}>
                              同意
                            </Button>
                            <Button size="small" danger icon={<CloseOutlined />}
                              onClick={() => handleRequest(n.id, 'rejected')}
                              style={{ borderRadius: 16, fontSize: 12 }}>
                              拒绝
                            </Button>
                          </div>
                        )}
                        {n.type === 'join_request' && n.requestStatus !== 'pending' && (
                          <div style={{ marginTop: 6, fontSize: 12, color: n.requestStatus === 'approved' ? '#52c41a' : '#ff4d4f' }}>
                            {n.requestStatus === 'approved' ? '✓ 已同意' : '✗ 已拒绝'}
                          </div>
                        )}
                      </div>

                      {!n.read && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#667eea', flexShrink: 0, marginTop: 6 }} />}
                    </div>
                  </div>
                ))
              })()}
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  )
}
