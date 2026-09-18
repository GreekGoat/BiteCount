import { z } from 'zod'

/** Shared contract for every AI provider BiteCount can talk to. */

export const AiItem = z.object({
  name: z.string().describe('Short food name, e.g. "Chicken curry"'),
  emoji: z.string().describe('One emoji for this food'),
  portion: z.string().describe('Readable portion, e.g. "1 medium bowl"'),
  grams: z.number().describe('Estimated weight in grams (or ml for drinks)'),
  kcal: z.number(),
  protein_g: z.number(),
  carbs_g: z.number(),
  fat_g: z.number(),
})

export const AiQuestion = z.object({
  id: z.string(),
  question: z.string().describe('One short question, under 60 characters'),
  options: z.array(z.string()).describe('2 to 5 concrete answers with a size cue where useful'),
})

export const AiResult = z.object({
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

/** The same shape as a plain JSON Schema, for providers that want one. */
export const AI_JSON_SCHEMA = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['need_info', 'estimate'] },
    questions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          question: { type: 'string', description: 'One short question, under 60 characters' },
          options: { type: 'array', items: { type: 'string' }, description: '2 to 5 concrete answers with a size cue' },
        },
        required: ['id', 'question', 'options'],
        propertyOrdering: ['id', 'question', 'options'],
      },
    },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          emoji: { type: 'string', description: 'One emoji for this food' },
          portion: { type: 'string', description: 'Readable portion, e.g. "1 medium bowl"' },
          grams: { type: 'number' },
          kcal: { type: 'number' },
          protein_g: { type: 'number' },
          carbs_g: { type: 'number' },
          fat_g: { type: 'number' },
        },
        required: ['name', 'emoji', 'portion', 'grams', 'kcal', 'protein_g', 'carbs_g', 'fat_g'],
        propertyOrdering: ['name', 'emoji', 'portion', 'grams', 'kcal', 'protein_g', 'carbs_g', 'fat_g'],
      },
    },
    confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
    low_kcal: { type: 'number' },
    high_kcal: { type: 'number' },
    notes: { type: 'string', description: 'Under 140 characters: the assumptions that matter' },
  },
  required: ['status', 'questions', 'items', 'confidence', 'low_kcal', 'high_kcal', 'notes'],
  propertyOrdering: ['status', 'questions', 'items', 'confidence', 'low_kcal', 'high_kcal', 'notes'],
} as const

export const SYSTEM_PROMPT = `You estimate the calories and macronutrients of meals people describe in their own words.

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

Always end with a usable estimate rather than a refusal. Be decisive and realistic: someone is logging a meal, not filing a lab report.

Reply with JSON matching the required shape. Use an empty array for questions when you are giving an estimate, and an empty array for items when you are asking questions.`

export class AiError extends Error {
  kind: 'auth' | 'rate' | 'network' | 'refused' | 'blocked' | 'unknown'
  hint?: string
  constructor(kind: AiError['kind'], message: string, hint?: string) {
    super(message)
    this.kind = kind
    this.hint = hint
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

export function buildPrompt(req: AiRequest): string {
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

export const macrosFromAiItem = (item: AiItemData) => ({
  kcal: Math.max(0, Math.round(item.kcal)),
  p: Math.max(0, Math.round(item.protein_g * 10) / 10),
  c: Math.max(0, Math.round(item.carbs_g * 10) / 10),
  f: Math.max(0, Math.round(item.fat_g * 10) / 10),
})

/** Providers sometimes wrap JSON in prose or a code fence. */
export function parseAiJson(raw: string): AiResultData {
  const text = raw.trim()
  const candidates = [text]
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fence) candidates.push(fence[1])
  const braces = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)
  if (braces) candidates.push(braces)

  for (const candidate of candidates) {
    try {
      const parsed = AiResult.safeParse(JSON.parse(candidate))
      if (parsed.success) return parsed.data
    } catch {
      // Try the next shape.
    }
  }
  throw new AiError('unknown', 'The estimate came back in an unexpected format. Try again.')
}
