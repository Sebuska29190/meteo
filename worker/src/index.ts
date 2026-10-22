export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors })

    if (url.pathname === '/api/vigilance') {
      const r = await fetch('https://feeds.meteoalarm.org/api/v1/warnings/feeds-france')
      const body = await r.text()
      return new Response(body, { status: r.status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' } })
    }

    return new Response('Not found', { status: 404, headers: cors })
  },
}
