// Heritage missions: spacecraft that flew in or through VLEO, with sourced parameters.
// Every parameter is marked "published" (stated in a cited source) or "estimated" (our engineering
// estimate, with the reasoning given). Edit with care: these values feed the model checks.

import { DAY_S, YEAR_S } from '../model/constants'
import type { PropulsionClass } from '../model/propulsion'
import type { AsBuiltSpacecraft } from '../model/satellite'

export interface Source {
  title: string
  url: string
}

export interface Parameter {
  label: string
  value: string
  status: 'published' | 'estimated'
  /** Index into the mission's sources, or a note explaining the estimate. */
  source?: number
  note?: string
}

/** The spacecraft as loaded into the model (As-built mode). */
export interface HeritageInputs {
  altitude_m: number
  inclination_deg: number
  beta_deg: number
  cd: number
  asBuilt: AsBuiltSpacecraft
  propulsion: PropulsionClass
  isp_s: number
  efficiency: number
  propellant_kg: number
  /** Representative solar activity for the mission period. */
  f107: number
  ap: number
}

export type CheckMetric = 'propellantLife' | 'naturalLifetime' | 'thrustMargin' | 'decayRate' | 'propellantNeeded'

/** A comparison between something that actually happened and what the model predicts. */
export interface Check {
  label: string
  metric: CheckMetric
  /** What was observed, in the metric's SI unit (s, m/day, or thrust ratio); null if qualitative. */
  observed: number | null
  observedText: string
  source?: number
  /** Changes to the mission inputs for this check (e.g. a different altitude). */
  overrides?: Partial<HeritageInputs>
  /** F10.7 range spanning the solar activity during the observation. */
  f107Range: [number, number]
  /** For propellantNeeded: how long the propellant must last. */
  duration_s?: number
  /** What to take from the comparison, especially when model and reality differ. */
  lesson: string
}

export interface HeritageMission {
  id: string
  name: string
  operator: string
  category: 'Government' | 'Academic' | 'Commercial'
  years: string
  altitudeText: string
  summary: string
  teaches: string[]
  inputs: HeritageInputs
  parameters: Parameter[]
  checks: Check[]
  sources: Source[]
}

const MONTH_S = YEAR_S / 12

