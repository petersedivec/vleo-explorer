// Constellation sizing and sustainment, analytic (docs/physics.md §10).

import { DEG, G0, R_EARTH, YEAR_S } from './constants'
import { period_s, radius_m } from './orbit'
import { PROPULSION_PRESETS } from './propulsion'
import { evaluateSatellite, type SatelliteInputs, type SatelliteResult } from './satellite'

export type CoverageType = 'revisit' | 'continuous'

export interface ConstellationInputs {
  coverage: CoverageType
  /** Imaging: maximum off-nadir pointing angle of the sensor. */
  offNadir_deg: number
  /** Imaging: required time between looks at a point on the equator. */
  revisit_s: number
  /** Imaging: usable equator crossings per orbit (1 for daylight-only optical, 2 for radar). */
  passesPerOrbit: 1 | 2
  /** Continuous coverage: minimum elevation of the satellite above the user's horizon. */
  minElevation_deg: number
  /** Continuous coverage: highest latitude that must be covered. */
  latitudeMax_deg: number
  /**
   * How payload mass and power scale with altitude to keep the same ground performance:
   * payload ∝ (h / h_ref)^k. 0 keeps the payload fixed; ~2.5 for an optical telescope at fixed
   * resolution; ~2 for a direct-to-device antenna at fixed link margin. Design mode only.
   */
  payloadExponent: number
  /** Altitude at which the Explore payload is defined. */
  referenceAltitude_m: number
}

export const DEFAULT_CONSTELLATION: ConstellationInputs = {
  coverage: 'revisit',
  offNadir_deg: 30,
  revisit_s: 6 * 3600,
  passesPerOrbit: 1,
  minElevation_deg: 25,
  latitudeMax_deg: 60,
  payloadExponent: 2.5,
  referenceAltitude_m: 300e3,
}

/** Earth central angle (rad) reachable at a sensor off-nadir angle; NaN if the angle misses Earth. */
export function centralAngleFromOffNadir(altitude_m: number, offNadir_deg: number): number {
  const s = (Math.sin(offNadir_deg * DEG) * radius_m(altitude_m)) / R_EARTH
  if (s >= 1) return NaN
  const elevation = Math.acos(s)
  return Math.PI / 2 - offNadir_deg * DEG - elevation
}

/** Earth central angle (rad) of the footprint where the satellite is above a minimum elevation. */
export function centralAngleFromElevation(altitude_m: number, minElevation_deg: number): number {
  const e = minElevation_deg * DEG
  return Math.acos((R_EARTH * Math.cos(e)) / radius_m(altitude_m)) - e
}

/** Swath width or footprint diameter on the ground, m. */
export const groundWidth_m = (centralAngle_rad: number) => 2 * R_EARTH * centralAngle_rad

/** Satellites for a revisit time at the equator, swath-limited (§10.2). */
export function satellitesForRevisit(
  altitude_m: number,
  swath_m: number,
  revisit_s: number,
  passesPerOrbit: number,
  inclination_deg: number,
): number {
  const orbitsInWindow = revisit_s / period_s(altitude_m)
  const sinI = Math.max(Math.abs(Math.sin(inclination_deg * DEG)), 0.05)
  return Math.ceil((2 * Math.PI * R_EARTH * sinI) / (passesPerOrbit * orbitsInWindow * swath_m))
}

/** Satellites for continuous single coverage up to a latitude, hexagonal packing (§10.3). */
export function satellitesForContinuous(centralAngle_rad: number, latitudeMax_deg: number): number {
  const area = 4 * Math.PI * Math.sin(latitudeMax_deg * DEG)
  // Idealised lower bound: real Walker / streets-of-coverage designs need somewhat more.
  return Math.ceil(area / (((3 * Math.sqrt(3)) / 2) * centralAngle_rad ** 2))
}

export interface ConstellationPoint {
  altitude_m: number
  centralAngle_rad: number
  groundWidth_m: number
  satellites: number
  satellite: SatelliteResult
  /** Wet mass used: in Design mode, dry mass plus propellant and tank sized for the design life. */
  wetMass_kg: number
  propellant_kg: number
  /** Payload scale factor applied at this altitude (design mode). */
  payloadScale: number
  life_s: number
  replacementsPerYear: number
  deploymentMass_kg: number
  /** Steady-state mass launched per year to replace satellites as they reach end of life. */
  massPerYear_kg: number
  feasible: boolean
}

export function evaluateConstellation(sat: SatelliteInputs, c: ConstellationInputs, altitude_m: number): ConstellationPoint {
  const scale = sat.mode === 'design' ? (altitude_m / c.referenceAltitude_m) ** c.payloadExponent : 1
  const satellite = evaluateSatellite({
    ...sat,
    altitude_m,
    payloadMass_kg: sat.payloadMass_kg * scale,
    payloadPower_W: sat.payloadPower_W * scale,
  })
  const angle =
    c.coverage === 'revisit'
      ? centralAngleFromOffNadir(altitude_m, c.offNadir_deg)
      : centralAngleFromElevation(altitude_m, c.minElevation_deg)
  const width = groundWidth_m(angle)
  const satellites =
    c.coverage === 'revisit'
      ? satellitesForRevisit(altitude_m, width, c.revisit_s, c.passesPerOrbit, sat.inclination_deg)
      : satellitesForContinuous(angle, c.latitudeMax_deg)
  // Design mode: carry exactly the propellant (and tank) needed to hold altitude for the design life,
  // so life is set by the design life, not by a propellant load chosen for a different altitude.
  // As built: the spacecraft and its propellant are fixed.
  const sized = sat.mode === 'design'
  const propellant = sized ? (satellite.drag_N * sat.designLife_s) / (G0 * sat.isp_s) : sat.propellant_kg
  const wetMass = sized
    ? satellite.dryMass_kg + propellant * (1 + PROPULSION_PRESETS[sat.propulsion].tankFraction)
    : satellite.wetMass_kg
  const life = sized ? (satellite.feasible ? Math.min(sat.designLife_s, satellite.impulseLife_s) : 0) : satellite.missionLife_s
  const feasible = satellite.feasible && life > 0 && Number.isFinite(satellites) && satellites > 0
  const replacements = feasible ? satellites / (life / YEAR_S) : NaN
  return {
    altitude_m,
    centralAngle_rad: angle,
    groundWidth_m: width,
    satellites,
    satellite,
    wetMass_kg: wetMass,
    propellant_kg: propellant,
    payloadScale: scale,
    life_s: life,
    replacementsPerYear: replacements,
    deploymentMass_kg: feasible ? satellites * wetMass : NaN,
    massPerYear_kg: feasible ? replacements * wetMass : NaN,
    feasible,
  }
}

export function sweepConstellation(sat: SatelliteInputs, c: ConstellationInputs, altitudes_m: number[]) {
  return altitudes_m.map((h) => evaluateConstellation(sat, c, h))
}

/** Altitude with the lowest mass to orbit per year, among feasible points. */
export function optimumAltitude(points: ConstellationPoint[]): ConstellationPoint | null {
  return points.filter((p) => p.feasible).reduce<ConstellationPoint | null>((a, b) => (!a || b.massPerYear_kg < a.massPerYear_kg ? b : a), null)
}
