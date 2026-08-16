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

// ============ 大模型食物识别（饮食页「自由输入识别」用） ============
// 默认走 DeepSeek（中文强、费用极低）；可经环境变量切换到 OpenAI 等兼容接口。
// 优先级：请求体里的 apiKey（用户在 App 设置填的，存本机） > 后端环境变量 LLM_API_KEY。
const LLM_API_KEY = process.env.LLM_API_KEY || ''
const LLM_BASE_URL = (process.env.LLM_BASE_URL || 'https://api.deepseek.com').replace(/\/$/, '')
const LLM_MODEL = process.env.LLM_MODEL || 'deepseek-chat'

const RECOGNIZE_SYSTEM_PROMPT =
  '你是一个严谨的中文营养识别助手。用户会描述一顿饭或若干食物（可能是一句话，如"中午吃了红烧肉和半碗米饭"）。请：\n' +
  '1) 拆解出其中包含的每一种食物；\n' +
  '2) 为每种食物估算一份常见食用分量（克，字段 grams）；\n' +
  '3) 给出该分量下的热量(kcal)、蛋白质(g)、碳水(g)、脂肪(g)、膳食纤维(g)的绝对值（字段 kcal/protein/carb/fat/fiber）。\n' +
  '只输出 JSON，格式严格为：{"items":[{"name":"食物中文名","grams":数值,"kcal":数值,"protein":数值,"carb":数值,"fat":数值,"fiber":数值}]}。\n' +
  '无法识别时返回 {"items":[]}。\n' +
  '规则：不要编造数据；不确定分量按常见一份估算；若用户给出明确分量（如"200克""一个苹果"）则以用户描述为准并合理换算克数；不要输出 JSON 以外的任何文字。'

function parseItems(content) {
  var s = (content || '').trim()
  // 去掉可能的 ```json ... ``` 包裹
  var fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) s = fence[1].trim()
  var data = null
  try { data = JSON.parse(s) } catch (e) {
    var a = s.indexOf('{'), b = s.lastIndexOf('}')
    if (a >= 0 && b > a) { try { data = JSON.parse(s.slice(a, b + 1)) } catch (e2) { /* ignore */ } }
  }
  if (!data || !Array.isArray(data.items)) throw new Error('无法解析大模型返回')
  var items = data.items
    .filter(function (it) { return it && typeof it.name === 'string' && it.name && isFinite(it.grams) && it.grams > 0 })
    .map(function (it) {
      function num(v) { var n = parseFloat(v); return isFinite(n) ? Math.max(0, n) : 0 }
      return {
        name: it.name,
        grams: Math.round(num(it.grams)),
        kcal: Math.round(num(it.kcal)),
        protein: Math.round(num(it.protein) * 10) / 10,
        carb: Math.round(num(it.carb) * 10) / 10,
        fat: Math.round(num(it.fat) * 10) / 10,
        fiber: Math.round(num(it.fiber) * 10) / 10
      }
    })
  return { items: items }
}

function callLLM(text, apiKey) {
  var key = apiKey || LLM_API_KEY
  if (!key) {
    var err = new Error('未配置大模型 API Key（请在 App 设置中填写，或在后端设置 LLM_API_KEY 环境变量）')
    err.status = 503
    return Promise.reject(err)
  }
  var body = {
    model: LLM_MODEL,
    messages: [
      { role: 'system', content: RECOGNIZE_SYSTEM_PROMPT },
      { role: 'user', content: text }
    ],
    response_format: { type: 'json_object' },
    temperature: 0.2
  }
  var ctrl = new AbortController()
  var timer = setTimeout(function () { ctrl.abort() }, 20000)
  return fetch(LLM_BASE_URL + '/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
    body: JSON.stringify(body),
    signal: ctrl.signal
  }).then(function (r) {
    clearTimeout(timer)
    return r.json().then(function (j) { return { status: r.status, json: j } })
  }).then(function (res) {
    if (res.status !== 200) {
      var err = new Error('大模型返回错误: ' + ((res.json && res.json.error && res.json.error.message) || res.status))
      err.status = 502
      throw err
    }
    var content = res.json.choices && res.json.choices[0] && res.json.choices[0].message && res.json.choices[0].message.content
    if (!content) { var e2 = new Error('大模型返回为空'); e2.status = 502; throw e2 }
    return parseItems(content)
  })
}

// 饮水时段（务必与 web/js/store.js 的 WATER_SLOTS 保持一致）
const WATER_SLOTS = ['07:00', '09:00', '11:00', '13:00', '15:00', '17:30', '19:00', '21:30']
const MEAL_SLOTS = ['08:00', '12:00', '18:00']

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

