import { useEffect, useState, useCallback } from 'react'
import {
  Button, Modal, Form, Input, Select, InputNumber, Tag, message, Spin, Empty,
} from 'antd'
import {
  EditOutlined, MailOutlined, IdcardOutlined, EnvironmentOutlined,
  BankOutlined, BookOutlined, RocketOutlined, GithubOutlined, LinkOutlined,
  TeamOutlined, ReadOutlined, MessageOutlined, FireOutlined,
  LogoutOutlined, LockOutlined, CopyOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import useAuthStore from '../../store/authStore'
import useProfileStore, { ProfileExtras } from '../../store/profileStore'
import useChatStore from '../../store/chatStore'
import { getFriends } from '../../api/friends'
import { fetchGroups } from '../../api/groups'
import { getForums, type ApiForum } from '../../api/forum'

const INDUSTRY_OPTIONS = ['互联网', '金融', '教育', '医疗', '制造', '零售', '传媒', '法律', '咨询', '其他']
const SUGGEST_SKILLS = ['Java', 'Python', 'JavaScript', 'TypeScript', 'React', 'Vue', 'Node.js', 'Go', 'C++', 'SQL', 'Excel', 'PPT', '数据分析', '产品设计', 'UI/UX', '运营', '英语']

function avatarColorFromName(name: string): string {
  const colors = ['#667eea', '#f093fb', '#4facfe', '#43e97b', '#fa709a', '#a18cd1', '#fda085', '#84fab0', '#f6d365']
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff
  return colors[Math.abs(h) % colors.length]
}

export default function ProfilePage() {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const extras = useProfileStore((s) => s.extras)
  const setExtras = useProfileStore((s) => s.setExtras)
  const groupsLocal = useChatStore((s) => s.groups)

  const [editOpen, setEditOpen] = useState(false)
  const [form] = Form.useForm<ProfileExtras>()

  // 真实统计数据
  const [friendCount, setFriendCount] = useState(0)
  const [apiGroupCount, setApiGroupCount] = useState(0)
  const [joinedForums, setJoinedForums] = useState<ApiForum[]>([])
  const [statsLoading, setStatsLoading] = useState(true)

  const loadStats = useCallback(async () => {
    try {
      setStatsLoading(true)
      const [friendsRes, groupsRes, forumsRes] = await Promise.all([
        getFriends().catch(() => ({ data: { friends: [] } })),
        fetchGroups().catch(() => ({ data: { groups: [] } })),
        getForums().catch(() => ({ data: { forums: [] } })),
      ])
      setFriendCount(friendsRes.data.friends.length)
      setApiGroupCount(groupsRes.data.groups?.length ?? 0)
      setJoinedForums(forumsRes.data.forums.filter((f) => f.isMember))
    } finally {
      setStatsLoading(false)
    }
  }, [])

  useEffect(() => { loadStats() }, [loadStats])

  const groupCount = apiGroupCount || groupsLocal.length

  const handleOpenEdit = () => {
    form.setFieldsValue(extras)
    setEditOpen(true)
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      setExtras(values)
      setEditOpen(false)
      message.success('资料已保存')
    } catch {
      // 校验失败由 antd 自行提示
    }
  }

  const handleCopyId = () => {
    if (!user?.userId) return
    navigator.clipboard.writeText(user.userId)
    message.success('已复制 ID')
  }

  const handleLogout = () => {
    Modal.confirm({
      title: '确认退出？',
      content: '退出后需要重新登录才能进入账号。',
      okText: '退出',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: () => { logout(); navigate('/auth') },
    })
  }

  if (!user) return null

  const avatarColor = avatarColorFromName(user.username)
  const profileCompleteness = (() => {
    const fields: (keyof ProfileExtras)[] = ['bio', 'school', 'major', 'graduationYear', 'industry', 'location']
    const filled = fields.filter((f) => {
      const v = extras[f]
      return typeof v === 'string' && v.trim() !== ''
    }).length
    const skillsBonus = extras.skills.length > 0 ? 1 : 0
    return Math.round(((filled + skillsBonus) / (fields.length + 1)) * 100)
  })()

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: '#f5f6fa' }}>
      {/* ── 顶部 Hero ───────────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '40px 40px 80px',
        position: 'relative',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 24, color: '#fff' }}>
          <div style={{
            width: 96, height: 96, borderRadius: '50%',
            background: avatarColor,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 40, fontWeight: 700,
            boxShadow: '0 4px 16px rgba(0,0,0,0.2)', border: '4px solid rgba(255,255,255,0.3)',
            flexShrink: 0,
          }}>
            {user.username[0]?.toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              {user.username}
              {extras.industry && (
                <Tag style={{ background: 'rgba(255,255,255,0.25)', color: '#fff', border: 'none', borderRadius: 10 }}>
                  {extras.industry}
                </Tag>
              )}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, fontSize: 13, opacity: 0.9, marginBottom: 8 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <IdcardOutlined /> {user.userId}
                <CopyOutlined onClick={handleCopyId} style={{ cursor: 'pointer', marginLeft: 4 }} />
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <MailOutlined /> {user.email}
              </span>
              {extras.location && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <EnvironmentOutlined /> {extras.location}
                </span>
              )}
            </div>
            <div style={{ fontSize: 14, opacity: 0.95, lineHeight: 1.6, maxWidth: 720 }}>
              {extras.bio || <span style={{ opacity: 0.7 }}>这个人很懒，还没有写个性签名…</span>}
            </div>
          </div>
          <Button
            icon={<EditOutlined />}
            onClick={handleOpenEdit}
            style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', border: '1px solid rgba(255,255,255,0.4)', borderRadius: 20 }}
          >
            编辑资料
          </Button>
        </div>

        {/* 资料完整度 */}
        <div style={{ marginTop: 24, color: '#fff', fontSize: 12, opacity: 0.95, display: 'flex', alignItems: 'center', gap: 12, maxWidth: 600 }}>
          <span>资料完整度</span>
          <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.25)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ width: `${profileCompleteness}%`, height: '100%', background: profileCompleteness >= 80 ? '#43e97b' : '#fa709a', transition: 'width 0.3s' }} />
          </div>
          <span style={{ fontWeight: 600 }}>{profileCompleteness}%</span>
        </div>
      </div>

      {/* ── 内容区域 ───────────────────────────────────────── */}
      <div style={{ padding: '0 40px', marginTop: -40, paddingBottom: 40, maxWidth: 1100 }}>

        {/* 数据统计卡片 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginBottom: 24 }}>
          <StatCard icon={<TeamOutlined />} value={statsLoading ? '—' : friendCount} label="好友" color="#667eea" />
          <StatCard icon={<MessageOutlined />} value={statsLoading ? '—' : groupCount} label="群组" color="#f093fb" />
          <StatCard icon={<ReadOutlined />} value={statsLoading ? '—' : joinedForums.length} label="已加入论坛" color="#4facfe" />
          <StatCard icon={<FireOutlined />} value={extras.internshipCount} label="实习经历" color="#fa709a" />
        </div>

        {/* 双栏布局：基本信息 + 我的论坛 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>

          {/* 基本信息 */}
          <Card title="基本信息" extra={<Button type="link" size="small" onClick={handleOpenEdit}>编辑</Button>}>
            <InfoRow icon={<BankOutlined />} label="学校" value={extras.school} />
            <InfoRow icon={<BookOutlined />} label="专业" value={extras.major} />
            <InfoRow icon={<RocketOutlined />} label="毕业年份" value={extras.graduationYear} />
            <InfoRow icon={<EnvironmentOutlined />} label="所在城市" value={extras.location} />
            <InfoRow icon={<MessageOutlined />} label="目标行业" value={extras.industry} />
          </Card>

          {/* 技能标签 */}
          <Card title="技能标签" extra={<Button type="link" size="small" onClick={handleOpenEdit}>编辑</Button>}>
            {extras.skills.length === 0 ? (
              <Empty description="还没有添加技能标签" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ margin: '20px 0' }} />
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {extras.skills.map((s) => (
                  <Tag key={s} color="processing" style={{ fontSize: 13, padding: '4px 12px', borderRadius: 14 }}>{s}</Tag>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* 我加入的论坛 */}
        <Card title={`我加入的论坛 · ${joinedForums.length}`}>
          {statsLoading ? (
            <div style={{ textAlign: 'center', padding: 24 }}><Spin /></div>
          ) : joinedForums.length === 0 ? (
            <Empty description="还没有加入任何论坛" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
              {joinedForums.map((f) => (
                <div
                  key={f.id}
                  onClick={() => navigate('/forum')}
                  style={{
                    padding: 14, background: '#fafbff', border: '1px solid #eef0fa',
                    borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
                    transition: 'transform 0.15s, box-shadow 0.15s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(102,126,234,0.15)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '' }}
                >
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: f.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 15, flexShrink: 0 }}>
                    {f.name[0]}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</div>
                    <div style={{ fontSize: 11, color: '#9ca3af' }}>{f.industry} · {f.memberCount} 成员</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* 社交链接 */}
        {(extras.socialLinks.github || extras.socialLinks.linkedin || extras.socialLinks.blog) && (
          <Card title="社交链接" style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {extras.socialLinks.github && (
                <a href={extras.socialLinks.github} target="_blank" rel="noreferrer"
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#1a1a2e', color: '#fff', borderRadius: 18, fontSize: 13, textDecoration: 'none' }}>
                  <GithubOutlined /> GitHub
                </a>
              )}
              {extras.socialLinks.linkedin && (
                <a href={extras.socialLinks.linkedin} target="_blank" rel="noreferrer"
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#0a66c2', color: '#fff', borderRadius: 18, fontSize: 13, textDecoration: 'none' }}>
                  <LinkOutlined /> LinkedIn
                </a>
              )}
              {extras.socialLinks.blog && (
                <a href={extras.socialLinks.blog} target="_blank" rel="noreferrer"
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#43e97b', color: '#fff', borderRadius: 18, fontSize: 13, textDecoration: 'none' }}>
                  <LinkOutlined /> 个人博客
                </a>
              )}
            </div>
          </Card>
        )}

        {/* 账号与设置 */}
        <Card title="账号与设置" style={{ marginTop: 16 }}>
          <SettingRow
            icon={<LockOutlined />}
            label="修改密码"
            desc="定期修改密码以保障账号安全"
            onClick={() => message.info('修改密码功能开发中…')}
          />
          <SettingRow
            icon={<MailOutlined />}
            label="账号邮箱"
            desc={user.email}
          />
          <SettingRow
            icon={<LogoutOutlined />}
            label="退出登录"
            desc="退出当前账号"
            danger
            onClick={handleLogout}
          />
        </Card>
      </div>

      {/* ── 编辑弹窗 ───────────────────────────────────────── */}
      <Modal
        title="编辑个人资料"
        open={editOpen}
        onCancel={() => setEditOpen(false)}
        onOk={handleSubmit}
        okText="保存"
        cancelText="取消"
        width={600}
        destroyOnClose
      >
        <Form form={form} layout="vertical" initialValues={extras} preserve={false}>
          <Form.Item name="bio" label="个性签名">
            <Input.TextArea rows={2} maxLength={120} showCount placeholder="介绍一下自己…" />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item name="school" label="学校">
              <Input placeholder="如：清华大学" maxLength={30} />
            </Form.Item>
            <Form.Item name="major" label="专业">
              <Input placeholder="如：计算机科学" maxLength={30} />
            </Form.Item>
            <Form.Item name="graduationYear" label="毕业年份">
              <Input placeholder="如：2026" maxLength={4} />
            </Form.Item>
            <Form.Item name="location" label="所在城市">
              <Input placeholder="如：北京" maxLength={20} />
            </Form.Item>
            <Form.Item name="industry" label="目标行业">
              <Select allowClear placeholder="选择行业" options={INDUSTRY_OPTIONS.map((v) => ({ value: v, label: v }))} />
            </Form.Item>
            <Form.Item name="internshipCount" label="实习经历次数">
              <InputNumber min={0} max={20} style={{ width: '100%' }} />
            </Form.Item>
          </div>
          <Form.Item name="skills" label="技能标签">
            <Select
              mode="tags"
              placeholder="输入或选择技能"
              tokenSeparators={[',', '，', ' ']}
              options={SUGGEST_SKILLS.map((s) => ({ value: s, label: s }))}
            />
          </Form.Item>
          <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 8, marginTop: 8 }}>社交链接（可选）</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <Form.Item name={['socialLinks', 'github']} label="GitHub">
              <Input prefix={<GithubOutlined />} placeholder="https://github.com/..." />
            </Form.Item>
            <Form.Item name={['socialLinks', 'linkedin']} label="LinkedIn">
              <Input prefix={<LinkOutlined />} placeholder="https://linkedin.com/in/..." />
            </Form.Item>
            <Form.Item name={['socialLinks', 'blog']} label="博客">
              <Input prefix={<LinkOutlined />} placeholder="https://..." />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  )
}

// ── 子组件 ────────────────────────────────────────────────

function Card({ title, extra, children, style }: { title: string; extra?: React.ReactNode; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 12, padding: 20,
      boxShadow: '0 1px 4px rgba(0,0,0,0.04)', ...style,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e' }}>{title}</div>
        {extra}
      </div>
      {children}
    </div>
  )
}

function StatCard({ icon, value, label, color }: { icon: React.ReactNode; value: number | string; label: string; color: string }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 12, padding: '18px 20px',
      boxShadow: '0 1px 4px rgba(0,0,0,0.04)', display: 'flex', alignItems: 'center', gap: 14,
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 10, background: `${color}1a`,
        color, fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#1a1a2e', lineHeight: 1.1 }}>{value}</div>
        <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{label}</div>
      </div>
    </div>
  )
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px dashed #f0f1f7' }}>
      <span style={{ color: '#9ca3af', width: 16, textAlign: 'center' }}>{icon}</span>
      <span style={{ width: 80, fontSize: 13, color: '#9ca3af' }}>{label}</span>
      <span style={{ flex: 1, fontSize: 13, color: value ? '#1a1a2e' : '#c0c0c0' }}>{value || '未填写'}</span>
    </div>
  )
}

function SettingRow({ icon, label, desc, onClick, danger }: { icon: React.ReactNode; label: string; desc?: string; onClick?: () => void; danger?: boolean }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 4px', borderBottom: '1px solid #f5f6fa',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'background 0.15s',
      }}
      onMouseEnter={(e) => { if (onClick) e.currentTarget.style.background = '#f9fafe' }}
      onMouseLeave={(e) => { e.currentTarget.style.background = '' }}
    >
      <div style={{ width: 36, height: 36, borderRadius: 8, background: danger ? '#fff1f0' : '#f0f4ff', color: danger ? '#ff4d4f' : '#667eea', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, color: danger ? '#ff4d4f' : '#1a1a2e', fontWeight: 500 }}>{label}</div>
        {desc && <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{desc}</div>}
      </div>
      {onClick && <span style={{ color: '#c0c0c0', fontSize: 12 }}>›</span>}
    </div>
  )
}
