import type { StrategyResult } from '../engine'
import { roundToExponent, type Money, type MonthIndex, type Rate } from '../shared'
import { deflate } from './real'
import { irrMonthly } from './irr'

/** Metricas derivadas de una estrategia ya simulada. */
export interface StrategyMetrics {
  readonly finalNominal: Money
  /** Valor final en poder de compra del mes 0. */
  readonly finalReal: Money
  readonly totalContributed: Money
  /** `finalNominal - totalContributed`. */
  readonly netGain: Money
  /** Ganancia real: valor final real menos lo aportado, tambien deflactado mes a mes. */
  readonly netGainReal: Money
  /** `null` si los flujos no tienen TIR (sin cambio de signo o sin convergencia). */
  readonly irrAnnual: Rate | null
  readonly totalTax: Money
  /**
   * Primer mes desde el que `value >= cumulativeContribution` se mantiene hasta
   * el final. `null` si nunca se alcanza.
   */
  readonly breakevenMonth: MonthIndex | null
}

function totalContributedReal(
  points: StrategyResult['points'],
  inflationAnnual: Rate,
  exponent: number,
): Money {
  const total = points.reduce(
    (acc, point) => acc + deflate(point.contribution, inflationAnnual, point.monthIndex),
    0,
  )
  return roundToExponent(total, exponent)
}

function breakevenMonthOf(points: StrategyResult['points']): MonthIndex | null {
  let breakeven: MonthIndex | null = null
  for (let index = points.length - 1; index >= 0; index -= 1) {
    const point = points[index]!
    if (point.value >= point.cumulativeContribution) {
      breakeven = point.monthIndex
    } else {
      break
    }
  }
  return breakeven
}

/** Flujos money-weighted: `-aportacion` cada mes, mas el valor final en el ultimo. */
function contributionFlows(result: StrategyResult): number[] {
  const flows = result.points.map((point) => -point.contribution)
  const lastIndex = flows.length - 1
  if (lastIndex >= 0) {
    flows[lastIndex] = (flows[lastIndex] ?? 0) + result.finalValue
  }
  return flows
}

export function strategyMetrics(
  result: StrategyResult,
  inflationAnnual: Rate,
  exponent: number,
): StrategyMetrics {
  const lastPoint = result.points[result.points.length - 1]
  const finalMonthIndex = lastPoint ? lastPoint.monthIndex : (0 as MonthIndex)

  const finalReal = roundToExponent(
    deflate(result.finalValue, inflationAnnual, finalMonthIndex),
    exponent,
  )
  const contributedReal = totalContributedReal(result.points, inflationAnnual, exponent)

  const irrResult = irrMonthly(contributionFlows(result))

  return {
    finalNominal: result.finalValue,
    finalReal,
    totalContributed: result.totalContributed,
    netGain: roundToExponent(result.finalValue - result.totalContributed, exponent),
    netGainReal: roundToExponent(finalReal - contributedReal, exponent),
    irrAnnual: irrResult.ok ? irrResult.value : null,
    totalTax: result.totalTax,
    breakevenMonth: breakevenMonthOf(result.points),
  }
}
