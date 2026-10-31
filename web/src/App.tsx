import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { exponentialDensity_kg_m3, msisDensity_kg_m3, SOLAR_MODES, type SolarMode } from './model/atmosphere'
import { YEAR_S } from './model/constants'
import { PROPULSION_PRESETS, thrustToPower_N_W, type PropulsionClass } from './model/propulsion'
import { evaluateSatellite, sweepAltitude, type SatelliteInputs, type SatelliteResult } from './model/satellite'
import { Chart } from './ui/Chart'
import { sig } from './ui/format'
import { OUTPUT_GROUPS } from './ui/outputs'
import { decodeInputs, encodeInputs } from './ui/urlState'

const KM = 1e3
const SWEEP_ALTITUDES = Array.from({ length: 91 }, (_, k) => (150 + 5 * k) * KM)
const SWEEP_KM = SWEEP_ALTITUDES.map((h) => h / KM)
const MODES: SolarMode[] = ['low', 'moderate', 'high']
const MODE_LABEL: Record<SolarMode, string> = { low: 'Solar min', moderate: 'Moderate', high: 'Solar max' }
const MODE_COLOR: Record<SolarMode, string> = { low: 'var(--series-low)', moderate: 'var(--series-mid)', high: 'var(--series-high)' }

function solarModeOf(inputs: SatelliteInputs): SolarMode | null {
  return MODES.find((m) => SOLAR_MODES[m].f107 === inputs.solar.f107 && SOLAR_MODES[m].ap === inputs.solar.ap) ?? null
}

function cssColor(token: string) {
  const name = token.replace(/^var\((.*)\)$/, '$1')
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#888'
}

interface SliderProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  display: string
  onChange: (v: number) => void
  log?: boolean
}

