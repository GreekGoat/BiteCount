import { describe, expect, it } from 'vitest'
import { makeEstimatedFood } from './archetype'
import { computeItem, portionGrams, portionLabel } from './compute'
import { FOODS, getFood } from './db'
import { parseMeal } from './parse'
import { searchFoods } from './search'

const one = (text: string) => {
  const items = parseMeal(text)
  expect(items).toHaveLength(1)
  return items[0]
}

describe('food database', () => {
  it('has unique ids and sane numbers', () => {
    const ids = new Set<string>()
    for (const f of FOODS) {
      expect(ids.has(f.id), f.id).toBe(false)
      ids.add(f.id)
      expect(f.servings.length, f.id).toBeGreaterThan(0)
      expect(f.def, f.id).toBeLessThan(f.servings.length)
      const { kcal, p, c, f: fat } = f.per100
      if (!['beer', 'wine', 'spirits'].includes(f.id)) {
        // Energy from macros should be close to the stated kcal (fibre and rounding allow some slack).
        const fromMacros = p * 4 + c * 4 + fat * 9
        expect(Math.abs(fromMacros - kcal), `${f.id}: ${fromMacros} vs ${kcal}`).toBeLessThanOrEqual(Math.max(12, kcal * 0.12))
      }
    }
  })
})

describe('search', () => {
  it('finds foods by local names and with typos', () => {
    expect(searchFoods('bhat')[0].food.id).toBe('white-rice')
    expect(searchFoods('murgir jhol')[0].food.id).toBe('chicken-curry')
    expect(searchFoods('chiken curry')[0].food.id).toBe('chicken-curry')
    expect(searchFoods('biriyani')[0].food.id).toBe('chicken-biryani')
    expect(searchFoods('rotis')[0].food.id).toBe('roti')
    expect(searchFoods('cha')[0].food.id).toBe('tea')
  })
})

describe('parseMeal', () => {
  it('splits a meal into items with quantities', () => {
    const items = parseMeal('2 rotis and a large bowl of chicken curry')
    expect(items.map((i) => i.hit?.food.id)).toEqual(['roti', 'chicken-curry'])
    expect(items[0].portion).toEqual({ serving: 0, qty: 2 })
    const curry = items[1]
    expect(curry.hit!.food.servings[curry.portion.serving].label).toBe('large bowl')
    expect(curry.portionGiven).toBe(true)
  })

  it('understands grams and trailing amounts', () => {
    expect(one('200g rice').portion).toEqual({ serving: -1, qty: 1, grams: 200 })
    expect(one('rice 1 cup').portion).toEqual({ serving: 0, qty: 1 })
    expect(one('coke 500ml').portion).toEqual({ serving: -1, qty: 1, grams: 500 })
    expect(one('roti x 3').portion).toEqual({ serving: 0, qty: 3 })
    expect(one('half plate biryani').portion).toEqual({ serving: 1, qty: 0.5 })
  })

  it('reads cooking details from the description', () => {
    const item = one('restaurant style chicken curry with bones')
    expect(item.answers.style).toBe('rich')
    expect(item.answers.bone).toBe('bone')
    expect(one('boneless chicken curry').answers.bone).toBe('boneless')
  })

  it('treats "with milk and 2 sugars" as details of the tea, not new foods', () => {
    const item = one('2 cups of tea with milk and 2 sugars')
    expect(item.hit!.food.id).toBe('tea')
    expect(item.portion).toEqual({ serving: 0, qty: 2 })
    expect(item.answers.milk).toBe('regular')
    expect(item.answers.sugar).toBe('tsp2')
  })

  it('adds sides named after "with"', () => {
    const item = one('chicken curry with rice')
    expect(item.answers.sides).toEqual(['rice'])
    const two = parseMeal('chicken curry with 4 rotis')
    expect(two.map((i) => i.hit?.food.id)).toEqual(['chicken-curry', 'roti'])
    expect(two[1].portion.qty).toBe(4)
  })

  it('keeps compound names together', () => {
    expect(one('mac and cheese').hit!.food.id).toBe('mac-cheese')
    expect(one('fish and chips').hit!.food.id).toBe('fish-and-chips')
    expect(one('cup noodles').hit!.food.id).toBe('instant-noodles')
  })

  it('uses a serving named inside the food words', () => {
    const item = one('3 egg omelette')
    expect(item.hit!.food.id).toBe('omelette')
    expect(portionGrams(item.hit!.food, item.portion)).toBe(195)
  })

  it('reports unknown dishes instead of guessing wildly', () => {
    const item = one("grandma's special stew")
    expect(item.hit).toBeNull()
  })
})

