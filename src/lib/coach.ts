import { addDays, dayKey, fromKey, lastNDays, MEALS, type DayKey } from './date'
import type { Plan } from './plan'
import type { LogEntry, Profile } from './store'

/*
 * What the coach knows about today. Sent as plain text after the coach's
 * instructions on every turn, so it always reasons from the current log.
 */

const r = (n: number) => Math.round(n)

function totals(entries: LogEntry[]) {
  return entries.reduce((t, e) => ({ kcal: t.kcal + e.kcal, p: t.p + e.p, c: t.c + e.c, f: t.f + e.f }), { kcal: 0, p: 0, c: 0, f: 0 })
}

export interface CoachContextInput {
  now: Date
  profile: Profile
  plan: Plan
  entries: LogEntry[]
  /** The day the person is looking at; defaults to today. */
  day?: DayKey
}

export function buildCoachContext({ now, profile, plan, entries, day = dayKey(now) }: CoachContextInput): string {
  const todays = entries.filter((e) => e.date === day)
  const eaten = totals(todays)
  const left = {
    kcal: plan.budget - eaten.kcal,
    p: plan.protein - eaten.p,
    c: plan.carbs - eaten.c,
    f: plan.fat - eaten.f,
  }

  const time = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  const date = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })

  const lines: string[] = []
  lines.push('THE PERSON AND THEIR PLAN')
  lines.push(`Now: ${date}, ${time}.`)
  // A lookup, so "on Sunday" never depends on the model doing date arithmetic.
  const recent = Array.from({ length: 8 }, (_, i) => {
    const key = addDays(dayKey(now), -i)
    const name = fromKey(key).toLocaleDateString('en-GB', { weekday: 'long' })
    return `${name} ${key}${i === 0 ? ' (today)' : i === 1 ? ' (yesterday)' : ''}`
  })
  lines.push(`Dates: ${recent.join(', ')}.`)
  lines.push(
    `Body: ${profile.weightKg.toFixed(1)} kg${profile.goalKg ? `, goal ${profile.goalKg.toFixed(1)} kg` : ''}, ${profile.heightCm} cm, ${profile.age} years.`,
  )
  lines.push(
    `Plan (their own formula): maintenance ${r(plan.maintenance)} kcal (weight × 2.2 × 15), minus ${plan.deficitPct}% = budget ${r(plan.budget)} kcal a day. Targets: protein ${plan.protein} g, carbs ${plan.carbs} g, fat ${plan.fat} g.`,
  )

  lines.push('', `TODAY SO FAR (${todays.length} item${todays.length === 1 ? '' : 's'})`)
  if (!todays.length) lines.push('Nothing logged yet.')
  for (const meal of MEALS) {
    const items = todays.filter((e) => e.meal === meal.id)
    if (!items.length) continue
    const sum = totals(items)
    lines.push(`${meal.label} — ${r(sum.kcal)} kcal: ${items.map((e) => `${e.name} (${e.portion}, ${r(e.kcal)} kcal)`).join('; ')}`)
  }
  lines.push(`Eaten: ${r(eaten.kcal)} kcal · protein ${r(eaten.p)} g · carbs ${r(eaten.c)} g · fat ${r(eaten.f)} g.`)
  lines.push(
    `Left today: ${r(left.kcal)} kcal · protein ${r(left.p)} g · carbs ${r(left.c)} g · fat ${r(left.f)} g.${left.kcal < 0 ? ' (over budget)' : ''}`,
  )

  // A little history, so "how am I doing" has something to stand on.
  const yesterday = totals(entries.filter((e) => e.date === addDays(day, -1))).kcal
  const week = lastNDays(7, addDays(day, -1))
    .map((d) => totals(entries.filter((e) => e.date === d)).kcal)
    .filter((k) => k > 0)
  lines.push('', 'RECENT DAYS')
  lines.push(yesterday > 0 ? `Yesterday: ${r(yesterday)} kcal.` : 'Yesterday: nothing logged.')
  if (week.length) lines.push(`Previous 7 days: ${week.length} logged, average ${r(week.reduce((a, b) => a + b, 0) / week.length)} kcal.`)

  return lines.join('\n')
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/

/**
 * The day the coach says something was eaten, if it is a real day in the last
 * 60 days and not in the future; otherwise today. `legacyDay` is the
 * today/yesterday flag older saved replies carried.
 */
export function resolveEatenDate(date: string | undefined, legacyDay: 'today' | 'yesterday' | undefined, today: DayKey): DayKey {
  if (date && ISO_DAY.test(date) && !Number.isNaN(Date.parse(date)) && date <= today && date >= addDays(today, -60)) return date
  return legacyDay === 'yesterday' ? addDays(today, -1) : today
}
