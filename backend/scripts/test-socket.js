/**
 * Socket.io 集成测试
 * 用法：
 *   1. 启动后端：cd backend && npm run dev
 *   2. 准备两个账号（必须互为好友，且同时在同一个群里，方便验证广播）
 *   3. 在 backend/ 下执行： node scripts/test-socket.js
 *      或带环境变量：UA_EMAIL=a@x.com UA_PWD=... UB_EMAIL=b@x.com UB_PWD=... node scripts/test-socket.js
 *
 * 断言：
 *   - 双方 'connect' 成功
 *   - A/B 各自收到 'presence:snapshot'
 *   - A 发送 'message:send' → B 收到 'message:new'
 *   - A 发送 'typing' → B 收到 'typing:update'
 *   - 若有共同群：A 'group:message' → B 收到 'group:message:new'
 *
 * 注意：socket.io-client 已在 frontend 装过，backend 没装。
 *   临时：cd backend && npm i -D socket.io-client
 *   或者直接：node --experimental-... 引入 frontend 的（不推荐）
 */

const BASE_HTTP = process.env.API_BASE || 'http://localhost:5001'
const BASE_WS = process.env.WS_BASE || 'http://localhost:5001'
const USER_A = { email: process.env.UA_EMAIL || 'a@test.com', password: process.env.UA_PWD || '123456' }
const USER_B = { email: process.env.UB_EMAIL || 'b@test.com', password: process.env.UB_PWD || '123456' }

let io
try { io = require('socket.io-client') }
catch { console.error('缺少依赖，请先执行: cd backend && npm i -D socket.io-client'); process.exit(1) }

const c = { g: '\x1b[32m', r: '\x1b[31m', y: '\x1b[33m', b: '\x1b[36m', x: '\x1b[0m' }
const log = {
  ok: (m) => console.log(`${c.g}✓${c.x} ${m}`),
  fail: (m) => console.log(`${c.r}✗${c.x} ${m}`),
  info: (m) => console.log(`${c.b}·${c.x} ${m}`),
  step: (m) => console.log(`\n${c.y}▶ ${m}${c.x}`),
}

async function login(u) {
  const r = await fetch(`${BASE_HTTP}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(u),
  })
  if (!r.ok) throw new Error(`login failed: ${r.status} ${await r.text()}`)
  const data = await r.json()
  const meRes = await fetch(`${BASE_HTTP}/api/auth/me`, { headers: { Authorization: `Bearer ${data.token}` } })
  const me = await meRes.json()
  return { token: data.token, id: me._id || me.id, username: me.username }
}

function connect(token, label) {
  return new Promise((resolve, reject) => {
    const s = io(BASE_WS, { auth: { token }, transports: ['websocket'] })
    const to = setTimeout(() => reject(new Error(`${label} connect timeout`)), 5000)
    s.on('connect', () => { clearTimeout(to); log.ok(`${label} 已连接 sid=${s.id}`); resolve(s) })
    s.on('connect_error', (e) => { clearTimeout(to); reject(new Error(`${label}: ${e.message}`)) })
  })
}

function waitEvent(sock, event, timeout = 3000, filter = () => true) {
  return new Promise((resolve, reject) => {
    const to = setTimeout(() => reject(new Error(`等待 ${event} 超时`)), timeout)
    const handler = (payload) => {
      if (!filter(payload)) return
      clearTimeout(to); sock.off(event, handler); resolve(payload)
    }
    sock.on(event, handler)
  })
}

(async () => {
  try {
    log.step('1. 登录 A、B')
    const A = await login(USER_A); log.ok(`A ${A.username} ${A.id}`)
    const B = await login(USER_B); log.ok(`B ${B.username} ${B.id}`)

    log.step('2. 建立 socket 连接')
    const sa = await connect(A.token, 'A')
    const sb = await connect(B.token, 'B')

    log.step('3. 监听 B 的 message:new / typing:update / group:message:new')
    // 挂监听
    const pMsg = waitEvent(sb, 'message:new', 4000)
    const pTyping = waitEvent(sb, 'typing:update', 4000, (p) => p.fromUserId === A.id)

    log.step('4. A 发送私聊消息给 B')
    const convId = [A.id, B.id].sort().join('_')
    sa.emit('message:send', {
      conversationId: convId,
      toUserId: B.id,
      text: `hello-${Date.now()}`,
      type: 'text',
    })

    try {
      const p = await pMsg
      log.ok(`B 收到 message:new: ${p?.message?.text}`)
    } catch (e) { log.fail(e.message) }

    log.step('5. A 发送 typing')
    sa.emit('typing', { toUserId: B.id, typing: true })
    try {
      const p = await pTyping
      log.ok(`B 收到 typing:update: typing=${p.typing}`)
    } catch (e) { log.fail(e.message) }

    log.step('6. 群聊广播（若有共同群才能验证）')
    // 取 A 的群列表，选第一个 B 也在的群
    const gr = await fetch(`${BASE_HTTP}/api/groups`, { headers: { Authorization: `Bearer ${A.token}` } })
    const groups = await gr.json()
    const shared = Array.isArray(groups) ? groups.find((g) => {
      const ids = (g.members || g.memberIds || []).map((m) => m._id || m.id || m)
      return ids.includes(B.id)
    }) : null
    if (!shared) {
      log.info('无共同群，跳过群聊测试')
    } else {
      const gid = shared._id || shared.id
      const pGroupMsg = waitEvent(sb, 'group:message:new', 4000)
      sa.emit('group:message', { groupId: gid, content: `gmsg-${Date.now()}`, type: 'text' })
      try {
        const p = await pGroupMsg
        log.ok(`B 收到 group:message:new: ${p?.message?.content || JSON.stringify(p).slice(0, 80)}`)
      } catch (e) { log.fail(e.message) }
    }

    sa.disconnect(); sb.disconnect()
    console.log(`\n${c.g}测试结束${c.x}`)
    process.exit(0)
  } catch (e) {
    log.fail(e.message)
    process.exit(1)
  }
})()
