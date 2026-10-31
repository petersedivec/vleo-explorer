// Single-satellite evaluation with the closed mass/power/drag sizing loop
// (docs/physics.md §5-§7).

import {
  exponentialDensity_kg_m3,
  msisDensity_kg_m3,
  msisOxygen_m3,
  scaleHeight_m,
  type DensityFn,
  type SolarConditions,
} from './atmosphere'
import { G0, SOLAR_CONSTANT, YEAR_S } from './constants'
import { ballisticCoefficient_kg_m2, decayIntegralTable, drag_N } from './drag'
import { circularSpeed_m_s, period_s } from './orbit'
import { eclipseFraction, loopGain } from './power'
import { electricPower_W, PROPULSION_PRESETS, type PropulsionClass } from './propulsion'

export type ArrayOrientation = 'edgeOn' | 'sunTracking'

export interface SatelliteInputs {
  altitude_m: number
  inclination_deg: number
  /** Sun angle to the orbit plane; 0 is the worst case for eclipse. */
  beta_deg: number
  solar: SolarConditions
  atmosphereModel: 'msis' | 'exponential'
  /** Density multiplier used for sizing (storm margin). */
  stormMargin: number

  payloadMass_kg: number
  payloadPower_W: number
  /** Ram-facing area the payload forces on the body (e.g. a telescope barrel). */
  payloadFrontalArea_m2: number
  busFixedMass_kg: number
  busPower_W: number
  structureFraction: number
  /** Body frontal area; null sizes it from mass, bulk density and shape factor. */
  bodyFrontalArea_m2: number | null
  bulkDensity_kg_m3: number
  shapeFactor: number
  cd: number

  arrayOrientation: ArrayOrientation
  cellEfficiency: number
  packingFactor: number
  lifeDegradation: number
  arrayArealMass_kg_m2: number

  propulsion: PropulsionClass
  isp_s: number
  /** Total efficiency for electric thrusters; ignored for cold gas and monoprop. */
  efficiency: number
  /** Rated total impulse of the thruster set; Infinity if not limiting. */
  totalImpulse_Ns: number
  ppuSpecificMass_kg_W: number
  thrusterFixedMass_kg: number
  /** If false, the thruster fires in daylight only (duty = 1 - eclipse fraction). */
  thrustInEclipse: boolean
  propellant_kg: number
  designLife_s: number
}

/** Grazing-incidence drag factor for edge-on panels (§3). */
export const K_GRAZE = 0.07
/** Orbit-averaged projected-area factor for sun-tracking arrays (§3). */
export const K_TRACK = 2 / Math.PI
/** SMAD power-path efficiencies, direct energy transfer (§6.2). */
const X_ECLIPSE = 0.6
const X_DAYLIGHT = 0.8

export const DEFAULT_INPUTS: SatelliteInputs = {
  altitude_m: 300e3,
  inclination_deg: 53,
  beta_deg: 0,
  solar: { f107: 150, ap: 15 },
  atmosphereModel: 'msis',
  stormMargin: 3,
  payloadMass_kg: 20,
  payloadPower_W: 40,
  payloadFrontalArea_m2: 0,
  busFixedMass_kg: 15,
  busPower_W: 30,
  structureFraction: 0.25,
  bodyFrontalArea_m2: null,
  bulkDensity_kg_m3: 400,
  shapeFactor: 0.6,
  cd: 2.2,
  arrayOrientation: 'edgeOn',
  cellEfficiency: 0.3,
  packingFactor: 0.85,
  lifeDegradation: 0.85,
  arrayArealMass_kg_m2: 3,
  propulsion: 'electrospray',
  isp_s: PROPULSION_PRESETS.electrospray.isp_s,
  efficiency: PROPULSION_PRESETS.electrospray.efficiency ?? 0.5,
  totalImpulse_Ns: Infinity,
  ppuSpecificMass_kg_W: 0.02,
  thrusterFixedMass_kg: 2,
  thrustInEclipse: true,
  propellant_kg: 8,
  designLife_s: 5 * YEAR_S,
}

export type Infeasibility = 'loopDiverged' | 'loopNotConverged' | null

export interface SatelliteResult {
  feasible: boolean
  infeasibility: Infeasibility
  iterations: number

  speed_m_s: number
  period_s: number
  density_kg_m3: number
  scaleHeight_m: number
  oxygen_m3: number
  eclipseFraction: number
  duty: number

  dryMass_kg: number
  wetMass_kg: number
  bodyFrontalArea_m2: number
  arrayArea_m2: number
  dragArea_m2: number
  ballistic_kg_m2: number

