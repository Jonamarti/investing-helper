import { describe, expect, it } from 'vitest'

import { recommend, type RecommendationEntry } from '../../../../src/domain/analytics'
import type { StrategyMetrics } from '../../../../src/domain/analytics'
import type { Loan, Scenario, StrategyParams } from '../../../../src/domain/model'

function metrics(over: Partial<StrategyMetrics> = {}): StrategyMetrics {
  return {
    finalNominal: 1000,
    finalReal: 1000,
    totalContributed: 500,
    netGain: 500,
    netGainReal: 500,
    irrAnnual: 0.05,
    totalTax: 0,
    breakevenMonth: 0,
    ...over,
  }
}

function loan(over: Partial<Loan> & Pick<Loan, 'id' | 'annualRate'>): Loan {
  return {
    nameKey: `loan.${over.id}`,
    kind: 'installment',
    currency: 'EUR',
    principal: 10000,
    termMonths: 60,
    system: 'french',
    startMonth: 0,
    earlyExitPenaltyRate: 0,
    interestDeductible: false,
    ...over,
  }
}

function scenarioWithLoans(loans: readonly Loan[]): Scenario {
  return { loans } as never
}

function entry(
  strategyId: string,
  params: StrategyParams,
  metricsOver: Partial<StrategyMetrics> = {},
): RecommendationEntry {
  return { strategyId, type: params.type, params, metrics: metrics(metricsOver) }
}

const emptyScenario = scenarioWithLoans([])

