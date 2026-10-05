import { useMemo } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CoachResultData } from '../food/ai-types'
import { providerInfo, type AiProvider } from '../food/ai-models'
import type { Macros } from '../food/types'
import { dayKey, type DayKey, type Meal } from './date'
import { computePlan, PLAN_DEFAULTS, type Plan, type PlanSettings, waterGoalMl } from './plan'
import type { Units } from './units'

export type Sex = 'male' | 'female' | 'unspecified'

export interface Profile {
  name: string
  sex: Sex
  age: number
  heightCm: number
  weightKg: number
  goalKg?: number
  units: Units
}

export interface LogEntry {
  id: string
  date: DayKey
  meal: Meal
  name: string
  emoji: string
  portion: string
  kcal: number
  p: number
  c: number
  f: number
  foodId?: string
  source: 'db' | 'ai' | 'custom' | 'quick' | 'estimate'
  note?: string
  createdAt: number
}

export interface WeightEntry {
  date: DayKey
  kg: number
}

export interface SavedFood {
  id: string
  name: string
  emoji: string
  portion: string
  macros: Macros
  createdAt: number
}

export interface ProviderSettings {
  key: string
  model: string
  /** Models this key was last seen to support. */
  models?: { id: string; label: string }[]
  /** Optional endpoint that holds the key server-side (Groq). */
  proxyUrl?: string
}

/** One message in the coach conversation. */
export interface CoachMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  createdAt: number
  /** Assistant only: the structured answer behind the reply. */
  result?: CoachResultData
  /** Entries created from this message's log proposal, kept for undo. */
  logged?: string[]
  /** Suggestion index → the entry it was logged as. */
  picked?: Record<number, string>
  /** The meal for items the person gave no time for. */
  unsure?: Meal
  /** The request failed; the text says why. */
  error?: boolean
}

export interface CoachState {
  date: DayKey
  messages: CoachMessage[]
}

export interface Settings {
  theme: 'system' | 'dark' | 'light'
  /** Liquid Glass look: clear lets more through, tinted is frostier. */
  glass: 'clear' | 'tinted'
  haptics: boolean
  reduceMotion: boolean
  aiEnabled: boolean
  aiProvider: AiProvider
  ai: Record<AiProvider, ProviderSettings>
  waterGoal: number
}

export interface BiteState {
  onboarded: boolean
  profile: Profile
  plan: PlanSettings
  entries: LogEntry[]
  weights: WeightEntry[]
  water: Record<DayKey, number>
  saved: SavedFood[]
  settings: Settings
  coach: CoachState

  finishOnboarding: (profile: Profile, plan: PlanSettings) => void
  updateProfile: (patch: Partial<Profile>) => void
  updatePlan: (patch: Partial<PlanSettings>) => void
  /** Returns the entries as stored, with their ids. */
  addEntries: (entries: Omit<LogEntry, 'id' | 'createdAt'>[]) => LogEntry[]
  removeEntries: (ids: string[]) => void
  updateEntry: (id: string, patch: Partial<LogEntry>) => void
  removeEntry: (id: string) => void
  restoreEntry: (entry: LogEntry) => void
  logWeight: (kg: number, date?: DayKey) => void
  addWater: (ml: number, date?: DayKey) => void
  saveFood: (food: Omit<SavedFood, 'id' | 'createdAt'>) => void
  removeSaved: (id: string) => void
  updateSettings: (patch: Partial<Settings>) => void
  updateProvider: (provider: AiProvider, patch: Partial<ProviderSettings>) => void
  addCoachMessage: (message: Omit<CoachMessage, 'id' | 'createdAt'>) => string
  updateCoachMessage: (id: string, patch: Partial<CoachMessage>) => void
  removeCoachMessage: (id: string) => void
  /** Starts a fresh conversation (also happens on its own each new day). */
  clearCoach: () => void
  importState: (data: Partial<BiteState>) => void
  resetAll: () => void
}

export const DEFAULT_PROFILE: Profile = {
  name: '',
  sex: 'unspecified',
  age: 25,
  heightCm: 170,
  weightKg: 70,
  units: 'metric',
}

const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  glass: 'clear',
  haptics: true,
  reduceMotion: false,
  aiEnabled: true,
  aiProvider: 'gemini',
  ai: {
    gemini: { key: '', model: providerInfo('gemini').defaultModel },
    groq: { key: '', model: providerInfo('groq').defaultModel },
    claude: { key: '', model: providerInfo('claude').defaultModel },
  },
  waterGoal: waterGoalMl(DEFAULT_PROFILE.weightKg),
}

