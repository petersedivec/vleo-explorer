// Constellation tab: satellites needed, replacement rate and mass to orbit per year vs altitude
// (docs/physics.md §10).

import { useDeferredValue, useMemo, useState, type ReactNode } from 'react'
import { SOLAR_MODES } from '../model/atmosphere'
import {
  DEFAULT_CONSTELLATION,
  evaluateConstellation,
  optimumAltitude,
  sweepConstellation,
  type ConstellationInputs,
  type ConstellationPoint,
} from '../model/constellation'
import { DEG } from '../model/constants'
import type { SatelliteInputs } from '../model/satellite'
import { Chart } from './Chart'
import { cssColor, KM, MODE_COLOR, MODE_LABEL, MODES, solarModeOf } from './common'
import { duration, sig } from './format'
import { InfoButton } from './InfoButton'
import type { InfoKey } from './inputInfo'

const ALTITUDES = Array.from({ length: 91 }, (_, k) => (150 + 5 * k) * KM)
const ALT_KM = ALTITUDES.map((h) => h / KM)

interface Props {
  inputs: SatelliteInputs
  set: (patch: Partial<SatelliteInputs>) => void
  onEditSpacecraft: () => void
}

function infeasibleShapes(points: ConstellationPoint[]) {
  const shapes: Record<string, unknown>[] = []
  let start: number | null = null
  points.forEach((p, k) => {
    if (!p.feasible && start === null) start = ALT_KM[k]
    if (start !== null && (p.feasible || k === points.length - 1)) {
      shapes.push({
        type: 'rect', xref: 'x', yref: 'paper', x0: start - 2.5, x1: p.feasible ? ALT_KM[k] - 2.5 : ALT_KM[k] + 2.5,
        y0: 0, y1: 1, fillcolor: cssColor('var(--infeasible)'), line: { width: 0 }, layer: 'below',
      })
      start = null
    }
  })
  return shapes
}

