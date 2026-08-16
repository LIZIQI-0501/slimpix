// 本地静态服务器（预览 + 手机安装用）：node serve.js [port]
// 用法：本机运行后，手机连同一 Wi-Fi，打开下方「手机访问」链接 → 浏览器菜单「添加到主屏幕」
const http = require('http')
const fs = require('fs')
const path = require('path')
const os = require('os')

const root = __dirname
const port = parseInt(process.argv[2] || '8080', 10)

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.png': 'image/png'
}

function lanIPs() {
  const out = []
  const ifaces = os.networkInterfaces()
  Object.keys(ifaces).forEach(function (name) {
    ifaces[name].forEach(function (i) {
      if (i.family === 'IPv4' && !i.internal) out.push(i.address)
    })
  })
  return out
}

http.createServer(function (req, res) {
  let p = decodeURIComponent(req.url.split('?')[0])
  if (p === '/') p = '/index.html'
  const fp = path.join(root, p)
  if (!fp.startsWith(root)) { res.writeHead(403); return res.end('forbidden') }
  fs.readFile(fp, function (err, data) {
    if (err) { res.writeHead(404); return res.end('not found') }
    const ext = path.extname(fp)
    const cache = (ext === '.html') ? 'no-cache' : 'public, max-age=86400'
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': cache })
    res.end(data)
  })
}).listen(port, '0.0.0.0', function () {
  console.log('──────── SlimPix 本地服务器已启动 ────────')
  console.log('本机访问:  http://localhost:' + port)
  lanIPs().forEach(function (ip) {
    console.log('手机访问:  http://' + ip + ':' + port + '   （手机需连同一 Wi-Fi）')
  })
  console.log('提示: 手机浏览器打开上面的链接 → 菜单「添加到主屏幕」即可当 App 用')
  console.log('────────────────────────────────────────')
})
