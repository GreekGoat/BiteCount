import { describe, expect, it } from 'vitest'
import { computePlan, PLAN_DEFAULTS, projectGoal } from './plan'

describe('computePlan', () => {
  it('matches the worked example for 60 kg', () => {
    const plan = computePlan(60, PLAN_DEFAULTS)
    expect(plan.weightLb).toBe(132)
    expect(plan.maintenance).toBe(1980)
    expect(plan.deficitKcal).toBe(198)
    expect(plan.budget).toBe(1782)
    expect(plan.protein).toBe(120)
    expect(plan.fat).toBe(48)
    expect(plan.proteinKcal).toBe(480)
    expect(plan.fatKcal).toBe(432)
    expect(plan.carbs).toBe(217)
  })

  it('never lets macros exceed the budget', () => {
    for (const kg of [45, 58.5, 72.3, 90, 120]) {
      const p = computePlan(kg, PLAN_DEFAULTS)
      expect(p.proteinKcal + p.fatKcal + p.carbs * 4).toBeLessThanOrEqual(p.budget)
    }
  })

  it('treats a 0% deficit as maintenance', () => {
    const plan = computePlan(80, { ...PLAN_DEFAULTS, deficitPct: 0 })
    expect(plan.budget).toBe(plan.maintenance)
    expect(plan.maintenance).toBe(2640)
  })

  it('clamps carbs at zero when protein and fat use the whole budget', () => {
    const plan = computePlan(60, { deficitPct: 50, proteinPerKg: 3, fatPerKg: 1.5 })
    expect(plan.carbs).toBe(0)
  })
})

describe('projectGoal', () => {
  it('estimates weeks to goal from the daily deficit', () => {
    const start = new Date(2026, 0, 1)
    const g = projectGoal(60, 55, 198, start)!
    expect(g.kgPerWeek).toBeCloseTo(0.18, 2)
    expect(g.weeks).toBe(28)
  })

  it('returns null without a lower goal or a deficit', () => {
    expect(projectGoal(60, 65, 198)).toBeNull()
    expect(projectGoal(60, 55, 0)).toBeNull()
    expect(projectGoal(60, undefined, 198)).toBeNull()
  })
})
