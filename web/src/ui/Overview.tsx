// Landing page: purpose, a quick start, how the tabs connect, and reference material.

import { PROPULSION_PRESETS, thrustToPower_N_W, type PropulsionClass } from '../model/propulsion'
import { DEFAULT_INPUTS } from '../model/satellite'
import { sig, wearLife } from './format'

export type TabId = 'overview' | 'heritage' | 'explore' | 'propulsion101' | 'propulsion' | 'constellation'

/** The central VLEO trade in one picture: benefits improve as you go lower, the cost of staying there explodes. */
function TradeGraphic() {
  // Altitude runs left (low) to right (high). Curves are illustrative shapes, not model output.
  const xs = Array.from({ length: 41 }, (_, k) => k / 40)
  const x = (t: number) => 40 + t * 300
  const y = (v: number) => 170 - v * 140
  const drag = xs.map((t) => Math.min(1, Math.exp(-t * 6) * 1.1))
  const benefit = xs.map((t) => 0.15 + 0.6 * (1 - t))
  const total = xs.map((_, k) => drag[k] * 0.9 + (1 - benefit[k]) * 0.55)
  const minK = total.indexOf(Math.min(...total))
  const path = (v: number[]) => v.map((p, k) => `${k ? 'L' : 'M'}${x(xs[k]).toFixed(1)},${y(p).toFixed(1)}`).join(' ')
  const totalScaled = total.map((v) => v * 0.85 + 0.05)
  return (
    <svg className="trade-graphic" viewBox="0 0 380 210" role="img" aria-labelledby="trade-graphic-title trade-graphic-desc">
      <title id="trade-graphic-title">The VLEO trade</title>
      <desc id="trade-graphic-desc">
        As altitude falls, imaging and link benefits improve steadily, while the drag cost of staying in orbit rises
        exponentially. Their combination has a sweet spot.
      </desc>
      <line x1="40" y1="170" x2="345" y2="170" className="g-axis" />
      <line x1="40" y1="20" x2="40" y2="170" className="g-axis" />
      <text x="192" y="195" className="g-label" textAnchor="middle">
        Altitude →
      </text>
      <text x="44" y="186" className="g-small">
        150 km
      </text>
      <text x="345" y="186" className="g-small" textAnchor="end">
        450 km
      </text>
      <path d={path(drag)} className="g-drag" />
      <path d={path(benefit)} className="g-benefit" />
      <path d={path(totalScaled)} className="g-total" />
      <circle cx={x(xs[minK])} cy={y(totalScaled[minK])} r="5" className="g-dot" />
      <text x={x(xs[minK])} y={y(totalScaled[minK]) + 18} className="g-label" textAnchor="middle">
        sweet spot
      </text>
      <text x="345" y={y(totalScaled[totalScaled.length - 1]) - 8} className="g-label" textAnchor="end">
        combined
      </text>
      <text x="60" y="30" className="g-label g-drag-text">
        Drag cost: power, propellant, short life
      </text>
      <text x="105" y="70" className="g-label g-benefit-text">
        Benefit: sharper images, stronger links
      </text>
    </svg>
  )
}

const FLOW: { tab: TabId; title: string; text: string }[] = [
  {
    tab: 'heritage',
    title: 'Heritage missions',
    text: 'Start from spacecraft that really flew in VLEO — GOCE, SLATS, Starlink, Albedo and others — with sourced numbers and model-vs-reality checks.',
  },
  {
    tab: 'explore',
    title: 'Explore: single satellite',
    text: 'Design a single satellite or load a real one. Altitude, solar activity, payload, arrays and propulsion set here are shared with the tabs that follow.',
  },
  {
    tab: 'propulsion',
    title: 'Propulsion trade',
    text: 'The same satellite with each propulsion technology, compared fairly: which one does the mission with the least mass, and where?',
  },
  {
    tab: 'constellation',
    title: 'Constellation',
    text: 'Many copies of that satellite: how many are needed for revisit or continuous coverage, how often they must be replaced, and the best altitude.',
  },
]

const d = DEFAULT_INPUTS

