import { describe, expect, it } from 'vitest'

import { strategyMetrics } from '../../../../src/domain/analytics'
import type { StrategyResult, ValuePoint } from '../../../../src/domain/engine'

function point(over: Partial<ValuePoint> & Pick<ValuePoint, 'monthIndex'>): ValuePoint {
  return {
    date: '2026-01',
    contribution: 0,
    cumulativeContribution: 0,
    value: 0,
    cash: 0,
    position: 0,
    grossReturn: 0,
    tax: 0,
    netReturn: 0,
    ...over,
  }
}

function result(over: Partial<StrategyResult> & Pick<StrategyResult, 'points'>): StrategyResult {
  return {
    strategyId: 'test',
    type: 'cash',
    labelKey: 'strategy.cash.label',
    finalValue: 0,
    totalContributed: 0,
    totalTax: 0,
    ...over,
  }
}

describe('strategyMetrics', () => {
  it('sin inflacion y sin rendimiento, la TIR es cero y se llega al breakeven desde el primer mes', () => {
    // 1000 al mes, tres meses, sin crecimiento: el valor es siempre lo aportado.
    const points = [
      point({ monthIndex: 0, contribution: 1000, cumulativeContribution: 1000, value: 1000 }),
      point({ monthIndex: 1, contribution: 1000, cumulativeContribution: 2000, value: 2000 }),
      point({ monthIndex: 2, contribution: 1000, cumulativeContribution: 3000, value: 3000 }),
    ]
    const strategyResult = result({ points, finalValue: 3000, totalContributed: 3000 })

    const metrics = strategyMetrics(strategyResult, 0, 2)

    expect(metrics.finalNominal).toBe(3000)
    expect(metrics.finalReal).toBe(3000)
    expect(metrics.netGain).toBe(0)
    expect(metrics.netGainReal).toBe(0)
    expect(metrics.irrAnnual).toBeCloseTo(0, 6)
    expect(metrics.breakevenMonth).toBe(0)
  })

  it('la inflacion deflacta el valor final pero no cambia lo nominal', () => {
    const points = [
      point({ monthIndex: 11, contribution: 0, cumulativeContribution: 1000, value: 1000 }),
    ]
    const strategyResult = result({ points, finalValue: 1000, totalContributed: 1000 })

    const metrics = strategyMetrics(strategyResult, 0.02, 2)

    expect(metrics.finalNominal).toBe(1000)
    expect(metrics.finalReal).toBeCloseTo(1000 / 1.02, 2)
  })

  it('si nunca se alcanza el capital aportado, no hay breakeven', () => {
    const points = [
      point({ monthIndex: 0, contribution: 1000, cumulativeContribution: 1000, value: 900 }),
      point({ monthIndex: 1, contribution: 0, cumulativeContribution: 1000, value: 850 }),
    ]
    const strategyResult = result({ points, finalValue: 850, totalContributed: 1000 })

    const metrics = strategyMetrics(strategyResult, 0, 2)

    expect(metrics.breakevenMonth).toBeNull()
    expect(metrics.netGain).toBeCloseTo(-150, 2)
  })

  it('el breakeven es el primer mes desde el que el valor se mantiene por encima', () => {
    const points = [
      point({ monthIndex: 0, contribution: 1000, cumulativeContribution: 1000, value: 900 }),
      point({ monthIndex: 1, contribution: 0, cumulativeContribution: 1000, value: 1050 }),
      point({ monthIndex: 2, contribution: 0, cumulativeContribution: 1000, value: 1100 }),
    ]
    const strategyResult = result({ points, finalValue: 1100, totalContributed: 1000 })

    const metrics = strategyMetrics(strategyResult, 0, 2)

    expect(metrics.breakevenMonth).toBe(1)
  })

  it('sin flujos con cambio de signo, la TIR es null', () => {
    // Sin aportaciones y valor final cero: no hay ni entrada ni salida.
    const points = [point({ monthIndex: 0, contribution: 0, cumulativeContribution: 0, value: 0 })]
    const strategyResult = result({ points, finalValue: 0, totalContributed: 0 })

    const metrics = strategyMetrics(strategyResult, 0, 2)

    expect(metrics.irrAnnual).toBeNull()
  })
})