  drag_N: number
  stormDrag_N: number
  /** Thrust while firing, sized for the storm-margin drag. */
  sizedThrust_N: number
  thrusterUnits: number
  thrusterPower_W: number
  arrayPower_W: number
  loopGain: number

  deltaVPerYear_m_s: number
  propellantPerYear_kg: number
  propellantLife_s: number
  impulseLife_s: number
  missionLife_s: number
  lifeLimitedBy: 'propellant' | 'totalImpulse' | 'designLife'
  /** Decay time with no thrust, at launch mass. */
  naturalLifetime_s: number
  /** Decay time with no thrust after the propellant is gone (dry mass) — disposal. */
  disposalTime_s: number
  meetsFiveYearRule: boolean

  heatFlux_W_m2: number
  oxygenFluencePerYear_m2: number
}

export function densityFunction(inputs: Pick<SatelliteInputs, 'atmosphereModel' | 'solar' | 'inclination_deg'>): DensityFn {
  if (inputs.atmosphereModel === 'exponential') return exponentialDensity_kg_m3
  return (h) => msisDensity_kg_m3(h, inputs.solar, inputs.inclination_deg)
}

const decayTables = new Map<string, (altitude_m: number) => number>()

/** Cached cumulative decay integral for this atmosphere; lifetime = B * I(h). */
function decayIntegral(inputs: Pick<SatelliteInputs, 'atmosphereModel' | 'solar' | 'inclination_deg'>) {
  const key =
    inputs.atmosphereModel === 'exponential'
      ? 'exponential'
      : `msis|${inputs.solar.f107}|${inputs.solar.ap}|${inputs.inclination_deg}`
  let table = decayTables.get(key)
  if (!table) {
    if (decayTables.size > 64) decayTables.clear()
    table = decayIntegralTable(densityFunction(inputs))
    decayTables.set(key, table)
  }
  return table
}

const MAX_ITERATIONS = 200
const TOLERANCE = 1e-6
const DAMPING = 0.5
const MAX_DRY_MASS_KG = 1e5

