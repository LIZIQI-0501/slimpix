// SlimPix 轻量 Web Push 后端（定时发送喝水提醒）
// 作用：在饮水时段（与前端一致）向所有订阅者推送系统通知——即使 App 已关闭也能像闹钟一样提醒。
// 部署：node server.js（或 npm start）。建议部署到免费 Node 主机（Render / Railway / Fly.io），并设置环境变量。
const http = require('http')
const fs = require('fs')
const path = require('path')
const webpush = require('web-push')

// 默认时区：用户在中国，设为 Asia/Shanghai；部署在海外主机时用 TZ 环境变量覆盖即可
process.env.TZ = process.env.TZ || 'Asia/Shanghai'

const PORT = parseInt(process.env.PORT, 10) || 3000
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://liziqi-0501.github.io'
const SUBS_FILE = path.join(__dirname, 'subs.json')
const SENT_FILE = path.join(__dirname, '.sent.json')

// VAPID 密钥：优先读环境变量，否则读 vapid-keys.json
let vapidPublic, vapidPrivate
if (process.env.VAPID_PUBLIC && process.env.VAPID_PRIVATE) {
  vapidPublic = process.env.VAPID_PUBLIC
  vapidPrivate = process.env.VAPID_PRIVATE
} else {
  try {
    const k = JSON.parse(fs.readFileSync(path.join(__dirname, 'vapid-keys.json'), 'utf8'))
    vapidPublic = k.publicKey
    vapidPrivate = k.privateKey
  } catch (e) {
    console.error('缺少 VAPID 密钥：请设置环境变量 VAPID_PUBLIC/VAPID_PRIVATE，或在 push-server/vapid-keys.json 中填入。')
    process.exit(1)
  }
}
webpush.setVapidDetails('mailto:slimpix@example.com', vapidPublic, vapidPrivate)

// 饮水时段（务必与 web/js/store.js 的 WATER_SLOTS 保持一致）
const WATER_SLOTS = ['07:00', '09:00', '11:00', '13:00', '15:00', '17:30', '19:00', '21:30']

function loadSubs() {
  try { return JSON.parse(fs.readFileSync(SUBS_FILE, 'utf8')) } catch (e) { return [] }
}
function saveSubs(s) {
  fs.writeFileSync(SUBS_FILE, JSON.stringify(s, null, 2))
}
function loadSent() {
  try { return JSON.parse(fs.readFileSync(SENT_FILE, 'utf8')) } catch (e) { return { date: '', slots: {} } }
}
function saveSent(s) {
  fs.writeFileSync(SENT_FILE, JSON.stringify(s))
}

// 向全部订阅者推送；404/410 的失效订阅自动清除
function sendToAll(slot) {
  const subs = loadSubs()
  if (!subs.length) return
  const payload = JSON.stringify({
    title: '该喝水啦 💧',
    body: '现在是 ' + slot + '，喝一杯温水（约 250ml）有助代谢～',
    tag: 'slimpix-water-' + slot,
    url: './'
  })
  Promise.all(subs.map(function (sub) {
    return webpush.sendNotification(sub, payload)
      .then(function () { return null })
      .catch(function (err) {
        const code = err && err.statusCode
        if (code === 404 || code === 410) return sub.endpoint
        return null
      })
  })).then(function (results) {
    const dead = results.filter(function (r) { return typeof r === 'string' })
    if (dead.length) {
      const kept = subs.filter(function (s) { return dead.indexOf(s.endpoint) < 0 })
      saveSubs(kept)
      console.log('已清除 ' + dead.length + ' 个失效订阅')
    }
  })
}

function tick() {
  const now = new Date()
  const hhmm = ('0' + now.getHours()).slice(-2) + ':' + ('0' + now.getMinutes()).slice(-2)
  const today = now.getFullYear() + '-' + ('0' + (now.getMonth() + 1)).slice(-2) + '-' + ('0' + now.getDate()).slice(-2)
  let sent = loadSent()
  if (sent.date !== today) sent = { date: today, slots: {} }
  WATER_SLOTS.forEach(function (slot) {
    const p = slot.split(':')
    const slotDate = new Date()
    slotDate.setHours(parseInt(p[0], 10), parseInt(p[1], 10), 0, 0)
    const diffMin = (now - slotDate) / 60000
    if (diffMin >= 0 && diffMin <= 30 && !sent.slots[slot]) {
      sent.slots[slot] = true
      saveSent(sent)
      sendToAll(slot)
      console.log('[' + hhmm + '] 已推送饮水提醒：' + slot)
    }
  })
}

const server = http.createServer(function (req, res) {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN)
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }
  if (req.method === 'GET' && req.url === '/health') { res.writeHead(200); res.end('ok'); return }
  if (req.method === 'GET' && req.url === '/tick') { tick(); res.writeHead(200); res.end('ticked'); return }
  if (req.method === 'POST' && req.url === '/subscribe') {
    let body = ''
    req.on('data', function (c) { body += c })
    req.on('end', function () {
      try {
        const obj = JSON.parse(body)
        const subs = loadSubs()
        if (!obj.subscription || !obj.subscription.endpoint) throw new Error('bad subscription')
        if (!subs.some(function (s) { return s.endpoint === obj.subscription.endpoint })) {
          subs.push(obj.subscription)
          saveSubs(subs)
        }
        res.writeHead(201); res.end(JSON.stringify({ ok: true }))
      } catch (e) {
        res.writeHead(400); res.end(JSON.stringify({ ok: false, error: String(e) }))
      }
    })
    return
  }
  if (req.method === 'POST' && req.url === '/unsubscribe') {
    let body = ''
    req.on('data', function (c) { body += c })
    req.on('end', function () {
      try {
        const obj = JSON.parse(body)
        const subs = loadSubs().filter(function (s) { return s.endpoint !== obj.endpoint })
        saveSubs(subs)
        res.writeHead(200); res.end(JSON.stringify({ ok: true }))
      } catch (e) {
        res.writeHead(400); res.end(JSON.stringify({ ok: false }))
      }
    })
    return
  }
  res.writeHead(404); res.end('not found')
})

server.listen(PORT, function () {
  console.log('SlimPix push server 监听 ' + PORT + '（时区 ' + (process.env.TZ) + '，允许来源 ' + ALLOWED_ORIGIN + '）')
})
setInterval(tick, 30000)
tick()
