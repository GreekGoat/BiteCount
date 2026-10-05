import { AiError, toStrictSchema, type JsonRequest } from './ai-types'
import type { ModelChoice } from './ai-gemini'

/*
 * Groq, over its OpenAI-compatible endpoint. Plain fetch, no SDK.
 *
 * Reached either straight from the phone with the user's key, or through a
 * proxy they deploy (server/groq-proxy) that holds the key server-side.
 */

const BASE = 'https://api.groq.com/openai/v1'

export const GROQ_DEFAULT_MODEL = 'openai/gpt-oss-120b'

interface GroqResponse {
  choices?: { message?: { content?: string }; finish_reason?: string }[]
  error?: { message?: string; code?: string; type?: string }
}

export interface GroqTarget {
  /** Direct API key, or empty when going through a proxy. */
  apiKey: string
  /** Optional proxy endpoint that adds the key server-side. */
  proxyUrl?: string
}

const isSchemaMiss = (data: GroqResponse) =>
  data.error?.code === 'json_validate_failed' || /expected schema|failed_generation|json_validate/i.test(data.error?.message ?? '')

function errorFor(status: number, message: string, code?: string): AiError {
  const text = message || 'Groq returned an error.'
  if (code === 'json_validate_failed' || /expected schema|failed_generation|json_validate/i.test(text)) {
    return new AiError('unknown', 'That answer came out garbled. Try again.')
  }
  if (/does not exist or you do not have access/i.test(text)) {
    return new AiError('unknown', 'That Groq model is not available on your account.', 'Open You → AI estimation and tap "Check key" to reload the list.')
  }
  if (status === 401) return new AiError('auth', 'That Groq key was rejected.', 'Copy it again from console.groq.com/keys.')
  if (status === 403) return new AiError('auth', 'This Groq key is not allowed to use that model.')
  if (status === 413 || /too large|context length/i.test(text)) return new AiError('unknown', 'That was too long for Groq. Try a shorter message.')
  if (status === 429) {
    if (/per day|RPD|TPD/i.test(text)) return new AiError('rate', 'You have used today’s free Groq allowance.', 'It resets within a day. Meanwhile the offline food list still works.')
    return new AiError('rate', 'Groq is busy for a moment. Try again in a minute.', 'The free plan allows a few big requests a minute.')
  }
  if (status >= 500) return new AiError('network', 'Groq is having trouble right now. Try again shortly.')
  return new AiError('unknown', text)
}

const isReasoningModel = (model: string) => /gpt-oss|qwen3|deepseek-r1/i.test(model)

/** Seconds to wait before retrying, from the header or from "Please try again in 7.4s". */
function retryAfter(response: Response, message: string): number | null {
  const header = Number(response.headers.get('retry-after'))
  if (Number.isFinite(header) && header > 0) return header
  const match = message.match(/try again in (?:(\d+)m)?([\d.]+)(ms|s)/i)
  if (!match) return null
  const minutes = Number(match[1] ?? 0)
  const value = Number(match[2])
  return minutes * 60 + (match[3] === 'ms' ? value / 1000 : value)
}

export async function completeJsonGroq(target: GroqTarget, model: string, req: JsonRequest): Promise<string> {
  if (req.turns.some((t) => t.image)) {
    throw new AiError('unknown', 'Groq cannot read meal photos.', 'Switch to Gemini or Claude in You → AI estimation for photos.')
  }

  const url = target.proxyUrl?.trim() || `${BASE}/chat/completions`
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (!target.proxyUrl?.trim()) headers.authorization = `Bearer ${target.apiKey}`

  const body = {
    model,
    temperature: req.temperature ?? 0.4,
    ...(isReasoningModel(model) ? { reasoning_effort: req.effort ?? 'medium', include_reasoning: false } : {}),
    response_format: {
      type: 'json_schema',
      json_schema: { name: req.schemaName, strict: true, schema: toStrictSchema(req.schema) },
    },
    messages: [{ role: 'system', content: req.system }, ...req.turns.map((t) => ({ role: t.role, content: t.text }))],
  }

  const send = async () => {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 90_000)
    try {
      const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal: controller.signal })
      return { response, data: (await response.json().catch(() => ({}))) as GroqResponse }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw new AiError('network', 'That took too long. Try again.')
      throw new AiError('network', 'Could not reach Groq. Check your connection.')
    } finally {
      clearTimeout(timeout)
    }
  }

  let { response, data } = await send()

  // The free tier allows 8,000 tokens a minute. A short wait usually clears it, so wait once and retry.
  if (response.status === 429) {
    const wait = retryAfter(response, data.error?.message ?? '')
    if (wait !== null && wait <= 45) {
      req.onWait?.(Math.ceil(wait))
      await new Promise((resolve) => setTimeout(resolve, wait * 1000 + 250))
      ;({ response, data } = await send())
    }
  }

  // Now and then the model's output misses the schema and Groq rejects it. A second try almost always lands.
  if (response.status === 400 && isSchemaMiss(data)) ({ response, data } = await send())

  if (!response.ok) throw errorFor(response.status, data.error?.message ?? '', data.error?.code)

  const choice = data.choices?.[0]
  const text = choice?.message?.content ?? ''
  if (!text.trim()) {
    if (choice?.finish_reason === 'length') throw new AiError('unknown', 'The answer was cut off. Try a shorter message.')
    throw new AiError('unknown', 'Groq sent an empty answer. Try again.')
  }
  return text
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
