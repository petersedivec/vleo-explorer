// Turn heritage-mission data into model inputs and compare model predictions with what happened.

import type { Check, HeritageInputs, HeritageMission } from '../data/heritage'
import { G0 } from './constants'
import { DEFAULT_INPUTS, evaluateSatellite, type SatelliteInputs, type SatelliteResult } from './satellite'

export function heritageToInputs(mission: HeritageMission, overrides: Partial<HeritageInputs> = {}): SatelliteInputs {
  const m = { ...mission.inputs, ...overrides }
  return {
    ...DEFAULT_INPUTS,
    mode: 'asBuilt',
    asBuilt: { ...m.asBuilt },
    altitude_m: m.altitude_m,
    inclination_deg: m.inclination_deg,
    beta_deg: m.beta_deg,
    cd: m.cd,
    propulsion: m.propulsion,
    isp_s: m.isp_s,
    efficiency: m.efficiency,
    propellant_kg: m.propellant_kg,
    solar: { f107: m.f107, ap: m.ap },
    stormMargin: 1,
    // Heritage checks compare physics, not hardware life; design life does not cap results.
    designLife_s: Infinity,
  }
}

function metricValue(check: Check, inputs: SatelliteInputs, r: SatelliteResult): number {
  switch (check.metric) {
    case 'propellantLife':
      return r.propellantLife_s
    case 'naturalLifetime':
      return r.naturalLifetime_s
    case 'thrustMargin':
      return r.thrustMargin
    case 'decayRate':
      return r.decayRate_m_day
    case 'propellantNeeded':
      return (r.drag_N * (check.duration_s ?? 0)) / (G0 * inputs.isp_s)
  }
}

export interface CheckResult {
  /** Model value at the low and high ends of the check's solar-activity range. */
  low: number
  high: number
  /** 'consistent' when the observation is inside a wide band (high/low > 3): weak validation. */
  verdict: 'within' | 'consistent' | 'modelHigh' | 'modelLow' | null
  /** Observed ÷ nearest model bound, when outside the range. */
  ratio: number | null
}

export function evaluateCheck(mission: HeritageMission, check: Check): CheckResult {
  const values = check.f107Range.map((f107) => {
    const inputs = heritageToInputs(mission, { ...check.overrides, f107 })
    return metricValue(check, inputs, evaluateSatellite(inputs))
  })
  const low = Math.min(...values)
  const high = Math.max(...values)
  if (check.observed === null) return { low, high, verdict: null, ratio: null }
  if (check.observed >= low * 0.9 && check.observed <= high * 1.1)
    return { low, high, verdict: high / low > 3 ? 'consistent' : 'within', ratio: null }
  return check.observed < low
    ? { low, high, verdict: 'modelHigh', ratio: low / check.observed }
    : { low, high, verdict: 'modelLow', ratio: check.observed / high }
}
