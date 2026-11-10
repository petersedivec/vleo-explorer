// Number formatting for display: engineering units, limited significant figures.

import { DAY_S, YEAR_S } from '../model/constants'
import { unitLife_h, type PropulsionPreset } from '../model/propulsion'

export function sig(x: number, digits = 3): string {
  if (!Number.isFinite(x)) return x > 0 ? '∞' : '—'
  if (x === 0) return '0'
  return Number(x.toPrecision(digits)).toLocaleString('en-US', { maximumSignificantDigits: digits })
}

const PREFIXES: [number, string][] = [
  [1e9, 'G'], [1e6, 'M'], [1e3, 'k'], [1, ''], [1e-3, 'm'], [1e-6, 'µ'], [1e-9, 'n'],
]

/** Value with an SI prefix, e.g. 0.0021 N → "2.1 mN". */
export function si(x: number, unit: string, digits = 3): string {
  if (!Number.isFinite(x)) return x > 0 ? '∞' : '—'
  if (x === 0) return `0 ${unit}`
  const abs = Math.abs(x)
  for (const [scale, prefix] of PREFIXES) if (abs >= scale * 0.9995) return `${sig(x / scale, digits)} ${prefix}${unit}`
  return `${x.toExponential(digits - 1)} ${unit}`
}

/** Duration in the most readable unit. */
export function duration(seconds: number): string {
  if (!Number.isFinite(seconds)) return '∞'
  if (seconds < 2 * 3600) return `${sig(seconds / 60, 2)} min`
  if (seconds < 2 * DAY_S) return `${sig(seconds / 3600, 2)} h`
  if (seconds < 90 * DAY_S) return `${sig(seconds / DAY_S, 2)} days`
  if (seconds < 2 * YEAR_S) return `${sig(seconds / (YEAR_S / 12), 2)} months`
  return `${sig(seconds / YEAR_S, 2)} years`
}

export const sci = (x: number, digits = 2) => (Number.isFinite(x) ? x.toExponential(digits - 1) : '—')

/** Wear life per unit with its hours-at-rated-thrust equivalent and, where given, the plausible band. */
export function wearLife(p: PropulsionPreset, withRange = true): string {
  if (!Number.isFinite(p.unitTotalImpulse_Ns)) return 'not limiting'
  const base = `${p.unitTotalImpulse_Ns.toLocaleString('en-US')} N·s (≈ ${sig(unitLife_h(p), 2)} h at rated thrust)`
  const r = p.unitTotalImpulseRange_Ns
  return withRange && r ? `${base}; plausible band, scaled from public life tests, ${r[0].toLocaleString('en-US')}–${r[1].toLocaleString('en-US')} N·s` : base
}
