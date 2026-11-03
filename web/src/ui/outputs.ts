// Output cards: value, equation and a plain-language "why" for each result.

import type { SatelliteInputs, SatelliteResult } from '../model/satellite'
import { duration, sci, si, sig } from './format'

export interface OutputCard {
  id: string
  label: string
  value: (r: SatelliteResult, i: SatelliteInputs) => string
  /** Raw number used to show the change since the last input change. */
  raw: (r: SatelliteResult) => number
  equation: string
  why: string
  /** Hide in As-built mode, where the value is not computed. */
  designOnly?: boolean
  /** Depends on the sized spacecraft: shown as "—" when no design closes. */
  sized?: boolean
}

export interface OutputGroup {
  title: string
  cards: OutputCard[]
}

export const OUTPUT_GROUPS: OutputGroup[] = [
  {
    title: 'Orbit and atmosphere',
    cards: [
      {
        id: 'density',
        label: 'Air density',
        value: (r) => `${sci(r.density_kg_m3, 3)} kg/m³`,
        raw: (r) => r.density_kg_m3,
        equation: 'Orbit-averaged NRLMSIS 2.1 (or Vallado exponential table)',
        why: 'Density falls roughly exponentially with altitude. Every drag-driven number below inherits this exponential. The average is over all local times; a dawn-dusk sun-synchronous orbit sees somewhat lower density, a noon orbit somewhat higher.',
      },
      {
        id: 'scaleHeight',
        label: 'Scale height',
        value: (r) => si(r.scaleHeight_m, 'm', 2),
        raw: (r) => r.scaleHeight_m,
        equation: 'H = −1 / (d ln ρ / dh)',
        why: 'Drop by one scale height and density rises by a factor of e (2.7×). H is about 20 km at 150 km and 60 km at 450 km.',
      },
      {
        id: 'speed',
        label: 'Orbital speed',
        value: (r) => si(r.speed_m_s, 'm/s', 3),
        raw: (r) => r.speed_m_s,
        equation: 'v = √(μ / r)',
        why: 'Barely changes across VLEO (about 2%), so drag is driven almost entirely by density.',
      },
      {
        id: 'eclipse',
        label: 'Eclipse fraction',
        value: (r) => `${sig(r.eclipseFraction * 100, 2)} %`,
        raw: (r) => r.eclipseFraction,
        equation: 'f = (1/π)·acos(√(h² + 2R⊕h) / (r cos β)) if |β| < asin(R⊕/r)',
        why: 'Time in shadow, when arrays produce nothing. Lower orbits see a wider Earth shadow.',
      },
    ],
  },
  {
    title: 'Spacecraft',
    cards: [
      {
        id: 'dryMass',
        sized: true,
        label: 'Dry mass',
        value: (r) => `${sig(r.dryMass_kg, 3)} kg`,
        raw: (r) => r.dryMass_kg,
        equation: 'm_dry = (payload + bus + arrays + PPU + thruster) / (1 − f_struct)',
        why: 'More drag needs more thruster power, which needs more array, which adds mass and drag. The model iterates until these agree.',
      },
      {
        id: 'arrayArea',
        sized: true,
        designOnly: true,
        label: 'Solar array area',
        value: (r) => `${sig(r.arrayArea_m2, 2)} m²`,
        raw: (r) => r.arrayArea_m2,
        equation: 'A = P_array / (S·η·F·L·cos θ)',
        why: 'Arrays must also carry eclipse loads, so they are larger than the daylight load alone suggests.',
      },
      {
        id: 'dragArea',
        sized: true,
        label: 'Drag area',
        value: (r) => `${sig(r.dragArea_m2, 2)} m²`,
        raw: (r) => r.dragArea_m2,
        equation: 'A_ref = A_body + k_array·A_array',
        why: 'Even edge-on arrays add drag (grazing-incidence momentum exchange, k ≈ 0.07). Sun-tracking arrays add far more (k ≈ 0.71).',
      },
      {
        id: 'ballistic',
        sized: true,
        label: 'Ballistic coefficient',
        value: (r) => `${sig(r.ballistic_kg_m2, 3)} kg/m²`,
        raw: (r) => r.ballistic_kg_m2,
        equation: 'B = m / (C_D·A)',
        why: 'Dense, slim spacecraft resist drag. Lifetime without thrust is directly proportional to B.',
      },
      {
        id: 'loopGain',
        designOnly: true,
        label: 'Sizing-loop gain',
        value: (r) => sig(r.loopGain, 2),
        raw: (r) => r.loopGain,
        equation: 'G = (½ρ·k_storm·v²C_D·k)·(g₀Isp / 2ηd) / p_array',
        why: 'Extra drag created per unit of drag the extra array lets you cancel, at storm-margin density. Mass feedback adds a little more, so designs stop closing as G approaches 1: the hard floor.',
      },
    ],
  },
  {
    title: 'Propulsion and life',
    cards: [
      {
        id: 'drag',
        sized: true,
        label: 'Drag (nominal)',
        value: (r) => si(r.drag_N, 'N', 3),
        raw: (r) => r.drag_N,
        equation: 'D = ½ρv²C_D·A',
        why: 'The force the thruster must cancel, on average, to hold altitude.',
      },
      {
        id: 'thrusterPower',
        sized: true,
        label: 'Thruster power',
        value: (r) => si(r.thrusterPower_W, 'W', 3),
        raw: (r) => r.thrusterPower_W,
        equation: 'P = T·g₀·Isp / (2η); Design: T = D_storm / duty; As built: T = D / duty',
        why: 'In Design mode, sized for storm-level density; as built, the power to hold altitude at nominal density. Higher Isp saves propellant but costs power for the same thrust.',
      },
      {
        id: 'thrusterUnits',
        sized: true,
        designOnly: true,
        label: 'Thruster units',
        value: (r) => sig(r.thrusterUnits, 3),
        raw: (r) => r.thrusterUnits,
        equation: 'n = ⌈T_sized / T_unit⌉',
        why: 'Modular thrusters (electrospray, FEEP) scale by adding units.',
      },
      {
        id: 'propPerYear',
        sized: true,
        label: 'Propellant per year',
        value: (r) => si(r.propellantPerYear_kg * 1e3, 'g', 3),
        raw: (r) => r.propellantPerYear_kg,
        equation: 'ṁ = D / (g₀·Isp)',
        why: 'Independent of spacecraft mass at constant altitude: only drag and Isp matter.',
      },
      {
        id: 'thrustMargin',
        sized: true,
        label: 'Thrust margin',
        value: (r) => `×${sig(r.thrustMargin, 2)}`,
        raw: (r) => r.thrustMargin,
        equation: 'available thrust × duty ÷ drag',
        why: 'Above 1 the thruster can hold altitude at nominal density. In Design mode it equals the storm margin; in As-built mode it is whatever the hardware allows.',
      },
      {
        id: 'missionLife',
        label: 'Mission life',
        value: (r) => (r.feasible ? duration(r.missionLife_s) : 'no design closes'),
        raw: (r) => r.missionLife_s,
        equation: 'min(m_prop·g₀·Isp / D, I_total / D, design life)',
        why: 'The shortest of propellant, thruster total impulse and design life.',
      },
      {
        id: 'limitedBy',
        label: 'Life limited by',
        value: (r) =>
          r.infeasibility === 'thrustBelowDrag'
            ? 'cannot hold altitude'
            : !r.feasible
              ? '—'
              : ({ propellant: 'propellant', totalImpulse: 'thruster total impulse', designLife: 'design life' })[r.lifeLimitedBy],
        raw: () => NaN,
        equation: '',
        why: 'Which limit sets mission life.',
      },
    ],
  },
  {
    title: 'Disposal and environment',
    cards: [
      {
        id: 'naturalLifetime',
        sized: true,
        label: 'Lifetime with no thrust',
        value: (r) => duration(r.naturalLifetime_s),
        raw: (r) => r.naturalLifetime_s,
        equation: 't = B·∫ da / (√(μa)·ρ)',
        why: 'How long a satellite stays up if its thruster fails on day one. Grows exponentially with altitude.',
      },
      {
        id: 'decayRate',
        sized: true,
        label: 'Decay rate with no thrust',
        value: (r) => (r.decayRate_m_day >= 1000 ? si(r.decayRate_m_day, 'm/day', 2) : `${sig(r.decayRate_m_day, 2)} m/day`),
        raw: (r) => r.decayRate_m_day,
        equation: 'da/dt = −√(μa)·ρ / B',
        why: 'How fast the orbit shrinks right now if thrust stops. Compare it with how often you could fire a thruster or schedule a reboost.',
      },
      {
        id: 'disposal',
        sized: true,
        label: 'Disposal time (empty)',
        value: (r) => `${duration(r.disposalTime_s)}${r.meetsFiveYearRule ? ' ✓ 5-yr rule' : ' ✗ 5-yr rule'}`,
        raw: (r) => r.disposalTime_s,
        equation: 'same, with dry-mass B',
        why: 'The FCC requires disposal within 5 years of mission end. VLEO orbits clean themselves.',
      },
      {
        id: 'heat',
        label: 'Free-molecular heating',
        value: (r) => `${sig(r.heatFlux_W_m2, 2)} W/m²`,
        raw: (r) => r.heatFlux_W_m2,
        equation: 'q = ½ρv³',
        why: 'Aerodynamic heating on ram-facing surfaces; significant below about 180 km.',
      },
      {
        id: 'oxygen',
        label: 'Atomic-oxygen fluence per year',
        value: (r) => `${sci(r.oxygenFluencePerYear_m2, 2)} /m²`,
        raw: (r) => r.oxygenFluencePerYear_m2,
        equation: 'Φ = n_O·v·t',
        why: 'Atomic oxygen erodes polymers and coatings; drives material choices for long missions.',
      },
    ],
  },
]
