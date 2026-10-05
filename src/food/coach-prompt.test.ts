import { describe, expect, it } from 'vitest'
import { coachPrompt, recentTurns } from './ai'

describe('coach prompt', () => {
  it('sends a first message as it is', () => {
    expect(coachPrompt([{ role: 'user', text: 'What should I eat?' }])).toBe('What should I eat?')
  })

  it('folds earlier turns into a transcript before the new message', () => {
    const prompt = coachPrompt([
      { role: 'user', text: 'I had biryani for lunch' },
      { role: 'assistant', text: 'Logged it.' },
      { role: 'user', text: 'Can I have a lassi?' },
    ])
    expect(prompt).toBe('Earlier in this chat:\nMe: I had biryani for lunch\nCoach: Logged it.\n\nMy message now: Can I have a lassi?')
  })

  it('keeps only the last few turns, starting on a user turn', () => {
    const turns = Array.from({ length: 9 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', text: `t${i}` }) as const)
    const recent = recentTurns([...turns], 6)
    expect(recent[0].role).toBe('user')
    expect(recent.at(-1)?.text).toBe('t8')
    expect(recent.length).toBeLessThanOrEqual(6)
  })
})
