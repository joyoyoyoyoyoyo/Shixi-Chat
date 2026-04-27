/**
 * REST API 冒烟测试
 * 用法：
 *   1. 先启动后端：cd backend && npm run dev
 *   2. 准备两个已注册账号（用真实邮箱/密码），填入下面 USER_A / USER_B
 *   3. node scripts/test-api.js
 *
 * 流程：
 *   登录A → 登录B → A查好友 → A查群 → A建群(含B) → A发群消息 → A查群历史
 */

const BASE = process.env.API_BASE || 'http://localhost:5001/api'

const USER_A = { email: process.env.UA_EMAIL || 'a@test.com', password: process.env.UA_PWD || '123456' }
const USER_B = { email: process.env.UB_EMAIL || 'b@test.com', password: process.env.UB_PWD || '123456' }

const c = { g: '\x1b[32m', r: '\x1b[31m', y: '\x1b[33m', b: '\x1b[36m', x: '\x1b[0m' }
const log = {
  ok: (m) => console.log(`${c.g}✓${c.x} ${m}`),
  fail: (m) => console.log(`${c.r}✗${c.x} ${m}`),
  info: (m) => console.log(`${c.b}·${c.x} ${m}`),
  step: (m) => console.log(`\n${c.y}▶ ${m}${c.x}`),
}

async function req(method, path, token, body) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let data
  try { data = JSON.parse(text) } catch { data = text }
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${JSON.stringify(data)}`)
  return data
}

async function login(u) {
  const d = await req('POST', '/auth/login', null, u)
  const token = d.token
  const me = await req('GET', '/auth/me', token)
  return { token, id: me._id || me.id, username: me.username, userId: me.userId }
}

(async () => {
  try {
    log.step('1. 登录两个用户')
    const A = await login(USER_A); log.ok(`A: ${A.username} (${A.id})`)
    const B = await login(USER_B); log.ok(`B: ${B.username} (${B.id})`)

    log.step('2. A 查询好友列表')
    const friends = await req('GET', '/friends', A.token)
    log.ok(`好友数: ${Array.isArray(friends) ? friends.length : '?'}`)

    log.step('3. A 查询群列表')
    const groups = await req('GET', '/groups', A.token)
    log.ok(`群数: ${Array.isArray(groups) ? groups.length : '?'}`)

    log.step('4. A 创建群（含 B）')
    const created = await req('POST', '/groups', A.token, {
      name: `测试群_${Date.now()}`,
      memberIds: [B.id],
    })
    const gid = created._id || created.id
    log.ok(`群已创建: ${gid}`)

    log.step('5. A 查询群历史')
    const msgs = await req('GET', `/groups/${gid}/messages`, A.token)
    log.ok(`群消息数: ${Array.isArray(msgs) ? msgs.length : '?'}`)

    log.step('6. A 设置公告')
    await req('PUT', `/groups/${gid}/announcement`, A.token, { announcement: 'hello' })
    log.ok('公告已设置')

    console.log(`\n${c.g}全部通过${c.x}`)
  } catch (e) {
    log.fail(e.message)
    process.exit(1)
  }
})()
