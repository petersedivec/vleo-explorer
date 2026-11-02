// Explanations for every input: what it is, typical values, what it drives, and why it matters.
// Edit freely: this file is plain content. `affects` lists result-card ids (see outputs.ts) to highlight.

export interface InputInfo {
  title: string
  what: string
  typical: string
  drives: string[]
  insight: string
  reference?: string
  affects: string[]
}

export type InfoKey =
  | 'altitude'
  | 'inclination'
  | 'beta'
  | 'solarActivity'
  | 'atmosphereModel'
  | 'stormMargin'
  | 'payloadMass'
  | 'payloadPower'
  | 'cd'
  | 'arrays'
  | 'technology'
  | 'isp'
  | 'efficiency'
  | 'propellant'
  | 'designLife'
  | 'thrustInEclipse'

export const INPUT_INFO: Record<InfoKey, InputInfo> = {
  altitude: {
    title: 'Altitude',
    what: 'Height of the circular orbit above the equator. VLEO is roughly 150–450 km; most of the International Space Station’s life has been near 400–420 km.',
    typical: 'GOCE flew at 255–224 km; JAXA’s SLATS reached 167 km; many VLEO concepts target 200–350 km.',
    drives: [
      'Air density and drag: exponential — about ×2.7 for every scale height (20–60 km) you descend',
      'Thruster power, array size and propellant use: follow drag, so also exponential',
      'Lifetime with no thrust: exponential the other way — days at 200 km, years at 500 km',
      'Imaging resolution and radio link strength: improve only linearly or as a square',
    ],
    insight: 'The central VLEO trade: mission benefits improve polynomially as you go lower, but the cost of staying there grows exponentially. Somewhere is a sweet spot, and it moves with everything else.',
    reference: 'Vallado, Fundamentals of Astrodynamics, ch. 8',
    affects: ['density', 'scaleHeight', 'speed', 'eclipse', 'drag', 'thrusterPower', 'propPerYear', 'missionLife', 'naturalLifetime', 'disposal', 'heat', 'oxygen', 'dryMass', 'arrayArea', 'loopGain'],
  },
  inclination: {
    title: 'Inclination',
    what: 'Tilt of the orbit plane to the equator. It sets the highest latitude the satellite flies over. 97–98° is sun-synchronous (the orbit keeps the same local time).',
    typical: '53° (many broadband shells), 51.6° (ISS), ~97° (Earth observation, sun-synchronous).',
    drives: [
      'Air density, slightly: high-inclination orbits spend time over the poles, where the upper atmosphere differs',
      'Later versions: which latitudes get coverage, and how fast the orbit plane drifts',
    ],
    insight: 'Small effect on drag; large effect on what a constellation can see. Matters most once we add coverage and revisit.',
    reference: 'NRLMSIS 2.1 atmosphere model, orbit-averaged by latitude',
    affects: ['density', 'drag', 'missionLife', 'naturalLifetime'],
  },
  beta: {
    title: 'Sun angle to orbit plane (β)',
    what: 'Angle between the orbit plane and the direction to the Sun. At β = 0 the Sun is in the orbit plane, so the satellite crosses Earth’s shadow every orbit for the longest time.',
    typical: '0° is the worst case for most orbits. Dawn-dusk sun-synchronous orbits sit near 60–90°, but in VLEO still see eclipse seasons.',
    drives: [
      'Eclipse fraction: about 40% of each orbit at 300 km when β = 0; none above about 73° at 300 km',
      'Solar array size: arrays must also charge batteries for eclipse loads',
    ],
    insight: 'Low orbits see a wider Earth shadow. Less eclipse means smaller arrays, which means less drag — one reason dawn-dusk orbits are popular for radar satellites.',
    reference: 'Wertz et al., Space Mission Engineering (SMAD), ch. 5',
    affects: ['eclipse', 'arrayArea', 'dryMass', 'dragArea', 'thrusterPower', 'loopGain'],
  },
  solarActivity: {
    title: 'Solar activity',
    what: 'The Sun’s ultraviolet output heats and puffs up the upper atmosphere over the 11-year solar cycle. Measured by the F10.7 radio flux (70 at solar minimum, 150 moderate, 250 at maximum).',
    typical: 'Solar maximum around 2024–25; next minimum expected around 2030.',
    drives: [
      'Air density: about ×2 at 200 km from minimum to maximum, rising to over ×20 at 450 km',
      'Everything drag-driven: thruster power, propellant use, mission life, natural lifetime',
    ],
    insight: 'Counter-intuitively, the solar cycle matters more the higher you fly. Launch date is a design parameter: the same satellite can last several times longer at solar minimum.',
    reference: 'NRLMSIS 2.1 (Emmert et al., 2021)',
    affects: ['density', 'scaleHeight', 'drag', 'propPerYear', 'missionLife', 'naturalLifetime', 'disposal', 'oxygen', 'heat'],
  },
  atmosphereModel: {
    title: 'Atmosphere model',
    what: 'NRLMSIS 2.1 is the US Naval Research Laboratory’s empirical model, averaged around the orbit and sensitive to solar activity. The exponential model is the classic textbook table: one fixed atmosphere.',
    typical: 'Use NRLMSIS for results; use exponential to compare with textbook problems.',
    drives: ['Air density and everything that depends on it'],
    insight: 'The textbook table matches NRLMSIS at moderate activity but cannot show the solar cycle — which is often the biggest uncertainty in VLEO.',
    reference: 'Vallado Table 8-4; Emmert et al., Earth and Space Science, 2021',
    affects: ['density', 'scaleHeight', 'drag', 'missionLife', 'naturalLifetime'],
  },
  stormMargin: {
    title: 'Storm margin on density',
    what: 'Geomagnetic storms can raise upper-atmosphere density several-fold within hours. The thruster and power system are sized to cope with density this many times the nominal value.',
    typical: '×2–5. In February 2022 a storm raised drag on a batch of newly launched Starlink satellites at about 210 km; 38 of 49 reentered.',
    drives: [
      'Thruster size and power, array area and mass (sized for the storm)',
      'The lowest altitude at which any design closes',
    ],
    insight: 'Margin costs mass and drag every day to survive a few days a year. Too little margin, and one storm can end the mission.',
    affects: ['thrusterPower', 'thrusterUnits', 'arrayArea', 'dryMass', 'dragArea', 'loopGain'],
  },
  payloadMass: {
    title: 'Payload mass',
    what: 'Mass of the mission instrument — camera, radar or communications antenna. The rest of the spacecraft is sized around it.',
    typical: 'A few kg (CubeSat camera) to hundreds of kg (high-resolution telescope or large radar).',
    drives: ['Dry mass (through structure and bus)', 'Body size, so frontal area and drag', 'Ballistic coefficient and natural lifetime'],
    insight: 'Heavier spacecraft are not penalised much by drag: drag depends on area, while resistance to drag grows with mass. Dense spacecraft decay more slowly.',
    affects: ['dryMass', 'dragArea', 'ballistic', 'drag', 'thrusterPower', 'naturalLifetime', 'disposal'],
  },
  payloadPower: {
    title: 'Payload power',
    what: 'Average electrical power the instrument draws.',
    typical: 'Tens of watts (small camera) to kilowatts (radar, direct-to-device antennas).',
    drives: ['Solar array area — which adds drag and mass', 'Competes with the thruster for power'],
    insight: 'Power-hungry payloads make VLEO harder twice: bigger arrays add drag, and the thruster has less power to cancel it.',
    affects: ['arrayArea', 'dryMass', 'dragArea', 'drag', 'thrusterPower', 'loopGain'],
  },
  cd: {
    title: 'Drag coefficient C_D',
    what: 'How effectively the spacecraft shape and surfaces convert oncoming air into drag. In VLEO the air is so thin that molecules hit surfaces individually (free-molecular flow), so C_D depends on surface material and shape.',
    typical: '2.2 for compact bodies; 2.4–2.6 for flat plates and long bodies. Panel-method tools such as ADBSat compute it from the geometry.',
    drives: ['Drag, linearly', 'Ballistic coefficient and natural lifetime, inversely'],
    insight: 'Low-drag shapes and surface coatings that reflect molecules more specularly are active VLEO research — a few percent of C_D is a few percent of propellant.',
    reference: 'Mostaza-Prieto et al. (ADBSat), Computer Physics Communications, 2022',
    affects: ['drag', 'ballistic', 'thrusterPower', 'propPerYear', 'missionLife', 'naturalLifetime', 'loopGain'],
  },
  arrays: {
    title: 'Solar arrays',
    what: 'Edge-on arrays lie parallel to the airflow (like GOCE’s fixed wings). Sun-tracking arrays rotate to face the Sun, so they swing broadside to the airflow for part of each orbit.',
    typical: 'Edge-on: drag factor ≈ 0.07 of array area, but less power per m². Sun-tracking: ≈ 0.71 of array area, full power.',
    drives: ['Drag area', 'Array size needed for the same power', 'Whether any design closes at low altitude'],
    insight: 'The single biggest design lever in VLEO. Sun-tracking arrays generate more power per m² but create so much drag that below about 200 km the extra power cannot pay for the drag it causes.',
    reference: 'Free-molecular flat-plate theory; SMAD ch. 21',
    affects: ['dragArea', 'arrayArea', 'drag', 'thrusterPower', 'loopGain', 'missionLife', 'ballistic'],
  },
  technology: {
    title: 'Propulsion technology',
    what: 'Class of thruster used to cancel drag. Choosing one loads typical specific impulse and efficiency; both remain adjustable.',
    typical: 'Cold gas and monopropellant: high thrust, low Isp. Electric (electrospray, FEEP, gridded ion, Hall, RF plasma): low thrust, high Isp, needs electrical power.',
    drives: ['Propellant use per year', 'Thruster power and array size', 'Mission life'],
    insight: 'There is no best thruster, only best for a given altitude, life and power budget. The Propulsion trade tab (coming in v1.3) maps where each one wins.',
    reference: 'NASA Small Spacecraft Technology State of the Art, In-Space Propulsion',
    affects: ['thrusterPower', 'thrusterUnits', 'propPerYear', 'missionLife', 'limitedBy', 'arrayArea', 'dryMass', 'loopGain'],
  },
  isp: {
    title: 'Specific impulse (Isp)',
    what: 'How much thrust you get per unit of propellant flow, in seconds. Exhaust speed = Isp × 9.81 m/s.',
    typical: 'Cold gas ~65 s; monopropellant ~220 s; Hall ~1,400 s; electrospray ~1,500 s (range 225–3,000+); gridded ion ~2,500 s; FEEP ~4,000 s.',
    drives: [
      'Propellant use: inversely — double Isp, half the propellant',
      'Thruster power for the same thrust: proportionally — double Isp, double the power',
    ],
    insight: 'The core electric-propulsion trade. High Isp saves propellant but needs more power, so bigger arrays, so more drag. In VLEO the optimum Isp depends on altitude.',
    reference: 'Goebel & Katz, Fundamentals of Electric Propulsion, ch. 2',
    affects: ['propPerYear', 'missionLife', 'thrusterPower', 'arrayArea', 'dryMass', 'dragArea', 'loopGain'],
  },
  efficiency: {
    title: 'Thruster efficiency η',
    what: 'Fraction of electrical input power that ends up as kinetic energy in the exhaust. Together with Isp it sets thrust per watt: T/P = 2η / (g₀·Isp).',
    typical: '0.25 (small RF plasma) to 0.6 (gridded ion); Hall ~0.45; electrospray ~0.5–0.6.',
    drives: ['Thruster power, inversely', 'Array area, mass and drag through the power'],
    insight: 'Thrust per watt (µN/W, shown next to the slider) is derived, not chosen: you cannot have high Isp and high thrust per watt without high efficiency.',
    reference: 'Goebel & Katz, ch. 2',
    affects: ['thrusterPower', 'arrayArea', 'dryMass', 'dragArea', 'loopGain'],
  },
  propellant: {
    title: 'Propellant',
    what: 'Propellant mass loaded at launch.',
    typical: 'GOCE carried about 40 kg of xenon for a ~1,000 kg spacecraft.',
    drives: ['Propellant-limited life, linearly', 'Wet mass and ballistic coefficient'],
    insight: 'At constant altitude, propellant use depends only on drag and Isp — not on spacecraft mass. Life = propellant × g₀ × Isp ÷ drag.',
    affects: ['missionLife', 'limitedBy', 'ballistic', 'naturalLifetime'],
  },
  designLife: {
    title: 'Design life',
    what: 'How long the spacecraft hardware is built to last — batteries, electronics, thruster wear — regardless of propellant.',
    typical: '1–3 years for small or low-cost satellites; 5–7 years for larger ones.',
    drives: ['Mission life, as an upper cap'],
    insight: 'Carrying more propellant than the hardware can use is wasted mass. Good designs balance propellant life with design life.',
    affects: ['missionLife', 'limitedBy'],
  },
  thrustInEclipse: {
    title: 'Thrust in eclipse',
    what: 'If on, batteries power the thruster in Earth’s shadow so it can fire all orbit. If off, it fires only in sunlight and must push harder to cancel the same average drag.',
    typical: 'Most drag-makeup designs thrust continuously; some small satellites fire only in sunlight to save battery mass.',
    drives: ['Thrust needed while firing', 'Array size (eclipse energy must be stored)'],
    insight: 'Sunlight-only thrusting needs a bigger thruster but smaller batteries. With long eclipses at low altitude, the trade shifts.',
    affects: ['thrusterPower', 'thrusterUnits', 'arrayArea', 'dryMass', 'loopGain'],
  },
}
