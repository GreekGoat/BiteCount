import Anthropic from '@anthropic-ai/sdk'
import { AiError, toStrictSchema, type JsonRequest } from './ai-types'
import type { ModelChoice } from './ai-gemini'

/*
 * Claude, called straight from the phone with the user's own key.
 */

const client = (apiKey: string) =>
  new Anthropic({
    apiKey,
    dangerouslyAllowBrowser: true,
    timeout: 120_000,
    maxRetries: 1,
  })

function toAiError(error: unknown): AiError {
  if (error instanceof AiError) return error
  if (error instanceof Anthropic.AuthenticationError) return new AiError('auth', 'That Claude key was rejected.', 'Copy it again from console.anthropic.com.')
  if (error instanceof Anthropic.PermissionDeniedError) return new AiError('auth', 'This key is not allowed to use that model.')
  if (error instanceof Anthropic.RateLimitError) return new AiError('rate', 'Rate limited by the API. Wait a moment and try again.')
  if (error instanceof Anthropic.APIConnectionError) return new AiError('network', 'Could not reach Claude. Check your connection.')
  if (error instanceof Anthropic.APIError) return new AiError('unknown', error.message || 'The API returned an error.')
  return new AiError('unknown', error instanceof Error ? error.message : 'Something went wrong.')
}

export async function completeJsonClaude(apiKey: string, model: string, req: JsonRequest): Promise<string> {
  const messages: Anthropic.Beta.BetaMessageParam[] = req.turns.map((turn) => {
    if (turn.role === 'assistant') return { role: 'assistant', content: turn.text }
    const content: Anthropic.Beta.BetaContentBlockParam[] = []
    if (turn.image) {
      content.push({ type: 'image', source: { type: 'base64', media_type: turn.image.mediaType as 'image/jpeg', data: turn.image.data } })
    }
    content.push({ type: 'text', text: turn.text })
    return { role: 'user', content }
  })

  try {
    const response = await client(apiKey).beta.messages.create({
      model,
      max_tokens: 8000,
      system: req.system,
      thinking: { type: 'adaptive' },
      output_config: {
        effort: req.effort ?? 'medium',
        format: { type: 'json_schema', schema: toStrictSchema(req.schema) },
      },
      // Opus 5 can decline a request; let the API retry it on a fallback model.
      ...(model === 'claude-opus-5' ? { betas: ['server-side-fallback-2026-07-01' as const], fallbacks: 'default' as const } : {}),
      messages,
    })

    if (response.stop_reason === 'refusal') {
      throw new AiError('refused', 'Claude would not answer this one. Try putting it differently.')
    }
    const text = response.content.map((block) => (block.type === 'text' ? block.text : '')).join('')
    if (!text.trim()) throw new AiError('unknown', 'Claude sent an empty answer. Try again.')
    return text
  } catch (error) {
    throw toAiError(error)
  }
}

export async function listClaudeModels(apiKey: string): Promise<ModelChoice[]> {
  try {
    const page = await client(apiKey).models.list({ limit: 20 })
    return page.data
      .filter((m) => /^claude-(opus|sonnet|haiku|fable)/.test(m.id))
      .map((m) => ({ id: m.id, label: m.display_name ?? m.id }))
      .slice(0, 8)
  } catch (error) {
    throw toAiError(error)
  }
}
