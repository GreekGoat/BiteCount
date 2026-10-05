import type { AiProvider } from './ai-models'
import type { ModelChoice } from './ai-gemini'
import {
  AiError,
  AiResult,
  buildEstimatePrompt,
  COACH_SCHEMA,
  COACH_SYSTEM,
  CoachResult,
  ESTIMATE_SCHEMA,
  ESTIMATE_SYSTEM,
  parseJsonLoose,
  type AiRequest,
  type AiResultData,
  type AiTurn,
  type CoachResultData,
  type JsonRequest,
} from './ai-types'

/*
 * Dispatcher. Each provider lives in its own module and is loaded only when it
 * is actually used, so the Claude SDK never ships to someone using Groq.
 */

export { AiError, macrosFromAiItem } from './ai-types'
export type { AiAnswer, AiRequest, AiResultData, AiItemData, AiTurn, CoachResultData, CoachSuggestionData } from './ai-types'
export type { ModelChoice } from './ai-gemini'

export interface AiSettings {
  provider: AiProvider
  key: string
  model: string
  /** Groq only: an endpoint that holds the key server-side. */
  proxyUrl?: string
}

/** Sends one structured request to whichever provider is set up, and returns the raw JSON text. */
async function completeJson(settings: AiSettings, req: JsonRequest): Promise<string> {
  const key = settings.key.trim()
  const proxyUrl = settings.proxyUrl?.trim()

  if (settings.provider === 'groq') {
    if (!key && !proxyUrl) throw new AiError('auth', 'Add a Groq key, or a proxy URL, in You → AI estimation.')
    const { completeJsonGroq } = await import('./ai-groq')
    return completeJsonGroq({ apiKey: key, proxyUrl }, settings.model, req)
  }
  if (!key) throw new AiError('auth', 'Add an API key in You → AI estimation first.')
  if (settings.provider === 'gemini') {
    const { completeJsonGemini } = await import('./ai-gemini')
    return completeJsonGemini(key, settings.model, req)
  }
  const { completeJsonClaude } = await import('./ai-claude')
  return completeJsonClaude(key, settings.model, req)
}

export interface CallOptions {
  /** A rate limit is making the call wait this many seconds before it retries. */
  onWait?: (seconds: number) => void
}

/** One dish, a meal or a whole day → items (with the meal each belongs to). */
export async function estimateWithAi(settings: AiSettings, req: AiRequest, options: CallOptions = {}): Promise<AiResultData> {
  const text = await completeJson(settings, {
    system: ESTIMATE_SYSTEM,
    turns: [{ role: 'user', text: buildEstimatePrompt(req), image: req.image }],
    schema: ESTIMATE_SCHEMA as unknown as Record<string, unknown>,
    schemaName: 'meal_estimate',
    effort: 'medium',
    onWait: options.onWait,
  })
  const parsed = AiResult.safeParse(parseJsonLoose(text))
  if (!parsed.success) throw new AiError('unknown', 'The estimate came back in an unexpected format. Try again.')
  return parsed.data
}

const COACH_HISTORY = 6

/** The last few turns, starting on a user turn so every provider accepts the order. */
export function recentTurns(turns: AiTurn[], max: number): AiTurn[] {
  const recent = turns.slice(-max)
  const first = recent.findIndex((t) => t.role === 'user')
  return first <= 0 ? recent : recent.slice(first)
}

/**
 * The conversation goes over as one message: a short transcript, then the new
 * message. Earlier replies sent back as prose turns tempt the model to answer
 * in prose, which breaks the JSON it must return. The log in the context
 * already carries what matters, so only the last few turns are kept.
 */
export function coachPrompt(turns: AiTurn[]): string {
  const recent = recentTurns(turns, COACH_HISTORY)
  const lastUser = recent.map((t) => t.role).lastIndexOf('user')
  const current = recent[lastUser]?.text ?? ''
  const earlier = recent.slice(0, Math.max(0, lastUser))
  if (!earlier.length) return current
  const transcript = earlier.map((t) => `${t.role === 'user' ? 'Me' : 'Coach'}: ${t.text}`).join('\n')
  return `Earlier in this chat:\n${transcript}\n\nMy message now: ${current}`
}

/** The coach: logs what was eaten, suggests what to eat, and answers "should I?". */
export async function askCoach(settings: AiSettings, turns: AiTurn[], context: string, options: CallOptions = {}): Promise<CoachResultData> {
  const text = await completeJson(settings, {
    system: `${COACH_SYSTEM}\n\n${context}`,
    turns: [{ role: 'user', text: coachPrompt(turns) }],
    schema: COACH_SCHEMA as unknown as Record<string, unknown>,
    schemaName: 'coach_reply',
    temperature: 0.5,
    effort: 'low',
    onWait: options.onWait,
  })
  const parsed = CoachResult.safeParse(parseJsonLoose(text))
  if (!parsed.success) throw new AiError('unknown', 'The coach answered in an unexpected format. Try again.')
  return parsed.data
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
