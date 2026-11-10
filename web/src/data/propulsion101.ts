// Propulsion 101: plain-language primer for readers with a space background but new to propulsion.
// Typical numbers on the cards come from the model presets (model/propulsion.ts) so they never drift.
// Ranges for the overview chart are public "state of the art" ranges for small spacecraft.

import type { PropulsionClass } from '../model/propulsion'

export interface Concept {
  title: string
  equation?: string
  text: string
}

export const CONCEPTS: Concept[] = [
  {
    title: 'Chemical or electric',
    text: 'Chemical thrusters get their energy from the propellant itself: high thrust (newtons) but modest exhaust speed. Electric thrusters use electricity from the solar arrays to accelerate charged particles: tiny thrust (micro- to millinewtons) but exhaust many times faster. In VLEO, where drag never stops, that efficiency is what makes multi-year missions possible.',
  },
  {
    title: 'Specific impulse (Isp)',
    equation: 'v_exhaust = g₀ · Isp;  ṁ = T / (g₀ · Isp)',
    text: 'Isp measures how much push you get per kilogram of propellant. Double the Isp and you need half the propellant for the same total impulse. Cold gas ~65 s, monopropellant ~220 s, bipropellant ~300–320 s, electric from ~800 s to over 4,000 s.',
  },
  {
    title: 'Thrust per watt: the price of Isp',
    equation: 'T / P = 2η / (g₀ · Isp)',
    text: 'At a fixed power, higher Isp means less thrust. So high-Isp thrusters save propellant but need more power — bigger solar arrays, which in VLEO add mass and drag. Efficiency η (jet power ÷ electrical power) is far lower for small thrusters than for large ones.',
  },
  {
    title: 'Total impulse and wear',
    equation: 'I = T · t',
    text: 'Total impulse is thrust × time: the whole job a thruster must do. Holding 300 km with a ~60 kg satellite takes about 0.15–1 mN continuously depending on solar activity (~0.5 mN typical): roughly 5–30 kN·s per year. Every thruster wears out after some total impulse; if that rating is small, a long mission needs many units.',
  },
  {
    title: 'Why VLEO is different',
    equation: 'propellant per year = D / (g₀ · Isp) × 1 year',
    text: 'Most missions use propulsion occasionally. In VLEO the thruster works continuously to cancel drag, and drag grows exponentially as you go lower. That rewards high Isp (less propellant), high thrust per watt (smaller arrays), long wear life, and the ability to run at whatever power the spacecraft can spare.',
  },
]

export interface Reading {
  title: string
  url: string
}

export interface TechCard {
  /** A model technology class, or an emerging concept not yet in the model. */
  id: PropulsionClass | 'airBreathing'
  name: string
  oneLiner: string
  howItWorks: string
  propellant: string
  strengths: string[]
  weaknesses: string[]
  /** Where it fits in VLEO, consistent with what the app's model shows. */
  vleoFit: string
  heritage: string
  maturity: string
  /** Public state-of-the-art ranges for the at-a-glance chart (null if not charted). */
  ispRange_s: [number, number] | null
  thrustRange_N: [number, number] | null
  reading: Reading[]
}

const NASA_SST: Reading = {
  title: 'NASA Small Spacecraft Technology State of the Art — In-Space Propulsion',
  url: 'https://www.nasa.gov/smallsat-institute/sst-soa/in-space_propulsion',
}
const GOEBEL: Reading = {
  title: 'Goebel & Katz, Fundamentals of Electric Propulsion: Ion and Hall Thrusters (JPL, free PDF)',
  url: 'https://descanso.jpl.nasa.gov/SciTechBook/series1/Goebel__cmprsd_opt.pdf',
}
const EP_REVIEW: Reading = {
  title: 'Electric propulsion for small satellites: a review (Aerospace, 2021)',
  url: 'https://www.mdpi.com/2226-4310/8/1/22',
}

