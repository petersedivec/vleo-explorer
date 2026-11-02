// Shared constants and helpers for the UI.

import { SOLAR_MODES, type SolarMode } from '../model/atmosphere'
import type { SatelliteInputs } from '../model/satellite'

export const KM = 1e3
export const SWEEP_ALTITUDES = Array.from({ length: 91 }, (_, k) => (150 + 5 * k) * KM)
export const SWEEP_KM = SWEEP_ALTITUDES.map((h) => h / KM)
export const MODES: SolarMode[] = ['low', 'moderate', 'high']
export const MODE_LABEL: Record<SolarMode, string> = { low: 'Solar min', moderate: 'Moderate', high: 'Solar max' }
export const MODE_COLOR: Record<SolarMode, string> = {
  low: 'var(--series-low)',
  moderate: 'var(--series-mid)',
  high: 'var(--series-high)',
}

export function solarModeOf(inputs: SatelliteInputs): SolarMode | null {
  return MODES.find((m) => SOLAR_MODES[m].f107 === inputs.solar.f107 && SOLAR_MODES[m].ap === inputs.solar.ap) ?? null
}

/** Resolve a CSS custom property (given as a name or var(--name)) to its current value. */
export function cssColor(token: string) {
  const name = token.replace(/^var\((.*)\)$/, '$1')
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#888'
}
