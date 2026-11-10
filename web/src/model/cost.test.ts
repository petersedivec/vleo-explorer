// Checks on the cost model (docs/physics.md §11).

import { describe, expect, it } from 'vitest'
import { DEFAULT_CONSTELLATION, evaluateConstellation } from './constellation'
import { YEAR_S } from './constants'
import { areaImagedPerYear_km2, bandArea_km2, constellationCost, DEFAULT_COSTS, learningFactor, learningRate } from './cost'
import { DEFAULT_INPUTS } from './satellite'

const service = { coverage: 'revisit' as const, latitudeMax_deg: 60, cellWidth_m: null }

describe('learning curve', () => {
  it('follows the quantity guidance: 95% below 10, 90% to 50, 85% above', () => {
    expect([learningRate(5), learningRate(20), learningRate(200)]).toEqual([0.95, 0.9, 0.85])
  })

  it('one unit costs the first-unit price; two units average (1 + L) / 2', () => {
    expect(learningFactor(1)).toBe(1)
    expect(learningFactor(2, 0.9)).toBeCloseTo((1 + 0.9) / 2, 12)
  })

  it('average falls with quantity', () => {
    expect(learningFactor(100, 0.85)).toBeLessThan(learningFactor(10, 0.85))
  })
})

describe('constellation cost', () => {
  const p = evaluateConstellation(DEFAULT_INPUTS, DEFAULT_CONSTELLATION, 300e3)
  const c = constellationCost(p, DEFAULT_COSTS, service)!

  it('per-year cost is the sum of its parts, and low ≤ high', () => {
    for (const b of [c.low, c.high]) expect(b.perYear).toBeCloseTo(b.build + b.launch + b.operations + b.fixed, 6)
    expect(c.low.perYear).toBeLessThan(c.high.perYear)
  })

  it('hand check of the low case', () => {
    const f = learningFactor(p.satellites)
    const unit = (30e3 * (p.satellite.dryMass_kg - p.payloadMass_kg) + 60e3 * p.payloadMass_kg) * f
    expect(c.low.unit).toBeCloseTo(unit, 6)
    expect(c.low.launchPerSatellite).toBeCloseTo(6e3 * p.wetMass_kg, 6)
    expect(c.low.build).toBeCloseTo((p.satellites / (p.life_s / YEAR_S)) * unit, 6)
    expect(c.low.operations).toBeCloseTo(50e3 * p.satellites, 6)
    expect(c.low.deployment).toBeCloseTo(p.satellites * (unit + 6e3 * p.wetMass_kg), 6)
  })

  it('imaging service is cost per km² actually imaged', () => {
    const imaged = areaImagedPerYear_km2(p)
    expect(c.service!.value[0]).toBeCloseTo(c.low.perYear / imaged, 12)
  })

  it('infeasible points have no cost', () => {
    const low = evaluateConstellation(DEFAULT_INPUTS, DEFAULT_CONSTELLATION, 160e3)
    expect(low.feasible).toBe(false)
    expect(constellationCost(low, DEFAULT_COSTS, service)).toBeNull()
  })

  it('band area: the whole Earth at 90°', () => {
    expect(bandArea_km2(90)).toBeCloseTo(4 * Math.PI * 6378.137 ** 2, 0)
  })

  it('phone service is priced per cell per year', () => {
    const d2d = { ...DEFAULT_CONSTELLATION, mission: 'd2d' as const, coverage: 'continuous' as const }
    const q = evaluateConstellation(DEFAULT_INPUTS, d2d, 400e3)
    const r = constellationCost(q, DEFAULT_COSTS, { coverage: 'continuous', latitudeMax_deg: 60, cellWidth_m: 50e3 })!
    const cells = bandArea_km2(60) / (Math.PI * 25 ** 2)
    expect(r.service!.value[1]).toBeCloseTo(r.high.perYear / cells, 6)
  })

  it('a scaled payload on revisit coverage has no service metric', () => {
    const q = evaluateConstellation(DEFAULT_INPUTS, { ...DEFAULT_CONSTELLATION, mission: 'scaled' }, 300e3)
    expect(constellationCost(q, DEFAULT_COSTS, service)!.service).toBeNull()
  })
})
