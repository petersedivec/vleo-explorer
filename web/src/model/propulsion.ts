// Propulsion (docs/physics.md §5).

import { G0 } from './constants'

export type PropulsionClass =
  | 'coldGas'
  | 'monoprop'
  | 'electrospray'
  | 'feep'
  | 'griddedIon'
  | 'hall'
  | 'rfPlasma'

export interface PropulsionPreset {
  label: string
  isp_s: number
  /** Total efficiency (jet power / input power); null for thrusters that are not power-limited. */
  efficiency: number | null
  /** Thrust per thruster unit or module. */
  unitThrust_N: number
  /** Fixed heater/valve power for non-electric thrusters. */
  fixedPower_W: number
  /** Tank and feed-system mass per kg of propellant (teaching default, physics.md §5.7). */
  tankFraction: number
  /** Propellant, for the comparison table. */
  propellant: string
  /**
   * Fixed propulsion-system mass independent of size: thruster head, feed system (valves, regulators),
   * minimum PPU. Teaching estimate (physics.md §5.7); the per-watt PPU mass is added separately.
   */
  systemFixedMass_kg: number
  /**
   * Lowest practical operating power (teaching estimate). Below it the thruster cannot run efficiently,
   * so the power system is sized for at least this and the thruster fires intermittently.
   */
  minPower_W: number
}

/** Generic technology classes; teaching defaults from NASA SST ranges (§5.3). */
export const PROPULSION_PRESETS: Record<PropulsionClass, PropulsionPreset> = {
  coldGas: {
    label: 'Cold gas', isp_s: 65, efficiency: null, unitThrust_N: 10e-3, fixedPower_W: 10,
    tankFraction: 0.6, propellant: 'Nitrogen or butane (high-pressure tank)',
    systemFixedMass_kg: 0.5,
    minPower_W: 0,
  },
  monoprop: {
    label: 'Monopropellant (green)', isp_s: 220, efficiency: null, unitThrust_N: 1, fixedPower_W: 20,
    tankFraction: 0.15, propellant: 'Green monopropellant (blowdown tank)',
    systemFixedMass_kg: 1.5,
    minPower_W: 0,
  },
  electrospray: {
    label: 'Electrospray (ionic liquid)', isp_s: 1500, efficiency: 0.35, unitThrust_N: 0.1e-3, fixedPower_W: 0,
    tankFraction: 0.08, propellant: 'Ionic liquid (unpressurised)',
    systemFixedMass_kg: 0.5,
    minPower_W: 0,
  },
  feep: {
    label: 'FEEP', isp_s: 4000, efficiency: 0.3, unitThrust_N: 0.35e-3, fixedPower_W: 0,
    tankFraction: 0.1, propellant: 'Liquid metal (indium), solid at launch',
    systemFixedMass_kg: 0.8,
    minPower_W: 5,
  },
  griddedIon: {
    label: 'Gridded ion', isp_s: 2500, efficiency: 0.55, unitThrust_N: 5e-3, fixedPower_W: 0,
    tankFraction: 0.15, propellant: 'Xenon (high-pressure tank)',
    systemFixedMass_kg: 4,
    minPower_W: 50,
  },
  hall: {
    label: 'Hall effect', isp_s: 1400, efficiency: 0.45, unitThrust_N: 15e-3, fixedPower_W: 0,
    tankFraction: 0.15, propellant: 'Xenon or krypton (high-pressure tank)',
    systemFixedMass_kg: 3,
    minPower_W: 100,
  },
  rfPlasma: {
    label: 'RF / ambipolar plasma', isp_s: 800, efficiency: 0.15, unitThrust_N: 5e-3, fixedPower_W: 0,
    tankFraction: 0.15, propellant: 'Xenon, krypton or iodine',
    systemFixedMass_kg: 2,
    minPower_W: 20,
  },
}

/** Electric thruster input power P = T g0 Isp / (2 eta). */
export const electricPower_W = (thrust_N: number, isp_s: number, efficiency: number) =>
  (thrust_N * G0 * isp_s) / (2 * efficiency)

/** Derived thrust-to-power, N/W. */
export const thrustToPower_N_W = (isp_s: number, efficiency: number) => (2 * efficiency) / (G0 * isp_s)

export const massFlow_kg_s = (thrust_N: number, isp_s: number) => thrust_N / (G0 * isp_s)

/** Propellant life holding altitude: m_prop g0 Isp / D. Independent of spacecraft mass. */
export const propellantLife_s = (propellant_kg: number, isp_s: number, drag_N: number) =>
  (propellant_kg * G0 * isp_s) / drag_N

export const rocketDeltaV_m_s = (isp_s: number, m0_kg: number, mf_kg: number) => G0 * isp_s * Math.log(m0_kg / mf_kg)
