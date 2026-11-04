import { describe, expect, it } from 'vitest'
import { YEAR_S } from './constants'
import { PROPULSION_PRESETS } from './propulsion'
import { budgetLifeFor, designFor, ispCurve, NEUTRAL_FIXED_MASS_KG, requirementFor, TECHNOLOGIES, winnerMap } from './propulsionTrade'
import { DEFAULT_INPUTS } from './satellite'

const base = DEFAULT_INPUTS

describe('propulsion trade', () => {
  it('propellant for a requirement is drag × life / (g0 Isp), plus tank', () => {
    const r = requirementFor(base, 'hall', 300e3, 3 * YEAR_S)
    const d = designFor(base, 'hall', 300e3, undefined, {}, 3 * YEAR_S)
    expect(r.propellant_kg).toBeCloseTo((d.drag_N * 3 * YEAR_S) / (9.80665 * PROPULSION_PRESETS.hall.isp_s), 9)
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
    // Equalising removes (estimated − neutral) fixed mass, grossed up by the structure fraction.
    const equal = designFor(base, 'hall', 300e3, undefined, { equalFixedMass: true })
    const estimated = designFor(base, 'hall', 300e3)
    const delta = (PROPULSION_PRESETS.hall.systemFixedMass_kg - NEUTRAL_FIXED_MASS_KG) / (1 - base.structureFraction)
    expect(estimated.dryMass_kg - equal.dryMass_kg).toBeCloseTo(delta, 1)
  })

  it('a Hall thruster is never sized below its minimum operating power', () => {
    const d = designFor(base, 'hall', 450e3)
    expect(d.thrusterPower_W).toBeGreaterThanOrEqual(PROPULSION_PRESETS.hall.minPower_W)
  })

  it('the generic Isp curve carries no technology-specific minimum power', () => {
    // At 450 km drag is tiny, so any floor would dominate the thruster power.
    const curve = ispCurve(base, 450e3, YEAR_S, [1500], 0.45, 0.12)
    const d = designFor(base, 'electrospray', 450e3, { isp_s: 1500, efficiency: 0.45 })
    expect(d.thrusterPower_W).toBeLessThan(PROPULSION_PRESETS.electrospray.minPower_W)
    expect(curve[0].thrusterPower_W).toBeCloseTo(d.thrusterPower_W, 9)
  })
})

describe('thruster wear', () => {
  it('carries enough units to cover the mission total impulse', () => {
    const life = 2 * YEAR_S
    const d = designFor(base, 'electrospray', 350e3, undefined, {}, life)
    const needed = d.drag_N * life
    expect(d.thrusterUnits * PROPULSION_PRESETS.electrospray.unitTotalImpulse_Ns).toBeGreaterThanOrEqual(needed * 0.999)
  })

  it('wear makes long electrospray missions heavier; ignoring wear removes the penalty', () => {
    const short = requirementFor(base, 'electrospray', 350e3, 0.25 * YEAR_S)
    const long = requirementFor(base, 'electrospray', 350e3, 5 * YEAR_S)
    const longNoWear = requirementFor(base, 'electrospray', 350e3, 5 * YEAR_S, { ignoreWear: true })
    expect(long.dry_kg).toBeGreaterThan(short.dry_kg)
    expect(longNoWear.dry_kg).toBeLessThan(long.dry_kg)
  })

  it('equal-budget life is self-consistent with the units it carries', () => {
    const life = budgetLifeFor(base, 'feep', 350e3, 80)
    const r = requirementFor(base, 'feep', 350e3, life)
    expect(r.wet_kg).toBeLessThanOrEqual(80 * 1.001)
  })

  it('a what-if wear life changes only the chosen technology', () => {
    const opts = { wearOverride: { tech: 'electrospray' as const, unitTotalImpulse_Ns: 10_000 } }
    const es = requirementFor(base, 'electrospray', 350e3, 5 * YEAR_S, opts)
    const esPublished = requirementFor(base, 'electrospray', 350e3, 5 * YEAR_S)
    expect(es.wet_kg).toBeLessThan(esPublished.wet_kg)
    expect(requirementFor(base, 'hall', 350e3, 5 * YEAR_S, opts).wet_kg).toBeCloseTo(requirementFor(base, 'hall', 350e3, 5 * YEAR_S).wet_kg, 9)
  })
})
