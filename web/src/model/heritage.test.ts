import { describe, expect, it } from 'vitest'
import { HERITAGE_MISSIONS } from '../data/heritage'
import { evaluateCheck, heritageToInputs } from './heritage'
import { evaluateSatellite } from './satellite'

describe('heritage missions', () => {
  it.each(HERITAGE_MISSIONS)('$name loads and evaluates', (m) => {
    const r = evaluateSatellite(heritageToInputs(m))
    expect(Number.isFinite(r.drag_N)).toBe(true)
    for (const p of m.parameters) if (p.source !== undefined) expect(m.sources[p.source], p.label).toBeDefined()
    for (const c of m.checks) if (c.source !== undefined) expect(m.sources[c.source], c.label).toBeDefined()
  })

  it('GOCE post-fuel reentry from 224 km is within the model band', () => {
    const goce = HERITAGE_MISSIONS.find((m) => m.id === 'goce')!
    expect(evaluateCheck(goce, goce.checks[0]).verdict).toBe('within')
  })

  it('SLATS ion engine holds 217 km but not 167 km', () => {
    const slats = HERITAGE_MISSIONS.find((m) => m.id === 'slats')!
    const [at217, , at167] = slats.checks.map((c) => evaluateCheck(slats, c))
    expect(at217.low).toBeGreaterThan(1)
    expect(at167.high).toBeLessThan(1)
  })

  it('prints all checks for review', () => {
    for (const m of HERITAGE_MISSIONS)
      for (const c of m.checks) {
        const r = evaluateCheck(m, c)
        console.log(`${m.id} | ${c.label} | obs ${c.observed} | model ${r.low.toPrecision(3)}–${r.high.toPrecision(3)} | ${r.verdict} ${r.ratio?.toFixed(2) ?? ''}`)
      }
  })
})
