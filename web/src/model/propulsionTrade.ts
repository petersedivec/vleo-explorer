// Fair, purely technical comparison of propulsion technologies (docs/physics.md §5.7).
//
// The spacecraft (payload, bus, arrays, storm margin, solar activity) comes from the Explore inputs.
// For each technology the closed sizing loop sizes thruster power, arrays and dry mass; propellant and
// tankage are then added either to meet a required life (equal requirement) or to fill a fixed wet-mass
// budget (equal total mass).

import { DAY_S, G0, YEAR_S } from './constants'
import { PROPULSION_PRESETS, type PropulsionClass } from './propulsion'
import { evaluateSatellite, type SatelliteInputs, type SatelliteResult } from './satellite'

export const TECHNOLOGIES = Object.keys(PROPULSION_PRESETS) as PropulsionClass[]

/** Neutral fixed system mass used for the generic Isp curve and the "equal fixed masses" check. */
export const NEUTRAL_FIXED_MASS_KG = 2

const GENERIC_CLASS: PropulsionClass = 'electrospray'

/** A winner within this fraction of the runner-up's wet mass is shown as a tie. */
export const TIE_MARGIN = 0.1

export interface TradeOptions {
  /** Give every technology the same fixed system mass, to see how much the estimates drive the result. */
  equalFixedMass?: boolean
  /** Ignore thruster wear (one unit lasts forever), to see how much wear life drives the result. */
  ignoreWear?: boolean
  /** What-if: a different wear life per unit for one technology. */
  wearOverride?: { tech: PropulsionClass; unitTotalImpulse_Ns: number }
}

const unitImpulseFor = (tech: PropulsionClass, options: TradeOptions) =>
  options.wearOverride?.tech === tech ? options.wearOverride.unitTotalImpulse_Ns : PROPULSION_PRESETS[tech].unitTotalImpulse_Ns

/** Whether a technology's sizing depends on mission life (through thruster wear). */
const wearMatters = (tech: PropulsionClass, options: TradeOptions) =>
  !options.ignoreWear && Number.isFinite(unitImpulseFor(tech, options))

export interface TechDesign {
  tech: PropulsionClass
  design: SatelliteResult
}

/** Size the spacecraft for one technology at one altitude, using that technology's preset Isp and efficiency. */
export function designFor(
  base: SatelliteInputs,
  tech: PropulsionClass,
  altitude_m: number,
  override?: { isp_s: number; efficiency: number },
  options: TradeOptions = {},
  /** Life the thrusters must survive; sets how many units are carried. Defaults to the design life. */
  life_s?: number,
): SatelliteResult {
  const preset = PROPULSION_PRESETS[tech]
  return evaluateSatellite({
    ...base,
    mode: 'design',
    altitude_m,
    propulsion: tech,
    isp_s: override?.isp_s ?? preset.isp_s,
    efficiency: override?.efficiency ?? preset.efficiency ?? base.efficiency,
    thrusterFixedMass_kg: override || options.equalFixedMass ? NEUTRAL_FIXED_MASS_KG : preset.systemFixedMass_kg,
    // The generic curve is technology-neutral: no minimum operating power, no unit count or wear.
    minPowerOverride_W: override ? 0 : undefined,
    idealThruster: override ? true : undefined,
    ignoreThrusterWear: options.ignoreWear,
    unitTotalImpulseOverride_Ns: options.wearOverride?.tech === tech ? options.wearOverride.unitTotalImpulse_Ns : undefined,
    impulseCoverLife_s: life_s ?? base.designLife_s,
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

export function requirementFor(base: SatelliteInputs, tech: PropulsionClass, altitude_m: number, life_s: number, options: TradeOptions = {}) {
  const preset = PROPULSION_PRESETS[tech]
  return meetRequirement(designFor(base, tech, altitude_m, undefined, options, life_s), preset.isp_s, preset.tankFraction, life_s)
}

export function budgetLifeFor(base: SatelliteInputs, tech: PropulsionClass, altitude_m: number, wetBudget_kg: number, options: TradeOptions = {}) {
  const preset = PROPULSION_PRESETS[tech]
  const lifeFor = (coverLife_s: number) =>
    lifeWithBudget(designFor(base, tech, altitude_m, undefined, options, coverLife_s), preset.isp_s, preset.tankFraction, wetBudget_kg)
  if (!wearMatters(tech, options)) return lifeFor(Infinity)
  // With wear, a longer life needs more thruster units, leaving less mass for propellant. Find the
  // longest life L the budget supports with units sized for L: lifeFor(L) ≥ L, by bisection in log(L).
  let lo = 0
  let hi = 200 * YEAR_S
  if (lifeFor(hi) >= hi) return hi
  if (lifeFor(DAY_S) < DAY_S) return 0
  lo = DAY_S
  for (let k = 0; k < 30; k++) {
    const mid = Math.sqrt(lo * hi)
    if (lifeFor(mid) >= mid) lo = mid
    else hi = mid
  }
  return lo
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
    // Any electric class will do: Isp, efficiency, fixed mass and minimum power are all overridden with
    // neutral values, so no technology's estimates leak into the generic curve.
    ...meetRequirement(designFor(base, GENERIC_CLASS, altitude_m, { isp_s, efficiency }), isp_s, tankFraction, life_s),
  }))
}

export interface WinnerCell {
  winner: PropulsionClass | null
  wet_kg: number
  runnerUp: PropulsionClass | null
  /** (runner-up wet mass − winner wet mass) ÷ winner wet mass; Infinity if there is no runner-up. */
  margin: number
  tie: boolean
}

/**
 * Lightest technology meeting each (altitude, life) requirement. The sizing loop does not depend on
 * life, so each technology is sized once per altitude and propellant is added per life.
 */
export function winnerMap(
  base: SatelliteInputs,
  altitudes_m: number[],
  lives_s: number[],
  options: TradeOptions = {},
  techs = TECHNOLOGIES,
): WinnerCell[][] {
  // Technologies without wear are sized once per altitude; wear-limited ones per (altitude, life).
  const fixedDesigns = altitudes_m.map((h) => techs.map((t) => (wearMatters(t, options) ? null : designFor(base, t, h, undefined, options))))
  return lives_s.map((life) =>
    altitudes_m.map((h, a) => {
      const candidates = techs
        .map((tech, k) => {
          const p = PROPULSION_PRESETS[tech]
          const design = fixedDesigns[a][k] ?? designFor(base, tech, h, undefined, options, life)
          return { tech, r: meetRequirement(design, p.isp_s, p.tankFraction, life) }
        })
        .filter((o) => o.r.feasible)
        .sort((x, y) => x.r.wet_kg - y.r.wet_kg)
      const margin = candidates[1] ? (candidates[1].r.wet_kg - candidates[0].r.wet_kg) / candidates[0].r.wet_kg : Infinity
      return {
        winner: candidates[0]?.tech ?? null,
        wet_kg: candidates[0]?.r.wet_kg ?? NaN,
        runnerUp: candidates[1]?.tech ?? null,
        margin,
        tie: margin < TIE_MARGIN,
      }
    }),
  )
}
