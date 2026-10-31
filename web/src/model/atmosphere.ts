// Atmosphere models (docs/physics.md §2).

import table from '../data/atmosphere.json'

export interface SolarConditions {
  f107: number // sfu
  ap: number
}

export type SolarMode = 'low' | 'moderate' | 'high'

export const SOLAR_MODES: Record<SolarMode, SolarConditions> = {
  low: { f107: 70, ap: 4 },
  moderate: { f107: 150, ap: 15 },
  high: { f107: 250, ap: 15 },
}

const ALT_KM: number[] = table.axes.altitude_km
const F107: number[] = table.axes.f107_sfu
const AP: number[] = table.axes.ap
const INC: number[] = table.axes.inclination_deg
const LOG_RHO: number[][][][] = table.log10_density_kg_m3
const LOG_O: number[][][][] = table.log10_o_number_density_m3

/** Lower index and fraction for linear interpolation, clamped to the axis. */
function interpIndex(axis: number[], x: number): [number, number] {
  if (x <= axis[0]) return [0, 0]
  const last = axis.length - 1
  if (x >= axis[last]) return [last - 1, 1]
  let i = 0
  while (axis[i + 1] <= x) i++
  return [i, (x - axis[i]) / (axis[i + 1] - axis[i])]
}

function interpLog(grid: number[][][][], altitude_m: number, solar: SolarConditions, inclination_deg: number) {
  const idx = [
    interpIndex(F107, solar.f107),
    interpIndex(AP, solar.ap),
    interpIndex(INC, inclination_deg),
    interpIndex(ALT_KM, altitude_m / 1e3),
  ]
  let total = 0
  for (let corner = 0; corner < 16; corner++) {
    let weight = 1
    const pos = [0, 0, 0, 0]
    for (let d = 0; d < 4; d++) {
      const bit = (corner >> d) & 1
      const [i, frac] = idx[d]
      weight *= bit ? frac : 1 - frac
      pos[d] = i + bit
    }
    if (weight) total += weight * grid[pos[0]][pos[1]][pos[2]][pos[3]]
  }
  return total
}

/** Orbit-averaged NRLMSIS 2.1 total mass density, kg/m^3. */
export const msisDensity_kg_m3 = (altitude_m: number, solar: SolarConditions, inclination_deg: number) =>
  10 ** interpLog(LOG_RHO, altitude_m, solar, inclination_deg)

/** Orbit-averaged NRLMSIS 2.1 atomic-oxygen number density, m^-3. */
export const msisOxygen_m3 = (altitude_m: number, solar: SolarConditions, inclination_deg: number) =>
  10 ** interpLog(LOG_O, altitude_m, solar, inclination_deg)

// Vallado Table 8-4: [base altitude km, base density kg/m^3, scale height km]
const VALLADO_BANDS: [number, number, number][] = [
  [100, 5.297e-7, 5.877], [110, 9.661e-8, 7.263], [120, 2.438e-8, 9.473],
  [130, 8.484e-9, 12.636], [140, 3.845e-9, 16.149], [150, 2.07e-9, 22.523],
  [180, 5.464e-10, 29.74], [200, 2.789e-10, 37.105], [250, 7.248e-11, 45.546],
  [300, 2.418e-11, 53.628], [350, 9.518e-12, 53.298], [400, 3.725e-12, 58.515],
  [450, 1.585e-12, 60.828], [500, 6.967e-13, 63.822], [600, 1.454e-13, 71.835],
  [700, 3.614e-14, 88.667], [800, 1.17e-14, 124.64], [900, 5.245e-15, 181.05],
  [1000, 3.019e-15, 268.0],
]

/** Static exponential atmosphere (teaching comparison), kg/m^3. */
export function exponentialDensity_kg_m3(altitude_m: number): number {
  const h_km = altitude_m / 1e3
  let band = VALLADO_BANDS[0]
  for (const b of VALLADO_BANDS) if (h_km >= b[0]) band = b
  const [h0, rho0, scale] = band
  return rho0 * Math.exp(-(h_km - h0) / scale)
}

export type DensityFn = (altitude_m: number) => number

/** Local density scale height H = -1 / (d ln rho / dh), m. */
export function scaleHeight_m(density: DensityFn, altitude_m: number, dh_m = 1e3): number {
  return (-2 * dh_m) / Math.log(density(altitude_m + dh_m) / density(altitude_m - dh_m))
}