describe('computeItem', () => {
  it('computes a medium bowl of chicken curry and its variations', () => {
    const curry = getFood('chicken-curry')!
    const base = computeItem(curry, { serving: 1, qty: 1 })
    expect(base.kcal).toBe(375)
    const rich = computeItem(curry, { serving: 1, qty: 1 }, { style: 'rich' })
    expect(rich.kcal).toBeGreaterThan(base.kcal + 100)
    const bones = computeItem(curry, { serving: 1, qty: 1 }, { bone: 'bone' })
    expect(bones.kcal).toBe(300)
  })

  it('adds per-cup sugar and milk for tea', () => {
    const tea = getFood('tea')!
    const m = computeItem(tea, { serving: 0, qty: 2 }, { milk: 'regular', sugar: 'tsp2' })
    expect(m.kcal).toBe(3 + 2 * 37 + 2 * 32)
  })

  it('labels portions readably', () => {
    const roti = getFood('roti')!
    expect(portionLabel(roti, { serving: 0, qty: 2 })).toBe('2 rotis · 80 g')
    expect(portionLabel(getFood('white-rice')!, { serving: -1, qty: 1, grams: 200 })).toBe('200 g')
  })
})

describe('estimated foods', () => {
  it('builds a stand-in food for an unknown dish', () => {
    const food = makeEstimatedFood("grandma's stew", 'curry', 'red')
    const m = computeItem(food, { serving: food.def, qty: 1 })
    expect(m.kcal).toBeGreaterThan(300)
    expect(m.kcal).toBeLessThan(600)
    expect(food.questions).toContain('bone')
  })
})

describe('parser regressions', () => {
  it('handles real phrasings', () => {
    const cases: [string, string[]][] = [
      ['bowl of dal, 1 cup rice and some shak', ['dal', 'white-rice', 'shak']],
      ['big mac', ['burger']],
      ['pizza 3 slices thin crust', ['pizza']],
      ['beef steak 250 grams', ['beef-steak']],
      ['green tea no sugar', ['tea']],
      ['dim bhaji and 2 slices of bread with butter', ['omelette', 'white-bread']],
      ['1 plate bhat, dal and murgir mangsho', ['white-rice', 'dal', 'chicken-curry']],
    ]
    for (const [text, ids] of cases) {
      expect(parseMeal(text).map((i) => i.hit?.food.id), text).toEqual(ids)
    }
  })

  it('picks the portion the words imply', () => {
    expect(portionGrams(getFood('white-rice')!, parseMeal('1 plate bhat')[0].portion)).toBe(280)
    expect(portionGrams(getFood('pizza')!, parseMeal('pizza 3 slices')[0].portion)).toBe(321)
    expect(portionGrams(getFood('beef-steak')!, parseMeal('beef steak 250 grams')[0].portion)).toBe(250)
  })

  it('does not double-count overlapping extras', () => {
    expect(parseMeal('chicken shawarma with garlic sauce')[0].answers.extras).toEqual(['mayo'])
  })

  it('reads drink details', () => {
    const tea = parseMeal('green tea no sugar')[0]
    expect(tea.answers.milk).toBe('black')
    expect(tea.answers.sugar).toBe('none')
    expect(parseMeal('large latte with oat milk')[0].answers.milkType).toBe('oat')
  })
})
