// Shareable links: the inputs that differ from the defaults, with a schema version.

import { PROPULSION_PRESETS } from '../model/propulsion'
import { DEFAULT_INPUTS, type SatelliteInputs } from '../model/satellite'

export const URL_SCHEMA_VERSION = 1

type Scalar = number | string | boolean | null
const KEYS: (keyof SatelliteInputs)[] = [
  'mode', 'altitude_m', 'inclination_deg', 'beta_deg', 'atmosphereModel', 'stormMargin',
  'payloadMass_kg', 'payloadPower_W', 'cd', 'arrayOrientation', 'propulsion', 'isp_s',
  'efficiency', 'thrustInEclipse', 'propellant_kg', 'designLife_s',
]

export function encodeInputs(inputs: SatelliteInputs): string {
  const params = new URLSearchParams({ v: String(URL_SCHEMA_VERSION) })
  for (const key of KEYS) {
    if (inputs[key] !== DEFAULT_INPUTS[key]) params.set(key, String(inputs[key] as Scalar))
  }
  if (inputs.solar.f107 !== DEFAULT_INPUTS.solar.f107) params.set('f107', String(inputs.solar.f107))
  if (inputs.solar.ap !== DEFAULT_INPUTS.solar.ap) params.set('ap', String(inputs.solar.ap))
  if (inputs.mode === 'asBuilt') {
    params.set('dryMass', String(inputs.asBuilt.dryMass_kg))
    params.set('dragArea', String(inputs.asBuilt.dragArea_m2))
    params.set('maxThrust', String(inputs.asBuilt.maxThrust_N))
  }
  return params.toString()
}

/** Allowed values for string inputs; anything else in a link is ignored. */
const ENUMS: Partial<Record<keyof SatelliteInputs, readonly string[]>> = {
  mode: ['design', 'asBuilt'],
  atmosphereModel: ['msis', 'exponential'],
  arrayOrientation: ['edgeOn', 'sunTracking'],
  propulsion: Object.keys(PROPULSION_PRESETS),
}

/** Physical ranges for numeric inputs, matching the controls; values outside are clamped. */
const RANGES: Partial<Record<keyof SatelliteInputs, [number, number]>> = {
  altitude_m: [150e3, 600e3],
  inclination_deg: [0, 180],
  beta_deg: [0, 90],
  stormMargin: [1, 5],
  payloadMass_kg: [0.1, 1e4],
  payloadPower_W: [0, 1e5],
  cd: [1, 5],
  isp_s: [10, 1e4],
  efficiency: [0.05, 0.95],
  propellant_kg: [0, 1e5],
  designLife_s: [0.1 * 31_557_600, Infinity],
}

const AS_BUILT_RANGES = {
  dryMass_kg: [0.1, 1e6],
  dragArea_m2: [1e-4, 1e4],
  maxThrust_N: [0, 10],
} satisfies Record<string, [number, number]>

const clamp = (x: number, [lo, hi]: [number, number]) => Math.min(Math.max(x, lo), hi)

export function decodeInputs(hash: string): SatelliteInputs {
  const params = new URLSearchParams(hash.replace(/^#/, ''))
  const inputs: SatelliteInputs = { ...DEFAULT_INPUTS, solar: { ...DEFAULT_INPUTS.solar } }
  if (params.get('v') !== String(URL_SCHEMA_VERSION)) return inputs
  const record = inputs as unknown as Record<string, Scalar>
  for (const key of KEYS) {
    const raw = params.get(key)
    if (raw === null) continue
    const current = DEFAULT_INPUTS[key]
    if (typeof current === 'number') {
      const n = Number(raw)
      const range = RANGES[key]
      if (Number.isFinite(n) || (raw === 'Infinity' && range && range[1] === Infinity)) record[key] = range ? clamp(n, range) : n
    } else if (typeof current === 'boolean') record[key] = raw === 'true'
    else if (ENUMS[key]?.includes(raw)) record[key] = raw
  }
  const f107 = Number(params.get('f107'))
  const ap = Number(params.get('ap'))
  if (params.has('f107') && Number.isFinite(f107)) inputs.solar.f107 = clamp(f107, [60, 300])
  if (params.has('ap') && Number.isFinite(ap)) inputs.solar.ap = clamp(ap, [0, 400])
  inputs.asBuilt = { ...DEFAULT_INPUTS.asBuilt }
  const asBuiltKeys = [
    ['dryMass', 'dryMass_kg'],
    ['dragArea', 'dragArea_m2'],
    ['maxThrust', 'maxThrust_N'],
  ] as const
  for (const [param, field] of asBuiltKeys) {
    const n = Number(params.get(param))
    if (params.has(param) && Number.isFinite(n)) inputs.asBuilt[field] = clamp(n, AS_BUILT_RANGES[field])
  }
  return inputs
}
