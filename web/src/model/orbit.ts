// Circular-orbit relations (docs/physics.md §1).

import { DAY_S, DEG, J2, MU, R_EARTH } from './constants'

export const radius_m = (altitude_m: number) => R_EARTH + altitude_m

export const circularSpeed_m_s = (altitude_m: number) => Math.sqrt(MU / radius_m(altitude_m))

export const period_s = (altitude_m: number) => 2 * Math.PI * Math.sqrt(radius_m(altitude_m) ** 3 / MU)

export const orbitsPerDay = (altitude_m: number) => DAY_S / period_s(altitude_m)

export const groundSpeed_m_s = (altitude_m: number) =>
  (circularSpeed_m_s(altitude_m) * R_EARTH) / radius_m(altitude_m)

export function nodalRegression_rad_s(altitude_m: number, inclination_deg: number): number {
  const r = radius_m(altitude_m)
  const n = (2 * Math.PI) / period_s(altitude_m)
  return -1.5 * J2 * (R_EARTH / r) ** 2 * n * Math.cos(inclination_deg * DEG)
}

export function sunSynchronousInclination_deg(altitude_m: number): number {
  const r = radius_m(altitude_m)
  const n = (2 * Math.PI) / period_s(altitude_m)
  const omegaSun = (2 * Math.PI) / (365.2422 * DAY_S)
  return Math.acos(-omegaSun / (1.5 * J2 * (R_EARTH / r) ** 2 * n)) / DEG
}
