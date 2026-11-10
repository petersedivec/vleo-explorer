// Requirement-based payload sizing for the three teaching missions (docs/physics.md §9).
//
// Each mission states a ground requirement (image resolution, radar sensitivity, phone cell size) and the
// payload needed to meet it is sized at each altitude. This replaces the (h / 300 km)^k scaling.
// All parameters are teaching estimates with stated reasoning (physics.md §9); none describes a product.

import { BOLTZMANN, DEG, R_EARTH, SPEED_OF_LIGHT } from './constants'
import { circularSpeed_m_s, radius_m } from './orbit'
import { K_GRAZE } from './satellite'

export type MissionKind = 'scaled' | 'optical' | 'sar' | 'd2d'

export interface MissionRequirements {
  /** Optical: ground sample distance at nadir. */
  gsd_m: number
  /** Radar: noise-equivalent sigma-zero (dB); more negative is more sensitive. */
  nesz_dB: number
  /** Direct-to-device: width of one beam (cell) on the ground. */
  cellWidth_m: number
  /** Direct-to-device: lowest elevation of the satellite above the phone's horizon. */
  minElevation_deg: number
}

export const DEFAULT_REQUIREMENTS: MissionRequirements = {
  gsd_m: 0.8,
  nesz_dB: -17,
  cellWidth_m: 50e3,
  minElevation_deg: 25,
}

/** Teaching estimates for each payload model (physics.md §9). */
export const MISSION_PARAMS = {
  optical: {
    /** Rayleigh factor in GSD = Q λ h / D. */
    q: 1.22,
    wavelength_m: 550e-9,
    /** Reference instrument: aperture, mass and power. */
    refAperture_m: 0.5,
    refMass_kg: 100,
    refPower_W: 100,
    /** Mass ∝ aperture^k (k ≈ 2–3: volume grows as D³, lightweighting pulls it down). */
    massExponent: 2.5,
    /** Power ∝ aperture^k (detector area, electronics, thermal control). */
    powerExponent: 2,
    /** Telescope barrel: diameter and length as multiples of the aperture (compact folded design). */
    barrelDiameterFactor: 1.3,
    barrelLengthFactor: 1.5,
    /** Detector pixels across track: swath = pixels × GSD. */
    pixelsAcross: 12000,
    /** Fraction of the orbit spent imaging (small satellites are limited by downlink and power). */
    imagingDuty: 0.02,
  },
  sar: {
    /** X band, 9.65 GHz. */
    wavelength_m: SPEED_OF_LIGHT / 9.65e9,
    incidence_deg: 30,
    /** Antenna area as a multiple of the ambiguity-limited minimum. */
    areaMargin: 1.2,
    /** Antenna length (along track) ÷ height. */
    aspectRatio: 8,
    thickness_m: 0.1,
    arealMass_kg_m2: 15,
    electronicsMass_kg: 15,
    standbyPower_W: 20,
    /** Fraction of the orbit spent imaging (about 5 minutes per orbit). */
    imagingDuty: 0.05,
    /** Reference design: DC power while imaging, at this altitude, antenna margin and NESZ. */
    refImagingPower_W: 1000,
    refAltitude_m: 500e3,
    refNesz_dB: -17,
  },
  d2d: {
    frequency_Hz: 2e9,
    /** Phone uplink: EIRP, required carrier-to-noise density, satellite noise temperature, other losses. */
    phoneEirp_dBW: -7,
    requiredCN0_dBHz: 50,
    systemTemperature_K: 500,
    otherLosses_dB: 3,
    apertureEfficiency: 0.6,
    arealMass_kg_m2: 10,
    electronicsMass_kg: 20,
    /**
     * Payload power at the reference altitude and elevation. Per beam, delivering the same power flux to the
     * ground needs transmit power ∝ d² / gain, and gain ∝ antenna area ∝ d², so the two cancel; but a higher
     * satellite sees more cells, so power is scaled with footprint area to keep the same power per cell.
     */
    refPower_W: 100,
    refAltitude_m: 300e3,
    refElevation_deg: 25,
    thickness_m: 0.1,
  },
} as const

