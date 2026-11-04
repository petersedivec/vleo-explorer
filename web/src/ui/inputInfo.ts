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
  | 'mode'
  | 'asBuiltMass'
  | 'asBuiltArea'
  | 'maxThrust'
  | 'coverage'
  | 'offNadir'
  | 'revisit'
  | 'passes'
  | 'minElevation'
  | 'latitudeMax'
  | 'payloadExponent'

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
    affects: ['density', 'scaleHeight', 'speed', 'eclipse', 'drag', 'thrusterPower', 'propPerYear', 'missionLife', 'naturalLifetime', 'disposal', 'heat', 'oxygen', 'dryMass', 'arrayArea', 'loopGain', 'decayRate', 'thrustMargin'],
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
    affects: ['density', 'scaleHeight', 'drag', 'propPerYear', 'missionLife', 'naturalLifetime', 'disposal', 'oxygen', 'heat', 'decayRate', 'thrustMargin'],
  },
  atmosphereModel: {
    title: 'Atmosphere model',
    what: 'NRLMSIS 2.1 is the US Naval Research Laboratory’s empirical model, averaged around the orbit and sensitive to solar activity. The exponential model is the classic textbook table: one fixed atmosphere.',
    typical: 'Use NRLMSIS for results; use exponential to compare with textbook problems.',
    drives: ['Air density and everything that depends on it'],
    insight: 'The textbook table matches NRLMSIS at moderate activity but cannot show the solar cycle — which is often the biggest uncertainty in VLEO.',
    reference: 'Vallado Table 8-4; Emmert et al., Earth and Space Science, 2021',
    affects: ['density', 'scaleHeight', 'drag', 'missionLife', 'naturalLifetime', 'decayRate', 'thrustMargin'],
  },
  stormMargin: {
    title: 'Storm margin on density',
    what: 'Geomagnetic storms heat and expand the upper atmosphere within hours. The relative rise grows with altitude: tens of percent near 200 km, up to several-fold at 400 km and above. The thruster and power system are sized to cope with density this many times the nominal value.',
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
    affects: ['dryMass', 'dragArea', 'ballistic', 'drag', 'thrusterPower', 'naturalLifetime', 'disposal', 'decayRate'],
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
    reference: 'Sinpetru et al. (ADBSat), Computer Physics Communications, 2022',
    affects: ['drag', 'ballistic', 'thrusterPower', 'propPerYear', 'missionLife', 'naturalLifetime', 'loopGain', 'decayRate', 'thrustMargin'],
  },
  arrays: {
    title: 'Solar arrays',
    what: 'Edge-on arrays lie parallel to the airflow (like GOCE’s fixed wings). Sun-tracking arrays rotate to face the Sun, so they swing broadside to the airflow for part of each orbit.',
    typical: 'Edge-on: drag factor ≈ 0.07 of array area, but less power per m². Sun-tracking: ≈ 0.71 of array area, full power.',
    drives: ['Drag area', 'Array size needed for the same power', 'Whether any design closes at low altitude'],
    insight: 'The single biggest design lever in VLEO. Sun-tracking arrays generate more power per m² but create so much drag that at low altitude the extra power cannot pay for the drag it causes. With the default spacecraft and storm margin, sun-tracking designs stop closing around 265 km, edge-on designs around 200 km.',
    reference: 'Free-molecular flat-plate theory; SMAD ch. 21',
    affects: ['dragArea', 'arrayArea', 'drag', 'thrusterPower', 'loopGain', 'missionLife', 'ballistic'],
  },
  technology: {
    title: 'Propulsion technology',
    what: 'Class of thruster used to cancel drag. Choosing one loads typical specific impulse and efficiency; both remain adjustable.',
    typical: 'Cold gas and monopropellant: high thrust, low Isp. Electric (electrospray, FEEP, gridded ion, Hall, RF plasma): low thrust, high Isp, needs electrical power.',
    drives: ['Propellant use per year', 'Thruster power and array size', 'Mission life'],
    insight: 'There is no best thruster, only best for a given altitude, life and power budget. Wear life matters too: a module that delivers only ~100 N·s needs many copies for a multi-year mission. The Propulsion trade tab maps where each one wins.',
    reference: 'NASA Small Spacecraft Technology State of the Art, In-Space Propulsion',
    affects: ['thrusterPower', 'thrusterUnits', 'propPerYear', 'missionLife', 'limitedBy', 'arrayArea', 'dryMass', 'loopGain'],
  },
  isp: {
    title: 'Specific impulse (Isp)',
    what: 'How much thrust you get per unit of propellant flow, in seconds. Exhaust speed = Isp × 9.81 m/s.',
    typical: 'At small-satellite power: cold gas ~65 s; monopropellant ~220 s; Hall ~1,200 s; electrospray ~1,500 s (range 225–3,000+); gridded ion ~2,200 s; FEEP ~3,500 s.',
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
    typical: 'Small thrusters are much less efficient than kilowatt ones. At 20–200 W: Hall ~0.35, electrospray ~0.35, krypton Hall ~0.26, gridded ion ~0.20, FEEP ~0.15, RF plasma ~0.12. In thrust per watt: Hall ~59 µN/W, electrospray ~48, gridded ion ~19, FEEP ~9.',
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
    affects: ['missionLife', 'limitedBy', 'ballistic', 'naturalLifetime', 'decayRate'],
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
    insight: 'Sunlight-only thrusting needs a bigger thruster, but the arrays no longer have to store energy for thrusting in eclipse. With long eclipses at low altitude, the trade shifts. (Battery mass is not yet modelled.)',
    affects: ['thrusterPower', 'thrusterUnits', 'arrayArea', 'dryMass', 'loopGain'],
  },
  mode: {
    title: 'Design or As built',
    what: 'Design: the model sizes the spacecraft — arrays, thruster, mass — to hold altitude, and tells you if no design closes. As built: the spacecraft already exists (mass, drag area and thrust are fixed), and the model checks whether it can hold altitude and for how long.',
    typical: 'Use Design to explore what VLEO demands; use As built for real spacecraft from the Heritage missions tab.',
    drives: ['Which inputs are shown', 'Whether the sizing loop runs'],
    insight: 'Designers work in both directions: sizing a new spacecraft for an orbit, and checking what orbit an existing spacecraft can survive in.',
    affects: ['dryMass', 'dragArea', 'thrusterPower', 'missionLife', 'thrustMargin'],
  },
  asBuiltMass: {
    title: 'Dry mass (as built)',
    what: 'Spacecraft mass without propellant.',
    typical: 'CubeSats 1–25 kg; small satellites 100–500 kg; GOCE about 1,000 kg; the ISS about 420,000 kg.',
    drives: ['Ballistic coefficient, so lifetime with no thrust (linearly)', 'Δv per year needed to hold altitude'],
    insight: 'Mass does not change the drag force, only how strongly the spacecraft resists it. Heavy, compact spacecraft decay slowly.',
    affects: ['ballistic', 'naturalLifetime', 'disposal', 'decayRate'],
  },
  asBuiltArea: {
    title: 'Drag area (as built)',
    what: 'Effective area facing the airflow, including any solar arrays, used with C_D to compute drag.',
    typical: 'A 3U CubeSat 0.01–0.03 m²; GOCE about 1 m²; the ISS roughly 1,000 m² effective.',
    drives: ['Drag, linearly', 'Ballistic coefficient and lifetime, inversely'],
    insight: 'Often the least certain number for a real spacecraft: attitude, array angle and appendages change it from orbit to orbit.',
    affects: ['drag', 'ballistic', 'naturalLifetime', 'decayRate', 'thrustMargin', 'propPerYear', 'missionLife'],
  },
  maxThrust: {
    title: 'Maximum thrust (as built)',
    what: 'The most thrust the spacecraft can produce continuously for drag makeup. Zero means no drag makeup — the spacecraft simply decays.',
    typical: 'Electrospray modules 0.01–1 mN each; GOCE 1–20 mN; SLATS up to 28 mN.',
    drives: ['Thrust margin: available thrust ÷ drag', 'Whether the spacecraft can hold altitude at all'],
    insight: 'Below a margin of 1 the spacecraft cannot hold altitude. Above 1 but close to it, a storm or a rising solar cycle can push it under.',
    affects: ['thrustMargin', 'missionLife'],
  },
  coverage: {
    title: 'Coverage type',
    what: 'Revisit: a satellite must pass over each place every so often (imaging, radar). Continuous: at least one satellite must always be in view (communications, direct-to-device).',
    typical: 'Imaging constellations: revisit of hours to a day. Broadband and direct-to-device: continuous.',
    drives: ['Satellites needed: about 1/h for revisit, about 1/h² for continuous coverage'],
    insight: 'Continuous coverage costs far more satellites, and its satellite count falls much faster with altitude — which pushes communications constellations higher than imaging ones.',
    reference: 'Wertz et al., SMAD, ch. 9 (coverage)',
    affects: [],
  },
  offNadir: {
    title: 'Maximum off-nadir angle',
    what: 'How far from straight down the sensor can point. Together with altitude it sets the width of ground a satellite can image on each pass (its field of regard).',
    typical: '15–30° for high-resolution optical; up to 45° with agile pointing; radar typically looks 20–50° off nadir.',
    drives: ['Swath width, roughly in proportion to altitude', 'Satellites needed for a revisit time, inversely'],
    insight: 'Pointing further off nadir buys coverage but worsens resolution (longer slant range, oblique view). Lower orbits need wider angles for the same swath.',
    affects: [],
  },
  revisit: {
    title: 'Revisit time',
    what: 'The longest acceptable gap between looks at a point on the equator. Higher latitudes are revisited more often.',
    typical: 'Daily for mapping; a few hours for monitoring; under an hour for tactical needs.',
    drives: ['Satellites needed, inversely: halve the revisit time, double the satellites'],
    insight: 'Revisit is usually what sizes an imaging constellation, not resolution.',
    affects: [],
  },
  passes: {
    title: 'Usable passes per orbit',
    what: 'A satellite crosses the equator twice per orbit. Optical sensors in sun-synchronous orbits can use only the daylight crossing; radar works day and night.',
    typical: 'Optical: 1. Radar and radio-frequency sensing: 2.',
    drives: ['Satellites needed for a revisit time, inversely'],
    insight: 'One reason radar constellations need fewer satellites for the same revisit.',
    affects: [],
  },
  minElevation: {
    title: 'Minimum user elevation',
    what: 'How high above a user’s horizon a satellite must be to provide service. Lower elevations widen each satellite’s footprint but lengthen the radio path and add obstruction by terrain and buildings.',
    typical: '25–40° for broadband and phones; 10° for ground stations.',
    drives: ['Footprint size', 'Satellites needed for continuous coverage, roughly inversely with footprint area'],
    insight: 'In VLEO the footprint at a sensible elevation is small: thousands of satellites for global continuous coverage.',
    affects: [],
  },
  latitudeMax: {
    title: 'Highest latitude to cover',
    what: 'Continuous coverage is required from the equator up to this latitude, north and south.',
    typical: '±53–60° covers most of the world’s population; ±90° is truly global.',
    drives: ['Area to cover (proportional to the sine of the latitude)', 'Satellites needed'],
    insight: 'Skipping the poles saves satellites. Inclination should be close to this latitude: each footprint reaches a few degrees beyond the ground track.',
    affects: [],
  },
  payloadExponent: {
    title: 'Payload growth with altitude',
    what: 'To keep the same performance on the ground, payloads get bigger as you fly higher: payload mass and power ∝ (h / 300 km)^k. The Explore payload is defined at 300 km.',
    typical: 'k ≈ 2.5 for an optical telescope at fixed resolution (aperture ∝ h, mass ∝ aperture^2.5). k ≈ 2 for a direct-to-device antenna at fixed link margin (area ∝ h²). k = 0 keeps the payload fixed.',
    drives: ['Satellite mass and power at each altitude', 'The right-hand wall of the mass-per-year curve'],
    insight: 'This is what makes going higher expensive. Without it, higher is always better; with it, an optimum altitude appears. v2 will size payloads from real requirements instead.',
    affects: [],
  },
}