const ASSUMPTIONS: { area: string; items: string[] }[] = [
  {
    area: 'Orbit and atmosphere',
    items: [
      'Circular orbits. Atmosphere from NRLMSIS 2.1, averaged around the orbit (latitude, local time, season), with solar activity held constant in each run.',
      'Atmospheric co-rotation and winds are neglected (a few percent).',
      'The storm margin multiplies density by the same factor at every altitude when sizing thrust and power; real storm enhancements are smaller near 200 km and larger higher up.',
      'The sun angle β is a manual input (default 0°, the worst case for eclipse); it is not set automatically for sun-synchronous orbits.',
    ],
  },
  {
    area: 'Spacecraft sizing (Design mode)',
    items: [
      `Drag coefficient ${d.cd} by default. Edge-on panels add drag at 0.07 × their area (grazing incidence); sun-tracking arrays at 0.71 × area.`,
      `Structure ${d.structureFraction * 100}% of dry mass; power electronics ${d.ppuSpecificMass_kg_W} kg/W; arrays ${d.arrayArealMass_kg_m2} kg/m² with ${d.cellEfficiency * 100}% cells; body sized from a bulk density of ${d.bulkDensity_kg_m3} kg/m³.`,
      'Battery mass is not modelled; arrays are sized for eclipse loads (SMAD power-path efficiencies) but the energy storage itself adds no mass.',
      'A design “closes” if the mass–power–drag loop converges to less than 10× the mass of the same spacecraft with no drag to fight.',
      'Thrust cancels drag continuously at constant altitude. Mission life is the shortest of propellant life, thruster total impulse (unlimited by default) and design life.',
    ],
  },
  {
    area: 'Propulsion comparison',
    items: [
      'Technologies are generic classes, not products. Isp and efficiency follow published ranges adjusted to small-satellite power levels (e.g. Hall ≈ 59 µN/W, electrospray ≈ 48 µN/W, gridded ion ≈ 19 µN/W).',
      'Tank fractions, fixed system masses and minimum operating powers are teaching estimates (table below). Ties within 10% are shown faded.',
      'Thruster wear is modelled simply: enough thruster units are carried to deliver the mission’s total impulse, each adding mass. Not modelled: efficiency falling at low power within a technology.',
    ],
  },
  {
    area: 'Constellation',
    items: [
      'Satellite counts are analytic: revisit from the sensor’s field of regard with evenly spread passes; continuous coverage from ideal hexagonal packing (a lower bound).',
      'To keep the same performance on the ground, payload mass and power grow as (altitude ÷ 300 km)^k.',
      'Mass to orbit per year is a steady-state replacement figure; it excludes launch adapters and dispensers. There is no cost model yet.',
    ],
  },
  {
    area: 'Heritage missions',
    items: [
      'Every parameter is marked published (with its source) or estimated (with the reasoning). Model checks use a constant solar activity band for each mission period.',
    ],
  },
]

const NEXT_STEPS = [
  'Size payloads from real requirements: imaging resolution, radar sensitivity, direct-to-device link margin.',
  'Coverage simulator and 2D revisit map to check the analytic satellite counts; ground stations and downlink.',
  'A cost model: satellites, launch, replacement and operations, giving cost per year and cost per unit of service.',
  'Time-varying solar cycle: pick a launch year and fly through the cycle.',
  'Orbit-type choice (dawn-dusk or noon sun-synchronous, or other) that sets the sun angle and eclipse automatically.',
  'Uncertainty bands (Monte Carlo) on life, satellite count and mass.',
  'Battery mass; thruster efficiency that varies with operating power.',
  'An optimizer across altitude, satellite count and propulsion.',
  'Air-breathing electric propulsion as a clearly labelled what-if.',
]

const TECH_ORDER = Object.keys(PROPULSION_PRESETS) as PropulsionClass[]

