import { describe, expect, it } from 'vitest'
import { mentionsMeals, parseDay } from './day'

/** Flattens to "meal: food-id" pairs for compact assertions. */
const plan = (text: string) =>
  parseDay(text).flatMap((chunk) => chunk.items.map((item) => `${chunk.meal ?? '—'}: ${item.hit?.food.id ?? `?${item.query}`}`))

describe('parseDay', () => {
  it('reads a whole day written as one sentence', () => {
    expect(
      plan('Breakfast was 2 parathas and cha, lunch rice and chicken curry, then a samosa in the evening, dinner was dal and 2 rotis'),
    ).toEqual([
      'breakfast: paratha',
      'breakfast: tea',
      'lunch: white-rice',
      'lunch: chicken-curry',
      'snack: samosa',
      'dinner: dal',
      'dinner: roti',
    ])
  })

  it('handles meals named after the food', () => {
    expect(plan('2 eggs for breakfast and rice with dal for lunch')).toEqual(['breakfast: egg', 'lunch: white-rice', 'lunch: dal'])
  })

  it('splits two meals inside one clause at the comma', () => {
    const meals = plan('breakfast was eggs and toast, rice and chicken curry for lunch')
    expect(meals).toEqual(['breakfast: egg', 'breakfast: white-bread', 'lunch: white-rice', 'lunch: chicken-curry'])
  })

  it('reads one meal per line', () => {
    expect(plan('Breakfast: oats with milk\nLunch: chicken biryani\nSnack: apple\nDinner: grilled fish and salad')).toEqual([
      'breakfast: oatmeal-milk',
      'lunch: chicken-biryani',
      'snack: apple',
      'dinner: grilled-fish',
      'dinner: green-salad',
    ])
  })

  it('maps times of day to meals', () => {
    expect(plan('in the morning I had tea, at noon a chicken sandwich and at night pizza')).toEqual([
      'breakfast: tea',
      'lunch: sandwich',
      'dinner: pizza',
    ])
    expect(plan('a late night snack of chips')).toEqual(['snack: chips'])
  })

  it('leaves food with no time unassigned', () => {
    expect(plan('rice and dal')).toEqual(['—: white-rice', '—: dal'])
  })

  it('does not treat food names as times', () => {
    expect(plan('a dinner roll with butter')[0]).toBe('—: bun')
    expect(mentionsMeals('a dinner roll')).toBe(false)
    expect(mentionsMeals('rice for lunch')).toBe(true)
  })
})
