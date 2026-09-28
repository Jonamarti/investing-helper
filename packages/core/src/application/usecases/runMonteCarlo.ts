import { strategyMetrics } from '../../domain/analytics'
import { simulate, type StrategyInput } from '../../domain/engine'
import { horizonOf, type MonteCarloSettings, type Scenario } from '../../domain/model'
import { percentilesOf, probabilityAbove, sampleGbmPath } from '../../domain/montecarlo'
import type { IRandomSource } from '../ports/random'
import type { MonteCarloResultDto } from '../dto/monteCarlo'
import { strategyInputsOf } from './compareStrategies'

export interface RunMonteCarloOptions {
  readonly horizonMonths?: number
}

/**
 * Monte Carlo de una estrategia de renta variable dentro de un escenario.
 *
 * Solo `equity` tiene una trayectoria GBM que sustituir (ver
 * `EngineContext.month.randomMonthlyReturn` y `docs/arquitectura.md`): el resto
 * de estrategias del escenario se simulan una vez, deterministas, para dar la
 * referencia de "mejor alternativa".
 *
 * `random` se avanza una vez por cada Z de cada mes de cada camino: con la
 * misma semilla (mismo estado inicial de `random`) y los mismos parametros, el
 * resultado es identico.
 */
export function runMonteCarlo(
  scenario: Scenario,
  equityStrategy: StrategyInput,
  settings: MonteCarloSettings,
  random: IRandomSource,
  options: RunMonteCarloOptions = {},
): MonteCarloResultDto {
  if (equityStrategy.params.type !== 'equity') {
    throw new Error(
      `runMonteCarlo solo soporta estrategias "equity" por ahora, recibido: "${equityStrategy.params.type}"`,
    )
  }
  const equityParams = equityStrategy.params
  const horizon = options.horizonMonths ?? horizonOf(scenario)
  const nextUniform = () => random.next()

  const finalValues: number[] = []
  const netGainReals: number[] = []

  for (let path = 0; path < settings.paths; path += 1) {
    const monthlyReturns = sampleGbmPath(
      horizon,
      equityParams.expectedReturn,
      settings.equityVolatilityAnnual,
      nextUniform,
    )
    const { results, exponent } = simulate(scenario, [equityStrategy], {
      horizonMonths: horizon,
      randomMonthlyReturnFor: (_strategyId, monthIndex) => monthlyReturns[monthIndex],
    })
    const result = results[0]!
    finalValues.push(result.finalValue)
    netGainReals.push(
      strategyMetrics(result, scenario.assumptions.inflationAnnual, exponent).netGainReal,
    )
  }

  const others = strategyInputsOf(scenario).filter((input) => input.id !== equityStrategy.id)
  const bestOtherFinal =
    others.length === 0
      ? null
      : Math.max(
          ...simulate(scenario, others, { horizonMonths: horizon }).results.map(
            (r) => r.finalValue,
          ),
        )

  return {
    strategyId: equityStrategy.id,
    ...percentilesOf(finalValues),
    probBeatsBest: bestOtherFinal === null ? null : probabilityAbove(finalValues, bestOtherFinal),
    probBeatsInflation: probabilityAbove(netGainReals, 0),
    finalValues,
  }
}