const emptyCoach = (): CoachState => ({ date: dayKey(), messages: [] })

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`)

export const useStore = create<BiteState>()(
  persist(
    (set) => ({
      onboarded: false,
      profile: DEFAULT_PROFILE,
      plan: { ...PLAN_DEFAULTS },
      entries: [],
      weights: [],
      water: {},
      saved: [],
      settings: DEFAULT_SETTINGS,
      coach: emptyCoach(),

      finishOnboarding: (profile, plan) =>
        set((s) => ({
          onboarded: true,
          profile,
          plan,
          weights: [{ date: dayKey(), kg: profile.weightKg }],
          settings: { ...s.settings, waterGoal: waterGoalMl(profile.weightKg) },
        })),

      updateProfile: (patch) => set((s) => ({ profile: { ...s.profile, ...patch } })),
      updatePlan: (patch) => set((s) => ({ plan: { ...s.plan, ...patch } })),

      addEntries: (entries) => {
        const now = Date.now()
        const created = entries.map((e, i) => ({ ...e, id: uid(), createdAt: now + i }))
        set((s) => ({ entries: [...s.entries, ...created] }))
        return created
      },

      removeEntries: (ids) => {
        const drop = new Set(ids)
        set((s) => ({ entries: s.entries.filter((e) => !drop.has(e.id)) }))
      },

      updateEntry: (id, patch) => set((s) => ({ entries: s.entries.map((e) => (e.id === id ? { ...e, ...patch } : e)) })),
      removeEntry: (id) => set((s) => ({ entries: s.entries.filter((e) => e.id !== id) })),

      // Puts a deleted item back exactly as it was, for undo.
      restoreEntry: (entry) => set((s) => (s.entries.some((e) => e.id === entry.id) ? s : { entries: [...s.entries, entry] })),

      logWeight: (kg, date = dayKey()) =>
        set((s) => ({
          weights: [...s.weights.filter((w) => w.date !== date), { date, kg }].sort((a, b) => a.date.localeCompare(b.date)),
          profile: { ...s.profile, weightKg: kg },
          settings: { ...s.settings, waterGoal: waterGoalMl(kg) },
        })),

      addWater: (ml, date = dayKey()) =>
        set((s) => ({ water: { ...s.water, [date]: Math.max(0, (s.water[date] ?? 0) + ml) } })),

      saveFood: (food) => set((s) => ({ saved: [{ ...food, id: uid(), createdAt: Date.now() }, ...s.saved].slice(0, 200) })),
      removeSaved: (id) => set((s) => ({ saved: s.saved.filter((f) => f.id !== id) })),

      updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

      updateProvider: (provider, patch) =>
        set((s) => ({
          settings: { ...s.settings, ai: { ...s.settings.ai, [provider]: { ...s.settings.ai[provider], ...patch } } },
        })),

      addCoachMessage: (message) => {
        const id = uid()
        const today = dayKey()
        set((s) => {
          // A new day starts a new conversation, so yesterday's chat never confuses today's log.
          const messages = s.coach.date === today ? s.coach.messages : []
          return { coach: { date: today, messages: [...messages, { ...message, id, createdAt: Date.now() }].slice(-60) } }
        })
        return id
      },

      updateCoachMessage: (id, patch) =>
        set((s) => ({ coach: { ...s.coach, messages: s.coach.messages.map((m) => (m.id === id ? { ...m, ...patch } : m)) } })),

      removeCoachMessage: (id) => set((s) => ({ coach: { ...s.coach, messages: s.coach.messages.filter((m) => m.id !== id) } })),

      clearCoach: () => set({ coach: emptyCoach() }),

      importState: (data) =>
        set((s) => ({
          onboarded: data.onboarded ?? s.onboarded,
          profile: { ...s.profile, ...data.profile },
          plan: { ...s.plan, ...data.plan },
          entries: data.entries ?? s.entries,
          weights: data.weights ?? s.weights,
          water: data.water ?? s.water,
          saved: data.saved ?? s.saved,
          settings: { ...s.settings, ...data.settings },
        })),

      resetAll: () =>
        set({
          onboarded: false,
          profile: DEFAULT_PROFILE,
          plan: { ...PLAN_DEFAULTS },
          entries: [],
          weights: [],
          water: {},
          saved: [],
          settings: DEFAULT_SETTINGS,
          coach: emptyCoach(),
        }),
    }),
    {
      name: 'bitecount',
      version: 4,
      migrate: (persisted, version) => {
        const state = persisted as Partial<BiteState> & { settings?: Record<string, unknown> }
        if (!state.settings) return state as BiteState

        if (version < 2) {
          // v1 kept a single Claude key; move it into the per-provider shape.
          const legacy = state.settings as { aiKey?: string; aiModel?: string }
          state.settings = {
            ...DEFAULT_SETTINGS,
            ...state.settings,
            aiProvider: legacy.aiKey ? 'claude' : 'gemini',
            ai: {
              ...DEFAULT_SETTINGS.ai,
              claude: { key: legacy.aiKey ?? '', model: legacy.aiModel ?? providerInfo('claude').defaultModel },
            },
          }
        }

        if (version < 3) {
          // v3 added Groq; keep whatever the other providers already had.
          const settings = state.settings as { ai?: Partial<Record<AiProvider, ProviderSettings>> }
          settings.ai = { ...DEFAULT_SETTINGS.ai, ...(settings.ai ?? {}) }
        }

        if (version < 4) {
          // v4 added the Liquid Glass setting and the coach conversation.
          state.settings = { ...state.settings, glass: 'clear' }
          // If the selected provider has no key but another does, select that one.
          const s = state.settings as unknown as Settings
          const has = (p: AiProvider) => !!s.ai?.[p]?.key?.trim()
          const withKey = (['groq', 'gemini', 'claude'] as AiProvider[]).find(has)
          if (!has(s.aiProvider) && withKey) s.aiProvider = withKey
          ;(state as Partial<BiteState>).coach = emptyCoach()
        }

        return state as BiteState
      },
      partialize: ({ onboarded, profile, plan, entries, weights, water, saved, settings, coach }) => ({
        onboarded,
        profile,
        plan,
        entries,
        weights,
        water,
        saved,
        settings,
        coach,
      }),
    },
  ),
)

// ── Selectors ────────────────────────────────────────────────────────

/**
 * The plan is derived, so it must be memoised: a selector that builds a fresh
 * object on every call makes useSyncExternalStore re-render forever.
 */
export function usePlan(): Plan {
  const weightKg = useStore((s) => s.profile.weightKg)
  const settings = useStore((s) => s.plan)
  return useMemo(() => computePlan(weightKg, settings), [weightKg, settings])
}

const PROVIDER_ORDER: AiProvider[] = ['groq', 'gemini', 'claude']

/**
 * The key and model to use. The chosen provider wins when it has a key;
 * otherwise whichever provider does have one (Groq first), so a saved key is
 * never ignored just because a different provider is selected.
 */
export function useAiSettings() {
  const enabled = useStore((s) => s.settings.aiEnabled)
  const chosen = useStore((s) => s.settings.aiProvider)
  const all = useStore((s) => s.settings.ai)
  const has = (p: AiProvider) => !!(all[p]?.key?.trim() || all[p]?.proxyUrl?.trim())
  const provider = has(chosen) ? chosen : (PROVIDER_ORDER.find(has) ?? chosen)
  const settings = all[provider]
  const key = settings?.key?.trim() ?? ''
  const proxyUrl = settings?.proxyUrl?.trim() ?? ''
  return {
    enabled,
    provider,
    key,
    proxyUrl,
    model: settings?.model || providerInfo(provider).defaultModel,
    // Groq can run through a proxy that holds the key, so a key is not always needed.
    ready: enabled && (key.length > 0 || proxyUrl.length > 0),
  }
}

export const entriesForDay = (entries: LogEntry[], date: DayKey) => entries.filter((e) => e.date === date)

export const sumEntries = (entries: LogEntry[]): Macros =>
  entries.reduce((acc, e) => ({ kcal: acc.kcal + e.kcal, p: acc.p + e.p, c: acc.c + e.c, f: acc.f + e.f }), { kcal: 0, p: 0, c: 0, f: 0 })

/** Days in a row up to today with at least one entry. */
export function streakOf(entries: LogEntry[], today = dayKey()): number {
  const days = new Set(entries.map((e) => e.date))
  let streak = 0
  const d = new Date()
  if (!days.has(today)) d.setDate(d.getDate() - 1)
  for (;;) {
    if (!days.has(dayKey(d))) break
    streak++
    d.setDate(d.getDate() - 1)
  }
  return streak
}

/** Most recently logged foods, newest first, one row per distinct food. */
export function recentEntries(entries: LogEntry[], limit = 12): LogEntry[] {
  const seen = new Set<string>()
  const out: LogEntry[] = []
  for (const e of [...entries].sort((a, b) => b.createdAt - a.createdAt)) {
    const key = `${e.name}|${e.portion}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(e)
    if (out.length >= limit) break
  }
  return out
}
