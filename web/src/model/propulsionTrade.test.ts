import { describe, expect, it } from 'vitest'
import { YEAR_S } from './constants'
import { PROPULSION_PRESETS } from './propulsion'
import { budgetLifeFor, designFor, ispCurve, requirementFor, TECHNOLOGIES, winnerMap } from './propulsionTrade'
import { DEFAULT_INPUTS } from './satellite'

const base = DEFAULT_INPUTS

describe('propulsion trade', () => {
  it('propellant for a requirement is drag × life / (g0 Isp), plus tank', () => {
    const r = requirementFor(base, 'hall', 300e3, 3 * YEAR_S)
    const d = designFor(base, 'hall', 300e3)
    expect(r.propellant_kg).toBeCloseTo((d.drag_N * 3 * YEAR_S) / (9.80665 * 1400), 9)
    expect(r.tank_kg).toBeCloseTo(0.15 * r.propellant_kg, 9)
  })

  it('equal-budget life is consistent with the requirement mass', () => {
    for (const tech of TECHNOLOGIES) {
      const r = requirementFor(base, tech, 300e3, 2 * YEAR_S)
      if (!r.feasible) continue
      expect(budgetLifeFor(base, tech, 300e3, r.wet_kg) / YEAR_S).toBeCloseTo(2, 6)
    }
  })

  it('the Isp curve has an interior optimum for a long low mission', () => {
    const isps = Array.from({ length: 40 }, (_, k) => 100 * 1.1 ** k)
    const curve = ispCurve({ ...base, arrayOrientation: 'sunTracking' }, 250e3, 5 * YEAR_S, isps, 0.5, 0.12).filter((c) => c.feasible)
    const best = curve.reduce((a, b) => (b.wet_kg < a.wet_kg ? b : a))
    expect(best.isp_s).toBeGreaterThan(curve[0].isp_s)
    expect(best.isp_s).toBeLessThan(curve[curve.length - 1].isp_s)
  })

  it('cold gas wins nothing for multi-year missions; something wins at moderate altitude', () => {
    const map = winnerMap(base, [250e3, 350e3], [3 * YEAR_S])
    for (const cell of map[0]) {
      expect(cell.winner).not.toBeNull()
      expect(cell.winner).not.toBe('coldGas')
    }
  })

  it('every preset has a tank fraction', () => {
    for (const t of TECHNOLOGIES) expect(PROPULSION_PRESETS[t].tankFraction).toBeGreaterThan(0)
  })
})
