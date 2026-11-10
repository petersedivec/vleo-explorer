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
import { electricPower_W, massFlow_kg_s, PROPULSION_PRESETS, thrustToPower_N_W, type PropulsionClass } from './propulsion'
import { DEFAULT_INPUTS, evaluateSatellite, type SatelliteInputs } from './satellite'

const close = (actual: number, expected: number, rel: number) =>
  Number.isFinite(expected)
    ? expect(Math.abs(actual - expected)).toBeLessThanOrEqual(rel * Math.abs(expected) + 1e-300)
    : expect(actual).toBe(expected)

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

// ── Closed sizing loop (§7) and as-built mode (§7a) ──────────────────────────────
// The Python reference solves the loop differently (closed-form array/power for each trial mass, then a
// root-find on dry mass), so agreement checks the method as well as the arithmetic.

type GoldenSpacecraft = (typeof golden.sizing)[number]['inputs']

function toInputs(g: GoldenSpacecraft, thruster: string): SatelliteInputs {
  const tech = thruster as PropulsionClass
  const t = golden.thrusters[tech as keyof typeof golden.thrusters]
  return {
    ...DEFAULT_INPUTS,
    mode: 'design',
    altitude_m: g.altitude_m,
    inclination_deg: g.inclination_deg,
    beta_deg: g.beta_deg,
    solar: { f107: g.f107, ap: g.ap },
    atmosphereModel: g.atmosphere as SatelliteInputs['atmosphereModel'],
    stormMargin: g.storm_margin,
    payloadMass_kg: g.payload_mass_kg,
    payloadPower_W: g.payload_power_W,
    payloadFrontalArea_m2: g.payload_frontal_area_m2,
    busFixedMass_kg: g.bus_fixed_mass_kg,
    busPower_W: g.bus_power_W,
    structureFraction: g.structure_fraction,
    bodyFrontalArea_m2: g.body_frontal_area_m2,
    bulkDensity_kg_m3: g.bulk_density_kg_m3,
    shapeFactor: g.shape_factor,
    cd: g.cd,
    arrayOrientation: g.array_orientation as SatelliteInputs['arrayOrientation'],
    cellEfficiency: g.cell_efficiency,
    packingFactor: g.packing_factor,
    lifeDegradation: g.life_degradation,
    arrayArealMass_kg_m2: g.array_areal_mass_kg_m2,
    ppuSpecificMass_kg_W: g.ppu_specific_mass_kg_W,
    thrustInEclipse: g.thrust_in_eclipse,
    propellant_kg: g.propellant_kg,
    designLife_s: g.design_life_s,
    totalImpulse_Ns: g.total_impulse_Ns ?? Infinity,
    ignoreThrusterWear: !g.wear,
    propulsion: tech,
    isp_s: t.isp_s,
    efficiency: t.efficiency ?? 0.5,
    thrusterFixedMass_kg: t.system_fixed_mass_kg,
  }
}

describe('golden thrusters match the presets', () => {
  it.each(Object.entries(golden.thrusters))('%s', (tech, t) => {
    const p = PROPULSION_PRESETS[tech as PropulsionClass]
    expect([p.isp_s, p.efficiency, p.unitThrust_N, p.fixedPower_W, p.minPower_W, p.unitTotalImpulse_Ns, p.unitMass_kg, p.systemFixedMass_kg]).toEqual([
      t.isp_s, t.efficiency, t.unit_thrust_N, t.fixed_power_W, t.min_power_W, t.unit_total_impulse_Ns ?? Infinity, t.unit_mass_kg, t.system_fixed_mass_kg,
    ])
  })
})

describe('sizing loop', () => {
  it.each(golden.sizing)('$name', (g) => {
    const r = evaluateSatellite(toInputs(g.inputs, g.thruster))
    expect(r.feasible).toBe(g.feasible)
    close(r.eclipseFraction, g.eclipse_fraction, 1e-12)
    close(r.loopGain, g.loop_gain, 1e-9)
    if (!g.feasible) return
    close(r.dryMass_kg, g.dry_mass_kg!, 1e-5)
    close(r.massGrowth, g.mass_growth!, 1e-5)
    close(r.arrayArea_m2, g.array_area_m2!, 1e-5)
    close(r.bodyFrontalArea_m2, g.body_frontal_area_m2!, 1e-5)
    close(r.dragArea_m2, g.drag_area_m2!, 1e-5)
    close(r.thrusterPower_W, g.thruster_power_W!, 1e-5)
    close(r.stormDrag_N, g.storm_drag_N!, 1e-5)
    expect(r.thrusterUnits).toBe(g.thruster_units)
    close(r.drag_N, g.drag_N!, 1e-5)
    close(r.propellantLife_s, g.propellant_life_s!, 1e-5)
    close(r.impulseLife_s, g.impulse_life_s ?? Infinity, 1e-5)
    close(r.missionLife_s, g.mission_life_s!, 1e-5)
    // TypeScript tabulates the decay integral (trapezoid, 0.25 km); Python integrates adaptively.
    close(r.naturalLifetime_s, g.natural_lifetime_s!, 2e-3)
    close(r.disposalTime_s, g.disposal_time_s!, 2e-3)
  })
})

describe('as-built mode', () => {
  it.each(golden.as_built)('$name', (g) => {
    const base = toInputs(g.inputs, g.thruster)
    const r = evaluateSatellite({
      ...base,
      mode: 'asBuilt',
      asBuilt: { dryMass_kg: g.dry_mass_kg, dragArea_m2: g.drag_area_m2, maxThrust_N: g.max_thrust_N },
    })
    expect(r.feasible).toBe(g.feasible)
    close(r.thrustMargin, g.thrust_margin, 1e-9)
    close(r.thrusterPower_W, g.thruster_power_W, 1e-9)
    close(r.drag_N, g.drag_N, 1e-9)
    close(r.missionLife_s, g.mission_life_s, 1e-9)
    close(r.naturalLifetime_s, g.natural_lifetime_s, 2e-3)
  })
})
