// Property tests for the closed sizing loop (docs/physics.md §7).

import { describe, expect, it } from 'vitest'
import { YEAR_S } from './constants'
import { decayLifetime_s } from './drag'
import { DEFAULT_INPUTS, densityFunction, evaluateSatellite, minimumFeasibleAltitude_m, sweepAltitude } from './satellite'

const KM = 1e3
const altitudes = Array.from({ length: 91 }, (_, k) => (150 + 5 * k) * KM)

describe('closed sizing loop', () => {
  it('closes for the default design at 300 km', () => {
    const r = evaluateSatellite(DEFAULT_INPUTS)
    expect(r.feasible).toBe(true)
    expect(r.loopGain).toBeLessThan(1)
    expect(r.dryMass_kg).toBeGreaterThan(DEFAULT_INPUTS.payloadMass_kg)
  })

  it('drag, thruster power and array area fall with altitude', () => {
    const rs = sweepAltitude(DEFAULT_INPUTS, altitudes).filter((r) => r.feasible)
    for (let k = 1; k < rs.length; k++) {
      expect(rs[k].drag_N).toBeLessThan(rs[k - 1].drag_N)
      // Non-increasing: at high altitude the thruster sits at its minimum operating power.
      expect(rs[k].thrusterPower_W).toBeLessThanOrEqual(rs[k - 1].thrusterPower_W)
      expect(rs[k].arrayArea_m2).toBeLessThanOrEqual(rs[k - 1].arrayArea_m2 * (1 + 1e-9))
    }
  })

  it('the feasibility wall sits where the loop gain approaches 1, not at an iteration cap', () => {
    for (const orientation of ['edgeOn', 'sunTracking'] as const) {
      for (const r of sweepAltitude({ ...DEFAULT_INPUTS, arrayOrientation: orientation }, altitudes)) {
        if (r.loopGain > 1.05) expect(r.feasible).toBe(false)
        if (r.loopGain < 0.85) expect(r.feasible).toBe(true)
        expect(r.infeasibility).not.toBe('loopNotConverged')
      }
    }
  })

  it('sun-tracking arrays raise the minimum feasible altitude vs edge-on', () => {
    const edge = minimumFeasibleAltitude_m(DEFAULT_INPUTS, altitudes)!
    const track = minimumFeasibleAltitude_m({ ...DEFAULT_INPUTS, arrayOrientation: 'sunTracking' }, altitudes)!
    expect(track).toBeGreaterThan(edge)
  })

  it('higher Isp raises the minimum feasible altitude at fixed efficiency', () => {
    const lo = minimumFeasibleAltitude_m({ ...DEFAULT_INPUTS, arrayOrientation: 'sunTracking', isp_s: 1000 }, altitudes)!
    const hi = minimumFeasibleAltitude_m({ ...DEFAULT_INPUTS, arrayOrientation: 'sunTracking', isp_s: 4000 }, altitudes)!
    expect(hi).toBeGreaterThan(lo)
  })

  it('a bigger storm margin raises the minimum feasible altitude', () => {
    const calm = minimumFeasibleAltitude_m({ ...DEFAULT_INPUTS, arrayOrientation: 'sunTracking', stormMargin: 1 }, altitudes)!
    const storm = minimumFeasibleAltitude_m({ ...DEFAULT_INPUTS, arrayOrientation: 'sunTracking', stormMargin: 5 }, altitudes)!
    expect(storm).toBeGreaterThan(calm)
  })
})

describe('life', () => {
  it('propellant life is linear in propellant and Isp, and independent of propellant on drag', () => {
    const a = evaluateSatellite({ ...DEFAULT_INPUTS, designLife_s: Infinity })
    const b = evaluateSatellite({ ...DEFAULT_INPUTS, designLife_s: Infinity, propellant_kg: 2 * DEFAULT_INPUTS.propellant_kg })
    expect(b.propellantLife_s / a.propellantLife_s).toBeCloseTo(2, 6)
    expect(b.drag_N).toBeCloseTo(a.drag_N, 12)
  })

  it('mission life is the minimum of its limits', () => {
    const r = evaluateSatellite({ ...DEFAULT_INPUTS, totalImpulse_Ns: 1000 })
    expect(r.missionLife_s).toBe(Math.min(r.propellantLife_s, r.impulseLife_s, DEFAULT_INPUTS.designLife_s))
    expect(r.lifeLimitedBy).toBe('totalImpulse')
  })

  it('disposal (dry) decays faster than at launch mass', () => {
    const r = evaluateSatellite(DEFAULT_INPUTS)
    expect(r.disposalTime_s).toBeLessThan(r.naturalLifetime_s)
  })

  it('a dead satellite at 300 km meets the 5-year rule; at 600 km a light one may not', () => {
    expect(evaluateSatellite(DEFAULT_INPUTS).meetsFiveYearRule).toBe(true)
    const high = evaluateSatellite({ ...DEFAULT_INPUTS, altitude_m: 600e3, solar: { f107: 70, ap: 4 } })
    expect(high.disposalTime_s).toBeGreaterThan(5 * YEAR_S)
  })

  it('chemical thrusters close at low altitude but burn propellant fast', () => {
    const cold = evaluateSatellite({ ...DEFAULT_INPUTS, propulsion: 'coldGas', isp_s: 65, altitude_m: 250e3, designLife_s: Infinity })
    const es = evaluateSatellite({ ...DEFAULT_INPUTS, altitude_m: 250e3, designLife_s: Infinity })
    expect(cold.feasible).toBe(true)
    expect(cold.propellantLife_s).toBeLessThan(es.propellantLife_s / 10)
  })
})

describe('cached decay integral', () => {
  it.each([160e3, 250e3, 300e3, 450e3, 600e3])('matches direct Simpson integration at %d m', (h) => {
    const r = evaluateSatellite({ ...DEFAULT_INPUTS, altitude_m: h })
    const direct = decayLifetime_s(h, r.ballistic_kg_m2, densityFunction(DEFAULT_INPUTS))
    expect(Math.abs(r.naturalLifetime_s / direct - 1)).toBeLessThan(1e-3)
  })
})
