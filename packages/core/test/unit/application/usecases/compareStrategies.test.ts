import { describe, expect, it } from 'vitest'

import { compareStrategies } from '../../../../src/application'
import { defaultScenario, registerAllEngines } from '../../../../src'

registerAllEngines()

describe('compareStrategies', () => {
  it('simula las tres estrategias del escenario por defecto y arma la comparacion completa', () => {
    const scenario = defaultScenario()
    const comparison = compareStrategies(scenario, { horizonMonths: 60 })

    expect(comparison.horizonMonths).toBe(60)
    expect(comparison.strategies).toHaveLength(3)
    expect(new Set(comparison.ranking)).toEqual(
      new Set(comparison.strategies.map((s) => s.strategyId)),
    )
    expect(comparison.ranking).toHaveLength(3)

    for (const strategy of comparison.strategies) {
      expect(strategy.points).toHaveLength(60)
      expect(strategy.realPoints).toHaveLength(60)
      expect(strategy.metrics.finalNominal).toBe(strategy.points.at(-1)?.value)
      expect(strategy.metrics.finalReal).toBe(strategy.realPoints.at(-1)?.value)
    }

    expect(comparison.recommendation.headlineKey).toMatch(/^recommendation\.headline\./)
    expect(comparison.recommendation.reasons.length).toBeGreaterThan(0)
  })

  it('el ranking esta ordenado por finalReal descendente', () => {
    const scenario = defaultScenario()
    const comparison = compareStrategies(scenario, { horizonMonths: 36 })
    const finalRealById = new Map(
      comparison.strategies.map((s) => [s.strategyId, s.metrics.finalReal]),
    )

    for (let i = 1; i < comparison.ranking.length; i += 1) {
      const previous = finalRealById.get(comparison.ranking[i - 1]!)!
      const current = finalRealById.get(comparison.ranking[i]!)!
      expect(previous).toBeGreaterThanOrEqual(current)
    }
  })

  it('el total aportado del DTO coincide con la suma de los puntos', () => {
    const scenario = defaultScenario()
    const comparison = compareStrategies(scenario, { horizonMonths: 24 })
    for (const strategy of comparison.strategies) {
      const summed = strategy.points.reduce((acc, point) => acc + point.contribution, 0)
      expect(strategy.metrics.totalContributed).toBeCloseTo(summed, 2)
    }
  })
})
