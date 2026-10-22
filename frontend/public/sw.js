const CACHE = 'meteolive-v1'
const SHELL = ['/', '/app', '/app/alerts', '/manifest.webmanifest']

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()))
})

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)
  if (e.request.method !== 'GET') return
  if (url.pathname.startsWith('/api/')) return // never cache live alerts
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone()
        caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {})
        return res
      })
      .catch(() => caches.match(e.request).then((m) => m || caches.match('/app')))
  )
})

const API_BASE = 'https://meteo-live-api.szczeblewski-sebastian.workers.dev'

self.addEventListener('push', (event) => {
  event.waitUntil((async () => {
    try {
      const r = await fetch(`${API_BASE}/api/vigilance`)
      const j = await r.json()
      const top = []
      let max = 0
      for (const w of j.warnings || []) {
        const info = (w.alert?.info || []).find((i) => (i.language || '').startsWith('fr')) || w.alert?.info?.[0]
        const pl = (info?.parameter || []).find((p) => p.valueName === 'awareness_level')
        const v = String(pl?.value || '')
        const lvl = v.startsWith('4') ? 4 : v.includes('orange') ? 3 : v.includes('yellow') || v.includes('jaune') ? 2 : 1
        if (lvl >= 3) { top.push(info?.headline || info?.event || 'Alerte'); if (lvl > max) max = lvl }
      }
      const title = max >= 4 ? '🔴 Vigilance ROUGE' : '🟠 Vigilance ORANGE'
      await self.registration.showNotification(title, {
        body: top.slice(0, 3).join('\n') || 'Situation en cours de suivi.',
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: 'meteolive-alert',
        renotify: true,
        data: { url: '/app' },
      })
    } catch {}
  })())
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(clients.openWindow(event.notification.data?.url || '/app'))
})
