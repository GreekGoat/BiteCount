/** Kept apart from ai.ts so screens can list models without pulling in the SDK. */
export const AI_MODELS = [
  { id: 'claude-opus-5', label: 'Claude Opus 5', hint: 'Most accurate' },
  { id: 'claude-sonnet-5', label: 'Claude Sonnet 5', hint: 'Faster and cheaper' },
] as const

export type AiModel = (typeof AI_MODELS)[number]['id']
