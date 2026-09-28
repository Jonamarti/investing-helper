import type { StrategyMetrics } from './metrics'

/** Una estrategia con sus metricas, lista para ordenar. */
export interface RankedStrategy {
  readonly strategyId: string
  readonly metrics: StrategyMetrics
}

/**
 * Orden del comparador: `finalReal` descendente (poder de compra), desempate
 * por TIR descendente y despues por `strategyId`, para que el resultado no
 * dependa del orden de entrada ni de la estabilidad del `sort` del motor de JS.
 */
export function rankStrategies(entries: readonly RankedStrategy[]): RankedStrategy[] {
  return [...entries].sort((a, b) => {
    if (a.metrics.finalReal !== b.metrics.finalReal) {
      return b.metrics.finalReal - a.metrics.finalReal
    }
    const irrA = a.metrics.irrAnnual ?? Number.NEGATIVE_INFINITY
    const irrB = b.metrics.irrAnnual ?? Number.NEGATIVE_INFINITY
    if (irrA !== irrB) {
      return irrB - irrA
    }
    return a.strategyId.localeCompare(b.strategyId)
  })
}
