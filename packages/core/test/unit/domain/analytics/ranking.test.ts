import fc from 'fast-check'
import { describe, expect, it } from 'vitest'

import { rankStrategies, type RankedStrategy } from '../../../../src/domain/analytics'
import type { StrategyMetrics } from '../../../../src/domain/analytics'

function metricsOf(finalReal: number, irrAnnual: number | null = null): StrategyMetrics {
  return {
    finalNominal: finalReal,
    finalReal,
    totalContributed: 0,
    netGain: 0,
    netGainReal: 0,
    irrAnnual,
    totalTax: 0,
    breakevenMonth: null,
  }
}

function entry(
  strategyId: string,
  finalReal: number,
  irrAnnual: number | null = null,
): RankedStrategy {
  return { strategyId, metrics: metricsOf(finalReal, irrAnnual) }
}

/** Shuffle determinista, sin depender de la implementacion de fast-check. */
function shuffle<T>(items: readonly T[], seed: number): T[] {
  const arr = [...items]
  let state = seed >>> 0
  for (let i = arr.length - 1; i > 0; i -= 1) {
    state = (state * 1664525 + 1013904223) >>> 0
    const j = state % (i + 1)
    const tmp = arr[i]!
    arr[i] = arr[j]!
    arr[j] = tmp
  }
  return arr
}

describe('rankStrategies', () => {
  it('ordena por finalReal descendente', () => {
    const ranked = rankStrategies([entry('a', 100), entry('b', 300), entry('c', 200)])
    expect(ranked.map((r) => r.strategyId)).toEqual(['b', 'c', 'a'])
  })

  it('desempata por TIR descendente cuando finalReal empata', () => {
    const ranked = rankStrategies([
      entry('a', 100, 0.05),
      entry('b', 100, 0.08),
      entry('c', 100, 0.02),
    ])
    expect(ranked.map((r) => r.strategyId)).toEqual(['b', 'a', 'c'])
  })

  it('sin TIR se trata como la peor, y el ultimo desempate es por strategyId', () => {
    const ranked = rankStrategies([
      entry('z', 100, null),
      entry('a', 100, null),
      entry('m', 100, 0.01),
    ])
    expect(ranked.map((r) => r.strategyId)).toEqual(['m', 'a', 'z'])
  })

  it('el ranking no depende del orden de entrada', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            finalReal: fc.double({ min: -1_000_000, max: 1_000_000, noNaN: true }),
            irrAnnual: fc.option(fc.double({ min: -0.5, max: 0.5, noNaN: true }), { nil: null }),
          }),
          { minLength: 2, maxLength: 10 },
        ),
        fc.integer({ min: 0, max: 2 ** 31 - 1 }),
        (raw, seed) => {
          const entries = raw.map((r, index) => entry(`s${index}`, r.finalReal, r.irrAnnual))
          const shuffled = shuffle(entries, seed)
          expect(rankStrategies(shuffled)).toEqual(rankStrategies(entries))
        },
      ),
    )
  })
})