/** Propulsion teaching estimates, generated from the same presets the model uses. */
function PropulsionAssumptions() {
  return (
    <div className="table-wrap">
      <table className="params">
        <caption>
          Propulsion estimates for a ~50 kg spacecraft (20–200 W for propulsion). Isp and efficiency are adjusted to
          small-satellite power levels from public datasheets and papers; tank fraction, fixed mass, minimum power and
          wear life per unit were reviewed by the project author and checked against public data (Nov 2026). Sources in
          physics.md §5.7; edit in <code>web/src/model/propulsion.ts</code>.
        </caption>
        <thead>
          <tr>
            <th scope="col">Technology</th>
            <th scope="col">Isp</th>
            <th scope="col" className="no-caps">µN/W</th>
            <th scope="col">Tank (kg per kg propellant)</th>
            <th scope="col">Fixed system mass</th>
            <th scope="col">Minimum power</th>
            <th scope="col">Wear life per unit</th>
            <th scope="col">Each extra unit</th>
          </tr>
        </thead>
        <tbody>
          {TECH_ORDER.map((t) => {
            const p = PROPULSION_PRESETS[t]
            return (
              <tr key={t}>
                <th scope="row">{p.label}</th>
                <td>{sig(p.isp_s, 3)} s</td>
                <td>{p.efficiency === null ? '—' : sig(thrustToPower_N_W(p.isp_s, p.efficiency) * 1e6, 2)}</td>
                <td>{p.tankFraction}</td>
                <td>{p.systemFixedMass_kg} kg</td>
                <td>{p.efficiency === null ? '—' : `${p.minPower_W} W`}</td>
                <td>{wearLife(p, false)}</td>
                <td>{p.unitMass_kg ? `${p.unitMass_kg} kg` : '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export function Overview({ onNavigate, onLearn }: { onNavigate: (tab: TabId) => void; onLearn: () => void }) {
  return (
    <div className="overview">
      <section className="hero">
        <div className="hero-text">
          <p className="eyebrow">Very low Earth orbit, 150–450 km</p>
          <h2>Explore VLEO and how propulsion technologies may support it.</h2>
          <p>
            Flying lower brings sharper imaging, stronger radio links for direct-to-device and broadband, faster
            revisit and orbits that clean themselves of debris. The price is drag — and staying up means thrust, power
            and propellant. This app lets you see those trades for yourself, to understand what it takes to make VLEO
            commercially viable.
          </p>
          <div className="hero-actions">
            <button type="button" className="primary" onClick={() => onNavigate('explore')}>
              Design a satellite →
            </button>
            <button type="button" className="secondary" onClick={() => onNavigate('heritage')}>
              Start from a real mission
            </button>
          </div>
        </div>
        <TradeGraphic />
      </section>

      <section>
        <h3>How the tabs fit together</h3>
        <ol className="flow">
          {FLOW.map((f, k) => (
            <li key={f.tab}>
              <button type="button" className="flow-card" onClick={() => onNavigate(f.tab)}>
                <span className="flow-step">{k + 1}</span>
                <span className="flow-title">{f.title}</span>
                <span className="flow-text">{f.text}</span>
              </button>
            </li>
          ))}
        </ol>
        <div className="how-notes">
          <p>
            <strong>One satellite, shared everywhere.</strong> The satellite you set up in Explore — altitude, solar
            activity, payload, arrays, storm margin, propulsion — is the starting point for the Propulsion trade and
            Constellation tabs. Change altitude or solar activity on any tab and the others follow.
          </p>
          <p>
            <strong>Reading the charts.</strong> The dotted vertical line on every chart marks your current altitude.
            Shaded regions are altitudes where no design closes (or, for a real spacecraft, where its thrust is below
            drag). Three coloured curves usually show solar minimum, moderate and maximum activity.
          </p>
          <p>
            <strong>Learning as you go.</strong> Tap <span className="info-inline">i</span> beside any input for what it is,
            typical values and why it matters; tap any result card for its equation. Links in the address bar save your
            settings, so you can share a scenario.
          </p>
        </div>
      </section>

      <section className="reference">
        <h3>Reference</h3>
        <p>
          <button type="button" className="link strong" onClick={onLearn}>
            Propulsion 101 Overview for VLEO
          </button>{' '}
          — a primer for readers new to spacecraft propulsion: the key ideas, a map of the field, and a card with a
          simple diagram for each technology.
        </p>
        <p>
          The equations, units and references behind every number are in the physics specification:{' '}
          <a href="https://github.com/petersedivec/vleo-explorer/blob/main/docs/physics.md" target="_blank" rel="noreferrer">
            docs/physics.md
          </a>
          . Source code, plan and validation tests:{' '}
          <a href="https://github.com/petersedivec/vleo-explorer" target="_blank" rel="noreferrer">
            github.com/petersedivec/vleo-explorer
          </a>{' '}
          (MIT licence).
        </p>

        <h4>Key assumptions</h4>
        <div className="assumptions">
          {ASSUMPTIONS.map((a) => (
            <details key={a.area}>
              <summary>{a.area}</summary>
              <ul>
                {a.items.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            </details>
          ))}
        </div>

        <h4>Propulsion assumptions</h4>
        <PropulsionAssumptions />

        <h4>What’s next to build into the app</h4>
        <ul>
          {NEXT_STEPS.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>

        <p className="muted small">
          An academic, vendor-neutral teaching tool built from public data. Results are order-of-magnitude estimates for
          learning, not for flight or investment decisions.
        </p>
      </section>
    </div>
  )
}
