import { QUESTIONS } from './questions'
import type { Food, Macros, Modifier, QuestionKey } from './types'

export type Answers = Partial<Record<QuestionKey, string | string[]>>

export interface Portion {
  /** Index into food.servings, or -1 for a custom gram/ml amount. */
  serving: number
  qty: number
  grams?: number
}

export const macros = (m: Partial<Macros>): Macros => {
  const p = m.p ?? 0
  const c = m.c ?? 0
  const f = m.f ?? 0
  return { p, c, f, kcal: m.kcal ?? p * 4 + c * 4 + f * 9 }
}

export const addMacros = (a: Macros, b: Macros): Macros => ({ kcal: a.kcal + b.kcal, p: a.p + b.p, c: a.c + b.c, f: a.f + b.f })

export const scaleMacros = (a: Macros, k: number): Macros => ({ kcal: a.kcal * k, p: a.p * k, c: a.c * k, f: a.f * k })

export const sumMacros = (list: Macros[]): Macros => list.reduce(addMacros, { kcal: 0, p: 0, c: 0, f: 0 })

export const roundMacros = (m: Macros): Macros => ({
  kcal: Math.round(m.kcal),
  p: Math.round(m.p * 10) / 10,
  c: Math.round(m.c * 10) / 10,
  f: Math.round(m.f * 10) / 10,
})

export function portionGrams(food: Food, portion: Portion): number {
  if (portion.serving < 0) return Math.max(0, portion.grams ?? 0)
  const sv = food.servings[portion.serving] ?? food.servings[food.def]
  return sv.g * portion.qty
}

/** How many "servings" a portion is, for per-serving extras like sugar per cup. */
export function portionCount(food: Food, portion: Portion): number {
  if (portion.serving >= 0) return portion.qty
  const base = food.servings[food.def]?.g || 100
  return Math.max(0.25, (portion.grams ?? 0) / base)
}

export function selectedModifiers(answers: Answers): Modifier[] {
  const mods: Modifier[] = []
  for (const [key, value] of Object.entries(answers) as [QuestionKey, string | string[]][]) {
    const q = QUESTIONS[key]
    if (!q || q.key === 'sides') continue
    const ids = Array.isArray(value) ? value : [value]
    for (const id of ids) {
      const opt = q.options.find((o) => o.id === id)
      if (opt?.mod) mods.push(opt.mod)
    }
  }
  return mods
}

export function computeItem(food: Food, portion: Portion, answers: Answers = {}): Macros {
  const grams = portionGrams(food, portion)
  const count = portionCount(food, portion)
  const k = grams / 100

  let total = scaleMacros(food.per100, k)
  let mult = 1
  for (const mod of selectedModifiers(answers)) {
    if (mod.per100) total = addMacros(total, scaleMacros(macros(mod.per100), k))
    if (mod.each) total = addMacros(total, scaleMacros(macros(mod.each), count))
    if (mod.mult) mult *= mod.mult
  }
  total = scaleMacros(total, mult)
  return roundMacros({
    kcal: Math.max(0, total.kcal),
    p: Math.max(0, total.p),
    c: Math.max(0, total.c),
    f: Math.max(0, total.f),
  })
}

const plural = (label: string, n: number) => {
  if (n <= 1) return label
  if (/\(.*\)$/.test(label) || /^\d/.test(label)) return label
  const [head, ...rest] = label.split(' ')
  if (rest.length === 0) return head.endsWith('s') ? head : `${head}s`
  const last = rest[rest.length - 1]
  if (last.endsWith('s')) return label
  return [head, ...rest.slice(0, -1), `${last}s`].join(' ')
}

export function formatQty(n: number): string {
  const whole = Math.floor(n)
  const frac = Math.round((n - whole) * 100) / 100
  const fracStr = frac === 0.5 ? '½' : frac === 0.25 ? '¼' : frac === 0.75 ? '¾' : frac ? String(frac).slice(1) : ''
  if (!whole) return fracStr || '0'
  return `${whole}${fracStr}`
}

export function portionLabel(food: Food, portion: Portion): string {
  const unit = food.liquid ? 'ml' : 'g'
  if (portion.serving < 0) return `${Math.round(portion.grams ?? 0)} ${unit}`
  const sv = food.servings[portion.serving] ?? food.servings[food.def]
  const grams = Math.round(sv.g * portion.qty)
  if (sv.label === '100 g' || sv.label === '30 g') return `${grams} ${unit}`
  if (/^\d/.test(sv.label)) return `${portion.qty === 1 ? '' : `${formatQty(portion.qty)} × `}${sv.label} · ${grams} ${unit}`
  return `${formatQty(portion.qty)} ${plural(sv.label, portion.qty)} · ${grams} ${unit}`
}

export function answerSummary(answers: Answers): string[] {
  const parts: string[] = []
  for (const [key, value] of Object.entries(answers) as [QuestionKey, string | string[]][]) {
    const q = QUESTIONS[key]
    if (!q || key === 'sides') continue
    const ids = Array.isArray(value) ? value : [value]
    for (const id of ids) {
      if (!q.multi && id === q.def) continue
      const opt = q.options.find((o) => o.id === id)
      if (opt) parts.push(opt.label)
    }
  }
  return parts
}
