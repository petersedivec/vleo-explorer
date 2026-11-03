// Heritage missions tab: real spacecraft, sourced parameters, and model vs reality.

import { useMemo } from 'react'
import { HERITAGE_MISSIONS, type Check, type CheckMetric, type HeritageMission } from '../data/heritage'
import { evaluateCheck } from '../model/heritage'
import { duration, sig } from './format'

function formatMetric(metric: CheckMetric, value: number): string {
  switch (metric) {
    case 'propellantLife':
    case 'naturalLifetime':
      return duration(value)
    case 'thrustMargin':
      return `×${sig(value, 2)}`
    case 'decayRate':
      return `${sig((value * 30.4) / 1e3, 2)} km/month`
    case 'propellantNeeded':
      return `${sig(value, 2)} kg`
  }
}

function formatRange(metric: CheckMetric, low: number, high: number) {
  const a = formatMetric(metric, low)
  const b = formatMetric(metric, high)
  return a === b ? a : `${a} – ${b}`
}

function CheckRow({ mission, check }: { mission: HeritageMission; check: Check }) {
  const r = useMemo(() => evaluateCheck(mission, check), [mission, check])
  const verdict =
    r.verdict === 'within'
      ? { cls: 'ok', text: 'Within model range' }
      : r.verdict === 'consistent'
        ? { cls: 'warn', text: `Consistent, but the band spans ×${sig(r.high / r.low, 2)}` }
      : r.verdict === 'modelHigh'
        ? { cls: 'off', text: `Model high by ×${sig(r.ratio!, 2)}` }
        : r.verdict === 'modelLow'
          ? { cls: 'off', text: `Model low by ×${sig(r.ratio!, 2)}` }
          : check.metric === 'thrustMargin'
            ? r.high < 1
              ? { cls: 'off', text: 'Cannot hold altitude' }
              : r.low < 1.5
                ? { cls: 'warn', text: 'Barely holds' }
                : { cls: 'ok', text: 'Holds altitude' }
            : null
  const source = check.source !== undefined ? mission.sources[check.source] : undefined
  return (
    <div className="check">
      <h4>{check.label}</h4>
      <dl>
        <div>
          <dt>What happened</dt>
          <dd>
            {check.observedText}
            {source && (
              <>
                {' '}
                <a href={source.url} target="_blank" rel="noreferrer" title={source.title}>
                  [{(check.source ?? 0) + 1}]
                </a>
              </>
            )}
          </dd>
        </div>
        <div>
          <dt>Model</dt>
          <dd>
            {formatRange(check.metric, r.low, r.high)}{' '}
            <span className="muted">
              (F10.7 {check.f107Range[0]}–{check.f107Range[1]})
            </span>
            {verdict && <span className={`verdict ${verdict.cls}`}>{verdict.text}</span>}
          </dd>
        </div>
      </dl>
      <p>{check.lesson}</p>
    </div>
  )
}

interface HeritageProps {
  selectedId: string
  onSelect: (id: string) => void
  onLoad: (mission: HeritageMission) => void
}

export function Heritage({ selectedId, onSelect, onLoad }: HeritageProps) {
  const mission = HERITAGE_MISSIONS.find((m) => m.id === selectedId) ?? HERITAGE_MISSIONS[0]

  return (
    <div className="heritage">
      <p className="intro">
        Spacecraft that flew in or through very low Earth orbit. Each loads into the model <em>as built</em> — its real
        mass, drag area and thrust — so you can start from realistic numbers and change one thing at a time. Every
        parameter is marked <span className="status published">published</span> or{' '}
        <span className="status estimated">estimated</span>, and each mission compares what actually happened with what
        the model predicts.
      </p>

      <div className="mission-picker" role="list">
        {HERITAGE_MISSIONS.map((m) => (
          <button
            key={m.id}
            type="button"
            role="listitem"
            className={`mission-tile${m.id === mission.id ? ' active' : ''}`}
            aria-pressed={m.id === mission.id}
            onClick={() => onSelect(m.id)}
          >
            <span className="mission-name">{m.name}</span>
            <span className="mission-meta">
              {m.years} · {m.altitudeText}
            </span>
            <span className={`category ${m.category.toLowerCase()}`}>{m.category}</span>
          </button>
        ))}
      </div>

      <article className="mission-detail">
        <header>
          <div>
            <h2>{mission.name}</h2>
            <p className="muted">
              {mission.operator} · {mission.years} · {mission.altitudeText}
            </p>
          </div>
          <button type="button" className="primary" onClick={() => onLoad(mission)}>
            Load into Explore →
          </button>
        </header>
        <p>{mission.summary}</p>
        <h3>What it teaches</h3>
        <ul>
          {mission.teaches.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>

        <h3>Model vs reality</h3>
        <div className="checks">
          {mission.checks.map((c) => (
            <CheckRow key={c.label} mission={mission} check={c} />
          ))}
        </div>

        <h3>Parameters</h3>
        <div className="table-wrap">
          <table className="params">
            <thead>
              <tr>
                <th scope="col">Parameter</th>
                <th scope="col">Value</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {mission.parameters.map((p) => (
                <tr key={p.label}>
                  <th scope="row">{p.label}</th>
                  <td>
                    {p.value}
                    {p.note && <span className="note">{p.note}</span>}
                  </td>
                  <td>
                    <span className={`status ${p.status}`}>{p.status}</span>
                    {p.source !== undefined && (
                      <a href={mission.sources[p.source].url} target="_blank" rel="noreferrer" title={mission.sources[p.source].title}>
                        [{p.source + 1}]
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted small">
          Model checks use the solar activity range shown for each, no storm margin and no design-life cap.
          {mission.inputs.asBuilt.maxThrust_N === 0 && ' This spacecraft is modelled with no drag-makeup thrust.'}
        </p>

        <h3>Sources</h3>
        <ol className="sources">
          {mission.sources.map((s) => (
            <li key={s.url}>
              <a href={s.url} target="_blank" rel="noreferrer">
                {s.title}
              </a>
            </li>
          ))}
        </ol>
      </article>
    </div>
  )
}
