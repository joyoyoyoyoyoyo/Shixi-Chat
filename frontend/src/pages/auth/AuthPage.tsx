import { useState, useRef } from 'react'
import { Form, Input, Button, Tabs, message, Space, Modal } from 'antd'
import {
  UserOutlined,
  LockOutlined,
  MailOutlined,
  SafetyOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import * as authApi from '../../api/auth'
import useAuthStore from '../../store/authStore'

export default function AuthPage() {
  const [activeTab, setActiveTab] = useState('login')
  const [countdown, setCountdown] = useState(0)
  const [loading, setLoading] = useState(false)
  const [sendingCode, setSendingCode] = useState(false)
  const [termsOpen, setTermsOpen] = useState(false)
  const [privacyOpen, setPrivacyOpen] = useState(false)
  const timerRef = useRef<number | null>(null)
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [loginForm] = Form.useForm()
  const [registerForm] = Form.useForm()

  const startCountdown = () => {
    setCountdown(60)
    timerRef.current = window.setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(timerRef.current!)
          return 0
        }
        return c - 1
      })
    }, 1000)
  }

  const handleSendCode = async () => {
    const email = registerForm.getFieldValue('email')
    if (!email) { message.warning('请先输入邮箱'); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      message.warning('请输入正确的邮箱格式')
      return
    }
    setSendingCode(true)
    try {
      await authApi.sendCode(email)
      message.success('验证码已发送，请查收邮件')
      startCountdown()
    } catch (err: any) {
      message.error(err.response?.data?.message || '发送失败，请稍后重试')
    } finally {
      setSendingCode(false)
    }
  }

  const handleLogin = async (values: { email: string; password: string }) => {
    setLoading(true)
    try {
      const res = await authApi.login(values)
      setAuth(res.data.token, res.data.user)
      message.success('登录成功！')
      navigate('/')
    } catch (err: any) {
      message.error(err.response?.data?.message || '登录失败')
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async (values: any) => {
    setLoading(true)
    try {
      const res = await authApi.register(values)
      setAuth(res.data.token, res.data.user)
      message.success('注册成功，欢迎加入！')
      navigate('/')
    } catch (err: any) {
      message.error(err.response?.data?.message || '注册失败')
    } finally {
      setLoading(false)
    }
  }


  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* ── 左侧品牌区 ── */}
      <div
        style={{
          flex: 1,
          position: 'relative',
          backgroundImage: [
            'linear-gradient(to bottom, rgba(15,17,28,1) 0%, rgba(15,17,28,1) 15%, rgba(15,17,28,0.6) 45%, rgba(15,17,28,0.75) 75%, rgba(15,17,28,0.95) 100%)',
            "url('https://images.unsplash.com/photo-1486325212027-8081e485255e?auto=format&fit=crop&w=1400&q=80')",
          ].join(', '),
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 48,
          color: 'white',
        }}
      >
        {/* 顶部 Logo 文字 */}
        <div style={{ position: 'absolute', top: 36, left: 40, display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'rgba(255,255,255,0.15)',
            backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16,
          }}>
            💼
          </div>
          <span style={{ fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,0.9)', letterSpacing: 1 }}>
            ShixiChat
          </span>
        </div>

        {/* 中央主文案 */}
        <div style={{ textAlign: 'center', maxWidth: 380 }}>
          <h1 style={{
            fontSize: 42,
            fontWeight: 700,
            color: 'white',
            margin: '0 0 16px',
            lineHeight: 1.2,
            letterSpacing: '-0.5px',
            textShadow: '0 2px 12px rgba(0,0,0,0.4)',
          }}>
            连接每一位<br />正在成长的你
          </h1>
          <p style={{
            fontSize: 15,
            color: 'rgba(255,255,255,0.75)',
            lineHeight: 1.9,
            margin: 0,
          }}>
            跨越行业边界，与全国实习生分享经验<br />拓展职业人脉，共同走向更远的未来
          </p>
        </div>

        {/* 底部三项特性 */}
        <div style={{
          position: 'absolute',
          bottom: 48,
          display: 'flex',
          gap: 0,
          width: '100%',
          padding: '0 48px',
          justifyContent: 'center',
        }}>
          {[
            { icon: '💬', label: '实时聊天', desc: '私聊 · 群组' },
            { icon: '📋', label: '职业论坛', desc: '行业 · 经验' },
            { icon: '👥', label: '拓展人脉', desc: '搜索 · 结识' },
          ].map((item, i) => (
            <div key={item.label} style={{
              flex: 1,
              textAlign: 'center',
              padding: '16px 0',
              borderLeft: i > 0 ? '1px solid rgba(255,255,255,0.15)' : 'none',
            }}>
              <div style={{ fontSize: 24, marginBottom: 6 }}>{item.icon}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>{item.label}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>{item.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── 右侧表单区 ── */}
      <div
        style={{
          width: 480,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '48px 56px',
          background: '#fff',
        }}
      >
        <div style={{ width: '100%', maxWidth: 360 }}>
          <h2 style={{ fontSize: 26, fontWeight: 'bold', color: '#1a1a2e', marginBottom: 6 }}>
            {activeTab === 'login' ? '欢迎回来 👋' : '创建账号'}
          </h2>
          <p style={{ color: '#6b7280', marginBottom: 28, fontSize: 14 }}>
            {activeTab === 'login'
              ? '登录你的实习生交流账号'
              : '加入我们，开始你的职场之旅'}
          </p>

          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            centered
            items={[
              { key: 'login', label: '账号登录' },
              { key: 'register', label: '注册账号' },
            ]}
            style={{ marginBottom: 20 }}
          />

          {/* 登录表单 */}
          {activeTab === 'login' && (
            <Form form={loginForm} onFinish={handleLogin} size="large">
              <Form.Item
                name="email"
                rules={[
                  { required: true, message: '请输入邮箱' },
                  { type: 'email', message: '邮箱格式不正确' },
                ]}
              >
                <Input
                  prefix={<MailOutlined style={{ color: '#9ca3af' }} />}
                  placeholder="请输入邮箱"
                />
              </Form.Item>

              <Form.Item
                name="password"
                rules={[{ required: true, message: '请输入密码' }]}
              >
                <Input.Password
                  prefix={<LockOutlined style={{ color: '#9ca3af' }} />}
                  placeholder="请输入密码"
                />
              </Form.Item>

              <Form.Item style={{ marginBottom: 0 }}>
                <Button type="primary" htmlType="submit" block loading={loading} className="auth-btn">
                  登 录
                </Button>
              </Form.Item>
            </Form>
          )}

          {/* 注册表单 */}
          {activeTab === 'register' && (
            <Form form={registerForm} onFinish={handleRegister} size="large">
              <Form.Item
                name="username"
                rules={[
                  { required: true, message: '请输入用户名' },
                  { min: 2, max: 20, message: '用户名长度为 2-20 个字符' },
                ]}
              >
                <Input
                  prefix={<UserOutlined style={{ color: '#9ca3af' }} />}
                  placeholder="请输入用户名（2-20 字符）"
                />
              </Form.Item>

              <Form.Item
                name="email"
                rules={[
                  { required: true, message: '请输入邮箱' },
                  { type: 'email', message: '邮箱格式不正确' },
                ]}
              >
                <Input
                  prefix={<MailOutlined style={{ color: '#9ca3af' }} />}
                  placeholder="请输入邮箱"
                />
              </Form.Item>

              {/* 验证码行 */}
              <Form.Item label="验证码" required style={{ marginBottom: 24 }}>
                <Space.Compact style={{ width: '100%' }}>
                  <Form.Item
                    name="code"
                    noStyle
                    rules={[{ required: true, message: '请输入验证码' }]}
                  >
                    <Input
                      prefix={<SafetyOutlined style={{ color: '#9ca3af' }} />}
                      placeholder="6 位验证码"
                      maxLength={6}
                      style={{ flex: 1 }}
                    />
                  </Form.Item>
                  <Button
                    onClick={handleSendCode}
                    loading={sendingCode}
                    disabled={countdown > 0}
                    style={{ minWidth: 116 }}
                  >
                    {countdown > 0 ? `${countdown}s 后重试` : '发送验证码'}
                  </Button>
                </Space.Compact>
              </Form.Item>

              <Form.Item
                name="password"
                rules={[
                  { required: true, message: '请输入密码' },
                  { min: 6, message: '密码至少 6 位' },
                ]}
              >
                <Input.Password
                  prefix={<LockOutlined style={{ color: '#9ca3af' }} />}
                  placeholder="请设置密码（至少 6 位）"
                />
              </Form.Item>

              <Form.Item
                name="confirmPassword"
                dependencies={['password']}
                rules={[
                  { required: true, message: '请确认密码' },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || getFieldValue('password') === value)
                        return Promise.resolve()
                      return Promise.reject(new Error('两次输入的密码不一致'))
                    },
                  }),
                ]}
              >
                <Input.Password
                  prefix={<LockOutlined style={{ color: '#9ca3af' }} />}
                  placeholder="请再次输入密码"
                />
              </Form.Item>

              <Form.Item style={{ marginBottom: 0 }}>
                <Button type="primary" htmlType="submit" block loading={loading} className="auth-btn">
                  注 册
                </Button>
              </Form.Item>
            </Form>
          )}

          <p style={{ textAlign: 'center', marginTop: 20, color: '#9ca3af', fontSize: 12 }}>
            注册即表示同意&nbsp;
            <span
              onClick={() => setTermsOpen(true)}
              style={{ color: '#667eea', cursor: 'pointer', textDecoration: 'underline' }}
            >
              《用户协议》
            </span>
            &nbsp;和&nbsp;
            <span
              onClick={() => setPrivacyOpen(true)}
              style={{ color: '#667eea', cursor: 'pointer', textDecoration: 'underline' }}
            >
              《隐私政策》
            </span>
          </p>
        </div>
      </div>

      {/* 用户协议弹窗 */}
      <Modal
        title="用户协议"
        open={termsOpen}
        onCancel={() => setTermsOpen(false)}
        footer={<Button type="primary" onClick={() => setTermsOpen(false)}>我已阅读</Button>}
        width={640}
        styles={{ body: { maxHeight: '60vh', overflowY: 'auto', paddingRight: 8 } }}
      >
        <div style={{ color: '#374151', lineHeight: 1.9, fontSize: 14 }}>
          <p style={{ color: '#6b7280', marginBottom: 20 }}>更新日期：2024年1月1日 &nbsp;|&nbsp; 生效日期：2024年1月1日</p>

          <h4>一、服务说明</h4>
          <p>实习生交流平台（以下简称"本平台"）是面向在校生及应届生的职业交流社区，提供即时通讯、职业论坛、人脉拓展等服务。在使用本平台前，请您仔细阅读并同意本协议。</p>

          <h4 style={{ marginTop: 16 }}>二、账号注册与管理</h4>
          <p>1. 您需使用真实有效的邮箱完成注册，并对账号安全负责。</p>
          <p>2. 禁止注册、使用违法违规、仿冒他人的账号名称。</p>
          <p>3. 请妥善保管账号密码，如因账号被盗造成的损失由用户自行承担。</p>

          <h4 style={{ marginTop: 16 }}>三、用户行为规范</h4>
          <p>用户在本平台发布内容时，不得包含以下内容：</p>
          <p>1. 违反国家法律法规的信息；</p>
          <p>2. 侮辱、诽谤、骚扰他人的内容；</p>
          <p>3. 虚假求职信息或商业欺诈内容；</p>
          <p>4. 传播他人隐私或未经授权的个人信息。</p>

          <h4 style={{ marginTop: 16 }}>四、知识产权</h4>
          <p>本平台所有原创内容（包括但不限于界面设计、文字、图标）的知识产权归本平台所有。用户发布的内容，用户保留所有权，但授予本平台在平台范围内展示的非独家许可。</p>

          <h4 style={{ marginTop: 16 }}>五、免责声明</h4>
          <p>本平台不对用户间的沟通内容、交易行为及因此产生的纠纷承担责任。因不可抗力导致的服务中断，本平台不承担赔偿责任。</p>

          <h4 style={{ marginTop: 16 }}>六、协议修改</h4>
          <p>本平台有权在必要时修改本协议，修改后将通过站内公告通知用户。继续使用平台服务即视为接受修改后的协议。</p>
        </div>
      </Modal>

      {/* 隐私政策弹窗 */}
      <Modal
        title="隐私政策"
        open={privacyOpen}
        onCancel={() => setPrivacyOpen(false)}
        footer={<Button type="primary" onClick={() => setPrivacyOpen(false)}>我已阅读</Button>}
        width={640}
        styles={{ body: { maxHeight: '60vh', overflowY: 'auto', paddingRight: 8 } }}
      >
        <div style={{ color: '#374151', lineHeight: 1.9, fontSize: 14 }}>
          <p style={{ color: '#6b7280', marginBottom: 20 }}>更新日期：2024年1月1日 &nbsp;|&nbsp; 生效日期：2024年1月1日</p>

          <h4>一、我们收集的信息</h4>
          <p>在您使用本平台时，我们会收集以下信息：</p>
          <p>1. <strong>注册信息</strong>：用户名、邮箱地址；</p>
          <p>2. <strong>个人资料</strong>：您主动填写的头像、简介、行业、实习信息；</p>
          <p>3. <strong>使用数据</strong>：登录时间、消息记录、发帖内容；</p>
          <p>4. <strong>设备信息</strong>：浏览器类型、操作系统（仅用于安全校验）。</p>

          <h4 style={{ marginTop: 16 }}>二、信息的使用方式</h4>
          <p>1. 提供、维护和改进平台服务；</p>
          <p>2. 向您发送验证码、系统通知等服务邮件；</p>
          <p>3. 保障平台安全，防范欺诈和滥用行为；</p>
          <p>4. 分析用户使用习惯以优化功能体验（匿名化处理）。</p>

          <h4 style={{ marginTop: 16 }}>三、信息共享与披露</h4>
          <p>我们不会向第三方出售您的个人信息。以下情况除外：</p>
          <p>1. 经您明确同意；</p>
          <p>2. 法律法规要求或司法机关依法要求；</p>
          <p>3. 保护本平台或用户合法权益所必须。</p>

          <h4 style={{ marginTop: 16 }}>四、信息安全</h4>
          <p>我们采用加密存储（密码使用 bcrypt 加密）、HTTPS 传输等措施保护您的数据安全。但请注意，互联网环境下没有绝对安全的传输方式，请勿在平台内分享过于敏感的个人信息。</p>

          <h4 style={{ marginTop: 16 }}>五、您的权利</h4>
          <p>您可以随时通过个人主页修改或删除您的个人资料。如需注销账号，请联系平台客服，我们将在 7 个工作日内处理。</p>

          <h4 style={{ marginTop: 16 }}>六、联系我们</h4>
          <p>如对本隐私政策有任何疑问，欢迎通过平台内反馈功能联系我们。</p>
        </div>
      </Modal>
    </div>
  )
}
