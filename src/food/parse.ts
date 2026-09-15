import type { Answers, Portion } from './compute'
import { FOODS } from './db'
import { QUESTIONS } from './questions'
import { normalize, searchFoods, singular, tokens, type SearchHit } from './search'
import type { Food, QuestionKey } from './types'

export interface ParsedItem {
  raw: string
  query: string
  hit: SearchHit | null
  candidates: SearchHit[]
  /** Several foods matched about equally well ("curry"). */
  ambiguous: boolean
  portion: Portion
  /** The user said how much (a number, unit or size). */
  portionGiven: boolean
  answers: Answers
}

const NUMBER_WORDS: Record<string, number> = {
  a: 1, an: 1, one: 1, single: 1, two: 2, couple: 2, three: 3, few: 3, four: 4, five: 5, six: 6,
  seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, dozen: 12, half: 0.5, quarter: 0.25,
}

/** Grams (or ml) per unit. */
const MASS: Record<string, number> = {
  g: 1, gm: 1, gms: 1, gram: 1, gramme: 1, gr: 1, grm: 1, kg: 1000, kilo: 1000, oz: 28.35, ounce: 28.35,
  lb: 453.6, pound: 453.6, ml: 1, milliliter: 1, millilitre: 1, l: 1000, liter: 1000, litre: 1000, ltr: 1000, cl: 10, dl: 100,
}

/** Rough grams for vessel words when a food has no matching serving. */
const VESSEL: Record<string, number> = {
  cup: 240, bowl: 250, katori: 150, plate: 280, plateful: 280, glass: 250, mug: 300, tbsp: 15, tablespoon: 15,
  tsp: 5, teaspoon: 5, spoon: 15, spoonful: 15, slice: 30, piece: 50, pc: 50, pcs: 50, handful: 30, scoop: 30,
  can: 330, bottle: 500, pack: 50, packet: 50, bar: 45, serving: 200, portion: 200, stick: 10, bite: 15, box: 250,
}

const unitWord = (w: string) => (MASS[w] != null ? w : singular(w))

const SIZE_WORDS: Record<string, string> = {
  small: 'small', mini: 'small', tiny: 'small', little: 'small', medium: 'medium', regular: 'regular', normal: 'regular',
  large: 'large', big: 'large', huge: 'large', jumbo: 'large', double: 'double',
}
const SIZE_FACTOR: Record<string, number> = { small: 0.7, medium: 1, regular: 1, large: 1.4, double: 2 }

const FILLERS = [
  /\b(i\s+)?(just\s+)?(had|ate|eaten|drank|drunk|have had|having|consumed|finished|got)\b/g,
  /\bfor (breakfast|lunch|dinner|supper|snacks?|brunch|iftar|sehri|suhoor)\b/g,
  /\b(today|tonight|this morning|this evening|yesterday|approx|approximately|about|around|roughly|maybe|like|some|almost|nearly)\b/g,
]

// Food names containing a separator word, protected so they are not split apart.
const COMPOUNDS = Array.from(
  new Set(
    FOODS.flatMap((f) => [f.name, ...f.aliases])
      .map((n) => normalize(n))
      .filter((n) => /\b(and|with|n|on)\b/.test(n)),
  ),
).sort((a, b) => b.length - a.length)

// Every known name, so "cup noodles" is not read as a cup of noodles.
const NAME_SET = new Set(FOODS.flatMap((f) => [f.name, ...f.aliases]).map((n) => tokens(n).join(' ')))
const isKnownName = (words: string[]) => NAME_SET.has(tokens(words.join(' ')).join(' '))

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const toNumber = (t: string): number | null => {
  if (/^\d+(\.\d+)?$/.test(t)) return parseFloat(t)
  if (/^\d+\/\d+$/.test(t)) {
    const [a, b] = t.split('/').map(Number)
    return b ? a / b : null
  }
  return t in NUMBER_WORDS ? NUMBER_WORDS[t] : null
}

interface Segment {
  qty?: number
  unit?: string
  size?: string
  text: string
}

