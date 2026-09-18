import { FOODS } from './db'
import type { Food } from './types'

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’'`]/g, '')
    .replace(/½/g, ' 0.5 ')
    .replace(/¼/g, ' 0.25 ')
    .replace(/¾/g, ' 0.75 ')
    .replace(/[^a-z0-9.%/\s-]/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function singular(token: string): string {
  if (token.length <= 3) return token
  if (token.endsWith('ies')) return `${token.slice(0, -3)}y`
  if (token.endsWith('oes')) return token.slice(0, -2)
  if (token.endsWith('ches') || token.endsWith('shes') || token.endsWith('sses') || token.endsWith('xes')) return token.slice(0, -2)
  if (token.endsWith('ss') || token.endsWith('us')) return token
  if (token.endsWith('s')) return token.slice(0, -1)
  return token
}

const STOP = new Set(['a', 'an', 'the', 'of', 'some', 'my', 'i', 'had', 'ate', 'just', 'with', 'and', 'in', 'on', 'for', 'style', 'type', 'kind'])

export const tokens = (text: string) =>
  normalize(text)
    .split(' ')
    .filter((t) => /[a-z0-9]/.test(t) && !STOP.has(t))
    .map(singular)

function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0]
    prev[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j]
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1))
      diag = tmp
    }
  }
  return prev[b.length]
}

/** Loose similarity for how much of the query a name explains (prefixes count, for type-ahead). */
function tokenSimilarity(q: string, c: string): number {
  if (q === c) return 1
  if (q.length >= 2 && c.startsWith(q)) return q.length >= 3 ? 0.9 : 0.6
  if (c.length >= 3 && q.startsWith(c)) return 0.75
  if (q.length >= 4 && c.length >= 3) {
    const sim = 1 - levenshtein(q, c) / Math.max(q.length, c.length)
    if (sim >= 0.7) return sim * 0.9
  }
  return 0
}

/** Strict similarity for "does the query contain this whole name" (typos allowed, fragments not). */
function strictSimilarity(q: string, c: string): number {
  if (q === c) return 1
  if (c.startsWith(q) && q.length >= 4 && q.length / c.length >= 0.8) return 0.85
  if (q.length >= 5 && c.length >= 5) {
    const sim = 1 - levenshtein(q, c) / Math.max(q.length, c.length)
    if (sim >= 0.8) return sim
  }
  return 0
}

interface Entry {
  food: Food
  names: { text: string; tokens: string[]; primary: boolean }[]
}

/** "Roti / chapati" and "Milk (whole)" also answer to "roti", "chapati" and "milk". */
function nameVariants(name: string): string[] {
  const base = name.replace(/\s*\([^)]*\)\s*/g, ' ').trim()
  const parts = base.split(/\s+\/\s+/)
  return Array.from(new Set([name, base, ...parts]))
}

const INDEX: Entry[] = FOODS.map((food) => {
  const primary = new Set(nameVariants(food.name))
  const all = Array.from(new Set([...primary, ...food.aliases]))
  return {
    food,
    names: all.map((n) => ({ text: tokens(n).join(' '), tokens: tokens(n), primary: primary.has(n) })),
  }
})

export interface SearchHit {
  food: Food
  score: number
  /** The name or alias that matched best. */
  matched: string
}

function scoreName(qTokens: string[], qText: string, name: Entry['names'][number]): number {
  if (!name.tokens.length || !qTokens.length) return 0
  if (name.text === qText) return 1000 + (name.primary ? 5 : 0)
  let sum = 0
  let hits = 0
  for (const qt of qTokens) {
    let best = 0
    for (const ct of name.tokens) best = Math.max(best, tokenSimilarity(qt, ct))
    sum += best
    if (best > 0) hits++
  }
  const queryCoverage = sum / qTokens.length
  const primaryBonus = name.primary ? 8 : 0

  // The whole name appears in a longer description: "pizza 3 slices thin crust".
  // One-word names must match near-exactly, or a typo like "sunday" claims "sundae".
  const floor = name.tokens.length === 1 ? 0.95 : 0.001
  const fullName = name.tokens.every((ct) => qTokens.some((qt) => strictSimilarity(qt, ct) >= floor))
  if (fullName) {
    const containsBonus = ` ${qText} `.includes(` ${name.text} `) ? 20 : 0
    return 700 + queryCoverage * 150 + Math.min(name.tokens.length, 4) * 15 + containsBonus + primaryBonus
  }

  if (queryCoverage < 0.5) return 0
  const nameCoverage = Math.min(1, hits / name.tokens.length)
  const prefixBonus = name.text.startsWith(qText) ? 60 : 0
  return queryCoverage * 600 + nameCoverage * 250 + prefixBonus + primaryBonus
}

export function searchFoods(query: string, limit = 8, pool: Food[] | null = null): SearchHit[] {
  const qTokens = tokens(query)
  const qText = qTokens.join(' ')
  if (!qText) return []
  const entries = pool ? INDEX.filter((e) => pool.includes(e.food)) : INDEX
  const hits: SearchHit[] = []
  for (const entry of entries) {
    let best = 0
    let matched = entry.food.name
    for (const name of entry.names) {
      const sc = scoreName(qTokens, qText, name)
      if (sc > best) {
        best = sc
        matched = name.text
      }
    }
    if (best > 0) hits.push({ food: entry.food, score: best, matched })
  }
  return hits.sort((a, b) => b.score - a.score || a.food.name.length - b.food.name.length).slice(0, limit)
}

/** Best single match, or null when nothing is a confident match. */
export function bestFood(query: string): SearchHit | null {
  const [top] = searchFoods(query, 1)
  return top && top.score >= 560 ? top : null
}
