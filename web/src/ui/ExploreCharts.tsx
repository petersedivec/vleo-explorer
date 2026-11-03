import { useDeferredValue, useMemo } from 'react'
import { exponentialDensity_kg_m3, msisDensity_kg_m3, SOLAR_MODES, type SolarMode } from '../model/atmosphere'
import { YEAR_S } from '../model/constants'
import { sweepAltitude, type SatelliteInputs, type SatelliteResult } from '../model/satellite'
import { Chart } from './Chart'
import { cssColor, KM, MODE_COLOR, MODE_LABEL, MODES, SWEEP_ALTITUDES, SWEEP_KM } from './common'

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

export function ExploreCharts({ inputs }: { inputs: SatelliteInputs }) {
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
    y: sweeps[m].map((r) => (r.infeasibility === 'loopDiverged' || r.infeasibility === 'loopNotConverged' ? null : r.naturalLifetime_s / YEAR_S)),
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
      y: sweeps.moderate.map((r) => (r.infeasibility === 'loopDiverged' || r.infeasibility === 'loopNotConverged' ? null : r.drag_N * 1e3)),
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
          <strong>Mission life vs altitude.</strong> Shaded: no design closes, or (as built) thrust is below drag, at moderate activity. Life is capped by
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
