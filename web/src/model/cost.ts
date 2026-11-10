// Cost model: build, launch and operate a constellation (docs/physics.md §11).
//
// Every parameter is a low–high range of teaching assumptions (physics.md §11 gives the reasoning);
// results are bands, never single numbers. Steady-state replacement view: no financing, no time value
// of money, no development (non-recurring) cost.

import { DEG, R_EARTH, YEAR_S } from './constants'
import type { ConstellationPoint } from './constellation'
import { circularSpeed_m_s, radius_m } from './orbit'

export type Range = [low: number, high: number]

export interface CostAssumptions {
  /** First-unit cost per kg of bus (dry mass other than payload), US$. */
  busPerKg: Range
  /** First-unit cost per kg of payload, US$. */
  payloadPerKg: Range
  /** Launch price per kg of wet mass, US$. */
  launchPerKg: Range
  /** Operations per satellite per year, US$. */
  opsPerSatelliteYear: Range
  /** Fixed ground segment and mission operations per year, US$. */
  fixedPerYear: Range
}

export const DEFAULT_COSTS: CostAssumptions = {
  busPerKg: [30e3, 100e3],
  payloadPerKg: [60e3, 250e3],
  launchPerKg: [6e3, 30e3],
  opsPerSatelliteYear: [50e3, 200e3],
  fixedPerYear: [1e6, 5e6],
}

/**
 * Learning rate by production quantity, after the New SMAD's guidance: 95% below 10 units, 90% for
 * 10–50, 85% above 50. Each doubling of quantity multiplies unit cost by this rate.
 */
export function learningRate(units: number): number {
  return units < 10 ? 0.95 : units <= 50 ? 0.9 : 0.85
}

/** Average unit cost over n units on a Wright learning curve, as a fraction of the first unit. */
export function learningFactor(units: number, rate = learningRate(units)): number {
  if (units <= 1) return 1
  // Average of k^b over k = 1..n, b = log2(rate).
  const b = Math.log2(rate)
  let sum = 0
  for (let k = 1; k <= units; k++) sum += k ** b
  return sum / units
}

export interface CostBreakdown {
  /** Average cost to build one satellite (with learning). */
  unit: number
  /** Launch cost per satellite. */
  launchPerSatellite: number
  /** Per year: building replacements, launching them, operating the fleet, fixed costs. */
  build: number
  launch: number
  operations: number
  fixed: number
  perYear: number
  /** Building and launching the whole constellation once. */
  deployment: number
}

export interface ServiceMetric {
  label: string
  /** US$ per unit of service, low and high. */
  value: Range
  unit: string
}

export interface CostResult {
  low: CostBreakdown
  high: CostBreakdown
  learningRate: number
  service: ServiceMetric | null
}

function breakdown(p: ConstellationPoint, a: CostAssumptions, i: 0 | 1, factor: number): CostBreakdown {
  const busMass = Math.max(p.satellite.dryMass_kg - p.payloadMass_kg, 0)
  const unit = (a.busPerKg[i] * busMass + a.payloadPerKg[i] * p.payloadMass_kg) * factor
  const launchPerSatellite = a.launchPerKg[i] * p.wetMass_kg
  const build = p.replacementsPerYear * unit
  const launch = p.replacementsPerYear * launchPerSatellite
  const operations = a.opsPerSatelliteYear[i] * p.satellites
  const fixed = a.fixedPerYear[i]
  return {
    unit,
    launchPerSatellite,
    build,
    launch,
    operations,
    fixed,
    perYear: build + launch + operations + fixed,
    deployment: p.satellites * (unit + launchPerSatellite),
  }
}

/** Area of the latitude band |φ| ≤ φmax, km². */
export const bandArea_km2 = (latitudeMax_deg: number) =>
  (4 * Math.PI * R_EARTH ** 2 * Math.sin(Math.min(Math.abs(latitudeMax_deg), 90) * DEG)) / 1e6

export interface ServiceContext {
  coverage: 'revisit' | 'continuous'
  /** Highest latitude served (continuous coverage). */
  latitudeMax_deg: number
  /** Phone service: cell width on the ground, m; null for other missions. */
  cellWidth_m: number | null
}

/** Area an imaging constellation actually collects per year: N × swath × ground speed × imaging duty × year, km². */
export function areaImagedPerYear_km2(p: ConstellationPoint): number {
  if (!p.payload?.imagingSwath_m || !p.payload.imagingDuty) return NaN
  const groundSpeed = (circularSpeed_m_s(p.altitude_m) * R_EARTH) / radius_m(p.altitude_m)
  return (p.satellites * p.payload.imagingSwath_m * groundSpeed * p.payload.imagingDuty * YEAR_S) / 1e6
}

/**
 * Cost per unit of service (§11). Imaging missions: dollars per km² imaged. Phone service: dollars per
 * cell per year. Other cases: dollars per km² of the covered band per year (continuous coverage only);
 * a scaled payload has no defined swath, so revisit coverage has no service metric.
 */
export function serviceMetric(perYear: Range, p: ConstellationPoint, s: ServiceContext): ServiceMetric | null {
  const imaged = areaImagedPerYear_km2(p)
  if (Number.isFinite(imaged) && imaged > 0)
    return { label: 'Cost per km² imaged', value: [perYear[0] / imaged, perYear[1] / imaged], unit: '$ per km²' }
  if (s.coverage === 'revisit') return null
  const area = bandArea_km2(s.latitudeMax_deg)
  if (s.cellWidth_m) {
    const cells = area / (Math.PI * (s.cellWidth_m / 2e3) ** 2)
    return { label: 'Cost per cell per year', value: [perYear[0] / cells, perYear[1] / cells], unit: '$ per cell per year' }
  }
  return { label: 'Cost per km² covered per year', value: [perYear[0] / area, perYear[1] / area], unit: '$ per km² per year' }
}

export function constellationCost(p: ConstellationPoint, a: CostAssumptions, s: ServiceContext): CostResult | null {
  if (!p.feasible) return null
  const rate = learningRate(p.satellites)
  const factor = learningFactor(p.satellites, rate)
  const low = breakdown(p, a, 0, factor)
  const high = breakdown(p, a, 1, factor)
  return { low, high, learningRate: rate, service: serviceMetric([low.perYear, high.perYear], p, s) }
}
