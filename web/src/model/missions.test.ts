// Hand checks and scaling laws for the requirement-based payloads (docs/physics.md §9).

import { describe, expect, it } from 'vitest'
import { centralAngleFromElevation, DEFAULT_CONSTELLATION, evaluateConstellation } from './constellation'
import { SPEED_OF_LIGHT } from './constants'
import {
  d2dPayload,
  d2dRequiredGain,
  MISSION_PARAMS,
  opticalPayload,
  sarMinimumArea_m2,
  sarPayload,
  slantRangeFromElevation_m,
  slantRangeFromIncidence_m,
} from './missions'
import { circularSpeed_m_s } from './orbit'
import { DEFAULT_INPUTS } from './satellite'

describe('geometry', () => {
  it('slant range equals altitude straight down / straight up', () => {
    expect(slantRangeFromIncidence_m(400e3, 0)).toBeCloseTo(400e3, 3)
    expect(slantRangeFromElevation_m(400e3, 90)).toBeCloseTo(400e3, 3)
  })

  it('slant range grows with incidence and with lower elevation', () => {
    // Earth curves away, so the look angle is smaller than the incidence angle: h < R < h / cos θ.
    expect(slantRangeFromIncidence_m(400e3, 30)).toBeGreaterThan(400e3)
    expect(slantRangeFromIncidence_m(400e3, 30)).toBeLessThan(400e3 / Math.cos((30 * Math.PI) / 180))
    expect(slantRangeFromElevation_m(400e3, 10)).toBeGreaterThan(slantRangeFromElevation_m(400e3, 30))
  })
})

describe('optical', () => {
  it('hand check: 0.8 m GSD at 300 km needs a 1.22 × 550 nm × 300 km / 0.8 m = 0.252 m aperture', () => {
    expect(opticalPayload(300e3, 0.8).size).toBeCloseTo(0.2516, 4)
  })

  it('aperture ∝ altitude, so mass ∝ altitude^2.5 at fixed resolution', () => {
    const ratio = opticalPayload(600e3, 0.8).mass_kg / opticalPayload(300e3, 0.8).mass_kg
    expect(ratio).toBeCloseTo(2 ** MISSION_PARAMS.optical.massExponent, 9)
  })
})

describe('radar', () => {
  it('hand check: ambiguity-limited area 4 v λ R tan θ / c', () => {
    const h = 500e3
    const R = slantRangeFromIncidence_m(h, 30)
    const expected = (4 * circularSpeed_m_s(h) * (SPEED_OF_LIGHT / 9.65e9) * R * Math.tan(Math.PI / 6)) / SPEED_OF_LIGHT
    expect(sarMinimumArea_m2(h)).toBeCloseTo(expected, 12)
    expect(expected).toBeGreaterThan(0.9)
    expect(expected).toBeLessThan(1.2)
  })

  it('reference design reproduces its own imaging power', () => {
    const p = MISSION_PARAMS.sar
    const s = sarPayload(p.refAltitude_m, p.refNesz_dB)
    expect(s.power_W).toBeCloseTo(p.standbyPower_W + p.imagingDuty * p.refImagingPower_W, 9)
  })

  it('3 dB more sensitivity doubles imaging power', () => {
    const p = MISSION_PARAMS.sar
    const imaging = (n: number) => (sarPayload(400e3, n).power_W - p.standbyPower_W) / p.imagingDuty
    expect(imaging(-20) / imaging(-17)).toBeCloseTo(10 ** 0.3, 9)
  })

  it('with area ∝ v R, imaging power grows about in proportion to slant range', () => {
    const p = MISSION_PARAMS.sar
    const imaging = (h: number) => (sarPayload(h, -17).power_W - p.standbyPower_W) / p.imagingDuty
    const rangeRatio = slantRangeFromIncidence_m(600e3, 30) / slantRangeFromIncidence_m(300e3, 30)
    const vRatio = circularSpeed_m_s(600e3) / circularSpeed_m_s(300e3)
    expect(imaging(600e3) / imaging(300e3)).toBeCloseTo(rangeRatio / vRatio, 9)
  })
})

describe('direct-to-device', () => {
  it('hand check of the uplink budget in decibels', () => {
    const d = 1000e3
    const lambda = SPEED_OF_LIGHT / 2e9
    const lfs = 20 * Math.log10((4 * Math.PI * d) / lambda)
    const g_dB = 50 + 7 + lfs + 3 + 10 * Math.log10(500) - 228.6
    expect(10 * Math.log10(d2dRequiredGain(d))).toBeCloseTo(g_dB, 1)
  })

  it('at default cell size the beam, not the link, sets the antenna; its side ∝ slant range', () => {
    const a = d2dPayload(300e3, 50e3, 25)
    const b = d2dPayload(600e3, 50e3, 25)
    expect(a.limitedBy).toMatch(/cell size/)
    const dRatio = slantRangeFromElevation_m(600e3, 25) / slantRangeFromElevation_m(300e3, 25)
    expect(b.size / a.size).toBeCloseTo(dRatio ** 2, 9)
    // Same power per cell: power grows with the footprint (spherical cap) area.
    const cap = (h: number) => 1 - Math.cos(centralAngleFromElevation(h, 25))
    expect(b.power_W / a.power_W).toBeCloseTo(cap(600e3) / cap(300e3), 9)
    expect(a.power_W).toBeCloseTo(MISSION_PARAMS.d2d.refPower_W, 9)
  })

  it('large cells are link-limited instead', () => {
    expect(d2dPayload(300e3, 2000e3, 25).limitedBy).toMatch(/uplink/)
  })
})

describe('in the constellation', () => {
  it('mission payloads replace the scaled payload and add antenna drag', () => {
    const sar = evaluateConstellation(DEFAULT_INPUTS, { ...DEFAULT_CONSTELLATION, mission: 'sar', passesPerOrbit: 2 }, 400e3)
    expect(sar.payload?.kind).toBe('sar')
    expect(sar.satellite.dragArea_m2).toBeGreaterThan(sar.payload!.dragArea_m2)
    expect(Number.isNaN(sar.payloadScale)).toBe(true)
  })

  it('radar favours higher altitude than optical imaging (slower payload growth)', () => {
    const altitudes = Array.from({ length: 81 }, (_, k) => (200 + 5 * k) * 1e3)
    const best = (mission: 'optical' | 'sar') =>
      altitudes
        .map((h) => evaluateConstellation(DEFAULT_INPUTS, { ...DEFAULT_CONSTELLATION, mission }, h))
        .filter((p) => p.feasible)
        .reduce((a, b) => (b.massPerYear_kg < a.massPerYear_kg ? b : a)).altitude_m
    expect(best('sar')).toBeGreaterThan(best('optical'))
  })
})