export const TECH_CARDS: TechCard[] = [
  {
    id: 'coldGas',
    name: 'Cold gas',
    oneLiner: 'Stored gas released through a nozzle. The simplest thruster there is.',
    howItWorks:
      'A tank holds gas (nitrogen, or a liquefied gas such as butane) under pressure. Opening a valve lets it expand through a small nozzle. No combustion, no electricity beyond the valve.',
    propellant: 'Nitrogen, butane or similar, in a pressurised tank.',
    strengths: ['Very simple and safe', 'Instant, precise small impulses', 'Low cost and power'],
    weaknesses: ['Lowest Isp of all (~65 s): propellant runs out fast', 'Heavy pressure tanks'],
    vleoFit:
      'Useful for attitude control or a small manoeuvre, but far too propellant-hungry to cancel drag for long. In the app it at most ties for very short missions of a few months.',
    heritage: 'Widely flown on small satellites and CubeSats for attitude control and small manoeuvres.',
    maturity: 'Mature.',
    ispRange_s: [40, 110],
    thrustRange_N: [1e-5, 3.6],
    reading: [NASA_SST],
  },
  {
    id: 'monoprop',
    name: 'Monopropellant (green)',
    oneLiner: 'A single liquid propellant decomposed over a hot catalyst.',
    howItWorks:
      'Liquid propellant flows from a tank into a heated catalyst bed, where it decomposes into hot gas that expands through a nozzle. "Green" propellants (such as AF-M315E or LMP-103S) replace toxic hydrazine and perform slightly better.',
    propellant: 'Green monopropellant in a blowdown tank (hydrazine on older spacecraft).',
    strengths: ['High thrust (newtons) for fast manoeuvres', 'Needs almost no electrical power', 'Mature and well understood'],
    weaknesses: ['Isp ~220 s: about 4–16× more propellant than the electric options for the same job', 'Catalyst preheating; propellant handling'],
    vleoFit:
      'Because it needs no power, it closes where electric designs cannot generate enough power to beat drag: below about 200 km (for a ~60 kg spacecraft) only chemical options work, and monopropellant wins every mission there. Higher up it often wins or ties short missions of a year or less. JAXA’s SLATS used chemical thrusters alongside its ion engine to reach 167 km.',
    heritage: 'Hydrazine on thousands of spacecraft; green propellants flown on PRISMA (2010) and NASA’s Green Propellant Infusion Mission (2019).',
    maturity: 'Mature (hydrazine); flight-proven (green).',
    ispRange_s: [150, 310],
    thrustRange_N: [0.05, 28],
    reading: [NASA_SST],
  },
  {
    id: 'electrospray',
    name: 'Electrospray (ionic liquid)',
    oneLiner: 'A strong electric field pulls ions, and in some designs tiny charged droplets, out of a liquid salt at microscopic emitter tips.',
    howItWorks:
      'An ionic liquid — a salt that is liquid at room temperature — wets thousands of sharp emitter tips held at high voltage relative to a nearby extractor grid. The field pulls the liquid into tiny cones (Taylor cones) whose tips emit a beam of charged particles, accelerated through about 1–2 kV (kilovolts; several kV in older designs). Ion-only ("pure-ion") beams reach about 3,000–4,000 s, but practical small chips measure about 600–1,500 s after losses; designs that also emit droplets (the older "colloid" thrusters) run at about 150–250 s and give more thrust per watt. Because the liquid holds both positive and negative ions, many designs avoid a separate neutraliser by alternating polarity or pairing positive and negative emitters. Thrust is set by the voltage and the number of emitters, so systems scale by adding chips or modules.',
    propellant: 'Ionic liquid, unpressurised; often held inside the thruster module itself.',
    strengths: [
      'No pressurised tank, no gas feed system',
      'Scales down well: tiny modules, very low minimum power',
      'Good thrust per watt (~48 µN/W in the app, at system level including power electronics) and very precise, throttleable thrust',
    ],
    weaknesses: [
      'Low thrust: single emitter heads give ~0.005–0.1 mN, so mN-level thrust needs many heads or modules (the app uses 0.15 mN per module)',
      'Emitter wear is the least certain number: public life tests ran from about a hundred hours (ion-mode chips) to a few thousand (droplet-mode heads on ST7: ~2,400 h in flight on LISA Pathfinder), and several stopped before wearing out. The app uses 300 N·s per module (~560 h at rated thrust) and shows a 50–2,000 N·s band; the top end comes only from droplet-mode heritage',
    ],
    vleoFit:
      'In the app (300 N·s per module) it is the clear lightest choice for CubeSat-class spacecraft at about 280–450 km on missions of a few months to about two years, and ties for lightest on many other CubeSat cases and on short missions of larger spacecraft above about 320 km. Longer missions need many modules, and FEEP or Hall take over. These results hinge on wear life, the least certain number: try the 50–2,000 N·s band with the wear-life what-if on the Propulsion trade tab.',
    heritage: 'Colloid (electrospray) micro-thrusters flew as NASA’s ST7 experiment on LISA Pathfinder (2015–2017); AeroCube-8 (2015–16) carried ion-electrospray thrusters for a CubeSat demonstration, with little flight data published; several CubeSat demonstrations since.',
    maturity: 'Flight-demonstrated; lifetime is the active development area.',
    ispRange_s: [150, 4000],
    thrustRange_N: [1e-5, 1.5e-3],
    reading: [NASA_SST, EP_REVIEW],
  },
  {
    id: 'feep',
    name: 'FEEP (field-emission electric propulsion)',
    oneLiner: 'Like electrospray, but the liquid is a molten metal.',
    howItWorks:
      'A metal such as indium is heated until it melts and wets a sharp emitter (needle or crown). A strong field extracts and accelerates metal ions to very high speed. A separate neutraliser emits electrons so the spacecraft does not charge up.',
    propellant: 'Indium, solid at launch, melted in an integrated reservoir.',
    strengths: ['Very high Isp (thousands of seconds): least propellant', 'Compact, integrated units', 'Very fine thrust control'],
    weaknesses: ['Low thrust per watt at small scale (~9 µN/W, including heaters)', 'Heater power even in standby', 'Low thrust per unit'],
    vleoFit:
      'Its high Isp pays off on long missions high in the VLEO band, where drag — and so the power needed — is small. Lower down, its appetite for power (arrays, mass, drag) makes it uncompetitive.',
    heritage: 'Hundreds of commercial units delivered and flown on small satellites since about 2018.',
    maturity: 'Flight-proven on small satellites.',
    ispRange_s: [1500, 6000],
    thrustRange_N: [1e-6, 1e-3],
    reading: [NASA_SST, EP_REVIEW],
  },
  {
    id: 'griddedIon',
    name: 'Gridded ion',
    oneLiner: 'A plasma is created in a chamber and its ions are accelerated through electrically charged grids.',
    howItWorks:
      'Gas (xenon, or iodine on some small systems) is ionised inside a discharge chamber. Two or three closely spaced grids at high voltage extract the ions and accelerate them into a beam. A neutraliser cathode adds electrons to the beam.',
    propellant: 'Xenon in a high-pressure tank, or solid iodine.',
    strengths: ['High Isp and, at large scale, the highest efficiency', 'Long flight heritage on science missions'],
    weaknesses: ['Low efficiency at small scale (~19 µN/W at 50–75 W)', 'Grid erosion limits life', 'Complex power electronics'],
    vleoFit:
      'Flew the classic VLEO mission, GOCE, at sub-kilowatt scale (1–20 mN). On small spacecraft its low thrust per watt means large arrays, so in the app it competes mainly for long missions higher in the band.',
    heritage: 'GOCE (drag-free at 255–224 km, 2009–13), Hayabusa, Dawn, BepiColombo; JAXA’s SLATS; an iodine ion thruster flew on a small satellite in 2020.',
    maturity: 'Mature at large scale; flight-proven at small scale.',
    ispRange_s: [500, 3000],
    thrustRange_N: [1e-4, 0.02],
    reading: [GOEBEL, NASA_SST],
  },
  {
    id: 'hall',
    name: 'Hall effect (xenon)',
    oneLiner: 'Electrons trapped by a magnetic field ionise gas, and the resulting electric field accelerates the ions.',
    howItWorks:
      'Gas is fed through the anode at the back of a ring-shaped channel. A radial magnetic field traps electrons from an external cathode, making them circle the channel (the Hall current). They ionise the gas, and the axial electric field along the channel accelerates the ions out. There are no grids.',
    propellant: 'Xenon in a high-pressure tank.',
    strengths: ['Best thrust per watt of the electric options (~59 µN/W at small scale)', 'High thrust density', 'Very large flight heritage'],
    weaknesses: ['Needs a minimum power (~75 W for the smallest units): heavy for tiny spacecraft', 'Efficiency falls at low power', 'Channel erosion'],
    vleoFit:
      'Its thrust per watt makes it strong where drag is high: in the app it wins multi-year missions around 250–300 km on 50–250 kg spacecraft (often as a near-tie). On CubeSats it still wins low down (about 225–275 km), where it is often the only electric option that closes, but above about 275 km its minimum power and fixed mass let lighter options win.',
    heritage: 'Many geostationary communication satellites; ESA’s SMART-1 lunar mission (2003); widely used on small satellites and LEO constellations (Starlink uses Hall thrusters on krypton and argon — see the next card).',
    maturity: 'Mature.',
    ispRange_s: [800, 1900],
    thrustRange_N: [2.5e-4, 0.055],
    reading: [GOEBEL, NASA_SST],
  },
  {
    id: 'hallKrypton',
    name: 'Hall effect (krypton)',
    oneLiner: 'The same Hall thruster running on krypton: much cheaper propellant, some performance cost.',
    howItWorks:
      'Identical in principle to a xenon Hall thruster. Krypton is lighter and harder to ionise, so it gives slightly higher Isp but lower efficiency, and it is stored at about a third of xenon’s density.',
    propellant: 'Krypton in a high-pressure tank (larger and heavier per kg than xenon).',
    strengths: ['Propellant costs a fraction of xenon’s', 'Higher Isp than xenon at the same voltage'],
    weaknesses: ['Lower efficiency, especially at small scale (~39 µN/W)', 'Bigger, heavier tanks', 'Faster erosion'],
    vleoFit: 'Close to xenon Hall on mass in the app at 275 km and above; lower down its lower efficiency makes it 40–70% heavier. Its real advantage is propellant cost for large constellations, which the app does not yet model.',
    heritage: 'Starlink satellites (krypton, later argon).',
    maturity: 'Flight-proven at constellation scale.',
    ispRange_s: null,
    thrustRange_N: null,
    reading: [NASA_SST],
  },
  {
    id: 'rfPlasma',
    name: 'RF / ambipolar plasma',
    oneLiner: 'Radio waves make a plasma, and a diverging magnetic field pushes it out like a nozzle.',
    howItWorks:
      'Gas flows through a tube wrapped by an antenna that drives radio-frequency power into it, creating a plasma. A magnetic field that spreads out at the exit (a "magnetic nozzle") converts the plasma’s energy into directed flow. Nothing touches the plasma, so there are no electrodes to erode.',
    propellant: 'Xenon, krypton, argon or iodine.',
    strengths: ['No electrodes: potentially very long life', 'Flexible on propellant'],
    weaknesses: ['Low efficiency at small scale today (~31 µN/W)', 'Limited flight heritage; flight units range from about 50 W to about 500 W'],
    vleoFit:
      'In the app its low efficiency keeps it from winning on small spacecraft. Its lack of electrodes to wear out could matter more as missions get longer, and it is the basis of several air-breathing concepts.',
    heritage: 'First commercial flights on small satellites in 2021, including an iodine plasma thruster at about 30–60 W.',
    maturity: 'Early flight heritage.',
    ispRange_s: [400, 1100],
    thrustRange_N: [5e-4, 0.017],
    reading: [NASA_SST],
  },
  {
    id: 'airBreathing',
    name: 'Air-breathing electric (emerging)',
    oneLiner: 'Scoop up the thin air the satellite flies through and use it as propellant.',
    howItWorks:
      'A forward-facing intake collects atmospheric particles, mostly atomic oxygen and molecular nitrogen (N₂), compresses them, and feeds them to an electric thruster (often RF-based) that ionises and accelerates them. If thrust exceeds drag, the satellite could stay up indefinitely without carrying propellant.',
    propellant: 'The atmosphere itself.',
    strengths: ['No propellant limit: life set by hardware, not tanks', 'Works best exactly where drag is worst'],
    weaknesses: ['Unproven in flight', 'Intake efficiency and high power needs', 'Works only in a narrow altitude band'],
    vleoFit: 'The long-term rival to stored-propellant systems. The app will add it as a clearly labelled what-if.',
    heritage: 'Ground demonstrations (an ESA-backed test in 2018); DARPA’s Otter programme and several start-ups are working toward flight.',
    maturity: 'Laboratory and ground test.',
    ispRange_s: null,
    thrustRange_N: null,
    reading: [
      {
        title: 'A review of air-breathing electric propulsion (Journal of Electric Propulsion, 2022)',
        url: 'https://link.springer.com/article/10.1007/s44205-022-00024-9',
      },
    ],
  },
]
