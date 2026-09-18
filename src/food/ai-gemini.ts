import {
  AI_JSON_SCHEMA,
  AiError,
  buildPrompt,
  parseAiJson,
  SYSTEM_PROMPT,
  type AiRequest,
  type AiResultData,
} from './ai-types'

/*
 * Google Gemini (AI Studio) over plain REST. No SDK, so the app stays small and
 * the key never leaves the phone.
 */

const BASE = 'https://generativelanguage.googleapis.com/v1beta'

interface GeminiPart {
  text?: string
  inlineData?: { mimeType: string; data: string }
}

interface GeminiResponse {
  candidates?: {
    content?: { parts?: GeminiPart[] }
    finishReason?: string
  }[]
  promptFeedback?: { blockReason?: string }
  error?: { code?: number; message?: string; status?: string }
}

function errorFor(status: number, message: string): AiError {
  const text = message || 'Gemini returned an error.'
  if (/denied access/i.test(text)) {
    return new AiError(
      'blocked',
      'Google has blocked this API project.',
      'Create a fresh key at aistudio.google.com/apikey (a new project), and check the Gemini API is available in your country.',
    )
  }
  if (status === 400 && /API key not valid|API_KEY_INVALID/i.test(text)) {
    return new AiError('auth', 'That Gemini key was rejected.', 'Copy it again from aistudio.google.com/apikey.')
  }
  if (status === 401 || status === 403) return new AiError('auth', text)
  if (status === 429) return new AiError('rate', 'Gemini is rate limiting this key. Wait a moment and try again.')
  if (status >= 500) return new AiError('network', 'Gemini is having trouble right now. Try again shortly.')
  return new AiError('unknown', text)
}

async function call(apiKey: string, model: string, body: unknown, signal?: AbortSignal): Promise<GeminiResponse> {
  let response: Response
  try {
    response = await fetch(`${BASE}/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify(body),
      signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw new AiError('network', 'That took too long. Try again.')
    throw new AiError('network', 'Could not reach Gemini. Check your connection.')
  }

  const data = (await response.json().catch(() => ({}))) as GeminiResponse
  if (!response.ok) throw errorFor(response.status, data.error?.message ?? '')
  return data
}

export async function estimateWithGemini(apiKey: string, model: string, req: AiRequest): Promise<AiResultData> {
  const parts: GeminiPart[] = []
  if (req.image) parts.push({ inlineData: { mimeType: req.image.mediaType, data: req.image.data } })
  parts.push({ text: buildPrompt(req) })

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 120_000)
  try {
    const data = await call(
      apiKey,
      model,
      {
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: AI_JSON_SCHEMA,
          temperature: 0.4,
        },
      },
      controller.signal,
    )

    if (data.promptFeedback?.blockReason) {
      throw new AiError('refused', 'Gemini would not answer that one. Try describing it differently.')
    }
    const candidate = data.candidates?.[0]
    const text = (candidate?.content?.parts ?? []).map((p) => p.text ?? '').join('')
    if (!text.trim()) {
      if (candidate?.finishReason === 'MAX_TOKENS') throw new AiError('unknown', 'The answer was cut off. Try a shorter description.')
      if (candidate?.finishReason === 'SAFETY') throw new AiError('refused', 'Gemini would not answer that one.')
      throw new AiError('unknown', 'Gemini sent an empty answer. Try again.')
    }
    return parseAiJson(text)
  } finally {
    clearTimeout(timeout)
  }
}

export interface ModelChoice {
  id: string
  label: string
}

/** Models this key can actually use, newest first. */
export async function listGeminiModels(apiKey: string): Promise<ModelChoice[]> {
  let response: Response
  try {
    response = await fetch(`${BASE}/models?pageSize=200`, { headers: { 'x-goog-api-key': apiKey } })
  } catch {
    throw new AiError('network', 'Could not reach Google. Check your connection.')
  }
  const data = (await response.json().catch(() => ({}))) as {
    models?: { name?: string; displayName?: string; supportedGenerationMethods?: string[] }[]
    error?: { message?: string }
  }
  if (!response.ok) throw errorFor(response.status, data.error?.message ?? '')

  const skip = /tts|image|audio|embedding|robotics|computer-use|transcribe|lyria|veo|imagen|gemma|deep-research|antigravity|live|native-audio|dialog/i
  const models = (data.models ?? [])
    .filter((m) => m.supportedGenerationMethods?.includes('generateContent') !== false)
    .map((m) => ({ id: (m.name ?? '').replace(/^models\//, ''), label: m.displayName ?? '' }))
    .filter((m) => m.id.startsWith('gemini') && !skip.test(m.id))

  const rank = (id: string) => {
    const version = Number(id.match(/gemini-(\d+(?:\.\d+)?)/)?.[1] ?? 0)
    const tier = /pro/.test(id) ? 2 : /flash-lite/.test(id) ? 0 : 1
    const preview = /preview|exp/.test(id) ? -0.5 : 0
    return version * 10 + tier + preview
  }
  return models.sort((a, b) => rank(b.id) - rank(a.id)).slice(0, 8)
}
