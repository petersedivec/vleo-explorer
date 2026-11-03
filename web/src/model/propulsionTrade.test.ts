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

describe('fairness checks', () => {
  it('marks a tie when the runner-up is within 10%', () => {
    for (const row of winnerMap(base, [300e3, 400e3], [1 * YEAR_S, 5 * YEAR_S]))
      for (const c of row) expect(c.tie).toBe(c.margin < 0.1)
  })

  it('equal fixed masses give every technology the same fixed system mass', () => {
    // Hall's estimated fixed mass is 3 kg; equalising to 2 kg removes 1 kg / (1 − structure fraction).
    const equal = designFor(base, 'hall', 300e3, undefined, { equalFixedMass: true })
    const estimated = designFor(base, 'hall', 300e3)
    expect(estimated.dryMass_kg - equal.dryMass_kg).toBeCloseTo(1 / (1 - base.structureFraction), 1)
  })

  it('a Hall thruster is never sized below its minimum operating power', () => {
    const d = designFor(base, 'hall', 450e3)
    expect(d.thrusterPower_W).toBeGreaterThanOrEqual(PROPULSION_PRESETS.hall.minPower_W)
  })

  it('the generic Isp curve carries no technology-specific minimum power', () => {
    expect(PROPULSION_PRESETS.electrospray.minPower_W).toBe(0)
  })
})
