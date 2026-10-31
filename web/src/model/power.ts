// Eclipse and power (docs/physics.md §6, §7.1).

import { DEG, G0, R_EARTH } from './constants'
import { radius_m } from './orbit'

/** Fraction of the orbit in Earth's shadow for a given beta angle. */
export function eclipseFraction(altitude_m: number, beta_deg: number): number {
  const r = radius_m(altitude_m)
  const beta = Math.abs(beta_deg) * DEG
  if (beta >= Math.asin(R_EARTH / r)) return 0
  return Math.acos(Math.sqrt(altitude_m ** 2 + 2 * R_EARTH * altitude_m) / (r * Math.cos(beta))) / Math.PI
}

/**
 * Sizing-loop gain: extra drag power demanded per extra watt of array (§7.1).
 * G >= 1 means no design closes at this altitude.
 */
export function loopGain(
  density_kg_m3: number,
  speed_m_s: number,
  cd: number,
  kArray: number,
  isp_s: number,
  efficiency: number,
  duty: number,
  /** Thruster watts that one square metre of array can support, after power-path losses. */
  arrayPower_W_m2: number,
): number {
  return (
    ((0.5 * density_kg_m3 * speed_m_s ** 2 * cd * kArray) * ((G0 * isp_s) / (2 * efficiency * duty))) /
    arrayPower_W_m2
  )
}
