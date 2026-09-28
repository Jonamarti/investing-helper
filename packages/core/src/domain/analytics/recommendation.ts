import {
  findLoan,
  type BondsParams,
  type CashParams,
  type EquityParams,
  type MixedComponent,
  type Scenario,
  type StrategyParams,
  type StrategyType,
} from '../model'
import type { StrategyMetrics } from './metrics'
import { rankStrategies } from './ranking'

/** Diferencia relativa en `finalReal` por debajo de la cual dos estrategias empatan. */
const TIE_THRESHOLD = 0.01
/** Peso del impuesto sobre la ganancia bruta a partir del cual se avisa. */
const HIGH_TAX_SHARE = 0.25

export interface RecommendationItem {
  readonly key: string
  readonly params?: Readonly<Record<string, number | string>>
}

/** Salida del motor de reglas: una cabecera i18n, razones y avisos. */
export interface Recommendation {
  readonly headlineKey: string
  readonly reasons: readonly RecommendationItem[]
  readonly caveats: readonly RecommendationItem[]
}

/** Lo que el motor de reglas necesita de cada estrategia ya simulada. */
export interface RecommendationEntry {
  readonly strategyId: string
  readonly type: StrategyType
  readonly params: StrategyParams
  readonly metrics: StrategyMetrics
}

function componentReturnOf(component: MixedComponent): number {
  switch (component.kind) {
    case 'cash':
      return (component.params as CashParams).annualRate
    case 'bonds':
      return (component.params as BondsParams).couponRate
    case 'equity':
      return (component.params as EquityParams).expectedReturn
  }
}

/**
 * Rentabilidad esperada anual "de un vistazo" de una estrategia, para comparar
 * contra el tipo de un prestamo. `null` en amortizar deuda, que no invierte.
 */
function expectedReturnOf(params: StrategyParams): number | null {
  switch (params.type) {
    case 'cash':
      return params.annualRate
    case 'bonds':
      return params.couponRate
    case 'equity':
      return params.expectedReturn
    case 'mixed':
      return params.components.reduce(
        (acc, component) => acc + component.weight * componentReturnOf(component),
        0,
      )
    case 'debtPaydown':
      return null
  }
}

function bestInvestmentReturn(
  entries: readonly RecommendationEntry[],
  excludeStrategyId: string,
): number | null {
  let best: number | null = null
  for (const entry of entries) {
    if (entry.strategyId === excludeStrategyId) {
      continue
    }
    const candidate = expectedReturnOf(entry.params)
    if (candidate !== null && (best === null || candidate > best)) {
      best = candidate
    }
  }
  return best
}

function maxLoanRate(scenario: Scenario, loanIds: readonly string[]): number | null {
  let best: number | null = null
  for (const loanId of loanIds) {
    const loan = findLoan(scenario, loanId)
    if (loan && (best === null || loan.annualRate > best)) {
      best = loan.annualRate
    }
  }
  return best
}

/**
 * Motor de reglas puro sobre estrategias ya simuladas.
 *
 * No vuelve a simular nada: solo lee `metrics` (de `strategyMetrics`) y los
 * parametros originales, para poder comparar el tipo de un prestamo contra la
 * rentabilidad esperada de la mejor inversion.
 */
export function recommend(
  entries: readonly RecommendationEntry[],
  scenario: Scenario,
): Recommendation {
  if (entries.length === 0) {
    return { headlineKey: 'recommendation.headline.empty', reasons: [], caveats: [] }
  }

  const ranked = rankStrategies(
    entries.map((entry) => ({ strategyId: entry.strategyId, metrics: entry.metrics })),
  )
  const top = ranked[0]!
  const second = ranked[1]
  const winner = entries.find((entry) => entry.strategyId === top.strategyId)!

  const isTie =
    second !== undefined &&
    top.metrics.finalReal !== 0 &&
    Math.abs(top.metrics.finalReal - second.metrics.finalReal) / Math.abs(top.metrics.finalReal) <
      TIE_THRESHOLD

  const reasons: RecommendationItem[] = []
  const caveats: RecommendationItem[] = []

  if (isTie && second) {
    reasons.push({
      key: 'recommendation.reason.tie',
      params: { a: top.strategyId, b: second.strategyId },
    })
  } else {
    reasons.push({ key: 'recommendation.reason.winner', params: { strategyId: winner.strategyId } })
  }

  if (winner.type === 'debtPaydown' && winner.params.type === 'debtPaydown') {
    const loanRate = maxLoanRate(scenario, winner.params.loanIds)
    const marketRate = bestInvestmentReturn(entries, winner.strategyId)
    if (loanRate !== null && marketRate !== null && loanRate > marketRate) {
      reasons.push({
        key: 'recommendation.reason.debtBeatsMarket',
        params: { loanRate, marketRate },
      })
    }
  }

  if (winner.metrics.netGainReal < 0) {
    caveats.push({
      key: 'recommendation.caveat.negativeReal',
      params: { netGainReal: winner.metrics.netGainReal },
    })
  }

  const grossGain = winner.metrics.netGain + winner.metrics.totalTax
  if (grossGain > 0 && winner.metrics.totalTax / grossGain >= HIGH_TAX_SHARE) {
    caveats.push({
      key: 'recommendation.caveat.highTax',
      params: { taxShare: winner.metrics.totalTax / grossGain },
    })
  }

  return {
    headlineKey: isTie ? 'recommendation.headline.tie' : 'recommendation.headline.winner',
    reasons,
    caveats,
  }
}
