import {
  AI_JSON_SCHEMA,
  AiError,
  buildPrompt,
  parseAiJson,
  SYSTEM_PROMPT,
  type AiRequest,
  type AiResultData,
} from './ai-types'
import type { ModelChoice } from './ai-gemini'

/*
 * Groq, over its OpenAI-compatible endpoint. Plain fetch, no SDK.
 *
 * Two ways to reach it:
 *  - straight from the phone with the user's own key (default), or
 *  - through a proxy they deploy (server/groq-proxy), which holds the key
 *    server-side so it never reaches the browser at all.
 */

const BASE = 'https://api.groq.com/openai/v1'

export const GROQ_DEFAULT_MODEL = 'openai/gpt-oss-120b'

interface GroqResponse {
  choices?: { message?: { content?: string }; finish_reason?: string }[]
  error?: { message?: string; code?: string; type?: string }
}

function errorFor(status: number, message: string): AiError {
  const text = message || 'Groq returned an error.'
  if (/does not exist or you do not have access/i.test(text)) {
    return new AiError('unknown', 'That Groq model is not available on your account.', 'Open You → AI estimation and tap "Check key" to reload the list.')
  }
  if (status === 401) return new AiError('auth', 'That Groq key was rejected.', 'Copy it again from console.groq.com/keys.')
  if (status === 403) return new AiError('auth', 'This Groq key is not allowed to use that model.')
  if (status === 413 || /too large/i.test(text)) return new AiError('unknown', 'That description was too long for Groq.')
  if (status === 429) return new AiError('rate', 'Groq is rate limiting this key. Wait a moment and try again.')
  if (status >= 500) return new AiError('network', 'Groq is having trouble right now. Try again shortly.')
  return new AiError('unknown', text)
}

interface GroqTarget {
  /** Direct API key, or empty when going through a proxy. */
  apiKey: string
  /** Optional proxy endpoint that adds the key server-side. */
  proxyUrl?: string
}

async function call(target: GroqTarget, body: unknown, signal?: AbortSignal): Promise<GroqResponse> {
  const url = target.proxyUrl?.trim() || `${BASE}/chat/completions`
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (!target.proxyUrl?.trim()) headers.authorization = `Bearer ${target.apiKey}`

  let response: Response
  try {
    response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw new AiError('network', 'That took too long. Try again.')
    throw new AiError('network', 'Could not reach Groq. Check your connection.')
  }

  const data = (await response.json().catch(() => ({}))) as GroqResponse
  if (!response.ok) throw errorFor(response.status, data.error?.message ?? '')
  return data
}

export async function estimateWithGroq(target: GroqTarget, model: string, req: AiRequest): Promise<AiResultData> {
  if (req.image) {
    throw new AiError('unknown', 'Groq cannot read meal photos.', 'Switch to Gemini or Claude in You → AI estimation for photos.')
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 120_000)
  try {
    const data = await call(
      target,
      {
        model,
        temperature: 0.4,
        // OpenAI-compatible structured output: the model must return this exact shape.
        response_format: {
          type: 'json_schema',
          json_schema: { name: 'meal_estimate', strict: true, schema: toStrictSchema(AI_JSON_SCHEMA) },
        },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: buildPrompt(req) },
        ],
      },
      controller.signal,
    )

    const choice = data.choices?.[0]
    const text = choice?.message?.content ?? ''
    if (!text.trim()) {
      if (choice?.finish_reason === 'length') throw new AiError('unknown', 'The answer was cut off. Try a shorter description.')
      throw new AiError('unknown', 'Groq sent an empty answer. Try again.')
    }
    return parseAiJson(text)
  } finally {
    clearTimeout(timeout)
  }
}

/** Strict mode wants `additionalProperties: false` on every object, and no Gemini-only keys. */
function toStrictSchema(schema: unknown): Record<string, unknown> {
  if (Array.isArray(schema)) return schema.map(toStrictSchema) as unknown as Record<string, unknown>
  if (!schema || typeof schema !== 'object') return schema as Record<string, unknown>

  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(schema as Record<string, unknown>)) {
    if (key === 'propertyOrdering') continue
    out[key] = typeof value === 'object' && value !== null ? toStrictSchema(value) : value
  }
  if (out.type === 'object') out.additionalProperties = false
  return out
}

/** Chat models this key can use, best first. */
export async function listGroqModels(apiKey: string): Promise<ModelChoice[]> {
  let response: Response
  try {
    response = await fetch(`${BASE}/models`, { headers: { authorization: `Bearer ${apiKey}` } })
  } catch {
    throw new AiError('network', 'Could not reach Groq. Check your connection.')
  }
  const data = (await response.json().catch(() => ({}))) as {
    data?: { id?: string; context_window?: number }[]
    error?: { message?: string }
  }
  if (!response.ok) throw errorFor(response.status, data.error?.message ?? '')

  const skip = /whisper|guard|tts|orpheus|embed|safeguard|prompt/i
  return (data.data ?? [])
    .map((m) => ({ id: m.id ?? '', context: m.context_window ?? 0 }))
    .filter((m) => m.id && !skip.test(m.id))
    .sort((a, b) => b.context - a.context || a.id.localeCompare(b.id))
    .slice(0, 8)
    .map((m) => ({ id: m.id, label: prettyName(m.id) }))
}

function prettyName(id: string) {
  const name = id.includes('/') ? id.split('/')[1] : id
  return name
    .replace(/[-_]/g, ' ')
    .replace(/\bgpt oss\b/i, 'GPT-OSS')
    .replace(/\b(\d+)b\b/i, '$1B')
    .replace(/^\w/, (c) => c.toUpperCase())
}
