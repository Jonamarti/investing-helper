import { describe, expect, it } from 'vitest'

import { crossovers } from '../../../../src/domain/analytics'
import type { StrategyResult, ValuePoint } from '../../../../src/domain/engine'

function pointAt(monthIndex: number, value: number): ValuePoint {
  return {
    monthIndex,
    date: `m${monthIndex}`,
    contribution: 0,
    cumulativeContribution: 0,
    value,
    cash: value,
    position: 0,
    grossReturn: 0,
    tax: 0,
    netReturn: 0,
  }
}

function seriesOf(strategyId: string, values: readonly number[]): StrategyResult {
  return {
    strategyId,
    type: 'cash',
    labelKey: `strategy.${strategyId}.label`,
    points: values.map((value, index) => pointAt(index, value)),
    finalValue: values.at(-1) ?? 0,
    totalContributed: 0,
    totalTax: 0,
  }
}

describe('crossovers', () => {
  it('sin cambio de liderazgo no hay cruce', () => {
    const a = seriesOf('a', [100, 200, 300])
    const b = seriesOf('b', [10, 20, 30])
    expect(crossovers([a, b])).toEqual([])
  })

  it('detecta el primer mes en el que se invierte el liderazgo', () => {
    const a = seriesOf('a', [10, 20, 50, 60])
    const b = seriesOf('b', [30, 25, 20, 15])
    expect(crossovers([a, b])).toEqual([{ leaderBefore: 'b', leaderAfter: 'a', monthIndex: 2 }])
  })

  it('un empate exacto no cuenta como cruce si el liderazgo no cambia despues', () => {
    const a = seriesOf('a', [10, 20, 20, 30])
    const b = seriesOf('b', [5, 20, 20, 15])
    expect(crossovers([a, b])).toEqual([])
  })

  it('calcula el cruce por cada par de un grupo de mas de dos estrategias', () => {
    const a = seriesOf('a', [10, 30])
    const b = seriesOf('b', [20, 20])
    const c = seriesOf('c', [5, 40])
    const found = crossovers([a, b, c])
    // a-b: 10<20 -> 30>20, cruce en el mes 1. a-c: 10>5 -> 30<40, cruce en el mes 1.
    // b-c: 20>5 -> 20<40, cruce en el mes 1.
    expect(found).toHaveLength(3)
    expect(found).toContainEqual({ leaderBefore: 'b', leaderAfter: 'a', monthIndex: 1 })
    expect(found).toContainEqual({ leaderBefore: 'a', leaderAfter: 'c', monthIndex: 1 })
    expect(found).toContainEqual({ leaderBefore: 'b', leaderAfter: 'c', monthIndex: 1 })
  })
})
