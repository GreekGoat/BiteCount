import { Cookie, Moon, Sun, Sunrise, type LucideIcon } from 'lucide-react'
import type { Meal } from '../lib/date'
import { IconTile } from './List'

export const MEAL_ICON: Record<Meal, LucideIcon> = {
  breakfast: Sunrise,
  lunch: Sun,
  dinner: Moon,
  snack: Cookie,
}

/** iOS system colours, one per meal: sunrise orange, midday yellow, night indigo, snack pink. */
export const MEAL_COLOR: Record<Meal, string> = {
  breakfast: '#ff9500',
  lunch: '#f5b400',
  dinner: '#5856d6',
  snack: '#ff2d55',
}

export function MealIcon({ meal, size = 30 }: { meal: Meal; size?: number }) {
  const Icon = MEAL_ICON[meal]
  return (
    <IconTile color={MEAL_COLOR[meal]} size={size}>
      <Icon size={Math.round(size * 0.58)} strokeWidth={2.4} />
    </IconTile>
  )
}
