import type { ModelChoice } from './ai-gemini'
import { AiError, type AiRequest, type AiResultData } from './ai-types'
import type { AiProvider } from './ai-models'

/*
 * Dispatcher. Each provider lives in its own module and is loaded only when it
 * is actually used, so the Claude SDK never ships to someone using Gemini or Groq.
 */

export { AiError, macrosFromAiItem } from './ai-types'
export type { AiAnswer, AiRequest, AiResultData, AiItemData } from './ai-types'
export type { ModelChoice } from './ai-gemini'

export interface AiSettings {
  provider: AiProvider
  key: string
  model: string
  /** Groq only: an endpoint that holds the key server-side. */
  proxyUrl?: string
}

export async function estimateWithAi(settings: AiSettings, req: AiRequest): Promise<AiResultData> {
  const key = settings.key.trim()
  const proxyUrl = settings.proxyUrl?.trim()

  if (settings.provider === 'groq') {
    if (!key && !proxyUrl) throw new AiError('auth', 'Add a Groq key, or a proxy URL, in You → AI estimation.')
    const { estimateWithGroq } = await import('./ai-groq')
    return estimateWithGroq({ apiKey: key, proxyUrl }, settings.model, req)
  }

  if (!key) throw new AiError('auth', 'Add an API key in You → AI estimation first.')

  if (settings.provider === 'gemini') {
    const { estimateWithGemini } = await import('./ai-gemini')
    return estimateWithGemini(key, settings.model, req)
  }
  const { estimateWithClaude } = await import('./ai-claude')
  return estimateWithClaude(key, settings.model, req)
}

/** Checks a key and returns the models it can use. */
export async function verifyKey(provider: AiProvider, apiKey: string): Promise<ModelChoice[]> {
  const key = apiKey.trim()
  if (!key) throw new AiError('auth', 'Paste a key first.')
  if (provider === 'gemini') {
    const { listGeminiModels } = await import('./ai-gemini')
    return listGeminiModels(key)
  }
  if (provider === 'groq') {
    const { listGroqModels } = await import('./ai-groq')
    return listGroqModels(key)
  }
  const { listClaudeModels } = await import('./ai-claude')
  return listClaudeModels(key)
}
