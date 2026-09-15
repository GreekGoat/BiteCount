export interface Macros {
  kcal: number
  p: number // protein g
  c: number // carbs g
  f: number // fat g
}

export const ZERO: Macros = { kcal: 0, p: 0, c: 0, f: 0 }

export interface Serving {
  label: string
  g: number
  /** Unit words that should pick this serving, e.g. "bowl", "katori". */
  keys?: string[]
}

export type FoodCat =
  | 'curry'
  | 'dal'
  | 'rice'
  | 'bread'
  | 'noodles'
  | 'protein'
  | 'egg'
  | 'dairy'
  | 'fruit'
  | 'veg'
  | 'salad'
  | 'soup'
  | 'snack'
  | 'fastfood'
  | 'breakfast'
  | 'dessert'
  | 'drink'
  | 'hotdrink'
  | 'nuts'
  | 'condiment'

export type QuestionKey =
  | 'style' // oil / richness of a cooked dish
  | 'ratio' // meat pieces vs gravy
  | 'bone'
  | 'method' // boiled / pan-fried / deep-fried
  | 'milk' // milk in tea or coffee
  | 'milkType' // milk base of a latte-style drink
  | 'sugar'
  | 'spread' // butter / ghee / jam on bread
  | 'ghee' // ghee or butter on rice
  | 'dressing'
  | 'extras' // cheese / mayo / bacon on burgers & sandwiches
  | 'crust'
  | 'sweetness'
  | 'sides' // rice / roti / naan with a curry

export interface Food {
  id: string
  name: string
  emoji: string
  cat: FoodCat
  /** Nutrition per 100 g (or 100 ml for drinks). */
  per100: Macros
  servings: Serving[]
  /** Index of the serving to preselect. */
  def: number
  aliases: string[]
  questions: QuestionKey[]
  liquid?: boolean
}

export interface Modifier {
  /** Change per 100 g of food. */
  per100?: Partial<Macros>
  /** Change per serving (e.g. sugar per cup). */
  each?: Partial<Macros>
  /** Scale the whole item (e.g. edible share when bones are included). */
  mult?: number
}

export interface QuestionOption {
  id: string
  label: string
  hint?: string
  emoji?: string
  mod?: Modifier
  /** Words in what the user typed that should preselect this option ("restaurant", "boneless"). */
  match?: string[]
  /** For the sides question: the food this option adds to the meal. */
  addFood?: { id: string; serving?: number; qty?: number }
}

export interface Question {
  key: QuestionKey
  title: string
  subtitle?: string
  multi?: boolean
  options: QuestionOption[]
  /** Option preselected (single-choice). */
  def?: string
}
