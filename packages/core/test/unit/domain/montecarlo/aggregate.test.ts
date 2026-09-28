import fc from 'fast-check'
import { describe, expect, it } from 'vitest'

import {
  percentilesOf,
  probabilityAbove,
  probabilityPairwiseAbove,
} from '../../../../src/domain/montecarlo'

describe('percentilesOf', () => {
  it('con 101 valores de 0 a 100, cada percentil es su propio numero', () => {
    const values = Array.from({ length: 101 }, (_, i) => i)
    const percentiles = percentilesOf(values)
    expect(percentiles).toEqual({ p5: 5, p25: 25, p50: 50, p75: 75, p95: 95 })
  })

  it('un unico valor es el percentil de si mismo en todos los cortes', () => {
    expect(percentilesOf([42])).toEqual({ p5: 42, p25: 42, p50: 42, p75: 42, p95: 42 })
  })

  it('no depende del orden de entrada', () => {
    fc.assert(
      fc.property(
        fc.array(fc.double({ min: -1_000_000, max: 1_000_000, noNaN: true }), { minLength: 1 }),
        fc.integer({ min: 0, max: 2 ** 31 - 1 }),
        (values, seed) => {
          const shuffled = [...values]
          let state = seed >>> 0
          for (let i = shuffled.length - 1; i > 0; i -= 1) {
            state = (state * 1664525 + 1013904223) >>> 0
            const j = state % (i + 1)
            const tmp = shuffled[i]!
            shuffled[i] = shuffled[j]!
            shuffled[j] = tmp
          }
          expect(percentilesOf(shuffled)).toEqual(percentilesOf(values))
        },
      ),
    )
  })

  it('los percentiles son monotonos crecientes', () => {
    fc.assert(
      fc.property(
        fc.array(fc.double({ min: -1_000_000, max: 1_000_000, noNaN: true }), { minLength: 2 }),
        (values) => {
          const { p5, p25, p50, p75, p95 } = percentilesOf(values)
          expect(p5).toBeLessThanOrEqual(p25)
          expect(p25).toBeLessThanOrEqual(p50)
          expect(p50).toBeLessThanOrEqual(p75)
          expect(p75).toBeLessThanOrEqual(p95)
        },
      ),
    )
  })
})

describe('probabilityAbove', () => {
  it('cuenta la fraccion estrictamente por encima del umbral', () => {
    expect(probabilityAbove([1, 2, 3, 4], 2)).toBe(0.5)
  })

  it('nada por encima es 0, todo por encima es 1', () => {
    expect(probabilityAbove([1, 2, 3], 10)).toBe(0)
    expect(probabilityAbove([1, 2, 3], 0)).toBe(1)
  })
})

describe('probabilityPairwiseAbove', () => {
  it('compara trayectoria a trayectoria, no independientemente', () => {
    // a supera a b en 2 de 4 caminos, no en la mitad de todas las combinaciones.
    expect(probabilityPairwiseAbove([10, 1, 10, 1], [5, 5, 5, 5])).toBe(0.5)
  })

  it('exige el mismo numero de caminos en ambos lados', () => {
    expect(() => probabilityPairwiseAbove([1, 2], [1])).toThrow(/mismo numero de caminos/)
  })
})
