import type { Food, Macros, QuestionKey, Serving } from './types'

/*
 * Estimating a dish BiteCount has never heard of: the user says what kind of dish
 * it is and its main ingredient, and we build a stand-in food from typical values
 * for that kind of dish. The normal portion/oil questions then refine it.
 */

const s = (label: string, g: number, ...keys: string[]): Serving => ({ label, g, keys })

interface Kind {
  id: string
  label: string
  emoji: string
  per100: [number, number, number, number]
  servings: Serving[]
  def: number
  savory: boolean
  questions: QuestionKey[]
  liquid?: boolean
}

const BOWLS = [s('small bowl', 150, 'bowl'), s('medium bowl', 250, 'bowl'), s('large bowl', 400, 'bowl')]
const PLATES = [s('small plate', 180, 'plate'), s('plate', 300, 'plate'), s('large plate', 450, 'plate')]
const PIECES = [s('small piece', 50, 'piece'), s('medium piece', 100, 'piece'), s('large piece', 180, 'piece')]

export const DISH_KINDS: Kind[] = [
  { id: 'curry', label: 'Curry / stew / gravy', emoji: '🍛', per100: [140, 10, 6, 8.5], servings: BOWLS, def: 1, savory: true, questions: ['style', 'bone'] },
  { id: 'rice', label: 'Rice dish', emoji: '🍚', per100: [175, 6, 24, 6], servings: PLATES, def: 1, savory: true, questions: ['style'] },
  { id: 'noodles', label: 'Noodles / pasta', emoji: '🍜', per100: [160, 6, 22, 5.5], servings: PLATES, def: 1, savory: true, questions: ['style'] },
  { id: 'grill', label: 'Grilled / roasted meat or fish', emoji: '🍢', per100: [190, 25, 1, 9.5], servings: PIECES, def: 1, savory: true, questions: ['method'] },
  { id: 'sandwich', label: 'Sandwich / wrap / burger', emoji: '🥪', per100: [240, 11, 25, 10.5], servings: [s('small', 120, 'small'), s('regular', 220, 'regular'), s('large', 320, 'large')], def: 1, savory: true, questions: ['extras'] },
  { id: 'fried', label: 'Fried snack', emoji: '🍤', per100: [320, 6, 32, 19], servings: PIECES, def: 0, savory: true, questions: [] },
  { id: 'soup', label: 'Soup', emoji: '🥣', per100: [55, 3, 6, 2], servings: BOWLS, def: 1, savory: true, questions: [] },
  { id: 'salad', label: 'Salad', emoji: '🥗', per100: [90, 3, 6, 6], servings: BOWLS, def: 1, savory: true, questions: ['dressing'] },
  { id: 'veg', label: 'Vegetable side / stir-fry', emoji: '🥦', per100: [80, 2.5, 8, 4.5], servings: BOWLS, def: 0, savory: true, questions: ['style'] },
  { id: 'bread', label: 'Bread / bakery item', emoji: '🥐', per100: [300, 8, 48, 8], servings: PIECES, def: 1, savory: false, questions: ['spread'] },
  { id: 'dessert', label: 'Dessert / sweet', emoji: '🍰', per100: [330, 5, 48, 14], servings: PIECES, def: 1, savory: false, questions: ['sweetness'] },
  { id: 'drink', label: 'Drink / shake', emoji: '🥤', per100: [60, 1.5, 10, 1.5], servings: [s('small cup', 200, 'cup'), s('glass', 300, 'glass'), s('large', 500, 'large')], def: 1, savory: false, questions: ['sweetness'], liquid: true },
]

export const MAIN_INGREDIENTS: { id: string; label: string; emoji: string; delta: Partial<Macros> }[] = [
  { id: 'chicken', label: 'Chicken', emoji: '🐔', delta: { p: 3, f: -1 } },
  { id: 'red', label: 'Beef / mutton', emoji: '🐄', delta: { p: 3, f: 3 } },
  { id: 'fish', label: 'Fish / seafood', emoji: '🐟', delta: { p: 2, f: -2 } },
  { id: 'egg', label: 'Egg', emoji: '🥚', delta: { p: 1, f: 1 } },
  { id: 'paneer', label: 'Paneer / cheese', emoji: '🧀', delta: { p: 2, f: 5 } },
  { id: 'lentil', label: 'Lentils / beans', emoji: '🫘', delta: { p: 1, c: 5, f: -2 } },
  { id: 'veg', label: 'Vegetables', emoji: '🥕', delta: { p: -4, c: 3, f: -1.5 } },
  { id: 'mixed', label: 'Mixed / not sure', emoji: '🤷', delta: {} },
]

const kcalOf = (p: number, c: number, f: number) => p * 4 + c * 4 + f * 9

export function makeEstimatedFood(name: string, kindId: string, mainId?: string): Food {
  const kind = DISH_KINDS.find((k) => k.id === kindId) ?? DISH_KINDS[0]
  const main = kind.savory ? MAIN_INGREDIENTS.find((m) => m.id === mainId) : undefined
  const [, p0, c0, f0] = kind.per100
  const p = Math.max(0.5, p0 + (main?.delta.p ?? 0))
  const c = Math.max(0, c0 + (main?.delta.c ?? 0))
  const f = Math.max(0.2, f0 + (main?.delta.f ?? 0))
  const questions = kind.questions.filter((q) => q !== 'bone' || ['chicken', 'red', 'fish', 'mixed'].includes(mainId ?? ''))
  return {
    id: `est-${kind.id}-${mainId ?? 'none'}`,
    name: name.trim() ? name.trim().replace(/^\w/, (ch) => ch.toUpperCase()) : kind.label,
    emoji: kind.emoji,
    cat: 'curry',
    per100: { kcal: Math.round(kcalOf(p, c, f)), p, c, f },
    servings: kind.servings,
    def: kind.def,
    aliases: [],
    questions,
    liquid: kind.liquid,
  }
}

export const kindIsSavory = (kindId: string) => DISH_KINDS.find((k) => k.id === kindId)?.savory ?? true
