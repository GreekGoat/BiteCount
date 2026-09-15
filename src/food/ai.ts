import Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import { z } from 'zod'

/*
 * AI estimation runs straight from the phone against the user's own Claude API
 * key, which never leaves the device. This module is imported lazily so the SDK
 * is not part of the main bundle.
 */

export type { AiModel } from './ai-models'
import type { AiModel } from './ai-models'

const AiItem = z.object({
  name: z.string().describe('Short food name, e.g. "Chicken curry"'),
  emoji: z.string().describe('One emoji for this food'),
  portion: z.string().describe('Readable portion, e.g. "1 medium bowl"'),
  grams: z.number().describe('Estimated weight in grams (or ml for drinks)'),
  kcal: z.number(),
  protein_g: z.number(),
  carbs_g: z.number(),
  fat_g: z.number(),
})

const AiQuestion = z.object({
  id: z.string(),
  question: z.string().describe('One short question, under 60 characters'),
  options: z.array(z.string()).describe('2 to 5 concrete answers with a size cue where useful'),
})

const AiResult = z.object({
  status: z.enum(['need_info', 'estimate']),
  questions: z.array(AiQuestion).describe('Up to 3 questions when status is need_info, otherwise empty'),
  items: z.array(AiItem).describe('The foods in this meal when status is estimate, otherwise empty'),
  confidence: z.enum(['low', 'medium', 'high']),
  low_kcal: z.number().describe('Low end of a realistic range for the whole meal'),
  high_kcal: z.number().describe('High end of a realistic range for the whole meal'),
  notes: z.string().describe('Under 140 characters: the assumptions that matter'),
})

export type AiResultData = z.infer<typeof AiResult>
export type AiItemData = z.infer<typeof AiItem>

const SYSTEM = `You estimate the calories and macronutrients of meals people describe in their own words.

How to estimate:
- Work from standard food composition data (USDA FoodData Central, and Indian/Bangladeshi tables such as IFCT for South Asian dishes).
- Break the meal into the foods it is actually made of and give each one its own line.
- Account for what usually changes the number most: portion size, cooking oil or ghee, whether meat was on the bone, skin, sugar in drinks, dressings and sauces.
- South Asian home and restaurant cooking uses noticeably more oil than plain reference entries; restaurant and wedding food more again.
- Weights are edible portion in grams (ml for drinks). If a portion included bones or shells, estimate only what was eaten.
- Keep calories consistent with the macros: kcal should be within about 10% of 4*protein + 4*carbs + 9*fat, except for alcohol.

Asking questions:
- Ask only when an answer would change the estimate by more than roughly 15%, at most 3 questions, each with concrete options that include a size or amount cue (for example "Medium bowl (about 1.5 cups)").
- Never ask about anything the person already told you, and never ask more than one round of questions.
- If they say to skip the questions or just estimate, assume the most typical version and answer with an estimate.

Always end with a usable estimate rather than a refusal. Be decisive and realistic: someone is logging a meal, not filing a lab report.`

export class AiError extends Error {
  kind: 'auth' | 'rate' | 'network' | 'refused' | 'unknown'
  constructor(kind: AiError['kind'], message: string) {
    super(message)
    this.kind = kind
  }
}

export interface AiAnswer {
  question: string
  answer: string
}

export interface AiRequest {
  /** What the user typed. May be empty when they only sent a photo. */
  text: string
  image?: { data: string; mediaType: string }
  answers?: AiAnswer[]
  /** The user asked to skip the questions. */
  skipQuestions?: boolean
}

const client = (apiKey: string) =>
  new Anthropic({
    apiKey,
    dangerouslyAllowBrowser: true,
    timeout: 120_000,
    maxRetries: 1,
  })

function buildPrompt(req: AiRequest): string {
  const lines: string[] = []
  lines.push(req.image ? 'Here is a photo of what I ate.' : 'Here is what I ate.')
  if (req.text.trim()) lines.push(`My description: ${req.text.trim()}`)
  if (req.answers?.length) {
    lines.push('', 'Answers to your questions:')
    for (const a of req.answers) lines.push(`- ${a.question} → ${a.answer}`)
  }
  if (req.skipQuestions || req.answers?.length) {
    lines.push('', 'Give the estimate now (status "estimate"). Assume the most typical version of anything still unclear.')
  } else {
    lines.push('', 'If details you are missing would change the number by more than about 15%, ask up to 3 short questions (status "need_info"). Otherwise give the estimate.')
  }
  return lines.join('\n')
}

export async function estimateWithAi(apiKey: string, model: AiModel, req: AiRequest): Promise<AiResultData> {
  const content: Anthropic.Beta.BetaContentBlockParam[] = []
  if (req.image) {
    content.push({
      type: 'image',
      source: { type: 'base64', media_type: req.image.mediaType as 'image/jpeg', data: req.image.data },
    })
  }
  content.push({ type: 'text', text: buildPrompt(req) })

  try {
    const response = await client(apiKey).beta.messages.parse({
      model,
      max_tokens: 8000,
      system: SYSTEM,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'medium', format: betaZodOutputFormat(AiResult) },
      // Opus 5 can decline a request; let the API retry it on a fallback model.
      ...(model === 'claude-opus-5' ? { betas: ['server-side-fallback-2026-07-01' as const], fallbacks: 'default' as const } : {}),
      messages: [{ role: 'user', content }],
    })

    if (response.stop_reason === 'refusal') {
      throw new AiError('refused', 'Claude would not estimate this one. Try describing it differently.')
    }
    const parsed = response.parsed_output
    if (!parsed) throw new AiError('unknown', 'Could not read the estimate. Try again.')
    return parsed
  } catch (error) {
    throw toAiError(error)
  }
}

function toAiError(error: unknown): AiError {
  if (error instanceof AiError) return error
  if (error instanceof Anthropic.AuthenticationError) return new AiError('auth', 'That API key was rejected. Check it in Settings.')
  if (error instanceof Anthropic.PermissionDeniedError) return new AiError('auth', 'This key is not allowed to use that model.')
  if (error instanceof Anthropic.RateLimitError) return new AiError('rate', 'Rate limited by the API. Wait a moment and try again.')
  if (error instanceof Anthropic.APIConnectionError) return new AiError('network', 'Could not reach Claude. Check your connection.')
  if (error instanceof Anthropic.APIError) return new AiError('unknown', error.message || 'The API returned an error.')
  return new AiError('unknown', error instanceof Error ? error.message : 'Something went wrong.')
}

/** Cheap check that a key works, without spending tokens. */
export async function verifyKey(apiKey: string): Promise<void> {
  try {
    await client(apiKey).models.list({ limit: 1 })
  } catch (error) {
    throw toAiError(error)
  }
}

export const macrosFromAiItem = (item: AiItemData) => ({
  kcal: Math.max(0, Math.round(item.kcal)),
  p: Math.max(0, Math.round(item.protein_g * 10) / 10),
  c: Math.max(0, Math.round(item.carbs_g * 10) / 10),
  f: Math.max(0, Math.round(item.fat_g * 10) / 10),
})
