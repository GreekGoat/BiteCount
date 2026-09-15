import { computeItem } from '../food/compute'
import { FOODS } from '../food/db'
import type { Macros } from '../food/types'
import type { Plan } from './plan'

export interface Insight {
  icon: 'over' | 'protein' | 'room' | 'done' | 'start'
  text: string
}

const proteinPicks = FOODS.filter((f) => ['chicken-breast', 'egg', 'greek-yogurt', 'paneer', 'chicken-tikka', 'tuna', 'protein-shake', 'grilled-fish', 'dal', 'chickpeas'].includes(f.id))

/** One useful sentence about where the day stands. */
export function dayInsight(eaten: Macros, plan: Plan, entryCount: number): Insight {
  const left = plan.budget - eaten.kcal
  const proteinLeft = plan.protein - eaten.p

  if (entryCount === 0) {
    return { icon: 'start', text: 'Nothing logged yet today. Tap + and type what you ate — a rough description is enough.' }
  }
  if (left < 0) {
    return { icon: 'over', text: `You are ${Math.round(-left)} kcal past the budget. One lighter day does not undo a week — just note it and move on.` }
  }
  if (proteinLeft > 25 && left > 120) {
    const pick = proteinPicks
      .map((food) => {
        const portion = { serving: food.def, qty: 1 }
        return { food, macros: computeItem(food, portion) }
      })
      .filter((c) => c.macros.kcal <= left && c.macros.p >= 12)
      .sort((a, b) => b.macros.p / Math.max(1, b.macros.kcal) - a.macros.p / Math.max(1, a.macros.kcal))[0]
    if (pick) {
      const name = pick.food.name.replace(/\s*\([^)]*\)/g, '')
      const serving = pick.food.servings[pick.food.def].label.replace(/\s*\([^)]*\)/g, '')
      return {
        icon: 'protein',
        text: `${Math.round(proteinLeft)} g of protein to go. ${pick.food.emoji} ${name} — one ${serving} adds ${Math.round(pick.macros.p)} g for ${pick.macros.kcal} kcal.`,
      }
    }
  }
  if (left < 120) {
    return { icon: 'done', text: `Right on target — ${Math.round(left)} kcal left. Water or a cup of tea is the easy call from here.` }
  }
  return { icon: 'room', text: `${Math.round(left)} kcal still to play with, and ${Math.round(Math.max(0, proteinLeft))} g of protein.` }
}
