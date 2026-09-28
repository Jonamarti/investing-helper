import { assertNonEmpty } from '../shared'
import type { Money, Rate } from '../shared'

/** Percentiles habituales de una distribucion de valores finales. */
export interface Percentiles {
  readonly p5: Money
  readonly p25: Money
  readonly p50: Money
  readonly p75: Money
  readonly p95: Money
}

/**
 * Percentil `p` (0-1) de `values` por interpolacion lineal entre los dos
 * puntos mas cercanos (metodo habitual, el mismo que usa Excel `PERCENTILE.INC`).
 */
function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 1) {
    return sorted[0]!
  }
  const rank = p * (sorted.length - 1)
  const lowerIndex = Math.floor(rank)
  const upperIndex = Math.ceil(rank)
  const lower = sorted[lowerIndex]!
  const upper = sorted[upperIndex]!
  return lower + (upper - lower) * (rank - lowerIndex)
}

/** Percentiles p5/p25/p50/p75/p95 de un conjunto de valores finales. */
export function percentilesOf(values: readonly Money[]): Percentiles {
  assertNonEmpty(values, 'values')
  const sorted = [...values].sort((a, b) => a - b)
  return {
    p5: percentile(sorted, 0.05),
    p25: percentile(sorted, 0.25),
    p50: percentile(sorted, 0.5),
    p75: percentile(sorted, 0.75),
    p95: percentile(sorted, 0.95),
  }
}

/** Fraccion de `values` estrictamente por encima de `threshold`. */
export function probabilityAbove(values: readonly number[], threshold: number): Rate {
  assertNonEmpty(values, 'values')
  const count = values.filter((value) => value > threshold).length
  return count / values.length
}

/**
 * Fraccion de trayectorias en las que `a` supera a `b`, comparadas por indice:
 * `a[i]` y `b[i]` son la misma trayectoria simulada con la misma semilla, no
 * dos muestras independientes.
 */
export function probabilityPairwiseAbove(a: readonly number[], b: readonly number[]): Rate {
  assertNonEmpty(a, 'a')
  if (a.length !== b.length) {
    throw new RangeError(
      `Las trayectorias no tienen el mismo numero de caminos: ${a.length} vs ${b.length}`,
    )
  }
  let count = 0
  for (let i = 0; i < a.length; i += 1) {
    if (a[i]! > b[i]!) {
      count += 1
    }
  }
  return count / a.length
}
