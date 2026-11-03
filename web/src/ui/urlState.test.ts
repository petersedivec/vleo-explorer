import { describe, expect, it } from 'vitest'
import { evaluateSatellite, DEFAULT_INPUTS } from '../model/satellite'
import { decodeInputs, encodeInputs } from './urlState'

describe('shareable links', () => {
  it('round-trips a changed design', () => {
    const inputs = { ...DEFAULT_INPUTS, altitude_m: 250e3, propulsion: 'hall' as const, isp_s: 1400, cd: 2.4 }
    expect(decodeInputs('#' + encodeInputs(inputs))).toEqual(inputs)
  })

  it('round-trips as-built inputs', () => {
    const inputs = { ...DEFAULT_INPUTS, mode: 'asBuilt' as const, asBuilt: { dryMass_kg: 1036, dragArea_m2: 1, maxThrust_N: 0.02 } }
    expect(decodeInputs('#' + encodeInputs(inputs))).toEqual(inputs)
  })

  it('ignores unknown enum values and clamps numbers, so bad links cannot break the page', () => {
    const inputs = decodeInputs('#v=1&propulsion=foo&mode=bar&arrayOrientation=x&altitude_m=Infinity&efficiency=0&cd=NaN')
    expect(inputs.propulsion).toBe(DEFAULT_INPUTS.propulsion)
    expect(inputs.mode).toBe('design')
    expect(inputs.arrayOrientation).toBe(DEFAULT_INPUTS.arrayOrientation)
    expect(inputs.altitude_m).toBe(DEFAULT_INPUTS.altitude_m)
    expect(inputs.efficiency).toBe(0.05)
    expect(inputs.cd).toBe(DEFAULT_INPUTS.cd)
    expect(() => evaluateSatellite(inputs)).not.toThrow()
  })

  it('ignores links with another schema version', () => {
    expect(decodeInputs('#v=99&altitude_m=200000')).toEqual(DEFAULT_INPUTS)
  })
})