export const HERITAGE_MISSIONS: HeritageMission[] = [
  {
    id: 'goce',
    name: 'GOCE',
    operator: 'European Space Agency',
    category: 'Government',
    years: '2009–2013',
    altitudeText: '255 → 224 km',
    summary:
      'Gravity field and steady-state Ocean Circulation Explorer mapped Earth’s gravity from the lowest orbit of any science satellite of its time. A slim, finned, aerodynamic body with an ion thruster that throttled in real time to cancel drag ("drag-free" flight). It flew about twice its planned 20 months, then the xenon ran out.',
    teaches: [
      'Drag-free flight: continuous, throttled electric thrust exactly cancelling drag',
      'Aerodynamic shaping: slender body and fixed wing-like arrays to cut frontal area',
      'How fast a dead satellite falls at 224 km: about three weeks',
    ],
    inputs: {
      altitude_m: 255e3,
      inclination_deg: 96.7,
      beta_deg: 80,
      cd: 3.0,
      asBuilt: { dryMass_kg: 1036, dragArea_m2: 1.0, maxThrust_N: 20e-3 },
      propulsion: 'griddedIon',
      isp_s: 3000,
      efficiency: 0.55,
      propellant_kg: 41,
      f107: 100,
      ap: 10,
    },
    parameters: [
      { label: 'Launch mass', value: '1,077 kg', status: 'published', source: 2 },
      { label: 'Xenon propellant', value: '41 kg (≈40 kg)', status: 'published', source: 1 },
      { label: 'Dry mass used', value: '1,036 kg', status: 'estimated', note: 'Launch mass minus xenon.' },
      { label: 'Cross-sectional area', value: '≈1 m²', status: 'published', source: 0 },
      { label: 'Length', value: '≈5 m, octagonal body', status: 'published', source: 0 },
      {
        label: 'Drag coefficient',
        value: '3.0',
        status: 'estimated',
        note: 'Slender bodies with fins in free-molecular flow have C_D above the compact-body 2.2; GOCE density studies stress that C_D depends on the geometry model used.',
        source: 4,
      },
      { label: 'Thrusters', value: '2 × T5 gridded ion (one active), 1–20 mN, throttled', status: 'published', source: 3 },
      { label: 'Specific impulse', value: '≈3,000 s', status: 'published', source: 3 },
      { label: 'Orbit', value: 'Dawn-dusk sun-synchronous, 96.7°', status: 'published', source: 2 },
      { label: 'Altitude', value: '≈255 km, lowered to 224 km from Aug 2012', status: 'published', source: 1 },
      { label: 'Solar activity', value: 'F10.7 ≈ 70 (2009) rising to ≈130 (2013)', status: 'estimated', note: 'Solar cycle 24 rise.' },
    ],
    checks: [
      {
        label: 'Reentry after the xenon ran out at 224 km',
        metric: 'naturalLifetime',
        observed: 21 * DAY_S,
        observedText: '21 days (fuel out 21 Oct 2013, reentry 11 Nov 2013)',
        source: 1,
        overrides: { altitude_m: 224e3, propellant_kg: 0 },
        f107Range: [110, 160],
        lesson: 'The model reproduces this well: at 224 km a 1-tonne spacecraft falls in about three weeks.',
      },
      {
        label: 'Propellant life holding altitude',
        metric: 'propellantLife',
        observed: 4.6 * YEAR_S,
        observedText: '≈4.6 years (Mar 2009 – Oct 2013)',
        source: 1,
        f107Range: [70, 130],
        lesson:
          'The model predicts a longer life than GOCE achieved, so it underestimates drag or propellant use by roughly ×2. Likely reasons: the final year at 224–235 km (far more drag than at 255 km), a higher effective C_D or area, rising solar activity, and real thruster losses. A reminder that simple models give the right order of magnitude, not the answer.',
      },
    ],
    sources: [
      { title: 'ESA — GOCE: ESA’s Gravity Mission (brochure)', url: 'https://earth.esa.int/eogateway/documents/20142/37627/GOCE-ESAs-Gravity-Mission.pdf' },
      { title: 'ESA — GOCE mission comes to an end (press release, 2013)', url: 'https://www.esa.int/Newsroom/Press_Releases/ESA_s_GOCE_mission_comes_to_an_end' },
      { title: 'Wikipedia — GOCE', url: 'https://en.wikipedia.org/wiki/GOCE' },
      { title: 'Ion thrusters for electric propulsion (Rev. Sci. Instrum., 2020), mission table', url: 'https://pubs.aip.org/aip/rsi/article/91/6/061101/957865/Ion-thrusters-for-electric-propulsion-Scientific' },
      { title: 'TU Delft — Models and GOCE measurements of thermosphere density and wind below 250 km', url: 'https://research.tudelft.nl/en/publications/models-and-goce-measurements-of-thermosphere-density-and-wind-bel/' },
    ],
  },
  {
    id: 'slats',
    name: 'SLATS / Tsubame',
    operator: 'JAXA (Japan)',
    category: 'Government',
    years: '2017–2019',
    altitudeText: '271 → 167 km',
    summary:
      'Super Low Altitude Test Satellite stepped down through ever-lower orbits to test whether an Earth-observation satellite can live in VLEO. It holds the Guinness record for the lowest Earth-observation orbit: 167.4 km, held for seven days. An ion engine handled drag above about 220 km; lower down it needed its chemical thrusters as well.',
    teaches: [
      'Where an ion engine runs out of thrust: drag at 167 km is several times drag at 217 km',
      'Stepping down altitude to characterise drag and atomic oxygen',
      'Hybrid propulsion: electric for efficiency, chemical for the lowest orbits',
    ],
    inputs: {
      altitude_m: 217e3,
      inclination_deg: 98,
      beta_deg: 30,
      cd: 2.2,
      asBuilt: { dryMass_kg: 373, dragArea_m2: 1.0, maxThrust_N: 28e-3 },
      propulsion: 'griddedIon',
      isp_s: 2000,
      efficiency: 0.5,
      propellant_kg: 10,
      f107: 70,
      ap: 6,
    },
    parameters: [
      { label: 'Launch mass', value: '383 kg', status: 'published', source: 0 },
      { label: 'Xenon propellant', value: '10 kg', status: 'published', source: 1 },
      { label: 'Dry mass used', value: '373 kg', status: 'estimated', note: 'Launch mass minus xenon; chemical propellant ignored.' },
      { label: 'Ion engine', value: '10–28 mN, Isp ≈ 2,000 s, 370 W at 10 mN', status: 'published', source: 1 },
      {
        label: 'Drag area',
        value: '≈1.0 m² with C_D 2.2',
        status: 'estimated',
        note: 'Not published; estimated from the body cross-section with arrays edge-on.',
      },
      { label: 'Solar array output', value: '1,140 W (two arrays)', status: 'published', source: 3 },
      { label: 'Orbit', value: 'Sun-synchronous, ≈98°', status: 'estimated', note: 'Typical for its launch; exact value not used by the model.' },
      { label: 'Lowest altitude', value: '167.4 km for 7 days', status: 'published', source: 0 },
      { label: 'Solar activity', value: 'Deep solar minimum, F10.7 ≈ 70', status: 'estimated', note: '2018–2019.' },
    ],
    checks: [
      {
        label: 'Ion engine alone at 217 km',
        metric: 'thrustMargin',
        observed: null,
        observedText: 'Held about 217 km for about a month on the ion engine alone',
        source: 2,
        overrides: { altitude_m: 217e3 },
        f107Range: [70, 75],
        lesson: 'Thrust margin well above 1: the ion engine can hold this altitude, as it did.',
      },
      {
        label: 'Ion engine alone at 181 km',
        metric: 'thrustMargin',
        observed: null,
        observedText: 'Needed chemical thrusters together with the ion engine',
        source: 2,
        overrides: { altitude_m: 181e3 },
        f107Range: [70, 75],
        lesson: 'The model puts the margin near 1 — no room for density swings, consistent with JAXA adding chemical thrust.',
      },
      {
        label: 'Ion engine alone at 167.4 km',
        metric: 'thrustMargin',
        observed: null,
        observedText: 'Ion engine plus chemical thrusters; held for 7 days',
        source: 0,
        overrides: { altitude_m: 167.4e3 },
        f107Range: [70, 75],
        lesson: 'Margin below 1: the ion engine alone cannot hold 167 km. Drag here is about 7× drag at 217 km.',
      },
    ],
    sources: [
      { title: 'JAXA — Guinness record for lowest Earth-observation orbit (press release, 2019)', url: 'https://global.jaxa.jp/press/2019/12/20191224a.html' },
      { title: 'eoPortal — SLATS / Tsubame', url: 'https://www.eoportal.org/satellite-missions/slats' },
      { title: 'Spaceflight Now — Japanese satellite re-enters after experiments in ultra-low orbit (2019)', url: 'https://spaceflightnow.com/2019/10/15/japanese-satellite-re-enters-atmosphere-after-experiments-in-ultra-low-orbit/' },
      { title: 'Wikipedia — Super Low Altitude Test Satellite', url: 'https://en.wikipedia.org/wiki/Super_Low_Altitude_Test_Satellite' },
    ],
  },
  {
    id: 'champ',
    name: 'CHAMP',
    operator: 'GFZ Potsdam (Germany)',
    category: 'Government',
    years: '2000–2010',
    altitudeText: '454 km → reentry',
    summary:
      'CHAllenging Minisatellite Payload measured Earth’s gravity and magnetic field. It had no drag-makeup thruster: it simply decayed, using small cold-gas boosts a few times to raise its orbit. Planned for five years, it lasted more than ten.',
    teaches: [
      'Natural decay over a full solar cycle',
      'Why lifetime predictions need a band, not a number',
      'Small orbit boosts can double a mission',
    ],
    inputs: {
      altitude_m: 454e3,
      inclination_deg: 87.3,
      beta_deg: 30,
      cd: 2.2,
      asBuilt: { dryMass_kg: 522, dragArea_m2: 0.72, maxThrust_N: 0 },
      propulsion: 'coldGas',
      isp_s: 65,
      efficiency: 0.5,
      propellant_kg: 0,
      f107: 150,
      ap: 15,
    },
    parameters: [
      { label: 'Mass', value: '522 kg', status: 'published', source: 0 },
      { label: 'Area-to-mass ratio', value: '0.00138 m²/kg → 0.72 m²', status: 'published', source: 0 },
      { label: 'Drag coefficient', value: '2.2', status: 'estimated', note: 'Standard compact-body value.' },
      { label: 'Length', value: '8.33 m (including boom)', status: 'published', source: 1 },
      { label: 'Initial orbit', value: '≈454 km (sources give 454–460 km), 87°', status: 'published', source: 2 },
      { label: 'Propulsion', value: '40 mN cold gas; used to raise the orbit (2002 ×2, 2006)', status: 'published', source: 3 },
      { label: 'Solar activity', value: 'Solar maximum 2000–02, minimum 2008–09', status: 'published', note: 'Solar cycle 23.' },
    ],
    checks: [
      {
        label: 'Lifetime from 454 km with no thrust',
        metric: 'naturalLifetime',
        observed: 10.2 * YEAR_S,
        observedText: '10.2 years (Jul 2000 – Sep 2010), including orbit boosts',
        source: 1,
        f107Range: [80, 200],
        lesson:
          'Across the solar activity CHAMP saw, the model’s answer changes several-fold — lifetime predictions need a band, not a number. CHAMP’s orbit boosts also added years that a no-thrust model cannot capture.',
      },
    ],
    sources: [
      { title: 'GFZ — CHAMP satellite systems (mass, area-to-mass ratio)', url: 'https://gfz-potsdam.de/en/section/geomagnetism/infrastructure/gfz-satellite-mission-champ/satellite-systems' },
      { title: 'GFZ — CHAMP: a fiery end (2010)', url: 'https://www.gfz.de/en/press/news/details/champ-a-fiery-end' },
      { title: 'Gunter’s Space Page — CHAMP', url: 'https://space.skyrocket.de/doc_sdat/champ.htm' },
      { title: 'GFZ — CHAMP mission orbit', url: 'https://gfz-potsdam.de/en/section/geomagnetism/infrastructure/gfz-satellite-mission-champ/mission-orbit' },
    ],
  },
  {
    id: 'soar',
    name: 'SOAR',
    operator: 'EU DISCOVERER project (University of Manchester)',
    category: 'Academic',
    years: '2021–2022',
    altitudeText: '≈415 km → reentry',
    summary:
      'Satellite for Orbital Aerodynamics Research: a 3U CubeSat released from the International Space Station to test low-drag materials and steer itself with deployable aerodynamic fins. No propulsion — it decayed in about nine months.',
    teaches: [
      'Ballistic coefficient dominates small-satellite lifetime',
      'Aerodynamic attitude control with fins',
      'How uncertain area and attitude make lifetime predictions for small satellites',
    ],
    inputs: {
      altitude_m: 415e3,
      inclination_deg: 51.6,
      beta_deg: 30,
      cd: 2.2,
      asBuilt: { dryMass_kg: 3.355, dragArea_m2: 0.03, maxThrust_N: 0 },
      propulsion: 'coldGas',
      isp_s: 65,
      efficiency: 0.5,
      propellant_kg: 0,
      f107: 100,
      ap: 10,
    },
    parameters: [
      { label: 'Mass', value: '3.355 kg', status: 'published', source: 0 },
      { label: 'Form factor', value: '3U CubeSat (10 × 10 × 30 cm) with deployable fins', status: 'published', source: 1 },
      {
        label: 'Drag area',
        value: '≈0.03 m² (range 0.01–0.05)',
        status: 'estimated',
        note: 'Depends on attitude (end-on 0.01 m², side-on 0.03 m²) and fin deployment.',
      },
      { label: 'Release', value: 'From the ISS, 14–15 June 2021 (≈415 km, 51.6°)', status: 'published', source: 0 },
      { label: 'Reentry', value: 'March 2022', status: 'published', source: 2 },
      { label: 'Solar activity', value: 'Rising, F10.7 ≈ 80–120', status: 'estimated', note: 'Early solar cycle 25.' },
    ],
    checks: [
      {
        label: 'Lifetime from release with no thrust',
        metric: 'naturalLifetime',
        observed: 9 * MONTH_S,
        observedText: '≈9 months (Jun 2021 – Mar 2022)',
        source: 2,
        f107Range: [80, 130],
        lesson:
          'For a 3 kg CubeSat the drag area is the big unknown: fins, attitude changes and tumbling can double it. Lifetime is directly proportional to the ballistic coefficient, so a factor-of-two uncertainty in area is a factor-of-two uncertainty in lifetime. Try a different drag area in Explore.',
      },
    ],
    sources: [
      { title: 'nanosats.eu — SOAR', url: 'https://www.nanosats.eu/sat/soar' },
      { title: 'DISCOVERER — SOAR (Satellite for Orbital Aerodynamics Research)', url: 'https://discoverer.space/?p=2831' },
      { title: 'DISCOVERER: final results and outcomes (IAC 2022)', url: 'https://upcommons.upc.edu/entities/publication/a7ec7272-1f63-475a-ab14-a1b47843aa60' },
    ],
  },
  {
    id: 'starlink-storm',
    name: 'Starlink, February 2022',
    operator: 'SpaceX',
    category: 'Commercial',
    years: 'Feb 2022',
    altitudeText: '≈210 km insertion',
    summary:
      'Forty-nine broadband satellites were released into a deliberately low initial orbit (about 210 km) so that any failures would reenter quickly. A minor geomagnetic storm raised upper-atmosphere density; the satellites were put into a low-drag safe mode but could not climb out, and 38 reentered within days.',
    teaches: [
      'At 210 km there is almost no time: a satellite that cannot thrust falls in days',
      'Even a minor storm matters when thrust margin is thin',
      'The value of a low insertion orbit for debris safety',
    ],
    inputs: {
      altitude_m: 210e3,
      inclination_deg: 53.2,
      beta_deg: 30,
      cd: 2.2,
      asBuilt: { dryMass_kg: 300, dragArea_m2: 0.5, maxThrust_N: 0 },
      propulsion: 'hall',
      isp_s: 1400,
      efficiency: 0.45,
      propellant_kg: 0,
      f107: 130,
      ap: 30,
    },
    parameters: [
      { label: 'Satellites launched / lost', value: '49 / 38', status: 'published', source: 0 },
      { label: 'Insertion altitude', value: '≈210 km (orbit 210–320 km)', status: 'published', source: 1 },
      { label: 'Inclination', value: '53.2°', status: 'estimated', note: 'Shell for that launch group.' },
      { label: 'Mass per satellite', value: '≈260–307 kg (sources vary)', status: 'published', source: 2 },
      { label: 'Body', value: 'Flat panel ≈2.8 × 1.4 × 0.2 m, one large array', status: 'published', source: 2 },
      {
        label: 'Drag area in safe mode',
        value: '≈0.5 m²',
        status: 'estimated',
        note: 'Panel and array turned edge-on to the flow; the exact value is not public.',
      },
      { label: 'Propulsion', value: 'Krypton Hall-effect thrusters', status: 'published', source: 2 },
      { label: 'Storm effect', value: '≈20% density increase at 210 km', status: 'published', source: 3 },
    ],
    checks: [
      {
        label: 'Time to reenter from 210 km without thrust',
        metric: 'naturalLifetime',
        observed: null,
        observedText: 'Most of the 38 reentered within about a week of launch',
        source: 0,
        f107Range: [120, 140],
        lesson:
          'The model gives about ten days with no thrust at all — consistent with satellites that could not raise their orbit. Change Ap in the storm margin to see how little a 20% density rise changes the answer: the real problem is thrust margin, not the storm itself.',
      },
    ],
    sources: [
      { title: 'CIRES — Minor geomagnetic storm, big impact: the February 2022 Starlink loss', url: 'https://cires.colorado.edu/news/minor-geomagnetic-storm-big-impact-february-2022-starlink-satellite-loss' },
      { title: 'Space.com — Geomagnetic storm dooms 40 Starlink satellites', url: 'https://www.space.com/spacex-starlink-satellites-lost-geomagnetic-storm' },
      { title: 'Gunter’s Space Page — Starlink v1.5', url: 'https://space.skyrocket.de/doc_sdat/starlink-v1-5.htm' },
      { title: 'NSF PAR — Space Weather study of the February 2022 event', url: 'https://par.nsf.gov/biblio/10523466' },
    ],
  },
  {
    id: 'clarity-1',
    name: 'Albedo Clarity-1',
    operator: 'Albedo Space',
    category: 'Commercial',
    years: '2025–2026',
    altitudeText: '≈510 → 320 km',
    summary:
      'A 530 kg commercial imaging satellite built specifically for VLEO. Released by a rideshare at about 510 km, it descended under its own propulsion toward its operating orbit. It measured drag 12% better than its design target, but lost two of its four control-moment gyroscopes and stopped responding after nine months. It reentered on 10 June 2026.',
    teaches: [
      'The rideshare-then-descend route into VLEO',
      'VLEO risks are not only drag: attitude-control hardware ended this mission',
      'What a five-year life at 275 km demands in propellant',
    ],
    inputs: {
      altitude_m: 320e3,
      inclination_deg: 97.4,
      beta_deg: 30,
      cd: 2.2,
      asBuilt: { dryMass_kg: 510, dragArea_m2: 1.0, maxThrust_N: 15e-3 },
      propulsion: 'hall',
      isp_s: 1400,
      efficiency: 0.45,
      propellant_kg: 20,
      f107: 150,
      ap: 15,
    },
    parameters: [
      { label: 'Mass', value: '≈530 kg (one source: 580 kg)', status: 'published', source: 1 },
      { label: 'Size', value: '≈3 m tall, 1 m wide', status: 'published', source: 0 },
      { label: 'Launch', value: 'Transporter-13 rideshare, 15 Mar 2025 (UTC), ≈510 km', status: 'published', source: 1 },
      { label: 'Operating altitude', value: '≈320 km; drag measured at 350–380 km', status: 'published', source: 2 },
      { label: 'Drag vs design', value: 'C_D 12% better than target', status: 'published', source: 2 },
      { label: 'Design goal', value: '5-year life at 275 km', status: 'published', source: 2 },
      { label: 'Propulsion', value: 'Hall-effect thruster (single secondary source)', status: 'estimated', note: 'Thrust, Isp and propellant mass are not public; Hall class defaults used.' },
      { label: 'Drag area, propellant', value: '≈1 m², 20 kg', status: 'estimated', note: 'Not public; from the 1 m width and a typical propellant fraction.' },
      { label: 'End of mission', value: 'Contact lost after ≈9 months (CMG failures); reentry 10 Jun 2026', status: 'published', source: 2 },
    ],
    checks: [
      {
        label: 'Propellant needed for 5 years at 275 km',
        metric: 'propellantNeeded',
        observed: null,
        observedText: 'Albedo’s design goal: 5 years at 275 km',
        source: 2,
        overrides: { altitude_m: 275e3 },
        f107Range: [80, 180],
        duration_s: 5 * YEAR_S,
        lesson:
          'The answer swings by a factor of several with solar activity — which is why VLEO operators plan around the solar cycle. Try other propulsion classes in Explore to see how Isp changes the tank size.',
      },
    ],
    sources: [
      { title: 'eoPortal — Clarity (Albedo Space)', url: 'https://www.eoportal.org/satellite-missions/clarity' },
      { title: 'NASASpaceFlight — SpaceX launches Transporter-13', url: 'https://nasaspaceflight.com/2025/03/t13/' },
      { title: 'Albedo — Clarity-1: what worked, and where we go next', url: 'https://albedo.com/post/clarity-1-what-worked-and-where-we-go-next' },
      { title: 'Wikipedia — Albedo Space', url: 'https://en.wikipedia.org/wiki/Albedo_Space' },
    ],
  },
]