function Slider({ label, value, min, max, step, display, onChange, log }: SliderProps) {
  const toSlider = (v: number) => (log ? Math.log10(v) : v)
  const fromSlider = (s: number) => (log ? 10 ** s : s)
  return (
    <label className="control">
      <span className="control-label">
        {label}
        <output>{display}</output>
      </span>
      <input
        type="range"
        min={toSlider(min)}
        max={toSlider(max)}
        step={log ? 0.01 : step}
        value={toSlider(value)}
        onChange={(e) => onChange(fromSlider(Number(e.target.value)))}
      />
    </label>
  )
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T | null
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="control">
      <span className="control-label">{label}</span>
      <div className="segmented" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            className={value === o.value ? 'active' : ''}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function Controls({ inputs, set }: { inputs: SatelliteInputs; set: (patch: Partial<SatelliteInputs>) => void }) {
  const preset = PROPULSION_PRESETS[inputs.propulsion]
  const electric = preset.efficiency !== null
  return (
    <aside className="controls">
      <h2>Orbit</h2>
      <Slider
        label="Altitude"
        value={inputs.altitude_m / KM}
        min={150}
        max={600}
        step={5}
        display={`${inputs.altitude_m / KM} km`}
        onChange={(v) => set({ altitude_m: v * KM })}
      />
      <Slider
        label="Inclination"
        value={inputs.inclination_deg}
        min={0}
        max={97.5}
        step={0.5}
        display={`${inputs.inclination_deg}°`}
        onChange={(v) => set({ inclination_deg: v })}
      />
      <Slider
        label="Sun angle to orbit plane (β)"
        value={inputs.beta_deg}
        min={0}
        max={90}
        step={1}
        display={`${inputs.beta_deg}°`}
        onChange={(v) => set({ beta_deg: v })}
      />

      <h2>Environment</h2>
      <Segmented
        label="Solar activity"
        value={solarModeOf(inputs)}
        options={MODES.map((m) => ({ value: m, label: MODE_LABEL[m] }))}
        onChange={(m) => set({ solar: { ...SOLAR_MODES[m] } })}
      />
      <Segmented
        label="Atmosphere model"
        value={inputs.atmosphereModel}
        options={[
          { value: 'msis', label: 'NRLMSIS 2.1' },
          { value: 'exponential', label: 'Exponential' },
        ]}
        onChange={(v) => set({ atmosphereModel: v })}
      />
      <Slider
        label="Storm margin on density (sizing)"
        value={inputs.stormMargin}
        min={1}
        max={5}
        step={0.5}
        display={`×${inputs.stormMargin}`}
        onChange={(v) => set({ stormMargin: v })}
      />

      <h2>Spacecraft</h2>
      <Slider
        label="Payload mass"
        value={inputs.payloadMass_kg}
        min={1}
        max={500}
        step={1}
        log
        display={`${sig(inputs.payloadMass_kg, 2)} kg`}
        onChange={(v) => set({ payloadMass_kg: Number(sig(v, 2).replace(/,/g, '')) })}
      />
      <Slider
        label="Payload power"
        value={inputs.payloadPower_W}
        min={1}
        max={2000}
        step={1}
        log
        display={`${sig(inputs.payloadPower_W, 2)} W`}
        onChange={(v) => set({ payloadPower_W: Number(sig(v, 2).replace(/,/g, '')) })}
      />
      <Slider
        label="Drag coefficient C_D"
        value={inputs.cd}
        min={2}
        max={2.8}
        step={0.05}
        display={inputs.cd.toFixed(2)}
        onChange={(v) => set({ cd: v })}
      />
      <Segmented
        label="Solar arrays"
        value={inputs.arrayOrientation}
        options={[
          { value: 'edgeOn', label: 'Edge-on to flow' },
          { value: 'sunTracking', label: 'Sun-tracking' },
        ]}
        onChange={(v) => set({ arrayOrientation: v })}
      />

      <h2>Propulsion</h2>
      <label className="control">
        <span className="control-label">Technology</span>
        <select
          value={inputs.propulsion}
          onChange={(e) => {
            const p = e.target.value as PropulsionClass
            const pr = PROPULSION_PRESETS[p]
            set({ propulsion: p, isp_s: pr.isp_s, efficiency: pr.efficiency ?? inputs.efficiency })
          }}
        >
          {(Object.keys(PROPULSION_PRESETS) as PropulsionClass[]).map((p) => (
            <option key={p} value={p}>
              {PROPULSION_PRESETS[p].label}
            </option>
          ))}
        </select>
      </label>
      <Slider
        label="Specific impulse"
        value={inputs.isp_s}
        min={50}
        max={6000}
        step={10}
        log
        display={`${sig(inputs.isp_s, 2)} s`}
        onChange={(v) => set({ isp_s: Number(sig(v, 2).replace(/,/g, '')) })}
      />
      {electric && (
        <Slider
          label="Thruster efficiency η"
          value={inputs.efficiency}
          min={0.1}
          max={0.8}
          step={0.01}
          display={`${Math.round(inputs.efficiency * 100)} %  →  ${sig(thrustToPower_N_W(inputs.isp_s, inputs.efficiency) * 1e6, 2)} µN/W`}
          onChange={(v) => set({ efficiency: v })}
        />
      )}
      <Slider
        label="Propellant"
        value={inputs.propellant_kg}
        min={0.1}
        max={200}
        step={0.1}
        log
        display={`${sig(inputs.propellant_kg, 2)} kg`}
        onChange={(v) => set({ propellant_kg: Number(sig(v, 2).replace(/,/g, '')) })}
      />
      <Slider
        label="Design life"
        value={inputs.designLife_s / YEAR_S}
        min={0.5}
        max={15}
        step={0.5}
        display={`${inputs.designLife_s / YEAR_S} yr`}
        onChange={(v) => set({ designLife_s: v * YEAR_S })}
      />
      <label className="control checkbox">
        <input
          type="checkbox"
          checked={inputs.thrustInEclipse}
          onChange={(e) => set({ thrustInEclipse: e.target.checked })}
        />
        Thrust in eclipse (battery-powered)
      </label>
    </aside>
  )
}

function Cards({ inputs, result }: { inputs: SatelliteInputs; result: SatelliteResult }) {
  const previous = useRef<SatelliteResult | null>(null)
  const prior = previous.current
  useEffect(() => {
    previous.current = result
  }, [result])

  return (
    <div className="groups">
      {OUTPUT_GROUPS.map((group) => (
        <section key={group.title} className="group">
          <h2>{group.title}</h2>
          <div className="cards">
            {group.cards.map((card) => {
              const now = card.raw(result)
              const before = prior ? card.raw(prior) : NaN
              const change = Number.isFinite(now) && Number.isFinite(before) && before !== 0 ? now / before - 1 : 0
              const showChange = Math.abs(change) > 0.005
              return (
                <details key={card.id} className="card">
                  <summary>
                    <span className="card-label">{card.label}</span>
                    <span className="card-value">{card.value(result, inputs)}</span>
                    {showChange && (
                      <span className={`card-change ${change > 0 ? 'up' : 'down'}`} key={`${now}`}>
                        {change > 0 ? '▲' : '▼'} {sig(Math.abs(change) * 100, 2)}%
                      </span>
                    )}
                  </summary>
                  {card.equation && <code className="equation">{card.equation}</code>}
                  <p>{card.why}</p>
                </details>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}

function infeasibleShapes(results: SatelliteResult[]) {
  const shapes: Record<string, unknown>[] = []
  let start: number | null = null
  results.forEach((r, k) => {
    if (!r.feasible && start === null) start = SWEEP_KM[k]
    const endHere = start !== null && (r.feasible || k === results.length - 1)
    if (endHere) {
      shapes.push({
        type: 'rect', xref: 'x', yref: 'paper', x0: start! - 2.5, x1: r.feasible ? SWEEP_KM[k] - 2.5 : SWEEP_KM[k] + 2.5,
        y0: 0, y1: 1, fillcolor: cssColor('var(--infeasible)'), line: { width: 0 }, layer: 'below',
      })
      start = null
    }
  })
  return shapes
}

function Charts({ inputs }: { inputs: SatelliteInputs }) {
  const deferred = useDeferredValue(inputs)
  const sweeps = useMemo(
    () =>
      Object.fromEntries(
        MODES.map((m) => [m, sweepAltitude({ ...deferred, solar: { ...SOLAR_MODES[m] } }, SWEEP_ALTITUDES)]),
      ) as Record<SolarMode, SatelliteResult[]>,
    [deferred],
  )
  const current = deferred.altitude_m / KM
  const marker = { type: 'line', xref: 'x', yref: 'paper', x0: current, x1: current, y0: 0, y1: 1, line: { dash: 'dot', width: 1, color: cssColor('var(--muted)') } }
  const infeasible = infeasibleShapes(sweeps.moderate)
  const xaxis = { title: { text: 'Altitude (km)' }, range: [150, 600] }

  const lifeData = MODES.map((m) => ({
    x: SWEEP_KM,
    y: sweeps[m].map((r) => (r.feasible ? r.missionLife_s / YEAR_S : null)),
    name: MODE_LABEL[m],
    mode: 'lines',
    line: { color: cssColor(MODE_COLOR[m]), width: 2 },
  }))
  const decayData = MODES.map((m) => ({
    x: SWEEP_KM,
    y: sweeps[m].map((r) => (r.feasible ? r.naturalLifetime_s / YEAR_S : null)),
    name: MODE_LABEL[m],
    mode: 'lines',
    line: { color: cssColor(MODE_COLOR[m]), width: 2 },
  }))
  const powerData = [
    ...MODES.map((m) => ({
      x: SWEEP_KM,
      y: sweeps[m].map((r) => (r.feasible ? r.thrusterPower_W : null)),
      name: `Thruster power, ${MODE_LABEL[m]}`,
      mode: 'lines',
      line: { color: cssColor(MODE_COLOR[m]), width: 2 },
    })),
    {
      x: SWEEP_KM,
      y: sweeps.moderate.map((r) => (r.feasible ? r.drag_N * 1e3 : null)),
      name: 'Drag (moderate), mN',
      mode: 'lines',
      yaxis: 'y2',
      line: { color: cssColor('var(--muted)'), width: 1.5, dash: 'dash' },
    },
  ]
  const densityData = [
    ...MODES.map((m) => ({
      x: SWEEP_KM,
      y: SWEEP_ALTITUDES.map((h) => msisDensity_kg_m3(h, SOLAR_MODES[m], deferred.inclination_deg)),
      name: `NRLMSIS, ${MODE_LABEL[m]}`,
      mode: 'lines',
      line: { color: cssColor(MODE_COLOR[m]), width: 2 },
    })),
    {
      x: SWEEP_KM,
      y: SWEEP_ALTITUDES.map(exponentialDensity_kg_m3),
      name: 'Exponential (Vallado)',
      mode: 'lines',
      line: { color: cssColor('var(--muted)'), width: 1.5, dash: 'dash' },
    },
  ]

  return (
    <div className="charts">
      <figure>
        <figcaption>
          <strong>Mission life vs altitude.</strong> Shaded: no design closes (moderate activity). Life is capped by
          propellant, thruster impulse or design life.
        </figcaption>
        <Chart
          data={lifeData}
          layout={{ xaxis, yaxis: { title: { text: 'Mission life (years)' }, type: 'log', tickvals: [0.03, 0.1, 0.3, 1, 3, 10, 30], ticktext: ['0.03', '0.1', '0.3', '1', '3', '10', '30'] }, shapes: [...infeasible, marker] }}
        />
      </figure>
      <figure>
        <figcaption>
          <strong>Thruster power and drag vs altitude.</strong> Power is sized for storm-level density; exponential
          growth to the left is the left wall of the trade space.
        </figcaption>
        <Chart
          data={powerData}
          layout={{
            xaxis,
            yaxis: { title: { text: 'Thruster power (W)' }, type: 'log' },
            yaxis2: { title: { text: 'Drag (mN)' }, type: 'log', overlaying: 'y', side: 'right', showgrid: false },
            shapes: [...infeasible, marker],
          }}
        />
      </figure>
      <figure>
        <figcaption>
          <strong>Lifetime with no thrust.</strong> How long the satellite stays up if propulsion fails, for the design
          sized at each altitude. Dotted line: the FCC 5-year disposal rule.
        </figcaption>
        <Chart
          data={decayData}
          layout={{
            xaxis,
            yaxis: { title: { text: 'Years (log)' }, type: 'log' },
            shapes: [
              marker,
              { type: 'line', xref: 'paper', x0: 0, x1: 1, y0: 5, y1: 5, line: { dash: 'dot', width: 1, color: cssColor('var(--muted)') } },
            ],
          }}
        />
      </figure>
      <figure>
        <figcaption>
          <strong>Air density vs altitude.</strong> The solar cycle matters more the higher you go: about ×2 at
          200 km, over ×20 at 450 km.
        </figcaption>
        <Chart
          data={densityData}
          layout={{ xaxis, yaxis: { title: { text: 'Density (kg/m³)' }, type: 'log', exponentformat: 'power' }, shapes: [marker] }}
        />
      </figure>
    </div>
  )
}

export default function App() {
  const [inputs, setInputs] = useState<SatelliteInputs>(() => decodeInputs(window.location.hash))
  const set = (patch: Partial<SatelliteInputs>) => setInputs((prev) => ({ ...prev, ...patch }))
  const result = useMemo(() => evaluateSatellite(inputs), [inputs])

  useEffect(() => {
    const hash = encodeInputs(inputs)
    window.history.replaceState(null, '', `#${hash}`)
  }, [inputs])

  return (
    <div className="app">
      <header>
        <h1>VLEO Trade Study Explorer</h1>
        <p>
          How altitude, spacecraft design and propulsion trade against drag, power and mission life in very low
          Earth orbit. Tap any result for its equation and why it matters.
        </p>
      </header>
      <div className="layout">
        <Controls inputs={inputs} set={set} />
        <main>
          {!result.feasible && (
            <div className="banner" role="alert">
              <strong>No design closes at {inputs.altitude_m / KM} km.</strong> Drag from the arrays needed to power the
              thruster grows faster than the thrust they provide (sizing-loop gain {sig(result.loopGain, 2)}). Try
              edge-on arrays, lower Isp, a smaller storm margin or a higher orbit.
            </div>
          )}
          <Cards inputs={inputs} result={result} />
          <Charts inputs={inputs} />
        </main>
      </div>
      <footer>
        Academic, vendor-neutral teaching tool. Physics and references: <a href="https://github.com/petersedivec/vleo-explorer/blob/main/docs/physics.md">docs/physics.md</a>.
        Atmosphere: NRLMSIS 2.1, orbit-averaged. Not for flight or investment decisions.
      </footer>
    </div>
  )
}
