import type { StrategyResult } from '../engine'
import type { MonthIndex } from '../shared'

/** Primer mes en el que `leaderAfter` adelanta a `leaderBefore`. */
export interface Crossover {
  readonly leaderBefore: string
  readonly leaderAfter: string
  readonly monthIndex: MonthIndex
}

/**
 * Primer cambio de signo de `a(t) - b(t)`, ignorando los meses en que empatan.
 *
 * Un empate exacto no es un cruce: si `a` iguala a `b` y luego sigue del mismo
 * lado, no ha pasado nada; el cruce es el primer cambio de liderazgo real.
 */
function firstCrossover(a: StrategyResult, b: StrategyResult): Crossover | null {
  let leaderSign: number | null = null
  const length = Math.min(a.points.length, b.points.length)

  for (let index = 0; index < length; index += 1) {
    const diff = a.points[index]!.value - b.points[index]!.value
    if (diff === 0) {
      continue
    }
    const sign = Math.sign(diff)
    if (leaderSign === null) {
      leaderSign = sign
      continue
    }
    if (sign !== leaderSign) {
      return {
        leaderBefore: leaderSign > 0 ? a.strategyId : b.strategyId,
        leaderAfter: sign > 0 ? a.strategyId : b.strategyId,
        monthIndex: a.points[index]!.monthIndex,
      }
    }
  }
  return null
}

/** El primer cruce de cada par de estrategias, para "X supera a Y en el mes N". */
export function crossovers(results: readonly StrategyResult[]): Crossover[] {
  const found: Crossover[] = []
  for (let i = 0; i < results.length; i += 1) {
    for (let j = i + 1; j < results.length; j += 1) {
      const crossover = firstCrossover(results[i]!, results[j]!)
      if (crossover) {
        found.push(crossover)
      }
    }
  }
  return found
}
