import { describe, expect, it } from 'vitest'
import { resolveEatenDate } from './coach'

describe('resolveEatenDate', () => {
  const today = '2026-10-06'
  it('keeps a recent past day the coach worked out', () => {
    expect(resolveEatenDate('2026-10-04', undefined, today)).toBe('2026-10-04')
  })
  it('keeps today', () => {
    expect(resolveEatenDate('2026-10-06', undefined, today)).toBe(today)
  })
  it('never logs into the future', () => {
    expect(resolveEatenDate('2026-10-07', undefined, today)).toBe(today)
  })
  it('ignores dates that are too old or malformed', () => {
    expect(resolveEatenDate('2025-01-01', undefined, today)).toBe(today)
    expect(resolveEatenDate('Sunday', undefined, today)).toBe(today)
    expect(resolveEatenDate('', undefined, today)).toBe(today)
  })
  it('still understands older replies that said yesterday', () => {
    expect(resolveEatenDate(undefined, 'yesterday', today)).toBe('2026-10-05')
  })
})
