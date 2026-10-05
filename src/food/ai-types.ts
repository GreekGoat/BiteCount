import { z } from 'zod'

/*
 * Shared contract for every AI provider BiteCount can talk to.
 *
 * Each provider implements one thing — "send these turns, get JSON matching this
 * schema back" — and the two features (estimating a meal, and the coach) are
 * built on top of it here.
 */

// ── Turns and requests ───────────────────────────────────────────────

export interface AiImage {
  data: string
  mediaType: string
}

export interface AiTurn {
  role: 'user' | 'assistant'
  text: string
  image?: AiImage
}

export interface JsonRequest {
  system: string
  turns: AiTurn[]
  /** Plain JSON Schema. Providers adapt it to their own dialect. */
  schema: Record<string, unknown>
  schemaName: string
  temperature?: number
  /** How hard the model should think: low is fastest. */
  effort?: 'low' | 'medium' | 'high'
  /** Called when a rate limit makes the request wait before retrying. */
  onWait?: (seconds: number) => void
}

export class AiError extends Error {
  kind: 'auth' | 'rate' | 'network' | 'refused' | 'blocked' | 'unknown'
  hint?: string
  constructor(kind: AiError['kind'], message: string, hint?: string) {
    super(message)
    this.kind = kind
    this.hint = hint
  }
}

// ── Schema dialects ──────────────────────────────────────────────────

/** OpenAI-style strict mode (Groq, Claude): every object closed, no Gemini-only keys. */
export function toStrictSchema(schema: unknown): Record<string, unknown> {
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

/** Gemini's OpenAPI subset: no additionalProperties; propertyOrdering keeps output stable. */
export function toGeminiSchema(schema: unknown): Record<string, unknown> {
  if (Array.isArray(schema)) return schema.map(toGeminiSchema) as unknown as Record<string, unknown>
  if (!schema || typeof schema !== 'object') return schema as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(schema as Record<string, unknown>)) {
    if (key === 'additionalProperties') continue
    out[key] = typeof value === 'object' && value !== null ? toGeminiSchema(value) : value
  }
  if (out.type === 'object' && out.properties && !out.propertyOrdering) {
    out.propertyOrdering = Object.keys(out.properties as object)
  }
  return out
}

/** Providers sometimes wrap JSON in prose or a code fence. */
export function parseJsonLoose(raw: string): unknown {
  const text = raw.trim()
  const candidates = [text]
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fence) candidates.push(fence[1])
  const first = text.indexOf('{')
  const last = text.lastIndexOf('}')
  if (first >= 0 && last > first) candidates.push(text.slice(first, last + 1))
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate)
    } catch {
      // Try the next shape.
    }
  }
  throw new AiError('unknown', 'The answer came back in an unexpected format. Try again.')
}

// ── Meals ────────────────────────────────────────────────────────────

export const MEAL_VALUES = ['breakfast', 'lunch', 'dinner', 'snack', 'unspecified'] as const
export type AiMeal = (typeof MEAL_VALUES)[number]

const itemProperties = {
  name: { type: 'string' },
  emoji: { type: 'string' },
  portion: { type: 'string', description: 'e.g. "1 medium bowl"' },
  grams: { type: 'number' },
  kcal: { type: 'number' },
  protein_g: { type: 'number' },
  carbs_g: { type: 'number' },
  fat_g: { type: 'number' },
  meal: { type: 'string', enum: MEAL_VALUES },
}

export const AiItem = z.object({
  name: z.string(),
  emoji: z.string(),
  portion: z.string(),
  grams: z.number(),
  kcal: z.number(),
  protein_g: z.number(),
  carbs_g: z.number(),
  fat_g: z.number(),
  meal: z.enum(MEAL_VALUES).catch('unspecified'),
})
export type AiItemData = z.infer<typeof AiItem>

export const macrosFromAiItem = (item: { kcal: number; protein_g: number; carbs_g: number; fat_g: number }) => ({
  kcal: Math.max(0, Math.round(item.kcal)),
  p: Math.max(0, Math.round(item.protein_g * 10) / 10),
  c: Math.max(0, Math.round(item.carbs_g * 10) / 10),
  f: Math.max(0, Math.round(item.fat_g * 10) / 10),
})

// Kept short on purpose: Groq's free tier allows 8,000 tokens a minute.
const NUTRITION_RULES = `Estimating:
- Use standard food tables (USDA; IFCT for South Asian dishes). One item per food eaten.
- Portion, oil or ghee, bones, sugar and sauces move the number most. South Asian cooking uses more oil than reference values; restaurant food more again.
- grams = edible weight (ml for drinks). kcal within ~10% of 4×protein + 4×carbs + 9×fat.
- Anchors (typical Dhaka portions): paratha 260 each, roti 110 each, 1 cup cooked rice 205, a plate of biryani/tehari/kacchi 750–900, a bowl of meat or fish curry 300–400, dal bowl 180, singara/samosa 180–260, puri 140. "cha"/"chai" means milk tea with sugar, ~75 a cup, unless they say black or lal cha.
- meal = when they said they ate it: breakfast (morning, sehri), lunch (noon), snack (afternoon, evening, tea time, iftar, late night), dinner (night). A meal word covers the foods after it until another is named. Not said → "unspecified". Never guess a meal from the food.`

// ── Feature 1: estimating a meal ─────────────────────────────────────

export const AiQuestion = z.object({ id: z.string(), question: z.string(), options: z.array(z.string()) })

