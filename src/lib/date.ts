export type DayKey = string // YYYY-MM-DD in local time

const pad = (n: number) => String(n).padStart(2, '0')

export function dayKey(d = new Date()): DayKey {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function fromKey(key: DayKey): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(key: DayKey, days: number): DayKey {
  const d = fromKey(key)
  d.setDate(d.getDate() + days)
  return dayKey(d)
}

export function daysBetween(a: DayKey, b: DayKey): number {
  return Math.round((fromKey(b).getTime() - fromKey(a).getTime()) / 86_400_000)
}

export function lastNDays(n: number, end: DayKey = dayKey()): DayKey[] {
  return Array.from({ length: n }, (_, i) => addDays(end, i - n + 1))
}

export function relativeDayLabel(key: DayKey): string {
  const diff = daysBetween(dayKey(), key)
  if (diff === 0) return 'Today'
  if (diff === -1) return 'Yesterday'
  if (diff === 1) return 'Tomorrow'
  return fromKey(key).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })
}

export function greeting(d = new Date()): string {
  const h = d.getHours()
  if (h < 5) return 'Up late'
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  if (h < 22) return 'Good evening'
  return 'Good night'
}

export type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snack'

export const MEALS: { id: Meal; label: string; emoji: string }[] = [
  { id: 'breakfast', label: 'Breakfast', emoji: '🌅' },
  { id: 'lunch', label: 'Lunch', emoji: '☀️' },
  { id: 'dinner', label: 'Dinner', emoji: '🌙' },
  { id: 'snack', label: 'Snacks', emoji: '🍿' },
]

export function mealForTime(d = new Date()): Meal {
  const h = d.getHours() + d.getMinutes() / 60
  if (h >= 4 && h < 11) return 'breakfast'
  if (h >= 11 && h < 16) return 'lunch'
  if (h >= 18 && h < 23) return 'dinner'
  return 'snack'
}
