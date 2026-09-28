import { describe, expect, it } from 'vitest'

import { mulberry32 } from '../../../../src/infrastructure/rng/mulberry32'

describe('mulberry32', () => {
  it('la misma semilla da siempre la misma secuencia', () => {
    const a = mulberry32(42)
    const b = mulberry32(42)
    const sequenceA = Array.from({ length: 10 }, () => a.next())
    const sequenceB = Array.from({ length: 10 }, () => b.next())
    expect(sequenceA).toEqual(sequenceB)
  })

  it('semillas distintas dan secuencias distintas', () => {
    const a = mulberry32(1)
    const b = mulberry32(2)
    expect(a.next()).not.toBe(b.next())
  })

  it('siempre da un numero en [0, 1)', () => {
    const rng = mulberry32(7)
    for (let i = 0; i < 1000; i += 1) {
      const value = rng.next()
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
  })
})