export const AiResult = z.object({
  status: z.enum(['need_info', 'estimate']),
  questions: z.array(AiQuestion),
  items: z.array(AiItem),
  confidence: z.enum(['low', 'medium', 'high']).catch('medium'),
  low_kcal: z.number().catch(0),
  high_kcal: z.number().catch(0),
  notes: z.string().catch(''),
})
export type AiResultData = z.infer<typeof AiResult>

export const ESTIMATE_SCHEMA = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['need_info', 'estimate'] },
    questions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          question: { type: 'string', description: 'Under 60 characters' },
          options: { type: 'array', items: { type: 'string' } },
        },
        required: ['id', 'question', 'options'],
      },
    },
    items: {
      type: 'array',
      items: { type: 'object', properties: itemProperties, required: Object.keys(itemProperties) },
    },
    confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
    low_kcal: { type: 'number', description: 'Realistic range for the total' },
    high_kcal: { type: 'number' },
    notes: { type: 'string', description: 'Key assumptions, under 140 characters' },
  },
  required: ['status', 'questions', 'items', 'confidence', 'low_kcal', 'high_kcal', 'notes'],
} as const

export const ESTIMATE_SYSTEM = `You estimate calories and macros for food people describe in their own words: one dish, a meal, or a whole day.

${NUTRITION_RULES}

Questions: only if an answer would change the total by over ~15%. At most 3, one round, never about what they already said, each with 2–5 options carrying a size cue ("Medium bowl (~1.5 cups)"). For a whole day, estimate with typical portions instead. If told to skip, estimate the typical version.

Always end with a usable estimate. Empty questions when estimating; empty items when asking.`

export interface AiAnswer {
  question: string
  answer: string
}

export interface AiRequest {
  /** What the user typed. May be empty when they only sent a photo. */
  text: string
  image?: AiImage
  answers?: AiAnswer[]
  /** The user asked to skip the questions. */
  skipQuestions?: boolean
}

export function buildEstimatePrompt(req: AiRequest): string {
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

// ── Feature 2: the coach ─────────────────────────────────────────────

export const CoachSuggestion = z.object({
  name: z.string(),
  emoji: z.string(),
  portion: z.string(),
  kcal: z.number(),
  protein_g: z.number(),
  carbs_g: z.number(),
  fat_g: z.number(),
  meal: z.enum(MEAL_VALUES).catch('unspecified'),
  why: z.string().catch(''),
})

export const CoachResult = z.object({
  reply: z.string(),
  intent: z.enum(['log', 'suggest', 'verdict', 'answer']).catch('answer'),
  // date is YYYY-MM-DD; day is what older saved replies carried.
  log_items: z.array(AiItem.extend({ date: z.string().catch(''), day: z.enum(['today', 'yesterday']).optional().catch(undefined) })).catch([]),
  suggestions: z.array(CoachSuggestion).catch([]),
  verdict: z
    .object({ decision: z.enum(['yes', 'smaller', 'no', 'none']).catch('none'), headline: z.string().catch('') })
    .catch({ decision: 'none', headline: '' }),
})
export type CoachResultData = z.infer<typeof CoachResult>
export type CoachSuggestionData = z.infer<typeof CoachSuggestion>

const suggestionProperties = {
  name: { type: 'string' },
  emoji: { type: 'string' },
  portion: { type: 'string' },
  kcal: { type: 'number' },
  protein_g: { type: 'number' },
  carbs_g: { type: 'number' },
  fat_g: { type: 'number' },
  meal: { type: 'string', enum: MEAL_VALUES },
  why: { type: 'string', description: 'Why it fits today, under 90 characters' },
}

export const COACH_SCHEMA = {
  type: 'object',
  properties: {
    reply: { type: 'string' },
    intent: { type: 'string', enum: ['log', 'suggest', 'verdict', 'answer'] },
    log_items: {
      type: 'array',
      description: 'Only food already eaten',
      items: {
        type: 'object',
        properties: { ...itemProperties, date: { type: 'string', description: 'YYYY-MM-DD it was eaten' } },
        required: [...Object.keys(itemProperties), 'date'],
      },
    },
    suggestions: {
      type: 'array',
      items: { type: 'object', properties: suggestionProperties, required: Object.keys(suggestionProperties) },
    },
    verdict: {
      type: 'object',
      properties: {
        decision: { type: 'string', enum: ['yes', 'smaller', 'no', 'none'] },
        headline: { type: 'string', description: 'Under 50 characters, e.g. "Yes, with 600 to spare"; empty when none' },
      },
      required: ['decision', 'headline'],
    },
  },
  required: ['reply', 'intent', 'log_items', 'suggestions', 'verdict'],
} as const

export const COACH_SYSTEM = `You are the coach in BiteCount, a calorie tracker. Warm, brief, practical, like a knowledgeable friend. Never lecture or shame; no medical advice.

intent:
- log: they say what they ATE (a food, a meal, a whole day). Put every food in log_items with date = the day it was eaten (YYYY-MM-DD): today unless they say otherwise ("yesterday", "on Monday", "3 days ago", a date), worked out from today's date below. The app adds up and shows the totals, so do not quote totals; reply with one useful observation (e.g. protein is low, room for a light snack). Never log food they are only planning or asking about.
- suggest: they want ideas or what to eat next. 2–4 suggestions that fit what is left, closing the protein gap first, in the cuisine they eat.
- verdict: "should I eat X?". decision yes (fits easily), smaller (fits as a smaller portion or lighter side), no (clearly over). Unless yes, add a smaller portion or swap to suggestions.
- answer: anything else, from their numbers.

reply: 1–4 short plain sentences, no markdown or lists (the app shows cards). Use their plan and log below; "left" can be negative, say so kindly. Round kcal to 5.

${NUTRITION_RULES}`
