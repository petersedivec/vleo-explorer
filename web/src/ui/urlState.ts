// Shareable links: the inputs that differ from the defaults, with a schema version.

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
      if (Number.isFinite(n) || raw === 'Infinity') record[key] = n
    } else if (typeof current === 'boolean') record[key] = raw === 'true'
    else record[key] = raw
  }
  const f107 = Number(params.get('f107'))
  const ap = Number(params.get('ap'))
  if (params.has('f107') && Number.isFinite(f107)) inputs.solar.f107 = f107
  if (params.has('ap') && Number.isFinite(ap)) inputs.solar.ap = ap
  inputs.asBuilt = { ...DEFAULT_INPUTS.asBuilt }
  const asBuiltKeys = [
    ['dryMass', 'dryMass_kg'],
    ['dragArea', 'dragArea_m2'],
    ['maxThrust', 'maxThrust_N'],
  ] as const
  for (const [param, field] of asBuiltKeys) {
    const n = Number(params.get(param))
    if (params.has(param) && Number.isFinite(n)) inputs.asBuilt[field] = n
  }
  return inputs
}