export function Constellation({ inputs, set, onEditSpacecraft }: Props) {
  const [c, setC] = useState<ConstellationInputs>(DEFAULT_CONSTELLATION)
  const [openInfo, setOpenInfo] = useState<InfoKey | null>(null)
  const patch = (p: Partial<ConstellationInputs>) => setC((prev) => ({ ...prev, ...p }))
  const deferred = useDeferredValue({ inputs, c })

  const sweeps = useMemo(
    () =>
      Object.fromEntries(
        MODES.map((m) => [m, sweepConstellation({ ...deferred.inputs, solar: { ...SOLAR_MODES[m] } }, deferred.c, ALTITUDES)]),
      ) as Record<(typeof MODES)[number], ConstellationPoint[]>,
    [deferred],
  )
  const here = useMemo(() => evaluateConstellation(inputs, c, inputs.altitude_m), [inputs, c])
  const mode = solarModeOf(deferred.inputs) ?? 'moderate'
  const current = sweeps[mode]
  const best = optimumAltitude(current)
  const bestByMode = MODES.map((m) => optimumAltitude(sweeps[m]))

  const muted = cssColor('var(--muted)')
  const marker = { type: 'line', xref: 'x', yref: 'paper', x0: inputs.altitude_m / KM, x1: inputs.altitude_m / KM, y0: 0, y1: 1, line: { dash: 'dot', width: 1, color: muted } }
  const shading = infeasibleShapes(current)
  const xaxis = { title: { text: 'Altitude (km)' }, range: [150, 600] }
  const revisit = c.coverage === 'revisit'
  const widthLabel = revisit ? 'Swath (field of regard)' : 'Footprint diameter'

  const info = (key: InfoKey) => <InfoButton infoKey={key} open={openInfo === key} onOpenChange={setOpenInfo} />
  const slider = (o: {
    label: string
    infoKey: InfoKey
    value: number
    min: number
    max: number
    step: number
    display: string
    log?: boolean
    onChange: (v: number) => void
  }): ReactNode => (
    <div className={`control${openInfo === o.infoKey ? ' info-open' : ''}`}>
      <span className="control-label">
        <span className="control-name">
          <span>{o.label}</span>
          {info(o.infoKey)}
        </span>
        <output>{o.display}</output>
      </span>
      <input
        type="range"
        aria-label={o.label}
        min={o.log ? Math.log10(o.min) : o.min}
        max={o.log ? Math.log10(o.max) : o.max}
        step={o.log ? 0.01 : o.step}
        value={o.log ? Math.log10(o.value) : o.value}
        onChange={(e) => o.onChange(o.log ? 10 ** Number(e.target.value) : Number(e.target.value))}
      />
    </div>
  )
  const segmented = <T extends string | number>(label: string, infoKey: InfoKey | null, value: T, options: { value: T; label: string }[], onChange: (v: T) => void) => (
    <div className={`control${infoKey && openInfo === infoKey ? ' info-open' : ''}`}>
      <span className="control-label">
        <span className="control-name">
          <span>{label}</span>
          {infoKey && info(infoKey)}
        </span>
      </span>
      <div className="segmented" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            key={String(o.value)}
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

  return (
    <div className="layout">
      <aside className="controls" aria-label="Constellation inputs">
        <h2>Coverage</h2>
        {segmented('Coverage type', 'coverage', c.coverage, [
          { value: 'revisit', label: 'Revisit (imaging)' },
          { value: 'continuous', label: 'Continuous (comms)' },
        ], (v) => patch({ coverage: v, payloadExponent: v === 'revisit' ? 2.5 : 2 }))}
        {revisit ? (
          <>
            {slider({ label: 'Maximum off-nadir angle', infoKey: 'offNadir', value: c.offNadir_deg, min: 5, max: 50, step: 1, display: `${c.offNadir_deg}°`, onChange: (v) => patch({ offNadir_deg: v }) })}
            {slider({ label: 'Revisit time', infoKey: 'revisit', value: c.revisit_s / 3600, min: 0.5, max: 48, step: 0.1, log: true, display: `${sig(c.revisit_s / 3600, 2)} h`, onChange: (v) => patch({ revisit_s: Number(v.toPrecision(2)) * 3600 }) })}
            {segmented('Usable passes per orbit', 'passes', c.passesPerOrbit, [
              { value: 1, label: '1 (optical)' },
              { value: 2, label: '2 (radar)' },
            ], (v) => patch({ passesPerOrbit: v }))}
          </>
        ) : (
          <>
            {slider({ label: 'Minimum user elevation', infoKey: 'minElevation', value: c.minElevation_deg, min: 10, max: 60, step: 1, display: `${c.minElevation_deg}°`, onChange: (v) => patch({ minElevation_deg: v }) })}
            {slider({ label: 'Highest latitude to cover', infoKey: 'latitudeMax', value: c.latitudeMax_deg, min: 20, max: 90, step: 1, display: `±${c.latitudeMax_deg}°`, onChange: (v) => patch({ latitudeMax_deg: v }) })}
          </>
        )}
        {slider({ label: 'Payload growth with altitude, k', infoKey: 'payloadExponent', value: c.payloadExponent, min: 0, max: 3, step: 0.1, display: `${c.payloadExponent.toFixed(1)}`, onChange: (v) => patch({ payloadExponent: v }) })}

        <h2>Orbit and satellite</h2>
        {slider({ label: 'Altitude', infoKey: 'altitude', value: inputs.altitude_m / KM, min: 150, max: 600, step: 5, display: `${inputs.altitude_m / KM} km`, onChange: (v) => set({ altitude_m: v * KM }) })}
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
        <p className="control-note">
          Satellite from Explore ({inputs.mode === 'design' ? 'designed' : 'as built'}): inclination {inputs.inclination_deg}°,
          payload {sig(inputs.payloadMass_kg, 2)} kg at 300 km, design life {sig(inputs.designLife_s / 31_557_600, 2)} yr
          {inputs.mode === 'design' ? ' (propellant sized to last it at each altitude)' : `, propellant ${sig(inputs.propellant_kg, 2)} kg`}.{' '}
          <button type="button" className="link" onClick={onEditSpacecraft}>
            Edit in Explore
          </button>
        </p>
        {!revisit && inputs.inclination_deg < c.latitudeMax_deg && (
          <p className="control-note warn-note">
            Inclination {inputs.inclination_deg}° is below the latitude to cover (±{c.latitudeMax_deg}°): the estimate
            assumes inclined planes reach it.
          </p>
        )}
      </aside>

      <main>
        <div className="summary">
          <div className="summary-card">
            <span className="card-label">Satellites needed at {inputs.altitude_m / KM} km</span>
            <span className="card-value">{Number.isFinite(here.satellites) ? sig(here.satellites, 3) : '—'}</span>
            <span className="muted small">
              {widthLabel} {sig(here.groundWidth_m / KM, 3)} km ({sig(here.centralAngle_rad / DEG, 2)}° Earth angle
              {revisit ? '' : ' radius'})
            </span>
          </div>
          <div className="summary-card">
            <span className="card-label">Each satellite</span>
            <span className="card-value">
              {here.feasible ? `${sig(here.wetMass_kg, 3)} kg, ${duration(here.life_s)}` : 'No design closes'}
            </span>
            <span className="muted small">
              Payload ×{sig(here.payloadScale, 2)} of the 300 km payload
              {inputs.mode === 'design' && here.feasible && `; ${sig(here.propellant_kg, 2)} kg propellant for its life`}
            </span>
          </div>
          <div className="summary-card">
            <span className="card-label">To sustain the constellation</span>
            <span className="card-value">{here.feasible ? `${sig(here.massPerYear_kg, 2)} kg/yr` : '—'}</span>
            <span className="muted small">
              {here.feasible
                ? `${sig(here.replacementsPerYear, 2)} replacements/yr; ${sig(here.deploymentMass_kg, 2)} kg to deploy`
                : 'Cannot be sustained here'}
            </span>
          </div>
          <div className="summary-card">
            <span className="card-label">Lowest mass to orbit per year ({MODE_LABEL[mode]})</span>
            <span className="card-value">{best ? `${best.altitude_m / KM} km` : '—'}</span>
            <span className="muted small">
              {best ? `${sig(best.massPerYear_kg, 2)} kg/yr with ${sig(best.satellites, 3)} satellites` : ''}
              {best && best.altitude_m === ALTITUDES[ALTITUDES.length - 1] && ' — at the top of the range: higher is still better'}
            </span>
          </div>
        </div>

        <div className="charts">
          <figure>
            <figcaption>
              <strong>Mass to orbit per year to sustain the constellation.</strong> Satellites needed × wet mass ÷ life:
              a technical stand-in for cost. The left wall is drag (short lives); the right wall is payload growth with
              altitude. Optima: {bestByMode.map((b, k) => `${MODE_LABEL[MODES[k]]} ${b ? `${b.altitude_m / KM} km` : '—'}`).join(', ')}.
            </figcaption>
            <Chart
              data={[
                ...MODES.map((m) => ({
                  x: ALT_KM,
                  y: sweeps[m].map((p) => (p.feasible ? p.massPerYear_kg : null)),
                  name: MODE_LABEL[m],
                  mode: 'lines',
                  line: { color: cssColor(MODE_COLOR[m]), width: 2 },
                })),
                ...bestByMode.flatMap((b, k) =>
                  b
                    ? [
                        {
                          x: [b.altitude_m / KM],
                          y: [b.massPerYear_kg],
                          mode: 'markers',
                          showlegend: false,
                          hovertemplate: `Optimum ${MODE_LABEL[MODES[k]]}: %{x} km, %{y:.2s} kg/yr<extra></extra>`,
                          marker: { size: 10, symbol: 'diamond', color: cssColor(MODE_COLOR[MODES[k]]) },
                        },
                      ]
                    : [],
                ),
              ]}
              layout={{ xaxis, yaxis: { title: { text: 'kg per year' }, type: 'log' }, shapes: [...shading, marker] }}
            />
          </figure>
          <figure>
            <figcaption>
              <strong>The two forces.</strong> Satellites needed falls with altitude (about 1/h for revisit, 1/h² for
              continuous coverage); satellite life rises steeply as drag fades, until design life caps it.
            </figcaption>
            <Chart
              data={[
                {
                  x: ALT_KM,
                  y: current.map((p) => (Number.isFinite(p.satellites) ? p.satellites : null)),
                  name: 'Satellites needed',
                  mode: 'lines',
                  line: { color: cssColor('var(--accent)'), width: 2 },
                },
                {
                  x: ALT_KM,
                  y: current.map((p) => (p.feasible ? p.life_s / 31_557_600 : null)),
                  name: 'Satellite life (years)',
                  mode: 'lines',
                  yaxis: 'y2',
                  line: { color: cssColor('var(--series-high)'), width: 2, dash: 'dash' },
                },
              ]}
              layout={{
                xaxis,
                yaxis: { title: { text: 'Satellites' }, type: 'log' },
                yaxis2: { title: { text: 'Life (years)' }, type: 'log', overlaying: 'y', side: 'right', showgrid: false },
                shapes: [...shading, marker],
              }}
            />
          </figure>
          <figure>
            <figcaption>
              <strong>{widthLabel} vs altitude.</strong>{' '}
              {revisit
                ? `At ${c.offNadir_deg}° off nadir the swath grows almost in proportion to altitude.`
                : `At ${c.minElevation_deg}° minimum elevation the footprint area grows roughly as altitude squared.`}
            </figcaption>
            <Chart
              data={[
                {
                  x: ALT_KM,
                  y: current.map((p) => p.groundWidth_m / KM),
                  name: widthLabel,
                  mode: 'lines',
                  line: { color: cssColor('var(--accent)'), width: 2 },
                },
              ]}
              layout={{ xaxis, yaxis: { title: { text: 'km' } }, shapes: [marker], showlegend: false }}
            />
          </figure>
          <figure>
            <figcaption>
              <strong>Satellite wet mass vs altitude.</strong> Payload grows as (h / 300 km)^{c.payloadExponent.toFixed(1)} to
              keep the same ground performance. At low altitude the arrays, thruster power and propellant needed to fight drag
              for the whole design life add mass.
            </figcaption>
            <Chart
              data={[
                {
                  x: ALT_KM,
                  y: current.map((p) => (p.feasible ? p.wetMass_kg : null)),
                  name: 'Wet mass',
                  mode: 'lines',
                  line: { color: cssColor('var(--accent)'), width: 2 },
                },
              ]}
              layout={{ xaxis, yaxis: { title: { text: 'kg' }, type: 'log' }, shapes: [...shading, marker], showlegend: false }}
            />
          </figure>
        </div>
        <p className="muted small">
          Analytic estimates (physics.md §10). Revisit uses the sensor’s field of regard (how far it can point, not the
          instantaneous swath) and assumes passes evenly spread in longitude; 1 usable pass per orbit suits daylight-only
          optical imaging in sun-synchronous orbit. Continuous coverage uses ideal hexagonal packing of footprints — a
          lower bound; real Walker or streets-of-coverage designs need somewhat more. Version 2 adds a coverage
          simulator to check both. Mass to orbit per year is a steady-state replacement view and excludes launch-vehicle
          and dispenser mass.
        </p>
      </main>
    </div>
  )
}