export interface PayloadDesign {
  kind: Exclude<MissionKind, 'scaled'>
  mass_kg: number
  /** Orbit-average power. */
  power_W: number
  /** Ram-facing area the payload forces on the body (telescope barrel). */
  frontalArea_m2: number
  /** Extra ram-facing area outside the body (an antenna flown edge-on). */
  dragArea_m2: number
  /** The sized element: telescope aperture diameter (m) or antenna area (m²). */
  size: number
  sizeLabel: string
  /** What sets the size, in words. */
  limitedBy: string
  /** Imaging missions: width imaged on the ground at one time, and the fraction of the orbit spent imaging. */
  imagingSwath_m?: number
  imagingDuty?: number
}

const dB = (x: number) => 10 * Math.log10(x)
const fromDb = (x: number) => 10 ** (x / 10)

/** Slant range from the satellite to a ground point seen at incidence angle θ (§9.2). */
export function slantRangeFromIncidence_m(altitude_m: number, incidence_deg: number): number {
  const c = Math.cos(incidence_deg * DEG)
  return -R_EARTH * c + Math.sqrt(R_EARTH ** 2 * c ** 2 + 2 * R_EARTH * altitude_m + altitude_m ** 2)
}

/** Slant range from a user to the satellite at elevation ε (§9.3). */
export function slantRangeFromElevation_m(altitude_m: number, elevation_deg: number): number {
  const e = elevation_deg * DEG
  return Math.sqrt(radius_m(altitude_m) ** 2 - (R_EARTH * Math.cos(e)) ** 2) - R_EARTH * Math.sin(e)
}

/** Optical imager sized for a nadir ground sample distance (§9.1). */
export function opticalPayload(altitude_m: number, gsd_m: number): PayloadDesign {
  const p = MISSION_PARAMS.optical
  const aperture = (p.q * p.wavelength_m * altitude_m) / gsd_m
  const ratio = aperture / p.refAperture_m
  return {
    kind: 'optical',
    mass_kg: p.refMass_kg * ratio ** p.massExponent,
    power_W: p.refPower_W * ratio ** p.powerExponent,
    // Pointed at nadir, the barrel's side faces the flow.
    frontalArea_m2: p.barrelDiameterFactor * aperture * p.barrelLengthFactor * aperture,
    dragArea_m2: 0,
    size: aperture,
    sizeLabel: 'Telescope aperture',
    limitedBy: 'diffraction: aperture ∝ altitude ÷ resolution',
    imagingSwath_m: p.pixelsAcross * gsd_m,
    imagingDuty: p.imagingDuty,
  }
}

/** Ambiguity-limited minimum SAR antenna area, A_min = 4 v λ R tan θ / c (§9.2). */
export function sarMinimumArea_m2(altitude_m: number): number {
  const p = MISSION_PARAMS.sar
  const R = slantRangeFromIncidence_m(altitude_m, p.incidence_deg)
  return (4 * circularSpeed_m_s(altitude_m) * p.wavelength_m * R * Math.tan(p.incidence_deg * DEG)) / SPEED_OF_LIGHT
}

