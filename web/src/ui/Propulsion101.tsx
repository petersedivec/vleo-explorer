// Propulsion 101 tab: core concepts, an at-a-glance chart, and one card per technology.

import { useEffect, type MouseEvent } from 'react'
import { CONCEPTS, TECH_CARDS, type TechCard } from '../data/propulsion101'
import { PROPULSION_PRESETS, thrustToPower_N_W } from '../model/propulsion'
import { Chart } from './Chart'
import { cssColor } from './common'
import { sig, wearLife } from './format'
import { Schematic } from './Schematics'

const CARD_COLOR: Record<TechCard['id'], string> = {
  coldGas: 'var(--tech-0)',
  monoprop: 'var(--tech-1)',
  electrospray: 'var(--tech-2)',
  feep: 'var(--tech-3)',
  griddedIon: 'var(--tech-4)',
  hall: 'var(--tech-5)',
  hallKrypton: 'var(--tech-7)',
  rfPlasma: 'var(--tech-6)',
  airBreathing: 'var(--muted)',
}

function Numbers({ card }: { card: TechCard }) {
  if (card.id === 'airBreathing') return <p className="muted small">Not yet in the model.</p>
  const p = PROPULSION_PRESETS[card.id]
  const rows: [string, string][] = [
    ['Isp in the app', `${sig(p.isp_s, 3)} s`],
    ['Thrust per watt', p.efficiency === null ? 'not power-limited' : `${sig(thrustToPower_N_W(p.isp_s, p.efficiency) * 1e6, 2)} µN/W (η ${p.efficiency})`],
    ['Thrust per unit', p.unitThrust_N >= 0.1 ? `${sig(p.unitThrust_N, 2)} N` : `${sig(p.unitThrust_N * 1e3, 2)} mN`],
    ['Minimum power', p.efficiency === null ? '—' : p.minPower_W ? `${p.minPower_W} W` : 'none'],
    ['Wear life per unit', wearLife(p)],
    ['Tank per kg propellant', `${p.tankFraction} kg`],
  ]
  return (
    <dl className="tech-numbers">
      {rows.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  )
}

function GlanceChart() {
  const charted = TECH_CARDS.filter((c) => c.ispRange_s && c.thrustRange_N)
  const shapes = charted.map((c) => ({
    type: 'rect',
    xref: 'x',
    yref: 'y',
    x0: c.ispRange_s![0],
    x1: c.ispRange_s![1],
    y0: c.thrustRange_N![0] * 1e3,
    y1: c.thrustRange_N![1] * 1e3,
    fillcolor: cssColor(CARD_COLOR[c.id]),
    opacity: 0.22,
    line: { color: cssColor(CARD_COLOR[c.id]), width: 1.5 },
  }))
  const labels = charted.map((c) => ({
    x: [Math.sqrt(c.ispRange_s![0] * c.ispRange_s![1])],
    y: [Math.sqrt(c.thrustRange_N![0] * c.thrustRange_N![1]) * 1e3],
    mode: 'text',
    text: [c.name.replace(/ \(.*\)/, '')],
    textfont: { color: cssColor(CARD_COLOR[c.id]), size: 12 },
    hovertemplate: `${c.name}<br>Isp ${c.ispRange_s![0]}–${c.ispRange_s![1]} s<br>thrust ${sig(c.thrustRange_N![0] * 1e3, 2)}–${sig(c.thrustRange_N![1] * 1e3, 2)} mN<extra></extra>`,
    showlegend: false,
  }))
  return (
    <Chart
      height={420}
      data={labels}
      layout={{
        shapes,
        xaxis: { title: { text: 'Specific impulse (s)' }, type: 'log', range: [1.5, 3.85], tickvals: [30, 100, 300, 1000, 3000], ticktext: ['30', '100', '300', '1,000', '3,000'] },
        yaxis: { title: { text: 'Thrust per unit (mN)' }, type: 'log', range: [-3.2, 4.6], tickvals: [0.001, 0.01, 0.1, 1, 10, 100, 1000, 10000], ticktext: ['0.001', '0.01', '0.1', '1', '10', '100', '1,000', '10,000'] },
        showlegend: false,
      }}
    />
  )
}

const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

interface Props {
  focus: string | null
  backLabel: string
  onBack: () => void
  onCompare: () => void
}

export function Propulsion101({ focus, backLabel, onBack, onCompare }: Props) {
  useEffect(() => {
    if (focus) scrollTo(`tech-${focus}`)
  }, [focus])

  const jump = (id: string) => (e: MouseEvent) => {
    e.preventDefault()
    scrollTo(id)
  }

  return (
    <div className="p101">
      <div className="subpage-head">
        <button type="button" className="link" onClick={onBack}>
          ← Back to {backLabel}
        </button>
        <h2 id="p101-top">Propulsion 101 Overview for VLEO</h2>
        <p className="intro">
          A primer for readers with a space background who are new to spacecraft propulsion: the handful of ideas that
          explain every trade in this app, a map of the field, then one card per technology. Numbers on the cards are the
          ones the model uses.
        </p>
      </div>

      <nav className="contents" aria-label="Contents">
        <h3>Contents</h3>
        <ol>
          <li>
            <a href="#p101-ideas" onClick={jump('p101-ideas')}>
              The ideas that explain everything
            </a>
          </li>
          <li>
            <a href="#p101-glance" onClick={jump('p101-glance')}>
              The field at a glance
            </a>
          </li>
          <li>
            <a href="#p101-techs" onClick={jump('p101-techs')}>
              The technologies
            </a>
            <ul>
              {TECH_CARDS.map((c) => (
                <li key={c.id}>
                  <a href={`#tech-${c.id}`} onClick={jump(`tech-${c.id}`)}>
                    <span className="swatch" style={{ background: CARD_COLOR[c.id] }} />
                    {c.name}
                  </a>
                </li>
              ))}
            </ul>
          </li>
        </ol>
      </nav>

      <section id="p101-ideas" className="anchor">
        <h3>1. The ideas that explain everything</h3>
        <div className="concepts">
          {CONCEPTS.map((c) => (
            <div key={c.title} className="concept">
              <h4>{c.title}</h4>
              {c.equation && <code className="equation">{c.equation}</code>}
              <p>{c.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="p101-glance" className="anchor">
        <h3>2. The field at a glance</h3>
        <figure className="glance">
          <figcaption>
            Thrust per thruster unit vs specific impulse for small-spacecraft systems (published ranges, NASA Small
            Spacecraft Technology State of the Art). Chemical thrusters sit at the top left: lots of thrust, little Isp.
            Electric thrusters sit at the bottom right: little thrust, lots of Isp. VLEO drag makeup needs millinewtons,
            continuously.
          </figcaption>
          <GlanceChart />
        </figure>
      </section>

      <section id="p101-techs" className="anchor">
        <h3>3. The technologies</h3>
        <div className="tech-cards">
          {TECH_CARDS.map((c) => (
            <article key={c.id} id={`tech-${c.id}`} className={`tech-card${focus === c.id ? ' focused' : ''}`}>
              <header>
                <a href="#p101-top" className="to-top" onClick={jump('p101-top')}>
                  ↑ Contents
                </a>
                <h4>
                  <span className="swatch" style={{ background: CARD_COLOR[c.id] }} />
                  {c.name}
                </h4>
                <p className="one-liner">{c.oneLiner}</p>
              </header>
              <Schematic id={c.id} name={c.name} />
              <div className="tech-body">
                <div>
                  <h5>How it works</h5>
                  <p>{c.howItWorks}</p>
                  <h5>Propellant</h5>
                  <p>{c.propellant}</p>
                  <div className="pros-cons">
                    <div>
                      <h5>Strengths</h5>
                      <ul>
                        {c.strengths.map((s) => (
                          <li key={s}>{s}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h5>Weaknesses</h5>
                      <ul>
                        {c.weaknesses.map((s) => (
                          <li key={s}>{s}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
                <div>
                  <h5>Typical numbers</h5>
                  <Numbers card={c} />
                  <h5>Fit for VLEO</h5>
                  <p>{c.vleoFit}</p>
                  <h5>Flight heritage</h5>
                  <p>
                    {c.heritage} <span className="muted">Maturity: {c.maturity}</span>
                  </p>
                  <h5>Further reading</h5>
                  <ul className="reading">
                    {c.reading.map((r) => (
                      <li key={r.url}>
                        <a href={r.url} target="_blank" rel="noreferrer">
                          {r.title}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </article>
          ))}
        </div>
        <p className="p101-actions">
          <button type="button" className="primary" onClick={onCompare}>
            Compare them on your mission →
          </button>
          <button type="button" className="secondary" onClick={onBack}>
            ← Back to {backLabel}
          </button>
        </p>
      </section>
    </div>
  )
}