export function evaluateSatellite(inputs: SatelliteInputs): SatelliteResult {
  const h = inputs.altitude_m
  const density = densityFunction(inputs)
  const rho = density(h)
  const v = circularSpeed_m_s(h)
  const T = period_s(h)
  const fe = eclipseFraction(h, inputs.beta_deg)
  const duty = inputs.thrustInEclipse ? 1 : 1 - fe
  const preset = PROPULSION_PRESETS[inputs.propulsion]
  const electric = preset.efficiency !== null
  const kArray = inputs.arrayOrientation === 'sunTracking' ? K_TRACK + K_GRAZE : K_GRAZE
  const cosAvg = inputs.arrayOrientation === 'sunTracking' ? 1 : K_TRACK
  const arrayPowerPerArea = SOLAR_CONSTANT * inputs.cellEfficiency * inputs.packingFactor * inputs.lifeDegradation * cosAvg

  // Array watts needed per watt of thruster load (daylight path, plus eclipse path if firing in eclipse).
  const powerPathFactor = 1 / X_DAYLIGHT + (inputs.thrustInEclipse && fe < 1 ? fe / ((1 - fe) * X_ECLIPSE) : 0)

  const bodyArea = (dryMass: number) =>
    Math.max(
      inputs.bodyFrontalArea_m2 ?? inputs.shapeFactor * (dryMass / inputs.bulkDensity_kg_m3) ** (2 / 3),
      inputs.payloadFrontalArea_m2,
    )

  let dryMass = (inputs.payloadMass_kg + inputs.busFixedMass_kg) / (1 - inputs.structureFraction)
  let thrusterPower = 0
  let arrayArea = 0
  let stormDrag = 0
  let iterations = 0
  let converged = false
  let diverged = false

  for (; iterations < MAX_ITERATIONS; iterations++) {
    const dragArea = bodyArea(dryMass) + kArray * arrayArea
    stormDrag = drag_N(rho * inputs.stormMargin, v, inputs.cd, dragArea)
    const fireThrust = stormDrag / duty
    const newThrusterPower = electric
      ? electricPower_W(fireThrust, inputs.isp_s, inputs.efficiency)
      : preset.fixedPower_W

    const loadDay = inputs.busPower_W + inputs.payloadPower_W + newThrusterPower
    const loadEclipse = inputs.busPower_W + inputs.payloadPower_W + (inputs.thrustInEclipse ? newThrusterPower : 0)
    const tEclipse = fe * T
    const tDay = (1 - fe) * T
    const arrayPower = (loadEclipse * tEclipse) / X_ECLIPSE / tDay + loadDay / X_DAYLIGHT
    const newArrayArea = arrayPower / arrayPowerPerArea

    const newDryMass =
      (inputs.payloadMass_kg +
        inputs.busFixedMass_kg +
        inputs.arrayArealMass_kg_m2 * newArrayArea +
        (electric ? inputs.ppuSpecificMass_kg_W * newThrusterPower : 0) +
        inputs.thrusterFixedMass_kg) /
      (1 - inputs.structureFraction)

    if (!Number.isFinite(newDryMass) || newDryMass > MAX_DRY_MASS_KG) {
      diverged = true
      break
    }
    const change = Math.abs(newDryMass - dryMass) / dryMass + Math.abs(newArrayArea - arrayArea) / Math.max(newArrayArea, 1e-9)
    dryMass += DAMPING * (newDryMass - dryMass)
    arrayArea += DAMPING * (newArrayArea - arrayArea)
    thrusterPower = newThrusterPower
    if (change < TOLERANCE) {
      converged = true
      break
    }
  }

  const bodyFrontal = bodyArea(dryMass)
  const dragArea = bodyFrontal + kArray * arrayArea
  const wetMass = dryMass + inputs.propellant_kg
  const drag = drag_N(rho, v, inputs.cd, dragArea)
  const sizedThrust = stormDrag / duty
  const ballistic = ballisticCoefficient_kg_m2(wetMass, inputs.cd, dragArea)
  const propPerSecond = drag / (G0 * inputs.isp_s)
  const propellantLife = inputs.propellant_kg / propPerSecond
  const impulseLife = inputs.totalImpulse_Ns / drag
  const missionLife = Math.min(propellantLife, impulseLife, inputs.designLife_s)
  const lifeLimitedBy =
    missionLife === inputs.designLife_s ? 'designLife' : missionLife === propellantLife ? 'propellant' : 'totalImpulse'
  const decay = decayIntegral(inputs)(h)
  const naturalLifetime = ballistic * decay
  const disposalTime = ballisticCoefficient_kg_m2(dryMass, inputs.cd, dragArea) * decay
  const oxygen = inputs.atmosphereModel === 'msis' ? msisOxygen_m3(h, inputs.solar, inputs.inclination_deg) : NaN
  const feasible = converged && !diverged

  return {
    feasible,
    infeasibility: diverged ? 'loopDiverged' : converged ? null : 'loopNotConverged',
    iterations,
    speed_m_s: v,
    period_s: T,
    density_kg_m3: rho,
    scaleHeight_m: scaleHeight_m(density, h),
    oxygen_m3: oxygen,
    eclipseFraction: fe,
    duty,
    dryMass_kg: dryMass,
    wetMass_kg: wetMass,
    bodyFrontalArea_m2: bodyFrontal,
    arrayArea_m2: arrayArea,
    dragArea_m2: dragArea,
    ballistic_kg_m2: ballistic,
    drag_N: drag,
    stormDrag_N: stormDrag,
    sizedThrust_N: sizedThrust,
    thrusterUnits: Math.ceil(sizedThrust / preset.unitThrust_N),
    thrusterPower_W: thrusterPower,
    arrayPower_W: arrayArea * arrayPowerPerArea,
    loopGain: electric
      ? loopGain(rho * inputs.stormMargin, v, inputs.cd, kArray, inputs.isp_s, inputs.efficiency, duty, arrayPowerPerArea / powerPathFactor)
      : 0,
    deltaVPerYear_m_s: (drag / wetMass) * YEAR_S,
    propellantPerYear_kg: propPerSecond * YEAR_S,
    propellantLife_s: propellantLife,
    impulseLife_s: impulseLife,
    missionLife_s: feasible ? missionLife : 0,
    lifeLimitedBy,
    naturalLifetime_s: naturalLifetime,
    disposalTime_s: disposalTime,
    meetsFiveYearRule: disposalTime <= 5 * YEAR_S,
    heatFlux_W_m2: 0.5 * rho * v ** 3,
    oxygenFluencePerYear_m2: oxygen * v * YEAR_S,
  }
}

/** Evaluate across altitudes, holding every other input fixed. */
export function sweepAltitude(inputs: SatelliteInputs, altitudes_m: number[]): SatelliteResult[] {
  return altitudes_m.map((altitude_m) => evaluateSatellite({ ...inputs, altitude_m }))
}

/** Lowest altitude in the list at which the design closes. */
export function minimumFeasibleAltitude_m(inputs: SatelliteInputs, altitudes_m: number[]): number | null {
  const sorted = [...altitudes_m].sort((a, b) => a - b)
  for (const altitude_m of sorted) if (evaluateSatellite({ ...inputs, altitude_m }).feasible) return altitude_m
  return null
}
