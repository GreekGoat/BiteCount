/** Kept apart from the provider modules so screens can list them without loading any SDK. */

export type AiProvider = 'gemini' | 'groq' | 'claude'

export interface ProviderInfo {
  id: AiProvider
  label: string
  short: string
  keyHint: string
  keyPlaceholder: string
  keyUrl: string
  keyUrlLabel: string
  /** Sensible default when the key has not been checked yet. */
  defaultModel: string
  fallbackModels: { id: string; label: string }[]
  /** Can it read a photo of the meal? */
  vision: boolean
  /** Supports an optional self-hosted proxy that holds the key server-side. */
  proxyable?: boolean
}

export const PROVIDERS: ProviderInfo[] = [
  {
    id: 'gemini',
    label: 'Google Gemini',
    short: 'Gemini',
    keyHint: 'Free tier available. Stored only on this phone.',
    keyPlaceholder: 'AIza… or AQ.…',
    keyUrl: 'https://aistudio.google.com/apikey',
    keyUrlLabel: 'aistudio.google.com/apikey',
    defaultModel: 'gemini-3.8-flash',
    fallbackModels: [
      { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash' },
      { id: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash' },
      { id: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro' },
    ],
    vision: true,
  },
  {
    id: 'groq',
    label: 'Groq',
    short: 'Groq',
    keyHint: 'Fast and free to start. Text only — no meal photos.',
    keyPlaceholder: 'gsk_…',
    keyUrl: 'https://console.groq.com/keys',
    keyUrlLabel: 'console.groq.com/keys',
    defaultModel: 'openai/gpt-oss-120b',
    fallbackModels: [
      { id: 'openai/gpt-oss-120b', label: 'GPT-OSS 120B' },
      { id: 'openai/gpt-oss-20b', label: 'GPT-OSS 20B' },
      { id: 'groq/compound', label: 'Compound' },
      { id: 'qwen/qwen3.8-27b', label: 'Qwen3.8 27B' },
    ],
    vision: false,
    proxyable: true,
  },
  {
    id: 'claude',
    label: 'Anthropic Claude',
    short: 'Claude',
    keyHint: 'Pay as you go. Stored only on this phone.',
    keyPlaceholder: 'sk-ant-…',
    keyUrl: 'https://console.anthropic.com/settings/keys',
    keyUrlLabel: 'console.anthropic.com',
    defaultModel: 'claude-opus-5',
    fallbackModels: [
      { id: 'claude-opus-5', label: 'Claude Opus 5' },
      { id: 'claude-sonnet-5', label: 'Claude Sonnet 5' },
      { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5' },
    ],
    vision: true,
  },
]

export const providerInfo = (id: AiProvider) => PROVIDERS.find((p) => p.id === id) ?? PROVIDERS[0]
