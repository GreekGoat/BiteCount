/**
 * Groq proxy for BiteCount (Cloudflare Worker).
 *
 * The app is a static site, so it has no server of its own and cannot hold a
 * secret. Deploy this and the key lives here instead: the phone posts the
 * request body to this URL, the Worker adds the Authorization header, and the
 * key is never in the browser, the bundle or the repo.
 *
 *   cd server/groq-proxy
 *   npx wrangler secret put GROQ_API_KEY     # paste the key when prompted
 *   npx wrangler deploy
 *
 * Then paste the deployed URL into You → AI estimation → Server proxy.
 */

// Only these origins may use the proxy, so a stray URL cannot spend your quota.
const ALLOWED_ORIGINS = ['https://greekgoat.github.io', 'http://localhost:5179']

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'

/** Requests are small; anything larger is not a meal description. */
const MAX_BODY_BYTES = 32_000

function corsHeaders(origin) {
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'access-control-max-age': '86400',
    vary: 'Origin',
  }
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') ?? ''
    const allowed = ALLOWED_ORIGINS.includes(origin)

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: allowed ? 204 : 403, headers: allowed ? corsHeaders(origin) : {} })
    }
    if (!allowed) return json({ error: { message: 'Origin not allowed.' } }, 403, {})
    if (request.method !== 'POST') return json({ error: { message: 'Use POST.' } }, 405, corsHeaders(origin))
    if (!env.GROQ_API_KEY) return json({ error: { message: 'GROQ_API_KEY is not set on the proxy.' } }, 500, corsHeaders(origin))

    const raw = await request.text()
    if (raw.length > MAX_BODY_BYTES) return json({ error: { message: 'Request too large.' } }, 413, corsHeaders(origin))

    let body
    try {
      body = JSON.parse(raw)
    } catch {
      return json({ error: { message: 'Invalid JSON.' } }, 400, corsHeaders(origin))
    }

    // Pass through only what this app sends, so the proxy cannot be repurposed.
    const payload = {
      model: typeof body.model === 'string' ? body.model : 'openai/gpt-oss-120b',
      temperature: typeof body.temperature === 'number' ? body.temperature : 0.4,
      messages: Array.isArray(body.messages) ? body.messages.slice(0, 8) : [],
      ...(body.response_format ? { response_format: body.response_format } : {}),
    }
    if (!payload.messages.length) return json({ error: { message: 'No messages.' } }, 400, corsHeaders(origin))

    const upstream = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${env.GROQ_API_KEY}` },
      body: JSON.stringify(payload),
    })

    return new Response(await upstream.text(), {
      status: upstream.status,
      headers: { 'content-type': 'application/json', ...corsHeaders(origin) },
    })
  },
}

function json(data, status, headers) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', ...headers } })
}
