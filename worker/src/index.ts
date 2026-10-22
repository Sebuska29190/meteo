/// <reference types="@cloudflare/workers-types" />

export interface Env {
  PUSH_SUBS: KVNamespace
  VAPID_PUBLIC: string
  VAPID_PRIVATE: string
}

const b64url = (s: string) => s.replace(/-/g, '+').replace(/_/g, '/')
const b64urlEnc = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

function jwkFrom(privB64: string, pubB64: string) {
  const d = atob(b64url(privB64).replace(/=+$/, ''))
  const pub = atob(b64url(pubB64).replace(/=+$/, ''))
  const hex2b64 = (arr: Uint8Array) => btoa(String.fromCharCode(...arr))
  const x = new Uint8Array(pub.slice(1, 33).split('').map((c) => c.charCodeAt(0)))
  const y = new Uint8Array(pub.slice(33, 65).split('').map((c) => c.charCodeAt(0)))
  const dv = new Uint8Array(d.split('').map((c) => c.charCodeAt(0)))
  return { kty: 'EC', crv: 'P-256', x: hex2b64(x), y: hex2b64(y), d: hex2b64(dv) } as any
}

async function vapidAuthHeader(endpoint: string, pub: string, priv: string): Promise<string> {
  const jwk = jwkFrom(priv, pub)
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])
  const header = b64urlEnc(new TextEncoder().encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))
  const payload = b64urlEnc(new TextEncoder().encode(JSON.stringify({
    aud: new URL(endpoint).origin,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: 'mailto:contact@meteo-live.pages.dev',
  })))
  const data = new TextEncoder().encode(`${header}.${payload}`)
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, data)
  const sigRaw = new Uint8Array(sig)
  const r = sigRaw.slice(0, 32); const s = sigRaw.slice(32, 64)
  const sigB64 = btoa(String.fromCharCode(...r, ...s)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `vapid t=${header}.${payload}.${sigB64}, k=${pub}`
}

async function sendPush(sub: any, pub: string, priv: string): Promise<Response> {
  const auth = await vapidAuthHeader(sub.endpoint, pub, priv)
  return fetch(sub.endpoint, { method: 'POST', headers: { TTL: '3600', Authorization: auth, Urgency: 'high' } })
}

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors })

    if (url.pathname === '/api/vigilance') {
      const r = await fetch('https://feeds.meteoalarm.org/api/v1/warnings/feeds-france')
      const body = await r.text()
      return new Response(body, { status: r.status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' } })
    }

    if (url.pathname === '/api/push/publickey') {
      return new Response(env.VAPID_PUBLIC, { headers: { ...cors, 'Content-Type': 'text/plain' } })
    }

    if (url.pathname === '/api/push/subscribe' && request.method === 'POST') {
      const body: any = await request.json()
      if (!body?.endpoint || !body?.keys?.p256dh || !body?.keys?.auth) {
        return new Response('bad subscription', { status: 400, headers: cors })
      }
      await env.PUSH_SUBS.put(`sub:${body.endpoint}`, JSON.stringify({ endpoint: body.endpoint, keys: body.keys, watched: body.watched || [] }))
      return new Response('ok', { headers: cors })
    }

    if (url.pathname === '/api/push/unsubscribe' && request.method === 'POST') {
      const body: any = await request.json()
      if (body?.endpoint) await env.PUSH_SUBS.delete(`sub:${body.endpoint}`)
      return new Response('ok', { headers: cors })
    }

    return new Response('Not found', { status: 404, headers: cors })
  },

  // cron */5: detect orange/red changes, ping subscribers
  async scheduled(_event: ScheduledController | any, env: Env): Promise<void> {
    const priv = env.VAPID_PRIVATE || ''
    if (!priv) return
    const r = await fetch('https://feeds.meteoalarm.org/api/v1/warnings/feeds-france')
    const feed: any = await r.json()
    let maxLevel = 0
    let count = 0
    for (const w of feed?.warnings || []) {
      const info = (w?.alert?.info || []).find((i: any) => (i.language || '').startsWith('fr')) || w?.alert?.info?.[0]
      const pl = (info?.parameter || []).find((p: any) => p.valueName === 'awareness_level')
      const v = String(pl?.value || '')
      const lvl = v.startsWith('4') ? 4 : v.includes('orange') ? 3 : v.includes('yellow') || v.includes('jaune') ? 2 : 1
      if (lvl >= 2) count++
      if (lvl > maxLevel) maxLevel = lvl
    }
    const sig = `${maxLevel}:${count}`
    const last = await env.PUSH_SUBS.get('meta:lastsig')
    if (sig === last) return
    await env.PUSH_SUBS.put('meta:lastsig', sig)

    const list = await env.PUSH_SUBS.list({ prefix: 'sub:' })
    for (const k of list.keys) {
      const raw = await env.PUSH_SUBS.get(k.name)
      if (!raw) continue
      try {
        const sub = JSON.parse(raw)
        const res = await sendPush(sub, env.VAPID_PUBLIC, priv)
        if (res.status === 404 || res.status === 410) await env.PUSH_SUBS.delete(k.name)
      } catch {}
    }
  },
}
