import Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import { AiError, AiResult, buildPrompt, SYSTEM_PROMPT, type AiRequest, type AiResultData } from './ai-types'
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

export async function estimateWithClaude(apiKey: string, model: string, req: AiRequest): Promise<AiResultData> {
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
      system: SYSTEM_PROMPT,
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
