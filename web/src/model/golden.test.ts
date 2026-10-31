// TypeScript model vs Python reference golden vectors (reference/make_golden.py).

import { describe, expect, it } from 'vitest'
import golden from '../../../reference/golden/physics.json'
import { exponentialDensity_kg_m3, msisDensity_kg_m3, msisOxygen_m3 } from './atmosphere'
import { decayLifetime_s, descent, edelbaumDeltaV_m_s } from './drag'
import {
  circularSpeed_m_s,
  nodalRegression_rad_s,
  orbitsPerDay,
  period_s,
  sunSynchronousInclination_deg,
} from './orbit'
import { eclipseFraction } from './power'
import { electricPower_W, massFlow_kg_s, thrustToPower_N_W } from './propulsion'

const close = (actual: number, expected: number, rel: number) =>
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(rel * Math.abs(expected) + 1e-300)

describe('orbit', () => {
  it.each(golden.orbit)('h = $altitude_m m', (g) => {
    close(circularSpeed_m_s(g.altitude_m), g.speed_m_s, 1e-12)
    close(period_s(g.altitude_m), g.period_s, 1e-12)
    close(orbitsPerDay(g.altitude_m), g.orbits_per_day, 1e-12)
    close(sunSynchronousInclination_deg(g.altitude_m), g.sso_inclination_deg, 1e-12)
    close(nodalRegression_rad_s(g.altitude_m, 53), g.nodal_regression_53deg_rad_s, 1e-12)
  })
})

describe('atmosphere', () => {
  it.each(golden.atmosphere)('h=$altitude_m F10.7=$f107 Ap=$ap i=$inclination_deg', (g) => {
    const solar = { f107: g.f107, ap: g.ap }
    close(msisDensity_kg_m3(g.altitude_m, solar, g.inclination_deg), g.density_kg_m3, 1e-9)
    close(msisOxygen_m3(g.altitude_m, solar, g.inclination_deg), g.o_number_density_m3, 1e-9)
  })

  it.each(golden.exponential_atmosphere)('exponential h=$altitude_m', (g) => {
    close(exponentialDensity_kg_m3(g.altitude_m), g.density_kg_m3, 1e-12)
  })
})

describe('decay', () => {
  it.each(golden.decay)('h=$altitude_m B=$ballistic_kg_m2', (g) => {
    const density = (h: number) => msisDensity_kg_m3(h, { f107: g.f107, ap: g.ap }, g.inclination_deg)
    close(decayLifetime_s(g.altitude_m, g.ballistic_kg_m2, density), g.lifetime_s, 1e-3)
  })
})

describe('eclipse', () => {
  it.each(golden.eclipse)('h=$altitude_m beta=$beta_deg', (g) => {
    close(eclipseFraction(g.altitude_m, g.beta_deg), g.fraction, 1e-12)
  })
})

describe('propulsion', () => {
  it.each(golden.propulsion)('T=$thrust_N Isp=$isp_s', (g) => {
    close(electricPower_W(g.thrust_N, g.isp_s, g.efficiency), g.power_W, 1e-12)
    close(thrustToPower_N_W(g.isp_s, g.efficiency), g.thrust_to_power_N_W, 1e-12)
    close(massFlow_kg_s(g.thrust_N, g.isp_s), g.mass_flow_kg_s, 1e-12)
  })
})

describe('descent', () => {
  it.each(golden.descent)('$start_altitude_m -> $end_altitude_m', (g) => {
    const density = (h: number) => msisDensity_kg_m3(h, { f107: g.f107, ap: g.ap }, g.inclination_deg)
    close(edelbaumDeltaV_m_s(g.start_altitude_m, g.end_altitude_m), g.edelbaum_delta_v_m_s, 1e-12)
    const r = descent(g.start_altitude_m, g.end_altitude_m, g.thrust_N, g.isp_s, g.mass_kg, g.cd, g.area_m2, density)
    close(r.time_s, g.time_s, 1e-3)
    close(r.propellant_kg, g.propellant_kg, 1e-3)
  })
})
