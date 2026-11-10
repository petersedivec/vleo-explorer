// Constellation tab: satellites needed, replacement rate and mass to orbit per year vs altitude
// (docs/physics.md §10).

import { useDeferredValue, useMemo, useState, type ReactNode } from 'react'
import { SOLAR_MODES } from '../model/atmosphere'
import {
  DEFAULT_CONSTELLATION,
  evaluateConstellation,
  nearOptimumBand,
  optimumAltitude,
  sweepConstellation,
  type ConstellationInputs,
  type ConstellationPoint,
} from '../model/constellation'
import { DEG } from '../model/constants'
import { constellationCost, DEFAULT_COSTS, type CostAssumptions, type CostResult } from '../model/cost'
import type { MissionKind, MissionRequirements } from '../model/missions'
import type { SatelliteInputs } from '../model/satellite'
import { Chart } from './Chart'
import { cssColor, KM, MODE_COLOR, MODE_LABEL, MODES, solarModeOf } from './common'
import { duration, money, moneyRange, sig } from './format'
import { InfoButton } from './InfoButton'
import type { InfoKey } from './inputInfo'

const ALTITUDES = Array.from({ length: 91 }, (_, k) => (150 + 5 * k) * KM)
const ALT_KM = ALTITUDES.map((h) => h / KM)

