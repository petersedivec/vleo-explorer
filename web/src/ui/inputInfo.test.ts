import { describe, expect, it } from 'vitest'
import { INPUT_INFO } from './inputInfo'
import { OUTPUT_GROUPS } from './outputs'

describe('input info', () => {
  const cardIds = new Set(OUTPUT_GROUPS.flatMap((g) => g.cards.map((c) => c.id)))
  it.each(Object.entries(INPUT_INFO))('%s highlights only existing result cards', (_key, info) => {
    for (const id of info.affects) expect(cardIds.has(id), id).toBe(true)
    expect(info.drives.length).toBeGreaterThan(0)
  })
})
