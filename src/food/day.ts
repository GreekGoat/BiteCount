import type { Meal } from '../lib/date'
import { parseMeal, type ParsedItem } from './parse'

/*
 * Whole-day logging, offline.
 *
 * "Breakfast was 2 parathas and cha, lunch rice and chicken curry, then a samosa
 *  in the evening, and dal with 2 rotis for dinner"
 *
 * The text is cut into clauses at sentence breaks and wherever a meal is named,
 * each clause takes the meal it mentions (or inherits the one before it), and the
 * food parser reads each clause on its own.
 */

/** Words that say when something was eaten, longest first so "late night" wins over "night". */
const MEAL_WORDS: [RegExp, Meal][] = [
  [/late[\s-]night|midnight/, 'snack'],
  [/breakfast|brekkie|brunch|morning|sehri|suhoor/, 'breakfast'],
  [/lunch(?:time)?|noon|midday|mid-day/, 'lunch'],
  [/afternoon|evening|tea[\s-]?time|snacks?|iftar/, 'snack'],
  [/dinner|supper|tonight|night/, 'dinner'],
]

const MEAL_WORD = '(?:late[\\s-]night|midnight|breakfast|brekkie|brunch|morning|sehri|suhoor|lunch(?:time)?|noon|midday|mid-day|afternoon|evening|tea[\\s-]?time|snacks?|iftar|dinner|supper|tonight|night)'

/** Food names that contain a meal word but are not a time ("dinner roll", "breakfast cereal"). */
const NOT_A_TIME = /\b(?:breakfast|dinner|lunch)\s+(?:roll|rolls|cereal|burrito|sandwich|box|bar|bars|platter)\b|\bmorning\s+glory\b/gi

/** A meal phrase with its lead-in ("for", "at", "in the") and tail ("was", ":"), so it can be cut cleanly. */
const MEAL_PHRASE = new RegExp(
  `\\b(?:(?:for|at|in|during|around|by|as|with)\\s+(?:the\\s+|a\\s+|an\\s+|my\\s+)?)?${MEAL_WORD}(?:\\s+(?:snacks?|time))?(?:\\s*(?:was|were|is|i had|i ate|had|ate|:|-|–|—))?(?=\\s|$|[,.;!?])`,
  'gi',
)

/** Clause breaks: sentence punctuation, new lines, and sequence words. */
const HARD_BREAK = /[.;!?\n]+|\b(?:then|after that|afterwards|later on|later|also)\b/gi

export interface DayChunk {
  /** Null when the text never says when it was eaten. */
  meal: Meal | null
  text: string
  items: ParsedItem[]
}

function mealOf(phrase: string): Meal | null {
  const p = phrase.toLowerCase()
  for (const [re, meal] of MEAL_WORDS) if (re.test(p)) return meal
  return null
}

interface Found {
  meal: Meal
  start: number
  end: number
  /** The phrase opens what follows ("lunch was rice") rather than closing what came before ("rice for lunch"). */
  leading: boolean
}

function findMeals(clause: string): Found[] {
  const masked = clause.replace(NOT_A_TIME, (m) => ' '.repeat(m.length))
  const found: Found[] = []
  for (const m of masked.matchAll(MEAL_PHRASE)) {
    const meal = mealOf(m[0])
    if (!meal || m.index === undefined) continue
    const before = clause.slice(0, m.index).trim()
    const after = clause.slice(m.index + m[0].length).trim()
    // Leading when it starts the clause (or follows "and"/"," directly) and food comes after it.
    const startsClause = before === '' || /(?:^|[,]|\band)$/i.test(before)
    const tailEmpty = after === '' || /^[,.;!?]/.test(after)
    found.push({ meal, start: m.index, end: m.index + m[0].length, leading: startsClause && !tailEmpty })
  }
  return found
}

/** Splits on hard breaks, then on commas or "and" that sit right before a leading meal phrase. */
function clausesOf(text: string): string[] {
  const out: string[] = []
  for (const sentence of text.split(HARD_BREAK)) {
    const s = sentence.trim()
    if (!s) continue
    // Cut before ", lunch was…", "and for dinner…"; cut after "…for breakfast," / "…in the evening and".
    const cuts = s
      .replace(new RegExp(`\\s*(?:,|\\band\\b)\\s*(?=(?:(?:for|at|in|during|around|by)\\s+(?:the\\s+|my\\s+)?)?${MEAL_WORD}\\b(?!\\s+(?:roll|cereal|burrito|sandwich|box|bar)))`, 'gi'), '\u0000')
      .replace(new RegExp(`(\\b(?:for|at|in|during|as)\\s+(?:the\\s+|a\\s+|my\\s+)?${MEAL_WORD}(?:\\s+snacks?)?)\\s*(?:,|\\band\\b)\\s*`, 'gi'), '$1\u0000')
      .split('\u0000')
      .map((c) => c.trim())
      .filter(Boolean)
    out.push(...cuts)
  }
  return out
}

/** Removes meal phrases and conversational filler so the food parser sees only food. */
function stripTimes(clause: string): string {
  return clause
    .replace(NOT_A_TIME, (m) => m.replace(/ /g, '\u0001'))
    .replace(MEAL_PHRASE, ' ')
    .replace(/\u0001/g, ' ')
    .replace(/\b(?:i\s+)?(?:had|ate|eaten|have had|grabbed|got|took|drank)\b/gi, ' ')
    .replace(/^\s*(?:and|then|,)\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function parseDay(text: string): DayChunk[] {
  const chunks: DayChunk[] = []
  let current: Meal | null = null

  for (const clause of clausesOf(text)) {
    const found = findMeals(clause)

    // Two different meals inside one clause ("eggs for breakfast, rice and curry for lunch"):
    // split at the last comma before the second meal's phrase.
    if (found.length >= 2 && found[0].meal !== found[found.length - 1].meal) {
      const second = found.find((f) => f.meal !== found[0].meal)!
      const cut = clause.lastIndexOf(',', second.start)
      if (cut > 0) {
        const parts = [clause.slice(0, cut), clause.slice(cut + 1)]
        for (const part of parts) {
          const meal: Meal | null = findMeals(part)[0]?.meal ?? current
          current = meal
          pushChunk(chunks, meal, part)
        }
        continue
      }
    }

    // A named meal carries forward to the clauses after it until another is named.
    const meal = found[0]?.meal ?? current
    if (found.length) current = meal
    pushChunk(chunks, meal, clause)
  }

  // Clauses before any named meal stay unassigned: the person picks, rather than us guessing.
  return chunks.filter((c) => c.items.length)
}

function pushChunk(chunks: DayChunk[], meal: Meal | null, clause: string) {
  const text = stripTimes(clause)
  if (!text) return
  chunks.push({ meal, text, items: parseMeal(text) })
}

/** True when the text names at least one meal time — worth grouping by meal. */
export function mentionsMeals(text: string): boolean {
  const masked = text.replace(NOT_A_TIME, ' ')
  return new RegExp(`\\b${MEAL_WORD}\\b`, 'i').test(masked)
}