const MISSIONS: { value: MissionKind; label: string; coverage: Partial<ConstellationInputs> }[] = [
  { value: 'optical', label: 'Optical imaging', coverage: { coverage: 'revisit', passesPerOrbit: 1 } },
  { value: 'sar', label: 'Radar (SAR)', coverage: { coverage: 'revisit', passesPerOrbit: 2 } },
  { value: 'd2d', label: 'Phone service', coverage: { coverage: 'continuous' } },
  { value: 'scaled', label: 'Scale Explore payload', coverage: {} },
]

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
  const setRequirement = (r: Partial<MissionRequirements>) => setC((prev) => ({ ...prev, requirements: { ...prev.requirements, ...r } }))
  const designMode = inputs.mode === 'design'
  const missionPayload = designMode && c.mission !== 'scaled'
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
  const band = nearOptimumBand(current)
  const bestByMode = MODES.map((m) => optimumAltitude(sweeps[m]))

  // Cost (teaching estimate, physics.md §11): low and high bands at every altitude.
  const serviceCtx = {
    coverage: c.coverage,
    latitudeMax_deg: c.latitudeMax_deg,
    cellWidth_m: missionPayload && c.mission === 'd2d' ? c.requirements.cellWidth_m : null,
  }
  const costs = current.map((p) => constellationCost(p, DEFAULT_COSTS, serviceCtx))
  const hereCost = constellationCost(here, DEFAULT_COSTS, serviceCtx)
  const cheapest = (side: 'low' | 'high') =>
    costs.reduce<{ k: number; v: number } | null>((acc, r, k) => (r && (!acc || r[side].perYear < acc.v) ? { k, v: r[side].perYear } : acc), null)
  const cheapLow = cheapest('low')
  const cheapHigh = cheapest('high')
  // Altitudes within 10% of the cheapest, on both the low and the high assumptions.
  const cheapBand = (() => {
    if (!cheapLow || !cheapHigh) return null
    const near = costs.flatMap((r, k) => (r && r.low.perYear <= cheapLow.v * 1.1 && r.high.perYear <= cheapHigh.v * 1.1 ? [ALT_KM[k]] : []))
    return near.length ? [Math.min(...near), Math.max(...near)] : null
  })()

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
        <h2>Mission</h2>
        {segmented('Mission payload', 'mission', c.mission, MISSIONS.map(({ value, label }) => ({ value, label })), (v) =>
          patch({ mission: v, ...MISSIONS.find((m) => m.value === v)!.coverage }),
        )}
        {!designMode ? (
          <p className="control-note">Payload sizing applies in Design mode only; the as-built spacecraft is used as is.</p>
        ) : c.mission === 'optical' ? (
          slider({ label: 'Image resolution (GSD at nadir)', infoKey: 'gsd', value: c.requirements.gsd_m, min: 0.3, max: 5, step: 0.01, log: true, display: `${sig(c.requirements.gsd_m, 2)} m`, onChange: (v) => setRequirement({ gsd_m: Number(v.toPrecision(2)) }) })
        ) : c.mission === 'sar' ? (
          slider({ label: 'Radar sensitivity (NESZ)', infoKey: 'nesz', value: c.requirements.nesz_dB, min: -25, max: -10, step: 0.5, display: `${c.requirements.nesz_dB} dB`, onChange: (v) => setRequirement({ nesz_dB: v }) })
        ) : c.mission === 'd2d' ? (
          slider({ label: 'Cell size on the ground', infoKey: 'cellWidth', value: c.requirements.cellWidth_m / KM, min: 10, max: 200, step: 1, log: true, display: `${sig(c.requirements.cellWidth_m / KM, 2)} km`, onChange: (v) => setRequirement({ cellWidth_m: Number(v.toPrecision(2)) * KM }) })
        ) : (
          slider({ label: 'Payload growth with altitude, k', infoKey: 'payloadExponent', value: c.payloadExponent, min: 0, max: 3, step: 0.1, display: `${c.payloadExponent.toFixed(1)}`, onChange: (v) => patch({ payloadExponent: v }) })
        )}

        <h2>Coverage</h2>
        {segmented('Coverage type', 'coverage', c.coverage, [
          { value: 'revisit', label: 'Revisit (imaging)' },
          { value: 'continuous', label: 'Continuous (comms)' },
        ], (v) => patch({ coverage: v }))}
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
          {missionPayload ? ' payload sized for the mission,' : ` payload ${sig(inputs.payloadMass_kg, 2)} kg at 300 km,`} design life {sig(inputs.designLife_s / 31_557_600, 2)} yr
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
        {inputs.mode === 'asBuilt' && (
          <div className="banner info-banner">
            <strong>As-built spacecraft.</strong> The same real spacecraft — {sig(inputs.asBuilt.dryMass_kg, 3)} kg dry plus{' '}
            {sig(inputs.propellant_kg, 2)} kg propellant — is placed at every altitude: no resizing, no payload growth, and
            life is limited by its fixed propellant. That is why its mass is a flat line.{' '}
            <button type="button" className="link" onClick={() => set({ mode: 'design' })}>
              Switch to Design mode
            </button>{' '}
            to let the model re-size a satellite for each altitude instead.
          </div>
        )}
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
              {here.payload
                ? `${here.payload.sizeLabel} ${here.payload.kind === 'optical' ? `${sig(here.payload.size, 2)} m` : `${sig(here.payload.size, 2)} m²`}; payload ${sig(here.payload.mass_kg, 2)} kg, ${sig(here.payload.power_W, 2)} W`
                : `Payload ×${sig(here.payloadScale, 2)} of the 300 km payload`}
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
            <span className="card-label">Cost per year at {inputs.altitude_m / KM} km (teaching estimate)</span>
            <span className="card-value">{hereCost ? moneyRange([hereCost.low.perYear, hereCost.high.perYear]) : '—'}</span>
            <span className="muted small">
              {hereCost
                ? `Deploy ${moneyRange([hereCost.low.deployment, hereCost.high.deployment])}${hereCost.service ? `; ${hereCost.service.label.toLowerCase()} ${moneyRange(hereCost.service.value)}` : ''}`
                : 'Cannot be sustained here'}
            </span>
          </div>
          <div className="summary-card">
            <span className="card-label">Lowest mass to orbit per year ({MODE_LABEL[mode]})</span>
            <span className="card-value">{best ? `${best.altitude_m / KM} km` : '—'}</span>
            <span className="muted small">
              {best ? `${sig(best.massPerYear_kg, 2)} kg/yr with ${sig(best.satellites, 3)} satellites` : ''}
              {band && band[1] > band[0] && `; within 10% from ${band[0] / KM} to ${band[1] / KM} km`}
              {best && best.altitude_m === ALTITUDES[ALTITUDES.length - 1] && ' — at the top of the range: higher is still better'}
            </span>
          </div>
        </div>

        <div className="charts">
          <figure>
            <figcaption>
              <strong>Mass to orbit per year to sustain the constellation.</strong> Satellites needed × wet mass ÷ life:
              a technical stand-in for cost. The left wall is drag (short lives); the right wall is payload growth with
              altitude.{' '}
              {missionPayload && c.mission === 'sar' && 'A radar antenna grows slowly with altitude, so radar’s optimum sits higher than imaging’s. '}
              {missionPayload && c.mission === 'd2d' && 'A phone-link antenna grows as altitude², but so does each satellite’s footprint, so the optimum drifts toward the top of the range. Phone link margin and latency, which favour lower orbits, are not in this metric. '} Optima: {bestByMode.map((b, k) => `${MODE_LABEL[MODES[k]]} ${b ? `${b.altitude_m / KM} km` : '—'}`).join(', ')}.
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
              <strong>Cost per year to sustain the constellation (teaching estimate, {MODE_LABEL[mode]}).</strong> Building
              and launching replacements, plus operations; the band spans the low and high cost assumptions below.
              Cheapest altitude: {cheapLow ? `${ALT_KM[cheapLow.k]} km` : '—'} (low assumptions),{' '}
              {cheapHigh ? `${ALT_KM[cheapHigh.k]} km` : '—'} (high)
              {cheapBand && cheapBand[1] > cheapBand[0] && `; within 10% of the cheapest from ${cheapBand[0]} to ${cheapBand[1]} km`}. Dollars are rounded to two figures: read the shape and
              the order of magnitude, not the digits.
            </figcaption>
            <Chart
              data={[
                {
                  x: ALT_KM,
                  y: costs.map((r) => (r ? r.low.perYear / 1e6 : null)),
                  name: 'Low assumptions',
                  mode: 'lines',
                  line: { color: cssColor('var(--accent)'), width: 2 },
                },
                {
                  x: ALT_KM,
                  y: costs.map((r) => (r ? r.high.perYear / 1e6 : null)),
                  name: 'High assumptions',
                  mode: 'lines',
                  fill: 'tonexty',
                  fillcolor: cssColor('var(--accent-soft)'),
                  line: { color: cssColor('var(--accent)'), width: 2, dash: 'dash' },
                },
              ]}
              layout={{ xaxis, yaxis: { title: { text: 'US$ million per year' }, type: 'log' }, shapes: [...shading, marker] }}
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
              <strong>Satellite wet mass vs altitude.</strong>{' '}
              {inputs.mode === 'design' ? (
                <>
                  Design mode: the satellite is re-sized at each altitude.{' '}
                  {missionPayload
                    ? `The payload (dotted) is sized to meet the mission requirement at that altitude — ${here.payload?.limitedBy ?? ''}.`
                    : `Payload grows as (h / 300 km)^${c.payloadExponent.toFixed(1)} to keep the same ground performance.`}{' '}
                  At low altitude the arrays, thruster power and propellant needed to fight drag for the whole design life
                  add mass.
                </>
              ) : (
                <>As built: the same spacecraft at every altitude, so its mass does not change.</>
              )}
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
                ...(missionPayload
                  ? [
                      {
                        x: ALT_KM,
                        y: current.map((p) => p.payload?.mass_kg ?? null),
                        name: 'Payload mass',
                        mode: 'lines',
                        line: { color: cssColor('var(--muted)'), width: 2, dash: 'dot' },
                      },
                    ]
                  : []),
              ]}
              layout={{ xaxis, yaxis: { title: { text: 'kg' }, type: 'log' }, shapes: [...shading, marker], showlegend: missionPayload }}
            />
          </figure>
        </div>
        {hereCost && <CostTable cost={hereCost} altitude_km={inputs.altitude_m / KM} />}
        <p className="muted small">
          Analytic estimates (physics.md §10). Revisit uses the sensor’s field of regard (how far it can point, not the
          instantaneous swath) and assumes passes evenly spread in longitude; 1 usable pass per orbit suits daylight-only
          optical imaging in sun-synchronous orbit. Continuous coverage uses ideal hexagonal packing of footprints — a
          lower bound; real Walker or streets-of-coverage designs need somewhat more. Version 2 adds a coverage
          simulator to check both. Mass to orbit per year is a steady-state replacement view and excludes launch-vehicle
          and dispenser mass. Mission payloads (physics.md §9) are first-order teaching models: optical resolution is
          diffraction-limited at nadir; radar is a side-looking stripmap design at 30° incidence, X band, with the
          antenna at 1.2× its ambiguity-limited minimum and about 3 m resolution; the phone link is sized for a 2 GHz
          uplink and the cell size, with the same power per cell.
          Battery mass for radar imaging bursts is not included.
        </p>
      </main>
    </div>
  )
}

