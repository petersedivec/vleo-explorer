// Propulsion trade tab: which technology does the mission best, and where (docs/physics.md §5.7).

import { useDeferredValue, useMemo, useState } from 'react'
import { SOLAR_MODES } from '../model/atmosphere'
import { YEAR_S } from '../model/constants'
import { PROPULSION_PRESETS, thrustToPower_N_W, type PropulsionClass } from '../model/propulsion'
import {
  budgetLifeFor,
  designFor,
  ispCurve,
  meetRequirement,
  NEUTRAL_FIXED_MASS_KG,
  TECHNOLOGIES,
  TIE_MARGIN,
  winnerMap,
} from '../model/propulsionTrade'
import type { SatelliteInputs } from '../model/satellite'
import { Chart } from './Chart'
import { cssColor, KM, MODE_LABEL, MODES, solarModeOf } from './common'
import { duration, sig } from './format'

const TECH_COLOR: Record<PropulsionClass, string> = {
  coldGas: 'var(--tech-0)',
  monoprop: 'var(--tech-1)',
  electrospray: 'var(--tech-2)',
  feep: 'var(--tech-3)',
  griddedIon: 'var(--tech-4)',
  hall: 'var(--tech-5)',
  hallKrypton: 'var(--tech-7)',
  rfPlasma: 'var(--tech-6)',
}
const SHORT: Record<PropulsionClass, string> = {
  coldGas: 'Cold gas',
  monoprop: 'Monoprop',
  electrospray: 'Electrospray',
  feep: 'FEEP',
  griddedIon: 'Gridded ion',
  hall: 'Hall (Xe)',
  hallKrypton: 'Hall (Kr)',
  rfPlasma: 'RF plasma',
}

const MAP_ALTITUDES = Array.from({ length: 36 }, (_, k) => (150 + 10 * k) * KM)
const MAP_LIVES_YR = Array.from({ length: 21 }, (_, k) => 0.1 * 10 ** (k / 10))
const LIFE_ALTITUDES = Array.from({ length: 36 }, (_, k) => (150 + 10 * k) * KM)
const ISPS = Array.from({ length: 45 }, (_, k) => 100 * 10 ** (k / 25))

interface Props {
  inputs: SatelliteInputs
  set: (patch: Partial<SatelliteInputs>) => void
  onEditSpacecraft: () => void
}

function NumberSlider(props: {
  label: string
  value: number
  min: number
  max: number
  display: string
  log?: boolean
  step?: number
  onChange: (v: number) => void
  hint?: string
}) {
  const { label, value, min, max, display, log, step, onChange, hint } = props
  const to = (v: number) => (log ? Math.log10(v) : v)
  const from = (v: number) => (log ? 10 ** v : v)
  return (
    <div className="control">
      <span className="control-label">
        <span>{label}</span>
        <output>{display}</output>
      </span>
      <input
        type="range"
        aria-label={label}
        min={to(min)}
        max={to(max)}
        step={log ? 0.01 : (step ?? 1)}
        value={to(value)}
        onChange={(e) => onChange(from(Number(e.target.value)))}
      />
      {hint && <p className="control-note">{hint}</p>}
    </div>
  )
}

