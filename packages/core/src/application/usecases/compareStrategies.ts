import {
  crossovers,
  rankStrategies,
  realSeries,
  recommend,
  strategyMetrics,
  type RecommendationEntry,
  type StrategyMetrics,
} from '../../domain/analytics'
import { simulate, type StrategyInput } from '../../domain/engine'
import type { Scenario, StrategyParams } from '../../domain/model'
import type { ComparisonResultDto, RecommendationDto, StrategyMetricsDto } from '../dto/comparison'

/** Los ids de las estrategias de un escenario, en el mismo esquema que usa `simulateScenario`. */
export function strategyInputsOf(scenario: Scenario): StrategyInput[] {
  return scenario.strategies.map((params, index) => ({
    id: `${params.type}-${index}`,
    labelKey: `strategy.${params.type}.label`,
    params,
  }))
}

function toMetricsDto(metrics: StrategyMetrics): StrategyMetricsDto {
  return { ...metrics }
}

function toRecommendationDto(recommendation: ReturnType<typeof recommend>): RecommendationDto {
  return {
    headlineKey: recommendation.headlineKey,
    reasons: recommendation.reasons.map((reason) => ({ ...reason })),
    caveats: recommendation.caveats.map((caveat) => ({ ...caveat })),
  }
}

export interface CompareStrategiesOptions {
  /** Cuantos meses simular. Por defecto, el horizonte del escenario. */
  readonly horizonMonths?: number
}

/**
 * Simula todas las estrategias de un escenario y arma la comparacion completa:
 * metricas, ranking, cruces y recomendacion, todo en DTOs para que `ui/**` no
 * tenga que importar `domain/engine` ni `domain/analytics`.
 */
export function compareStrategies(
  scenario: Scenario,
  options: CompareStrategiesOptions = {},
): ComparisonResultDto {
  const inputs = strategyInputsOf(scenario)
  const paramsById = new Map<string, StrategyParams>(
    inputs.map((input) => [input.id, input.params]),
  )

  const { results, horizonMonths, exponent } = simulate(
    scenario,
    inputs,
    options.horizonMonths === undefined ? {} : { horizonMonths: options.horizonMonths },
  )

  const metricsById = new Map<string, StrategyMetrics>(
    results.map((result) => [
      result.strategyId,
      strategyMetrics(result, scenario.assumptions.inflationAnnual, exponent),
    ]),
  )

  const ranked = rankStrategies(
    results.map((result) => ({
      strategyId: result.strategyId,
      metrics: metricsById.get(result.strategyId)!,
    })),
  )

  const recommendationEntries: RecommendationEntry[] = results.map((result) => ({
    strategyId: result.strategyId,
    type: result.type,
    params: paramsById.get(result.strategyId)!,
    metrics: metricsById.get(result.strategyId)!,
  }))
  const recommendation = recommend(recommendationEntries, scenario)

  return {
    horizonMonths,
    strategies: results.map((result) => ({
      strategyId: result.strategyId,
      type: result.type,
      labelKey: result.labelKey,
      points: result.points.map((point) => ({ ...point })),
      realPoints: realSeries(result.points, scenario.assumptions.inflationAnnual, exponent),
      metrics: toMetricsDto(metricsById.get(result.strategyId)!),
    })),
    ranking: ranked.map((entry) => entry.strategyId),
    crossovers: crossovers(results).map((crossover) => ({ ...crossover })),
    recommendation: toRecommendationDto(recommendation),
  }
}