const ASSUMPTION_ROWS: [keyof CostAssumptions, string, string][] = [
  ['busPerKg', 'Bus, first unit', 'per kg of dry mass other than payload'],
  ['payloadPerKg', 'Payload, first unit', 'per kg of payload'],
  ['launchPerKg', 'Launch', 'per kg of wet mass (rideshare to dedicated small launcher)'],
  ['opsPerSatelliteYear', 'Operations', 'per satellite per year'],
  ['fixedPerYear', 'Ground segment and mission operations', 'per year, whole constellation'],
]

/** Cost breakdown at the selected altitude, low and high, with the assumptions behind it (physics.md §11). */
function CostTable({ cost, altitude_km }: { cost: CostResult; altitude_km: number }) {
  const rows: [string, number, number][] = [
    ['Build replacement satellites', cost.low.build, cost.high.build],
    ['Launch replacements', cost.low.launch, cost.high.launch],
    ['Operate the fleet', cost.low.operations, cost.high.operations],
    ['Ground segment and mission operations', cost.low.fixed, cost.high.fixed],
  ]
  return (
    <div className="cost-section">
      <h2>Cost breakdown at {altitude_km} km (teaching estimate)</h2>
      <div className="table-wrap">
        <table className="params">
          <thead>
            <tr>
              <th scope="col">Per year</th>
              <th scope="col">Low</th>
              <th scope="col">High</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, lo, hi]) => (
              <tr key={label}>
                <th scope="row">{label}</th>
                <td>{money(lo)}</td>
                <td>{money(hi)}</td>
              </tr>
            ))}
            <tr>
              <th scope="row">
                <strong>Total per year</strong>
              </th>
              <td>
                <strong>{money(cost.low.perYear)}</strong>
              </td>
              <td>
                <strong>{money(cost.high.perYear)}</strong>
              </td>
            </tr>
            <tr>
              <th scope="row">Each satellite: build (average) + launch</th>
              <td>
                {money(cost.low.unit)} + {money(cost.low.launchPerSatellite)}
              </td>
              <td>
                {money(cost.high.unit)} + {money(cost.high.launchPerSatellite)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <details className="cost-assumptions">
        <summary>Cost assumptions (teaching estimates, US$)</summary>
        <div className="table-wrap">
          <table className="params">
            <thead>
              <tr>
                <th scope="col">Item</th>
                <th scope="col">Low</th>
                <th scope="col">High</th>
                <th scope="col">Basis</th>
              </tr>
            </thead>
            <tbody>
              {ASSUMPTION_ROWS.map(([key, label, basis]) => (
                <tr key={key}>
                  <th scope="row">{label}</th>
                  <td>{money(DEFAULT_COSTS[key][0])}</td>
                  <td>{money(DEFAULT_COSTS[key][1])}</td>
                  <td>{basis}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted small">
          Average unit cost follows a learning curve: each doubling of the number built multiplies unit cost by{' '}
          {Math.round(cost.learningRate * 100)}% here (95% below 10 units, 90% for 10–50, 85% above 50). Steady state:
          satellites are replaced as they reach end of life. Not included: development (non-recurring) cost, financing
          and the time value of money, insurance, launch failures, spectrum and licensing. Cost per unit of service is
          the yearly cost divided by the area actually imaged (imaging) or by the number of cells served (phone
          service); it is a cost to collect or serve, not a market price. See physics.md §11.
        </p>
      </details>
    </div>
  )
}
