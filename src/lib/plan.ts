/**
 * The diet plan method BiteCount follows:
 *   1. Maintenance = BW(kg) × 2.2 × 15
 *   2. Budget      = Maintenance − deficit% of Maintenance (10% by default)
 *   3. Macros      = protein BW × 2 g, fat BW × 0.8 g, carbs fill the remaining budget
 */

/** kg → lb factor used by the method. Used app-wide so every number on screen agrees with it. */
export const LB_PER_KG = 2.2
export const KCAL_PER_LB_MAINTENANCE = 15
export const KCAL_PER_KG_BODY_FAT = 7700

export const PLAN_DEFAULTS = {
  deficitPct: 10,
  proteinPerKg: 2,
  fatPerKg: 0.8,
} as const

export interface PlanSettings {
  deficitPct: number
  proteinPerKg: number
  fatPerKg: number
}

export interface Plan {
  weightKg: number
  weightLb: number
  maintenance: number
  deficitPct: number
  deficitKcal: number
  budget: number
  protein: number
  fat: number
  carbs: number
  proteinKcal: number
  fatKcal: number
  /** Calories left for carbs after protein and fat. */
  carbsKcal: number
}

export function computePlan(weightKg: number, s: PlanSettings): Plan {
  const weightLb = Math.round(weightKg * LB_PER_KG * 10) / 10
  const maintenance = Math.round(weightKg * LB_PER_KG * KCAL_PER_LB_MAINTENANCE)
  const deficitKcal = Math.round((maintenance * s.deficitPct) / 100)
  const budget = maintenance - deficitKcal
  const protein = Math.round(weightKg * s.proteinPerKg)
  const fat = Math.round(weightKg * s.fatPerKg)
  const proteinKcal = protein * 4
  const fatKcal = fat * 9
  const carbsKcal = Math.max(0, budget - proteinKcal - fatKcal)
  // Floor so the three macros never add up to more than the budget.
  const carbs = Math.floor(carbsKcal / 4)
  return {
    weightKg,
    weightLb,
    maintenance,
    deficitPct: s.deficitPct,
    deficitKcal,
    budget,
    protein,
    fat,
    carbs,
    proteinKcal,
    fatKcal,
    carbsKcal,
  }
}

export interface GoalProjection {
  kgPerWeek: number
  weeks: number
  date: Date
}

/** Rough time to goal from a steady daily deficit (7,700 kcal ≈ 1 kg of body fat). */
export function projectGoal(weightKg: number, goalKg: number | undefined, deficitKcal: number, from = new Date()): GoalProjection | null {
  if (!goalKg || goalKg >= weightKg || deficitKcal <= 0) return null
  const kgPerWeek = (deficitKcal * 7) / KCAL_PER_KG_BODY_FAT
  const weeks = Math.ceil((weightKg - goalKg) / kgPerWeek)
  const date = new Date(from)
  date.setDate(date.getDate() + weeks * 7)
  return { kgPerWeek, weeks, date }
}

export function bmi(weightKg: number, heightCm: number): number {
  const m = heightCm / 100
  return m > 0 ? weightKg / (m * m) : 0
}

export function bmiLabel(value: number): string {
  if (value < 18.5) return 'Underweight'
  if (value < 25) return 'Healthy range'
  if (value < 30) return 'Overweight'
  return 'Obese range'
}

/** ~35 ml per kg, rounded to the nearest 50 ml. */
export function waterGoalMl(weightKg: number): number {
  return Math.round((weightKg * 35) / 50) * 50
}