export function PropulsionTrade({ inputs, set, onEditSpacecraft }: Props) {
  const [life_yr, setLife] = useState(3)
  const [budget_kg, setBudget] = useState(80)
  const [genericEta, setGenericEta] = useState(0.45)
  const [equalFixedMass, setEqualFixedMass] = useState(false)
  const [ignoreWear, setIgnoreWear] = useState(false)
  const deferred = useDeferredValue({ inputs, life_yr, budget_kg, genericEta, equalFixedMass, ignoreWear })
  const options = useMemo(
    () => ({ equalFixedMass: deferred.equalFixedMass, ignoreWear: deferred.ignoreWear }),
    [deferred.equalFixedMass, deferred.ignoreWear],
  )
  const life_s = deferred.life_yr * YEAR_S
  const h = deferred.inputs.altitude_m

  const rows = useMemo(
    () =>
      TECHNOLOGIES.map((tech) => {
        const p = PROPULSION_PRESETS[tech]
        const design = designFor(deferred.inputs, tech, h, undefined, options, life_s)
        const req = meetRequirement(design, p.isp_s, p.tankFraction, life_s)
        return {
          tech,
          preset: p,
          design,
          req,
          budgetLife: budgetLifeFor(deferred.inputs, tech, h, deferred.budget_kg, options),
        }
      }),
    [deferred.inputs, h, life_s, deferred.budget_kg, options],
  )
  const feasibleRows = rows.filter((r) => r.req.feasible)
  const ranked = [...feasibleRows].sort((a, b) => a.req.wet_kg - b.req.wet_kg)
  const lightest = ranked[0] ?? null
  const lightTie = ranked.length > 1 && (ranked[1].req.wet_kg - ranked[0].req.wet_kg) / ranked[0].req.wet_kg < TIE_MARGIN ? ranked[1] : null
  const longest = rows.reduce<(typeof rows)[number] | null>((a, b) => (!a || b.budgetLife > a.budgetLife ? b : a), null)

  const curve = useMemo(
    () => ispCurve(deferred.inputs, h, life_s, ISPS, deferred.genericEta, 0.12),
    [deferred.inputs, h, life_s, deferred.genericEta],
  )
  const feasibleCurve = curve.filter((c) => c.feasible)
  const optimum = feasibleCurve.reduce<(typeof curve)[number] | null>((a, b) => (!a || b.wet_kg < a.wet_kg ? b : a), null)

  const map = useMemo(
    () => winnerMap(deferred.inputs, MAP_ALTITUDES, MAP_LIVES_YR.map((y) => y * YEAR_S), options),
    [deferred.inputs, options],
  )
  const lifeCurves = useMemo(
    () =>
      TECHNOLOGIES.map((tech) => ({
        tech,
        lives: LIFE_ALTITUDES.map((alt) => budgetLifeFor(deferred.inputs, tech, alt, deferred.budget_kg, options)),
      })),
    [deferred.inputs, deferred.budget_kg, options],
  )

  const muted = cssColor('var(--muted)')
  const altMarker = { type: 'line', xref: 'x', yref: 'paper', x0: h / KM, x1: h / KM, y0: 0, y1: 1, line: { dash: 'dot', width: 1, color: muted } }

  // Winner map as a discrete heatmap.
  const techIndex = (t: PropulsionClass | null) => (t === null ? null : TECHNOLOGIES.indexOf(t))
  const n = TECHNOLOGIES.length
  const colorscale = TECHNOLOGIES.flatMap((t, k) => [
    [k / n, cssColor(TECH_COLOR[t])],
    [(k + 1) / n, cssColor(TECH_COLOR[t])],
  ])
  const mapZ = map.map((row) => row.map((c) => techIndex(c.winner)))
  const mapText = map.map((row, i) =>
    row.map((c, j) => {
      const where = `${MAP_ALTITUDES[j] / KM} km, ${sig(MAP_LIVES_YR[i], 2)} yr`
      if (!c.winner) return `${where}<br>No technology closes`
      const runner = c.runnerUp
        ? `<br>Runner-up: ${SHORT[c.runnerUp]} (+${sig(c.margin * 100, 2)}%)${c.tie ? '<br><i>Effectively a tie</i>' : ''}`
        : ''
      return `${where}<br><b>${SHORT[c.winner]}</b>: ${sig(c.wet_kg, 3)} kg wet${runner}`
    }),
  )

  return (
    <div className="layout">
      <aside className="controls" aria-label="Comparison inputs">
        <h2>Mission</h2>
        <NumberSlider
          label="Altitude"
          value={inputs.altitude_m / KM}
          min={150}
          max={500}
          step={5}
          display={`${inputs.altitude_m / KM} km`}
          onChange={(v) => set({ altitude_m: v * KM })}
        />
        <NumberSlider
          label="Required life (equal requirement)"
          value={life_yr}
          min={0.1}
          max={10}
          log
          display={`${sig(life_yr, 2)} yr`}
          onChange={(v) => setLife(Number(v.toPrecision(2)))}
        />
        <NumberSlider
          label="Wet-mass budget (equal total mass)"
          value={budget_kg}
          min={5}
          max={2000}
          log
          display={`${sig(budget_kg, 2)} kg`}
          onChange={(v) => setBudget(Number(v.toPrecision(2)))}
        />

        <h2>Environment and spacecraft</h2>
        <div className="control">
          <span className="control-label">Solar activity</span>
          <div className="segmented" role="radiogroup" aria-label="Solar activity">
            {MODES.map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={solarModeOf(inputs) === m}
                className={solarModeOf(inputs) === m ? 'active' : ''}
                onClick={() => set({ solar: { ...SOLAR_MODES[m] } })}
              >
                {MODE_LABEL[m]}
              </button>
            ))}
          </div>
        </div>
        <div className="control">
          <span className="control-label">Solar arrays</span>
          <div className="segmented" role="radiogroup" aria-label="Solar arrays">
            {(['edgeOn', 'sunTracking'] as const).map((o) => (
              <button
                key={o}
                type="button"
                role="radio"
                aria-checked={inputs.arrayOrientation === o}
                className={inputs.arrayOrientation === o ? 'active' : ''}
                onClick={() => set({ arrayOrientation: o })}
              >
                {o === 'edgeOn' ? 'Edge-on' : 'Sun-tracking'}
              </button>
            ))}
          </div>
        </div>
        <p className="control-note">
          Payload {sig(inputs.payloadMass_kg, 2)} kg / {sig(inputs.payloadPower_W, 2)} W, storm margin ×
          {inputs.stormMargin}, C_D {inputs.cd.toFixed(2)}.{' '}
          <button type="button" className="link" onClick={onEditSpacecraft}>
            Edit in Explore
          </button>
        </p>

        <h2>Optimal-Isp curve</h2>
        <NumberSlider
          label="Generic thruster efficiency η"
          value={genericEta}
          min={0.15}
          max={0.7}
          step={0.01}
          display={`${Math.round(genericEta * 100)}%`}
          onChange={setGenericEta}
          hint={`Generic curve: tank fraction 0.12, fixed system mass ${NEUTRAL_FIXED_MASS_KG} kg.`}
        />

        <h2>Check the assumptions</h2>
        <label className="control checkbox">
          <input type="checkbox" checked={equalFixedMass} onChange={(e) => setEqualFixedMass(e.target.checked)} />
          Give every technology the same fixed system mass ({NEUTRAL_FIXED_MASS_KG} kg)
        </label>
        <label className="control checkbox">
          <input type="checkbox" checked={ignoreWear} onChange={(e) => setIgnoreWear(e.target.checked)} />
          Ignore thruster wear (one unit lasts forever)
        </label>
        <p className="control-note">
          Fixed masses, tank fractions, minimum powers and wear life are estimates. Toggle these to see how much of each
          win comes from them — for example, how much better electrospray would do if its modules lasted longer.
        </p>
      </aside>

      <main>
        {inputs.mode === 'asBuilt' && (
          <div className="banner info-banner">
            The comparison always <em>designs</em> the spacecraft for each technology, using the payload and bus from
            Explore’s Design mode.
          </div>
        )}
        <div className="summary">
          <div className="summary-card">
            <span className="card-label">
              Lightest for {sig(life_yr, 2)} yr at {h / KM} km
            </span>
            <span className="card-value">
              {lightest ? `${PROPULSION_PRESETS[lightest.tech].label}` : 'No technology closes'}
            </span>
            {lightest && (
              <span className="muted small">
                {sig(lightest.req.wet_kg, 3)} kg wet
                {lightTie && ` — effectively tied with ${SHORT[lightTie.tech]} (${sig(lightTie.req.wet_kg, 3)} kg)`}
              </span>
            )}
          </div>
          <div className="summary-card">
            <span className="card-label">
              Longest propellant life with {sig(budget_kg, 2)} kg at {h / KM} km
            </span>
            <span className="card-value">
              {longest && longest.budgetLife > 0 ? PROPULSION_PRESETS[longest.tech].label : 'Budget too small'}
            </span>
            {longest && longest.budgetLife > 0 && <span className="muted small">{duration(longest.budgetLife)}</span>}
          </div>
          <div className="summary-card">
            <span className="card-label">Optimal Isp (generic, η {Math.round(genericEta * 100)}%)</span>
            <span className="card-value">{optimum ? `${sig(optimum.isp_s, 2)} s` : '—'}</span>
            {optimum && <span className="muted small">{sig(optimum.wet_kg, 3)} kg wet</span>}
          </div>
        </div>

        <div className="table-wrap">
          <table className="params trade-table">
            <caption>
              At {h / KM} km, {MODE_LABEL[solarModeOf(inputs) ?? 'moderate']} solar activity. Requirement: hold altitude for{' '}
              {sig(life_yr, 2)} yr. Budget: {sig(budget_kg, 2)} kg wet.
            </caption>
            <thead>
              <tr>
                <th scope="col">Technology</th>
                <th scope="col">Isp</th>
                <th scope="col" className="no-caps">µN/W</th>
                <th scope="col">Thruster units</th>
                <th scope="col">Thruster power</th>
                <th scope="col">Arrays</th>
                <th scope="col">Dry mass</th>
                <th scope="col">Propellant + tank</th>
                <th scope="col">Wet mass for requirement</th>
                <th scope="col">Life on budget</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.tech}>
                  <th scope="row">
                    <span className="swatch" style={{ background: TECH_COLOR[r.tech] }} />
                    {r.preset.label}
                  </th>
                  <td>{sig(r.preset.isp_s, 3)} s</td>
                  <td>{r.preset.efficiency === null ? '—' : sig(thrustToPower_N_W(r.preset.isp_s, r.preset.efficiency) * 1e6, 2)}</td>
                  {r.req.feasible ? (
                    <>
                      <td title="Units for thrust and to cover the mission's total impulse (wear)">{r.design.thrusterUnits}</td>
                      <td>{sig(r.req.thrusterPower_W, 2)} W</td>
                      <td>{sig(r.req.arrayArea_m2, 2)} m²</td>
                      <td>{sig(r.req.dry_kg, 3)} kg</td>
                      <td>{sig(r.req.propellant_kg + r.req.tank_kg, 2)} kg</td>
                      <td className={lightest?.tech === r.tech ? 'best' : ''}>{sig(r.req.wet_kg, 3)} kg</td>
                      <td className={longest?.tech === r.tech && r.budgetLife > 0 ? 'best' : ''}>
                        {r.budgetLife > 0 ? duration(r.budgetLife) : 'over budget'}
                      </td>
                    </>
                  ) : (
                    <td colSpan={7} className="muted">
                      No design closes at this altitude (sizing-loop gain {sig(r.design.loopGain, 2)})
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="charts">
          <figure>
            <figcaption>
              <strong>Winner map: lightest technology for each mission.</strong> Hover for the wet mass and runner-up.
              Faded cells: the runner-up is within {Math.round(TIE_MARGIN * 100)}% — effectively a tie, well inside the
              uncertainty of the estimates. Blank: nothing closes.
            </figcaption>
            <Chart
              height={420}
              data={[
                {
                  type: 'heatmap',
                  x: MAP_ALTITUDES.map((a) => a / KM),
                  y: MAP_LIVES_YR,
                  z: mapZ,
                  zmin: -0.5,
                  zmax: n - 0.5,
                  colorscale,
                  showscale: false,
                  text: mapText,
                  hoverinfo: 'text',
                },
                {
                  // Fade cells where the runner-up is within the tie margin.
                  type: 'heatmap',
                  x: MAP_ALTITUDES.map((a) => a / KM),
                  y: MAP_LIVES_YR,
                  z: map.map((row) => row.map((c) => (c.winner && c.tie ? 1 : null))),
                  zmin: 0,
                  zmax: 1,
                  colorscale: [
                    [0, 'rgba(255,255,255,0.55)'],
                    [1, 'rgba(255,255,255,0.55)'],
                  ],
                  showscale: false,
                  hoverinfo: 'skip',
                },
                {
                  type: 'scatter',
                  mode: 'markers',
                  x: [h / KM],
                  y: [life_yr],
                  marker: { symbol: 'x', size: 12, color: cssColor('var(--text)') },
                  hoverinfo: 'skip',
                  showlegend: false,
                },
                ...TECHNOLOGIES.map((t) => ({
                  type: 'scatter',
                  mode: 'markers',
                  x: [null],
                  y: [null],
                  name: SHORT[t],
                  marker: { symbol: 'square', size: 12, color: cssColor(TECH_COLOR[t]) },
                })),
              ]}
              layout={{
                xaxis: { title: { text: 'Altitude (km)' } },
                yaxis: { title: { text: 'Required life (years)' }, type: 'log', tickvals: [0.1, 0.3, 1, 3, 10], ticktext: ['0.1', '0.3', '1', '3', '10'] },
                legend: { orientation: 'h', x: 0, y: -0.25, yanchor: 'top' },
              }}
            />
          </figure>

          <figure>
            <figcaption>
              <strong>Optimal specific impulse.</strong> Wet mass to hold {h / KM} km for {sig(life_yr, 2)} yr with a generic
              electric thruster. Low Isp burns propellant; high Isp needs power, arrays and their drag. Points: each
              technology with its own efficiency and tankage.
            </figcaption>
            <Chart
              data={[
                {
                  x: curve.map((c) => c.isp_s),
                  y: curve.map((c) => (c.feasible ? c.wet_kg : null)),
                  mode: 'lines',
                  name: `Generic electric, η ${Math.round(genericEta * 100)}%`,
                  line: { color: muted, width: 2 },
                },
                ...rows
                  .filter((r) => r.req.feasible)
                  .map((r) => ({
                    x: [r.preset.isp_s],
                    y: [r.req.wet_kg],
                    mode: 'markers+text',
                    text: [SHORT[r.tech]],
                    textposition: 'top center',
                    name: SHORT[r.tech],
                    showlegend: false,
                    marker: { size: 10, color: cssColor(TECH_COLOR[r.tech]) },
                  })),
              ]}
              layout={{
                xaxis: { title: { text: 'Specific impulse (s)' }, type: 'log', tickvals: [100, 200, 500, 1000, 2000, 5000], ticktext: ['100', '200', '500', '1,000', '2,000', '5,000'] },
                yaxis: { title: { text: 'Wet mass (kg)' }, type: 'log' },
                shapes: optimum
                  ? [{ type: 'line', xref: 'x', yref: 'paper', x0: optimum.isp_s, x1: optimum.isp_s, y0: 0, y1: 1, line: { dash: 'dot', width: 1, color: muted } }]
                  : [],
              }}
            />
          </figure>

          <figure>
            <figcaption>
              <strong>Life vs altitude with equal total mass ({sig(budget_kg, 2)} kg wet).</strong> Each technology’s
              spacecraft is sized for that altitude; whatever mass is left becomes propellant and tank. Design life is ignored, so
              lives beyond about ten years show propellant is no longer the limit.
            </figcaption>
            <Chart
              data={lifeCurves.map(({ tech, lives }) => ({
                x: LIFE_ALTITUDES.map((a) => a / KM),
                y: lives.map((l) => (l > 0 ? l / YEAR_S : null)),
                mode: 'lines',
                name: SHORT[tech],
                line: { color: cssColor(TECH_COLOR[tech]), width: 2 },
              }))}
              layout={{
                xaxis: { title: { text: 'Altitude (km)' }, range: [150, 500] },
                yaxis: { title: { text: 'Propellant-limited life (years)' }, type: 'log', range: [-2, 2.3], tickvals: [0.01, 0.1, 1, 10, 100], ticktext: ['0.01', '0.1', '1', '10', '100'] },
                shapes: [altMarker],
              }}
            />
          </figure>

          <figure className="callout">
            <figcaption>
              <strong>Why not compare equal propellant mass?</strong>
            </figcaption>
            <p>
              Give every thruster the same 10 kg of propellant and the highest-Isp option always “wins”. That hides the
              price of Isp: at the same thrust, power rises in proportion to Isp, so the arrays, power electronics and
              the drag from those arrays all grow. In VLEO that extra drag feeds straight back into the thrust needed.
            </p>
            <p>
              Comparing at equal total mass, or at equal mission requirement, charges each technology for everything it
              needs: propellant, tank, thruster hardware, power system and the drag that comes with it.
            </p>
            <p className="muted small">
              Isp and efficiency are adjusted to small-satellite power levels from public data; tank fractions, fixed
              system masses, minimum powers, and wear life per unit are estimates (physics.md §5.7). Thruster wear is
              modelled simply: enough units are carried to cover the mission’s total impulse, each adding mass.
              Electrospray’s published module life (about 100 N·s, 2020) is its main limit for long missions and is
              improving. Not yet modelled: efficiency falling off at low power, and battery mass. Where the winner map is
              faded, or changes when you toggle the checks, treat the result as a tie.
            </p>
          </figure>
        </div>
      </main>
    </div>
  )
}
