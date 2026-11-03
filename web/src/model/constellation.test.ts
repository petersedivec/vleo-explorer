// Property tests for constellation sizing (docs/physics.md §10).

import { describe, expect, it } from 'vitest'
import {
  centralAngleFromElevation,
  centralAngleFromOffNadir,
  DEFAULT_CONSTELLATION,
  evaluateConstellation,
  optimumAltitude,
  satellitesForContinuous,
  sweepConstellation,
} from './constellation'
import { DEG, R_EARTH } from './constants'
import { DEFAULT_INPUTS } from './satellite'

const KM = 1e3

describe('geometry', () => {
  it('zero off-nadir sees only the nadir point', () => {
    expect(centralAngleFromOffNadir(300e3, 0)).toBeCloseTo(0, 12)
  })

  it('swath grows roughly linearly with altitude at small angles', () => {
    const a = centralAngleFromOffNadir(250e3, 10)
    const b = centralAngleFromOffNadir(500e3, 10)
    expect(b / a).toBeGreaterThan(1.9)
    expect(b / a).toBeLessThan(2.1)
  })

  it('zero elevation footprint reaches the horizon: cos λ = R/r', () => {
    expect(Math.cos(centralAngleFromElevation(400e3, 0))).toBeCloseTo(R_EARTH / (R_EARTH + 400e3), 12)
  })

  it('hand check: 400 km, 25° elevation gives acos(R cos 25° / r) − 25° ≈ 6.48°', () => {
    expect(centralAngleFromElevation(400e3, 25) / DEG).toBeCloseTo(6.48, 2)
  })
})

describe('satellite counts', () => {
  it('revisit count scales roughly as 1/h; continuous roughly as 1/h²', () => {
    const fixed = { ...DEFAULT_CONSTELLATION, payloadExponent: 0 }
    const rev = (h: number) => evaluateConstellation(DEFAULT_INPUTS, fixed, h).satellites
    const cont = (h: number) => evaluateConstellation(DEFAULT_INPUTS, { ...fixed, coverage: 'continuous' }, h).satellites
    const revRatio = rev(250 * KM) / rev(500 * KM)
    const contRatio = cont(250 * KM) / cont(500 * KM)
    expect(revRatio).toBeGreaterThan(1.6)
    expect(revRatio).toBeLessThan(2.4)
    expect(contRatio).toBeGreaterThan(3)
    expect(contRatio).toBeLessThan(5)
  })

  it('global continuous coverage at 550 km, 25° elevation needs hundreds of satellites', () => {
    const n = satellitesForContinuous(centralAngleFromElevation(550e3, 25), 90)
    expect(n).toBeGreaterThan(200)
    expect(n).toBeLessThan(1000)
  })
})

describe('sustainment', () => {
  const altitudes = Array.from({ length: 71 }, (_, k) => (150 + 5 * k) * KM)

  it('with payload growing with altitude, mass per year has an interior optimum', () => {
    const pts = sweepConstellation(DEFAULT_INPUTS, DEFAULT_CONSTELLATION, altitudes)
    const best = optimumAltitude(pts)!
    const feasible = pts.filter((p) => p.feasible)
    expect(best.altitude_m).toBeGreaterThan(feasible[0].altitude_m)
    expect(best.altitude_m).toBeLessThan(feasible[feasible.length - 1].altitude_m)
  })

  it('replacement rate is satellites over life', () => {
    const p = evaluateConstellation(DEFAULT_INPUTS, DEFAULT_CONSTELLATION, 300e3)
    expect(p.replacementsPerYear).toBeCloseTo(p.satellites / (p.life_s / 31_557_600), 9)
    expect(p.massPerYear_kg).toBeCloseTo(p.replacementsPerYear * p.wetMass_kg, 9)
  })

  it('payload scale is 1 at the reference altitude and fixed in as-built mode', () => {
    expect(evaluateConstellation(DEFAULT_INPUTS, DEFAULT_CONSTELLATION, 300e3).payloadScale).toBe(1)
    expect(evaluateConstellation({ ...DEFAULT_INPUTS, mode: 'asBuilt' }, DEFAULT_CONSTELLATION, 450e3).payloadScale).toBe(1)
  })

  it('design mode sizes propellant to the design life at every altitude', () => {
    for (const h of [220e3, 300e3, 450e3]) {
      const p = evaluateConstellation(DEFAULT_INPUTS, DEFAULT_CONSTELLATION, h)
      if (!p.feasible) continue
      expect(p.life_s).toBe(DEFAULT_INPUTS.designLife_s)
      expect(p.propellant_kg).toBeCloseTo((p.satellite.drag_N * p.life_s) / (9.80665 * DEFAULT_INPUTS.isp_s), 9)
    }
  })
})
