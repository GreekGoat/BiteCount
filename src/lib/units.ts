import { LB_PER_KG } from './plan'

export type Units = 'metric' | 'imperial'

export const kgToLb = (kg: number) => kg * LB_PER_KG
export const lbToKg = (lb: number) => lb / LB_PER_KG

export function formatWeight(kg: number, units: Units, digits = 1): string {
  const v = units === 'imperial' ? kgToLb(kg) : kg
  return `${trimNumber(v, digits)} ${units === 'imperial' ? 'lb' : 'kg'}`
}

export function formatHeight(cm: number, units: Units): string {
  if (units === 'metric') return `${Math.round(cm)} cm`
  const totalIn = Math.round(cm / 2.54)
  return `${Math.floor(totalIn / 12)}′ ${totalIn % 12}″`
}

export function trimNumber(v: number, digits = 1): string {
  const f = 10 ** digits
  return String(Math.round(v * f) / f)
}

export const fmt = (n: number) => Math.round(n).toLocaleString()
