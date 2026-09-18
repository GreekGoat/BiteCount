/**
 * The same proxy as a Next.js route, for anyone running BiteCount behind a Node
 * host (Vercel, etc.) rather than GitHub Pages.
 *
 * Copy this file to `app/api/estimate/route.js` in that project, set
 * GROQ_API_KEY in the host's environment variables, and point
 * You → AI estimation → Server proxy at /api/estimate.
 *
 * It accepts either shape:
 *   { "text": "grilled chicken sandwich" }           → builds the prompt here
 *   { "model": ..., "messages": [...] }              → passes through (what the app sends)
 */

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const DEFAULT_MODEL = 'openai/gpt-oss-120b'

const SYSTEM_PROMPT = `You estimate the calories and macronutrients of meals people describe in their own words.
Break the meal into the foods it is actually made of and give each one its own line.
Account for portion size, cooking oil or ghee, bones, and sugar in drinks.
Keep calories consistent with the macros: kcal within about 10% of 4*protein + 4*carbs + 9*fat.
Reply with JSON only.`

const SCHEMA = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['need_info', 'estimate'] },
    questions: {
      type: 'array',
      items: {
        type: 'object',
        properties: { id: { type: 'string' }, question: { type: 'string' }, options: { type: 'array', items: { type: 'string' } } },
        required: ['id', 'question', 'options'],
        additionalProperties: false,
      },
    },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          emoji: { type: 'string' },
          portion: { type: 'string' },
          grams: { type: 'number' },
          kcal: { type: 'number' },
          protein_g: { type: 'number' },
          carbs_g: { type: 'number' },
          fat_g: { type: 'number' },
        },
        required: ['name', 'emoji', 'portion', 'grams', 'kcal', 'protein_g', 'carbs_g', 'fat_g'],
        additionalProperties: false,
      },
    },
    confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
    low_kcal: { type: 'number' },
    high_kcal: { type: 'number' },
    notes: { type: 'string' },
  },
  required: ['status', 'questions', 'items', 'confidence', 'low_kcal', 'high_kcal', 'notes'],
  additionalProperties: false,
}

export async function POST(request) {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    return Response.json({ error: { message: 'GROQ_API_KEY is not set on the server.' } }, { status: 500 })
  }

  let body
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: { message: 'Invalid JSON.' } }, { status: 400 })
  }

  const messages = Array.isArray(body.messages)
    ? body.messages.slice(0, 8)
    : [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Here is what I ate.\nMy description: ${String(body.text ?? '').slice(0, 2000)}\n\nGive the estimate now (status "estimate").` },
      ]

  if (!messages.length) return Response.json({ error: { message: 'No meal description.' } }, { status: 400 })

  const upstream = await fetch(GROQ_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: typeof body.model === 'string' ? body.model : DEFAULT_MODEL,
      temperature: typeof body.temperature === 'number' ? body.temperature : 0.4,
      messages,
      response_format: body.response_format ?? {
        type: 'json_schema',
        json_schema: { name: 'meal_estimate', strict: true, schema: SCHEMA },
      },
    }),
  })

  const data = await upstream.json()
  if (!upstream.ok) return Response.json(data, { status: upstream.status })

  // Pass the raw completion through when the app asked for it; otherwise unwrap
  // the JSON so a simple frontend can use it directly.
  if (Array.isArray(body.messages)) return Response.json(data)
  try {
    return Response.json(JSON.parse(data.choices?.[0]?.message?.content ?? '{}'))
  } catch {
    return Response.json({ error: { message: 'Model did not return JSON.' } }, { status: 502 })
  }
}
