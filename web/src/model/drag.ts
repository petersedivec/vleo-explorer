// Drag, decay and descent (docs/physics.md §3, §4, §8).

import type { DensityFn } from './atmosphere'
import { G0, MU, R_EARTH, REENTRY_ALTITUDE_M } from './constants'
import { circularSpeed_m_s, radius_m } from './orbit'

export const drag_N = (density_kg_m3: number, speed_m_s: number, cd: number, area_m2: number) =>
  0.5 * density_kg_m3 * speed_m_s ** 2 * cd * area_m2

export const ballisticCoefficient_kg_m2 = (mass_kg: number, cd: number, area_m2: number) =>
  mass_kg / (cd * area_m2)

/** Altitude-integration step for decay and descent. */
const STEP_M = 250

/**
 * Time to decay from altitude_m to reentry with no thrust.
 * t = integral of B / (sqrt(mu a) rho) da, composite Simpson in altitude.
 */
export function decayLifetime_s(
  altitude_m: number,
  ballistic_kg_m2: number,
  density: DensityFn,
  reentryAltitude_m = REENTRY_ALTITUDE_M,
): number {
  if (altitude_m <= reentryAltitude_m) return 0
  const integrand = (h: number) => ballistic_kg_m2 / (Math.sqrt(MU * (R_EARTH + h)) * density(h))
  let n = Math.ceil((altitude_m - reentryAltitude_m) / STEP_M)
  if (n % 2) n++
  const dh = (altitude_m - reentryAltitude_m) / n
  let sum = integrand(reentryAltitude_m) + integrand(altitude_m)
  for (let k = 1; k < n; k++) sum += (k % 2 ? 4 : 2) * integrand(reentryAltitude_m + k * dh)
  return (sum * dh) / 3
}

/**
 * Cumulative decay integral I(h) = integral of 1 / (sqrt(mu a) rho) da from reentry to h, so that
 * no-thrust lifetime = B * I(h). Tabulated once per atmosphere (trapezoid, 250 m steps) for fast sweeps.
 */
export function decayIntegralTable(
  density: DensityFn,
  maxAltitude_m = 1000e3,
  reentryAltitude_m = REENTRY_ALTITUDE_M,
): (altitude_m: number) => number {
  const n = Math.ceil((maxAltitude_m - reentryAltitude_m) / STEP_M)
  const cumulative = new Float64Array(n + 1)
  const f = (h: number) => 1 / (Math.sqrt(MU * (R_EARTH + h)) * density(h))
  let prev = f(reentryAltitude_m)
  for (let k = 1; k <= n; k++) {
    const next = f(reentryAltitude_m + k * STEP_M)
    cumulative[k] = cumulative[k - 1] + 0.5 * (prev + next) * STEP_M
    prev = next
  }
  return (altitude_m: number) => {
    if (altitude_m <= reentryAltitude_m) return 0
    const x = Math.min((altitude_m - reentryAltitude_m) / STEP_M, n)
    const k = Math.min(Math.floor(x), n - 1)
    return cumulative[k] + (x - k) * (cumulative[k + 1] - cumulative[k])
  }
}

/** Coplanar low-thrust transfer delta-v between circular orbits (Edelbaum). */
export const edelbaumDeltaV_m_s = (h1_m: number, h2_m: number) =>
  Math.abs(circularSpeed_m_s(h1_m) - circularSpeed_m_s(h2_m))

export interface DescentResult {
  time_s: number
  propellant_kg: number
}

/**
 * Spiral down with continuous retro-thrust, drag assisting. State (t, m) integrated in
 * semi-major axis with RK4, since da/dt < 0 throughout.
 */
export function descent(
  hStart_m: number,
  hEnd_m: number,
  thrust_N: number,
  isp_s: number,
  mass_kg: number,
  cd: number,
  area_m2: number,
  density: DensityFn,
): DescentResult {
  const mDot = thrust_N / (G0 * isp_s)
  const deriv = (a: number, m: number): [number, number] => {
    const aDot =
      -2 * Math.sqrt(a ** 3 / MU) * (thrust_N / m) - (Math.sqrt(MU * a) * density(a - R_EARTH) * cd * area_m2) / m
    return [1 / aDot, -mDot / aDot]
  }
  const a0 = radius_m(hStart_m)
  const a1 = radius_m(hEnd_m)
  const n = Math.max(1, Math.ceil(Math.abs(a1 - a0) / STEP_M))
  const da = (a1 - a0) / n
  let t = 0
  let m = mass_kg
  let a = a0
  for (let k = 0; k < n; k++) {
    const [t1, m1] = deriv(a, m)
    const [t2, m2] = deriv(a + da / 2, m + (da / 2) * m1)
    const [t3, m3] = deriv(a + da / 2, m + (da / 2) * m2)
    const [t4, m4] = deriv(a + da, m + da * m3)
    t += (da / 6) * (t1 + 2 * t2 + 2 * t3 + t4)
    m += (da / 6) * (m1 + 2 * m2 + 2 * m3 + m4)
    a += da
  }
  return { time_s: t, propellant_kg: mass_kg - m }
}
