// SlimPix 网页版 Service Worker —— 缓存应用外壳，支持离线 / 添加到主屏幕
const CACHE = 'slimpix-v2'
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './manifest.json',
  './icon.svg',
  './js/sprite-data.js',
  './js/algo.js',
  './js/store.js',
  './js/app.js'
]

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) { return c.addAll(ASSETS) }).then(function () { return self.skipWaiting() })
  )
})

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE }).map(function (k) { return caches.delete(k) }))
    }).then(function () { return self.clients.claim() })
  )
})

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return
  // 网络优先 + 缓存兜底：每次都尝试取最新文件，确保改动能即时生效；离线时才用缓存
  e.respondWith(
    fetch(e.request).then(function (resp) {
      if (resp && resp.status === 200 && resp.type === 'basic') {
        var cp = resp.clone()
        caches.open(CACHE).then(function (c) { c.put(e.request, cp) })
      }
      return resp
    }).catch(function () {
      return caches.match(e.request).then(function (cached) { return cached || caches.match('./index.html') })
    })
  )
})

// ===================== Web Push（关 App 也能提醒，需后台发送） =====================
self.addEventListener('push', function (e) {
  var data = { title: '该喝水啦 💧', body: '喝一杯温水（约 250ml）有助代谢～', url: './', tag: 'slimpix-water' }
  try { if (e.data) { var p = e.data.json(); if (p) data = Object.assign(data, p) } } catch (err) {}
  e.waitUntil(self.registration.showNotification(data.title, {
    body: data.body,
    icon: 'icon.svg',
    badge: 'icon.svg',
    tag: data.tag,
    renotify: true,
    data: { url: data.url || './' }
  }))
})

self.addEventListener('notificationclick', function (e) {
  e.notification.close()
  var target = (e.notification.data && e.notification.data.url) || './'
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (cs) {
      for (var i = 0; i < cs.length; i++) {
        if ('focus' in cs[i]) { cs[i].navigate(target); return cs[i].focus() }
      }
      if (clients.openWindow) return clients.openWindow(target)
    })
  )
})
