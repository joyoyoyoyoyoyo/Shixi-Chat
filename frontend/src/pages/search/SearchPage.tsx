import { useState } from 'react'
import { Input, Tag, Button } from 'antd'
import { SearchOutlined, TeamOutlined, FileTextOutlined, CheckOutlined, PlusOutlined } from '@ant-design/icons'
import { ALL_FORUMS } from '../../data/forums'
import useForumStore from '../../store/forumStore'

const INDUSTRY_COLORS: Record<string, string> = {
  IT: 'blue', 金融: 'gold', 医疗: 'green', 教育: 'purple', 零售: 'orange', 制造: 'cyan',
}

export default function SearchPage() {
  const [keyword, setKeyword] = useState('')
  const { joinedIds, join, leave } = useForumStore()

  const results = keyword.trim()
    ? ALL_FORUMS.filter(
        (f) =>
          f.title.includes(keyword) ||
          f.description.includes(keyword) ||
          f.industry.includes(keyword) ||
          f.tags.some((t) => t.includes(keyword))
      )
    : ALL_FORUMS

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {/* 顶部搜索栏 */}
      <div style={{ padding: '28px 40px 20px', background: '#fff', borderBottom: '1px solid #f0f0f0' }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1a1a2e', marginBottom: 16 }}>发现</h2>
        <Input
          size="large"
          placeholder="搜索论坛、行业、话题..."
          prefix={<SearchOutlined style={{ color: '#9ca3af' }} />}
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          allowClear
          style={{ maxWidth: 480, borderRadius: 24 }}
        />
      </div>

      {/* 结果区域 */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 40px' }}>
        {results.length === 0 ? (
          <div style={{ textAlign: 'center', marginTop: 120, color: '#9ca3af', fontSize: 14 }}>
            这个话题有待挖掘
          </div>
        ) : (
          <div className="forum-grid">
            {results.map((forum) => {
              const joined = joinedIds.includes(forum.id)
              return (
                <div key={forum.id} className="forum-card">
                  {/* 上方图片 60% */}
                  <div style={{ height: '60%', overflow: 'hidden', borderRadius: '12px 12px 0 0', position: 'relative' }}>
                    <img
                      src={forum.image}
                      alt={forum.title}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.3s' }}
                      className="forum-card-img"
                    />
                    {/* 已加入角标 */}
                    {joined && (
                      <div style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(0,0,0,0.5)', color: '#fff', fontSize: 11, padding: '3px 8px', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <CheckOutlined style={{ fontSize: 10 }} /> 已加入
                      </div>
                    )}
                  </div>

                  {/* 下方信息 40% */}
                  <div style={{ height: '40%', padding: '12px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <Tag color={INDUSTRY_COLORS[forum.industry] ?? 'default'} style={{ margin: 0 }}>
                          {forum.industry}
                        </Tag>
                        <span style={{ fontSize: 14, fontWeight: 600, color: '#1a1a2e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {forum.title}
                        </span>
                      </div>
                      <p style={{ fontSize: 12, color: '#6b7280', margin: 0, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                        {forum.description}
                      </p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', gap: 12, fontSize: 12, color: '#9ca3af' }}>
                        <span><TeamOutlined style={{ marginRight: 4 }} />{forum.members.toLocaleString()}</span>
                        <span><FileTextOutlined style={{ marginRight: 4 }} />{forum.posts}</span>
                      </div>
                      <Button
                        size="small"
                        type={joined ? 'default' : 'primary'}
                        icon={joined ? <CheckOutlined /> : <PlusOutlined />}
                        onClick={() => joined ? leave(forum.id) : join(forum.id)}
                        style={joined
                          ? { borderRadius: 20, fontSize: 12, color: '#9ca3af', borderColor: '#e5e7eb' }
                          : { borderRadius: 20, fontSize: 12, background: '#667eea', border: 'none' }
                        }
                      >
                        {joined ? '已加入' : '加入'}
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