describe('recommend', () => {
  it('sin estrategias no hay cabecera de ganador', () => {
    expect(recommend([], emptyScenario)).toEqual({
      headlineKey: 'recommendation.headline.empty',
      reasons: [],
      caveats: [],
    })
  })

  it('anuncia a la estrategia con mas patrimonio real como ganadora', () => {
    const winner = entry(
      'equity',
      { type: 'equity', expectedReturn: 0.07, gainTaxMode: 'onExit' },
      {
        finalReal: 2000,
      },
    )
    const loser = entry('cash', { type: 'cash', annualRate: 0.01 }, { finalReal: 1000 })

    const recommendation = recommend([winner, loser], emptyScenario)

    expect(recommendation.headlineKey).toBe('recommendation.headline.winner')
    expect(recommendation.reasons).toContainEqual({
      key: 'recommendation.reason.winner',
      params: { strategyId: 'equity' },
    })
  })

  it('con menos de un 1 % de diferencia en finalReal, es un empate tecnico', () => {
    const a = entry('cash', { type: 'cash', annualRate: 0.01 }, { finalReal: 10_000 })
    const b = entry(
      'bonds',
      {
        type: 'bonds',
        couponRate: 0.03,
        faceValue: 1000,
        purchasePrice: 1000,
        maturityPrice: 1000,
        maturityMonths: 60,
      },
      { finalReal: 10_050 },
    )

    const recommendation = recommend([a, b], emptyScenario)

    expect(recommendation.headlineKey).toBe('recommendation.headline.tie')
    expect(recommendation.reasons).toContainEqual({
      key: 'recommendation.reason.tie',
      params: { a: 'bonds', b: 'cash' },
    })
  })

  it('cuando amortizar gana y el tipo del prestamo supera la mejor inversion, lo dice', () => {
    const scenario = scenarioWithLoans([loan({ id: 'hipo', annualRate: 0.06 })])
    const debt = entry(
      'debt',
      {
        type: 'debtPaydown',
        loanIds: ['hipo'],
        order: 'avalanche',
        goal: 'shortenTerm',
        hurdleRate: 0,
      },
      { finalReal: 5000 },
    )
    const equity = entry(
      'equity',
      { type: 'equity', expectedReturn: 0.04, gainTaxMode: 'onExit' },
      {
        finalReal: 3000,
      },
    )

    const recommendation = recommend([debt, equity], scenario)

    expect(recommendation.reasons).toContainEqual({
      key: 'recommendation.reason.debtBeatsMarket',
      params: { loanRate: 0.06, marketRate: 0.04 },
    })
  })

  it('calcula la rentabilidad de una cartera mixta como media ponderada, e ignora prestamos inexistentes', () => {
    const scenario = scenarioWithLoans([
      loan({ id: 'hipo', annualRate: 0.05 }),
      loan({ id: 'coche', annualRate: 0.07 }),
      loan({ id: 'personal', annualRate: 0.02 }),
    ])
    const debt = entry(
      'debt',
      {
        type: 'debtPaydown',
        loanIds: ['hipo', 'coche', 'personal', 'inexistente'],
        order: 'avalanche',
        goal: 'shortenTerm',
        hurdleRate: 0,
      },
      { finalReal: 9000 },
    )
    // 0.5 * 1 % + 0.3 * 3 % + 0.2 * 7 % = 2.8 %: por debajo del 5 % del prestamo mas caro.
    const mixed = entry(
      'mixed',
      {
        type: 'mixed',
        rebalanceEveryMonths: 12,
        components: [
          { kind: 'cash', weight: 0.5, params: { annualRate: 0.01 } },
          {
            kind: 'bonds',
            weight: 0.3,
            params: {
              couponRate: 0.03,
              faceValue: 1000,
              purchasePrice: 1000,
              maturityPrice: 1000,
              maturityMonths: 60,
            },
          },
          { kind: 'equity', weight: 0.2, params: { expectedReturn: 0.07, gainTaxMode: 'onExit' } },
        ],
      },
      { finalReal: 4000 },
    )
    const equity = entry(
      'equity',
      { type: 'equity', expectedReturn: 0.05, gainTaxMode: 'onExit' },
      {
        finalReal: 4500,
      },
    )
    // Una segunda estrategia de deuda no aporta rentabilidad de mercado: se ignora.
    const otherDebt = entry(
      'otherDebt',
      { type: 'debtPaydown', loanIds: [], order: 'snowball', goal: 'reducePayment', hurdleRate: 0 },
      { finalReal: 100 },
    )

    const recommendation = recommend([debt, mixed, equity, otherDebt], scenario)

    // El tipo mas caro del prestamo (7 %, "coche") gana a la mejor inversion (5 %, equity).
    expect(recommendation.reasons).toContainEqual({
      key: 'recommendation.reason.debtBeatsMarket',
      params: { loanRate: 0.07, marketRate: 0.05 },
    })
  })

  it('no compara amortizar contra el mercado si el tipo del prestamo no lo supera', () => {
    const scenario = scenarioWithLoans([loan({ id: 'hipo', annualRate: 0.02 })])
    const debt = entry(
      'debt',
      {
        type: 'debtPaydown',
        loanIds: ['hipo'],
        order: 'avalanche',
        goal: 'shortenTerm',
        hurdleRate: 0,
      },
      { finalReal: 5000 },
    )
    const equity = entry(
      'equity',
      { type: 'equity', expectedReturn: 0.07, gainTaxMode: 'onExit' },
      {
        finalReal: 3000,
      },
    )

    const recommendation = recommend([debt, equity], scenario)

    expect(
      recommendation.reasons.some((r) => r.key === 'recommendation.reason.debtBeatsMarket'),
    ).toBe(false)
  })

  it('avisa si la ganadora tiene rentabilidad real negativa', () => {
    const winner = entry(
      'cash',
      { type: 'cash', annualRate: 0.01 },
      {
        finalReal: 900,
        netGainReal: -100,
      },
    )

    const recommendation = recommend([winner], emptyScenario)

    expect(recommendation.caveats).toContainEqual({
      key: 'recommendation.caveat.negativeReal',
      params: { netGainReal: -100 },
    })
  })

  it('avisa si el peso fiscal de la ganadora es alto', () => {
    const winner = entry(
      'equity',
      { type: 'equity', expectedReturn: 0.07, gainTaxMode: 'annual' },
      {
        finalReal: 2000,
        netGain: 750,
        totalTax: 250,
      },
    )

    const recommendation = recommend([winner], emptyScenario)

    expect(recommendation.caveats).toContainEqual({
      key: 'recommendation.caveat.highTax',
      params: { taxShare: 0.25 },
    })
  })

  it('no avisa de peso fiscal cuando es bajo', () => {
    const winner = entry(
      'equity',
      { type: 'equity', expectedReturn: 0.07, gainTaxMode: 'annual' },
      {
        finalReal: 2000,
        netGain: 950,
        totalTax: 50,
      },
    )

    const recommendation = recommend([winner], emptyScenario)

    expect(recommendation.caveats.some((c) => c.key === 'recommendation.caveat.highTax')).toBe(
      false,
    )
  })
})
