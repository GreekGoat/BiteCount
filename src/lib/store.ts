import { useMemo } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AiModel } from '../food/ai-models'
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

export interface Settings {
  theme: 'system' | 'dark' | 'light'
  haptics: boolean
  reduceMotion: boolean
  aiKey: string
  aiModel: AiModel
  aiEnabled: boolean
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

  finishOnboarding: (profile: Profile, plan: PlanSettings) => void
  updateProfile: (patch: Partial<Profile>) => void
  updatePlan: (patch: Partial<PlanSettings>) => void
  addEntries: (entries: Omit<LogEntry, 'id' | 'createdAt'>[]) => void
  updateEntry: (id: string, patch: Partial<LogEntry>) => void
  removeEntry: (id: string) => void
  logWeight: (kg: number, date?: DayKey) => void
  addWater: (ml: number, date?: DayKey) => void
  saveFood: (food: Omit<SavedFood, 'id' | 'createdAt'>) => void
  removeSaved: (id: string) => void
  updateSettings: (patch: Partial<Settings>) => void
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
  haptics: true,
  reduceMotion: false,
  aiKey: '',
  aiModel: 'claude-opus-5',
  aiEnabled: true,
  waterGoal: waterGoalMl(DEFAULT_PROFILE.weightKg),
}

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

      addEntries: (entries) =>
        set((s) => ({
          entries: [...s.entries, ...entries.map((e) => ({ ...e, id: uid(), createdAt: Date.now() }))],
        })),

      updateEntry: (id, patch) => set((s) => ({ entries: s.entries.map((e) => (e.id === id ? { ...e, ...patch } : e)) })),
      removeEntry: (id) => set((s) => ({ entries: s.entries.filter((e) => e.id !== id) })),

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
        }),
    }),
    {
      name: 'bitecount',
      version: 1,
      partialize: ({ onboarded, profile, plan, entries, weights, water, saved, settings }) => ({
        onboarded,
        profile,
        plan,
        entries,
        weights,
        water,
        saved,
        settings,
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
