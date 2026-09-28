import { describe, expect, it } from 'vitest'

import { rankStrategies, strategyMetrics } from '../../../../src/domain/analytics'
import { defaultScenario, registerAllEngines, simulateScenario } from '../../../../src'

registerAllEngines()

describe('analitica sobre un escenario simulado', () => {
  it('las metricas y el ranking son coherentes con la simulacion del escenario por defecto', () => {
    const scenario = defaultScenario()
    const { results, exponent } = simulateScenario(scenario, { horizonMonths: 60 })

    const ranked = rankStrategies(
      results.map((result) => ({
        strategyId: result.strategyId,
        metrics: strategyMetrics(result, scenario.assumptions.inflationAnnual, exponent),
      })),
    )

    expect(ranked).toHaveLength(results.length)

    for (const result of results) {
      const metrics = strategyMetrics(result, scenario.assumptions.inflationAnnual, exponent)
      const summed = result.points.reduce((acc, point) => acc + point.contribution, 0)

      // El total aportado que reporta el motor cuadra con la suma de los puntos.
      expect(result.totalContributed).toBeCloseTo(summed, 2)
      expect(metrics.totalContributed).toBe(result.totalContributed)
      expect(metrics.finalNominal).toBe(result.finalValue)
      // Con inflacion positiva y valor positivo, lo real nunca supera lo nominal.
      expect(metrics.finalReal).toBeLessThanOrEqual(metrics.finalNominal + 1e-6)
    }

    // El ranking esta ordenado por finalReal descendente.
    for (let i = 1; i < ranked.length; i += 1) {
      expect(ranked[i - 1]!.metrics.finalReal).toBeGreaterThanOrEqual(ranked[i]!.metrics.finalReal)
    }
  })
})