/** Stripmap radar sized for a noise-equivalent sigma-zero (§9.2). */
export function sarPayload(altitude_m: number, nesz_dB: number): PayloadDesign {
  const p = MISSION_PARAMS.sar
  const R = slantRangeFromIncidence_m(altitude_m, p.incidence_deg)
  const v = circularSpeed_m_s(altitude_m)
  const area = p.areaMargin * sarMinimumArea_m2(altitude_m)
  const Rref = slantRangeFromIncidence_m(p.refAltitude_m, p.incidence_deg)
  const vref = circularSpeed_m_s(p.refAltitude_m)
  const areaRef = p.areaMargin * sarMinimumArea_m2(p.refAltitude_m)
  // NESZ ∝ R³ λ v / (P A²): solve for the power that meets the requirement, scaled from the reference.
  const imaging = p.refImagingPower_W * (R / Rref) ** 3 * (v / vref) * (areaRef / area) ** 2 * fromDb(p.refNesz_dB - nesz_dB)
  const height = Math.sqrt(area / p.aspectRatio)
  return {
    kind: 'sar',
    mass_kg: p.electronicsMass_kg + p.arealMass_kg_m2 * area,
    power_W: p.standbyPower_W + p.imagingDuty * imaging,
    frontalArea_m2: 0,
    // Long axis along track, face looking sideways: the flow sees the antenna's edge plus grazing drag.
    dragArea_m2: height * p.thickness_m + K_GRAZE * area,
    size: area,
    sizeLabel: 'Radar antenna area',
    limitedBy: 'range and Doppler ambiguities: area ∝ speed × slant range',
    // Elevation beam λ / height spread over the slant range, projected on the ground at incidence θ.
    imagingSwath_m: (p.wavelength_m * R) / (height * Math.cos(p.incidence_deg * DEG)),
    imagingDuty: p.imagingDuty,
  }
}

/** Satellite antenna gain the phone uplink needs at slant range d (§9.3), as a linear ratio. */
export function d2dRequiredGain(slant_m: number): number {
  const p = MISSION_PARAMS.d2d
  const lambda = SPEED_OF_LIGHT / p.frequency_Hz
  const freeSpaceLoss_dB = 2 * dB((4 * Math.PI * slant_m) / lambda)
  // C/N0 = EIRP + G − L_fs − L_other − 10 log T − 10 log k  →  solve for G.
  return fromDb(p.requiredCN0_dBHz - p.phoneEirp_dBW + freeSpaceLoss_dB + p.otherLosses_dB + dB(p.systemTemperature_K) + dB(BOLTZMANN))
}

/** Direct-to-device antenna sized by the phone uplink and by the cell size on the ground (§9.3). */
export function d2dPayload(altitude_m: number, cellWidth_m: number, minElevation_deg: number): PayloadDesign {
  const p = MISSION_PARAMS.d2d
  const lambda = SPEED_OF_LIGHT / p.frequency_Hz
  const d = slantRangeFromElevation_m(altitude_m, minElevation_deg)
  const linkArea = (d2dRequiredGain(d) * lambda ** 2) / (4 * Math.PI * p.apertureEfficiency)
  const side = (lambda * d) / cellWidth_m
  const beamArea = side ** 2
  const area = Math.max(linkArea, beamArea)
  // Footprint (spherical cap) area ∝ 1 − cos λ, λ = acos(R⊕ cos ε / r) − ε (§10.1);
  // same power per cell → power ∝ footprint area.
  const cap = (h: number, e: number) => 1 - Math.cos(Math.acos((R_EARTH * Math.cos(e * DEG)) / radius_m(h)) - e * DEG)
  return {
    kind: 'd2d',
    mass_kg: p.electronicsMass_kg + p.arealMass_kg_m2 * area,
    power_W: (p.refPower_W * cap(altitude_m, minElevation_deg)) / cap(p.refAltitude_m, p.refElevation_deg),
    frontalArea_m2: 0,
    // Faces nadir, so it is edge-on to the flow: its edge plus grazing drag.
    dragArea_m2: Math.sqrt(area) * p.thickness_m + K_GRAZE * area,
    size: area,
    sizeLabel: 'Phone-link antenna area',
    limitedBy: beamArea >= linkArea ? 'cell size: side ∝ slant range ÷ cell width' : 'phone uplink budget: gain ∝ slant range²',
  }
}

export function payloadFor(kind: Exclude<MissionKind, 'scaled'>, altitude_m: number, r: MissionRequirements): PayloadDesign {
  if (kind === 'optical') return opticalPayload(altitude_m, r.gsd_m)
  if (kind === 'sar') return sarPayload(altitude_m, r.nesz_dB)
  return d2dPayload(altitude_m, r.cellWidth_m, r.minElevation_deg)
}