// 向全部订阅者推送；尊重每个订阅的 prefs（关掉的提醒不推）；404/410 的失效订阅自动清除
function payloadFor(slot, type) {
  if (type === 'meal') {
    return JSON.stringify({
      title: '该吃饭啦 🍚',
      body: '现在是 ' + slot + '，记得按时吃饭、记录一下哦～',
      tag: 'slimpix-meal-' + slot,
      url: './'
    })
  }
  return JSON.stringify({
    title: '该喝水啦 💧',
    body: '现在是 ' + slot + '，喝一杯温水（约 250ml）有助代谢～',
    tag: 'slimpix-water-' + slot,
    url: './'
  })
}
function sendToAll(slot, type) {
  const subs = loadSubs()
  if (!subs.length) return
  const payload = payloadFor(slot, type)
  Promise.all(subs.map(function (sub) {
    // 该订阅若显式关掉了此类提醒（prefs[type]===false）则跳过
    if (sub.prefs && sub.prefs[type] === false) return null
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

// 立即群发一条测试推送（绕过时段限制，仅用于验证链路 / 确认设备是否订阅）
function pushNow(label) {
  var subs = loadSubs()
  if (!subs.length) return Promise.resolve(0)
  var payload = JSON.stringify({
    title: '该喝水啦 💧',
    body: '测试推送：' + (label || '现在') + '，喝一杯温水（约 250ml）有助代谢～',
    tag: 'slimpix-water-test',
    url: './'
  })
  return Promise.all(subs.map(function (sub) {
    return webpush.sendNotification(sub, payload)
      .then(function () { return null })
      .catch(function (err) {
        var code = err && err.statusCode
        if (code === 404 || code === 410) return sub.endpoint
        return null
      })
  })).then(function (results) {
    var dead = results.filter(function (r) { return typeof r === 'string' })
    if (dead.length) {
      var kept = subs.filter(function (s) { return dead.indexOf(s.endpoint) < 0 })
      saveSubs(kept)
      console.log('已清除 ' + dead.length + ' 个失效订阅')
    }
    return subs.length
  })
}

function tick() {
  const now = new Date()
  const hhmm = ('0' + now.getHours()).slice(-2) + ':' + ('0' + now.getMinutes()).slice(-2)
  const today = now.getFullYear() + '-' + ('0' + (now.getMonth() + 1)).slice(-2) + '-' + ('0' + now.getDate()).slice(-2)
  let sent = loadSent()
  if (sent.date !== today) sent = { date: today, slots: {} }
  function fire(slot, type) {
    const key = type + ':' + slot
    if (sent.slots[key]) return
    const p = slot.split(':')
    const sd = new Date()
    sd.setHours(parseInt(p[0], 10), parseInt(p[1], 10), 0, 0)
    const diffMin = (now - sd) / 60000
    if (diffMin >= 0 && diffMin <= 30) {
      sent.slots[key] = true
      saveSent(sent)
      sendToAll(slot, type)
      console.log('[' + hhmm + '] 已推送' + (type === 'meal' ? '饭点' : '饮水') + '提醒：' + slot)
    }
  }
  WATER_SLOTS.forEach(function (slot) { fire(slot, 'water') })
  MEAL_SLOTS.forEach(function (slot) { fire(slot, 'meal') })
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
        const sub = obj.subscription
        sub.prefs = (obj.prefs && typeof obj.prefs === 'object')
          ? { water: obj.prefs.water !== false, meal: obj.prefs.meal !== false }
          : { water: true, meal: true }
        const idx = subs.findIndex(function (s) { return s.endpoint === sub.endpoint })
        if (idx === -1) subs.push(sub); else subs[idx] = sub  // 不存在则新增，存在则更新（含 prefs 开关）
        saveSubs(subs)
        res.writeHead(201); res.end(JSON.stringify({ ok: true }))
      } catch (e) {
        res.writeHead(400); res.end(JSON.stringify({ ok: false, error: String(e) }))
      }
    })
    return
  }
  if (req.method === 'POST' && req.url === '/recognize') {
    let body = ''
    req.on('data', function (c) { body += c })
    req.on('end', function () {
      let obj
      try { obj = JSON.parse(body) } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: false, error: 'bad json' })); return
      }
      const text = (obj.text || '').toString().slice(0, 500).trim()
      if (!text) { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: false, error: 'empty text' })); return }
      callLLM(text, obj.apiKey).then(function (result) {
        res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: true, items: result.items }))
      }).catch(function (err) {
        const st = (err && err.status) || 500
        res.writeHead(st, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: false, error: (err && err.message) || 'server error' }))
      })
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
  if (req.method === 'GET' && req.url === '/subs-count') {
    res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: true, count: loadSubs().length }))
    return
  }
  if (req.method === 'GET' && req.url === '/push-now') {
    pushNow('测试').then(function (n) {
      res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: true, sent: n }))
    }).catch(function (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: false, error: String(e) }))
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
