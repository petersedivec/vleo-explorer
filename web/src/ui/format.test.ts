import { describe, expect, it } from 'vitest'
import { money, moneyRange } from './format'

describe('money', () => {
  it('rounds to two significant figures before choosing the suffix', () => {
    expect(money(999_400)).toBe('$1.0M')
    expect(money(1032)).toBe('$1.0k')
    expect(money(12_340_000)).toBe('$12M')
    expect(money(150e6)).toBe('$150M')
    expect(money(0.0022)).toBe('$0.0022')
  })

  it('formats a band', () => {
    expect(moneyRange([1032, 4400])).toBe('$1.0k–$4.4k')
  })
})