function splitSegment(raw: string): Segment {
  const t = normalize(raw)
    .replace(/(\d)([a-z]{1,6})\b/g, (m, d, u) => (u === 'up' ? m : `${d} ${u}`))
    .replace(/\bx\s*(\d)/g, '$1')
    .replace(/(\d)\s*x\b/g, '$1')
  const words = t.split(' ').filter(Boolean)
  const seg: Segment = { text: '' }
  let qty: number | undefined

  // Leading "1 1/2", "2", "half", "a"
  while (words.length) {
    const n = toNumber(words[0])
    if (n == null) break
    qty = qty != null && n < 1 ? qty + n : qty != null ? qty * n : n
    words.shift()
  }
  // "large bowl", "big plate"
  while (words.length > 1 && SIZE_WORDS[words[0]] && !isKnownName(words)) seg.size = SIZE_WORDS[words.shift()!]
  const isUnit = (w: string) => MASS[w] != null || MASS[singular(w)] != null || VESSEL[singular(w)] != null
  if (words.length > 1 && isUnit(words[0]) && !isKnownName(words)) seg.unit = unitWord(words.shift()!)
  if (words[0] === 'of') words.shift()

  // Trailing "200 g", "2 bowls", "x 2"
  if (words.length > 1 && isUnit(words[words.length - 1]) && !isKnownName(words)) {
    const unit = unitWord(words[words.length - 1])
    const maybeNum = toNumber(words[words.length - 2] ?? '')
    if (maybeNum != null && !['a', 'an'].includes(words[words.length - 2])) {
      seg.unit = seg.unit ?? unit
      qty = qty ?? maybeNum
      words.splice(-2, 2)
    } else if (!seg.unit) {
      seg.unit = unit
      words.pop()
    }
  }
  if (words.length > 1) {
    const n = toNumber(words[words.length - 1])
    if (n != null && !['a', 'an'].includes(words[words.length - 1])) {
      qty = qty ?? n
      words.pop()
    }
  }

  // "pizza 3 slices thin crust": an amount in the middle.
  for (let i = 0; i < words.length - 1 && !seg.unit; i++) {
    const n = toNumber(words[i])
    if (n != null && !['a', 'an'].includes(words[i]) && isUnit(words[i + 1])) {
      qty = qty ?? n
      seg.unit = unitWord(words[i + 1])
      words.splice(i, 2)
    }
  }

  const known = isKnownName(words)
  const rest: string[] = []
  for (const w of words) {
    if (SIZE_WORDS[w] && !seg.size && !known) seg.size = SIZE_WORDS[w]
    else if (w !== 'of' && w !== 'x') rest.push(w)
  }
  seg.qty = qty
  seg.text = rest.join(' ')
  return seg
}

function resolvePortion(food: Food, seg: Segment, extraTokens: string[]): { portion: Portion; given: boolean } {
  const qty = seg.qty ?? 1
  let unit = seg.unit
  // "3 egg omelette": a serving key hiding in the words ("egg") picks that serving.
  if (!unit) {
    const nameTokens = new Set(tokens(food.name))
    const key = extraTokens.find((t) => !nameTokens.has(t) && food.servings.some((s) => s.keys?.includes(t)))
    if (key) unit = key
  }
  const given = seg.qty != null || !!unit || !!seg.size

  if (unit && MASS[unit] != null) {
    return { portion: { serving: -1, qty: 1, grams: Math.round(qty * MASS[unit]) }, given }
  }

  const size = seg.size
  const labelHasSize = (label: string) => !!size && (label.includes(size) || (size === 'regular' && label.includes('medium')))

  if (unit) {
    const withKey = food.servings.map((s, i) => ({ s, i })).filter(({ s }) => s.keys?.includes(unit!))
    if (withKey.length) {
      const bySize = withKey.find(({ s }) => labelHasSize(s.label) || (size ? s.keys?.includes(size) : false))
      const byExact = withKey.find(({ s }) => s.label === unit)
      const byMedium = withKey.find(({ s }) => s.label.startsWith('medium'))
      const byDefault = withKey.find(({ i }) => i === food.def)
      const pick = bySize ?? byExact ?? byMedium ?? byDefault ?? withKey[0]
      return { portion: { serving: pick.i, qty }, given }
    }
    if (VESSEL[unit] != null) {
      const factor = size ? SIZE_FACTOR[size] ?? 1 : 1
      return { portion: { serving: -1, qty: 1, grams: Math.round(qty * VESSEL[unit] * factor) }, given }
    }
  }

  if (size) {
    const idx = food.servings.findIndex((s) => labelHasSize(s.label) || s.keys?.includes(size))
    if (idx >= 0) return { portion: { serving: idx, qty }, given }
    const base = food.servings[food.def]
    return { portion: { serving: -1, qty: 1, grams: Math.round(base.g * qty * (SIZE_FACTOR[size] ?? 1)) }, given }
  }

  return { portion: { serving: food.def, qty }, given }
}

const phraseIn = (text: string, phrase: string) => new RegExp(`(^|\\s)${escapeRe(normalize(phrase))}(\\s|$)`).test(text)

const DIGIT_WORDS: Record<string, string> = { two: '2', three: '3', four: '4', five: '5' }

function prepForMatch(text: string) {
  return normalize(text)
    .split(' ')
    .map((w) => DIGIT_WORDS[w] ?? singular(w))
    .filter((w) => w !== 'of')
    .join(' ')
}

interface ModifierMatch {
  answers: Answers
  coverage: number
  onlySides: boolean
}

