// Fair, purely technical comparison of propulsion technologies (docs/physics.md §5.7).
//
// The spacecraft (payload, bus, arrays, storm margin, solar activity) comes from the Explore inputs.
// For each technology the closed sizing loop sizes thruster power, arrays and dry mass; propellant and
// tankage are then added either to meet a required life (equal requirement) or to fill a fixed wet-mass
// budget (equal total mass).

import { G0 } from './constants'
import { PROPULSION_PRESETS, type PropulsionClass } from './propulsion'
import { evaluateSatellite, type SatelliteInputs, type SatelliteResult } from './satellite'

export const TECHNOLOGIES = Object.keys(PROPULSION_PRESETS) as PropulsionClass[]

export interface TechDesign {
  tech: PropulsionClass
  design: SatelliteResult
}

/** Size the spacecraft for one technology at one altitude, using that technology's preset Isp and efficiency. */
export function designFor(base: SatelliteInputs, tech: PropulsionClass, altitude_m: number, override?: { isp_s: number; efficiency: number }): SatelliteResult {
  const preset = PROPULSION_PRESETS[tech]
  return evaluateSatellite({
    ...base,
    mode: 'design',
    altitude_m,
    propulsion: tech,
    isp_s: override?.isp_s ?? preset.isp_s,
    efficiency: override?.efficiency ?? preset.efficiency ?? base.efficiency,
    thrusterFixedMass_kg: preset.systemFixedMass_kg,
    // Propellant does not affect sizing; it is added below.
    propellant_kg: 0,
  })
}

export interface RequirementResult {
  feasible: boolean
  dry_kg: number
  propellant_kg: number
  tank_kg: number
  wet_kg: number
  thrusterPower_W: number
  arrayArea_m2: number
}

/** Propellant and tank needed to hold altitude for life_s, given a sized design. */
export function meetRequirement(design: SatelliteResult, isp_s: number, tankFraction: number, life_s: number): RequirementResult {
  const propellant = (design.drag_N * life_s) / (G0 * isp_s)
  const tank = tankFraction * propellant
  return {
    feasible: design.feasible,
    dry_kg: design.dryMass_kg,
    propellant_kg: propellant,
    tank_kg: tank,
    wet_kg: design.dryMass_kg + propellant + tank,
    thrusterPower_W: design.thrusterPower_W,
    arrayArea_m2: design.arrayArea_m2,
  }
}

/** Life achievable when propellant plus tank fill whatever a fixed wet-mass budget leaves after the dry mass. */
export function lifeWithBudget(design: SatelliteResult, isp_s: number, tankFraction: number, wetBudget_kg: number): number {
  if (!design.feasible) return 0
  const propellant = (wetBudget_kg - design.dryMass_kg) / (1 + tankFraction)
  if (propellant <= 0) return 0
  return (propellant * G0 * isp_s) / design.drag_N
}

export function requirementFor(base: SatelliteInputs, tech: PropulsionClass, altitude_m: number, life_s: number) {
  const preset = PROPULSION_PRESETS[tech]
  return meetRequirement(designFor(base, tech, altitude_m), preset.isp_s, preset.tankFraction, life_s)
}

export function budgetLifeFor(base: SatelliteInputs, tech: PropulsionClass, altitude_m: number, wetBudget_kg: number) {
  const preset = PROPULSION_PRESETS[tech]
  return lifeWithBudget(designFor(base, tech, altitude_m), preset.isp_s, preset.tankFraction, wetBudget_kg)
}

/**
 * Total wet mass to meet the requirement vs specific impulse, for a generic electric thruster of the
 * given efficiency and tank fraction. The minimum is the optimal Isp for this mission.
 */
export function ispCurve(
  base: SatelliteInputs,
  altitude_m: number,
  life_s: number,
  isps_s: number[],
  efficiency: number,
  tankFraction: number,
): (RequirementResult & { isp_s: number })[] {
  return isps_s.map((isp_s) => ({
    isp_s,
    ...meetRequirement(designFor(base, 'griddedIon', altitude_m, { isp_s, efficiency }), isp_s, tankFraction, life_s),
  }))
}

export interface WinnerCell {
  winner: PropulsionClass | null
  wet_kg: number
  runnerUp: PropulsionClass | null
}

/**
 * Lightest technology meeting each (altitude, life) requirement. The sizing loop does not depend on
 * life, so each technology is sized once per altitude and propellant is added per life.
 */
export function winnerMap(base: SatelliteInputs, altitudes_m: number[], lives_s: number[], techs = TECHNOLOGIES): WinnerCell[][] {
  const designs = altitudes_m.map((h) => techs.map((t) => designFor(base, t, h)))
  return lives_s.map((life) =>
    altitudes_m.map((_, a) => {
      const options = techs
        .map((tech, k) => {
          const p = PROPULSION_PRESETS[tech]
          return { tech, r: meetRequirement(designs[a][k], p.isp_s, p.tankFraction, life) }
        })
        .filter((o) => o.r.feasible)
        .sort((x, y) => x.r.wet_kg - y.r.wet_kg)
      return { winner: options[0]?.tech ?? null, wet_kg: options[0]?.r.wet_kg ?? NaN, runnerUp: options[1]?.tech ?? null }
    }),
  )
}
