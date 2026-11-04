import { describe, expect, it } from 'vitest'
import { PROPULSION_PRESETS } from '../model/propulsion'
import { TECH_CARDS } from './propulsion101'

describe('Propulsion 101', () => {
  it('has a card for every technology in the model, plus air-breathing', () => {
    const ids = new Set(TECH_CARDS.map((c) => c.id))
    for (const t of Object.keys(PROPULSION_PRESETS)) expect(ids.has(t as never), t).toBe(true)
    expect(ids.has('airBreathing')).toBe(true)
  })

  it('every card has strengths, weaknesses and a reading link', () => {
    for (const c of TECH_CARDS) {
      expect(c.strengths.length).toBeGreaterThan(0)
      expect(c.weaknesses.length).toBeGreaterThan(0)
      expect(c.reading[0].url).toMatch(/^https:\/\//)
    }
  })
})