/** Finds question options named in the text ("restaurant style", "with bones", "2 sugars"). */
export function matchModifiers(food: Food, text: string, ignore: Set<string> = new Set()): ModifierMatch {
  const t = prepForMatch(text)
  const answers: Answers = {}
  const covered = new Set<string>()
  let sidesOnly = true
  for (const key of food.questions) {
    const q = QUESTIONS[key]
    const found: { id: string; len: number; phrase: string }[] = []
    for (const opt of q.options) {
      for (const phrase of opt.match ?? []) {
        const p = prepForMatch(phrase)
        if (p && phraseIn(t, p)) found.push({ id: opt.id, len: p.length, phrase: p })
      }
    }
    if (!found.length) continue
    if (key !== 'sides') sidesOnly = false
    found.sort((a, b) => b.len - a.len)
    if (q.multi) {
      // "garlic sauce" should not also count as plain "sauce".
      const kept: typeof found = []
      for (const f of found) if (!kept.some((k) => ` ${k.phrase} `.includes(` ${f.phrase} `))) kept.push(f)
      answers[key as QuestionKey] = Array.from(new Set(kept.map((f) => f.id)))
      kept.forEach((f) => f.phrase.split(' ').forEach((w) => covered.add(w)))
    } else {
      answers[key as QuestionKey] = found[0].id
      found[0].phrase.split(' ').forEach((w) => covered.add(w))
    }
  }
  const words = t.split(' ').filter((w) => w && toNumber(w) == null && !ignore.has(w) && !['a', 'an', 'the', 'with', 'and', 'style', 'spoon', 'tsp'].includes(w))
  const coverage = words.length ? words.filter((w) => covered.has(w)).length / words.length : 0
  return { answers, coverage, onlySides: sidesOnly && Object.keys(answers).length > 0 }
}

function mergeAnswers(into: Answers, from: Answers) {
  for (const [k, v] of Object.entries(from) as [QuestionKey, string | string[]][]) {
    const q = QUESTIONS[k]
    if (q.multi) {
      const prev = (into[k] as string[] | undefined) ?? []
      into[k] = Array.from(new Set([...prev, ...(v as string[])]))
    } else {
      into[k] = v
    }
  }
}

export function parseMeal(input: string): ParsedItem[] {
  let text = ` ${input.toLowerCase()} `
    .replace(/[\n;+&|]/g, ',')
    .replace(/\bw\//g, ' with ')
  for (const re of FILLERS) text = text.replace(re, ' ')
  text = text.replace(/(\d+(?:\.\d+)?|one|two|three|four|five)\s+and\s+a\s+half\b/g, (_, n) => String((toNumber(n) ?? 0) + 0.5))

  const pieces = text
    .split(',')
    .flatMap((chunk) => {
      // Protect compound names like "mac and cheese" from being split.
      let spaced = ` ${normalize(chunk)} `
      for (const compound of COMPOUNDS) {
        spaced = spaced.replace(new RegExp(`(^|\\s)${escapeRe(compound)}(?=\\s|$)`, 'g'), (_m, lead) => lead + compound.replace(/ /g, '_'))
      }
      return spaced.split(/\s+(?:and|with|plus|along|alongside|then)\s+/)
    })
    .map((p) => p.replace(/_/g, ' ').trim())
    .filter((p) => p && !/^(a|an|the|some|and|with)$/.test(p))

  const items: ParsedItem[] = []
  for (const piece of pieces) {
    const seg = splitSegment(piece)
    const prev = items[items.length - 1]

    // "tea with milk and 2 sugars" → options of the previous item, not new foods.
    if (prev?.hit) {
      const mod = matchModifiers(prev.hit.food, piece)
      const explicitQty = seg.qty != null && seg.qty !== 1
      if (mod.coverage >= 0.6 && !(mod.onlySides && explicitQty)) {
        mergeAnswers(prev.answers, mod.answers)
        continue
      }
    }

    const query = seg.text || piece
    const candidates = searchFoods(query, 6)
    const top = candidates[0]
    const hit = top && top.score >= 560 ? top : null
    const second = candidates.find((c) => c.food.id !== top?.food.id)
    const ambiguous = !!hit && hit.score < 760 && !!second && hit.score - second.score < 20

    if (!hit) {
      items.push({ raw: piece, query, hit: null, candidates, ambiguous: false, portion: { serving: -1, qty: 1, grams: 0 }, portionGiven: seg.qty != null || !!seg.unit || !!seg.size, answers: {} })
      continue
    }

    const nameTokens = new Set(tokens(hit.food.name))
    const segTokens = tokens(query)
    const { portion, given } = resolvePortion(hit.food, seg, segTokens)
    const extra = segTokens.filter((t) => !nameTokens.has(t)).join(' ')
    const { answers } = matchModifiers(hit.food, extra, nameTokens)
    items.push({ raw: piece, query, hit, candidates, ambiguous, portion, portionGiven: given, answers })
  }
  return items
}

/** Re-resolve a parsed segment against a different food (after the user picks a candidate). */
export function reparseFor(item: ParsedItem, food: Food): ParsedItem {
  const seg = splitSegment(item.raw)
  const segTokens = tokens(item.query)
  const { portion, given } = resolvePortion(food, seg, segTokens)
  const nameTokens = new Set(tokens(food.name))
  const { answers } = matchModifiers(food, segTokens.filter((t) => !nameTokens.has(t)).join(' '), nameTokens)
  return { ...item, hit: { food, score: 1000, matched: food.name }, ambiguous: false, portion, portionGiven: given, answers }
}
