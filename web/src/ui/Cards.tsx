// Result cards with equation and explanation; highlights cards an open input info affects.

import { useEffect, useRef } from 'react'
import type { SatelliteInputs, SatelliteResult } from '../model/satellite'
import { sig } from './format'
import { OUTPUT_GROUPS } from './outputs'

interface CardsProps {
  inputs: SatelliteInputs
  result: SatelliteResult
  highlight: ReadonlySet<string>
}

export function Cards({ inputs, result, highlight }: CardsProps) {
  const previous = useRef<SatelliteResult | null>(null)
  const prior = previous.current
  useEffect(() => {
    previous.current = result
  }, [result])

  return (
    <div className={`groups${highlight.size ? ' highlighting' : ''}`}>
      {OUTPUT_GROUPS.map((group) => (
        <section key={group.title} className="group">
          <h2>{group.title}</h2>
          <div className="cards">
            {group.cards
              .filter((card) => !(card.designOnly && inputs.mode === 'asBuilt'))
              .map((card) => {
              const now = card.raw(result)
              const before = prior ? card.raw(prior) : NaN
              const change = Number.isFinite(now) && Number.isFinite(before) && before !== 0 ? now / before - 1 : 0
              const showChange = Math.abs(change) > 0.005
              return (
                <details key={card.id} className={`card${highlight.has(card.id) ? ' highlight' : ''}`}>
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
