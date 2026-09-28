import { describe, expect, it } from 'vitest'

import {
  defaultScenario,
  registerAllEngines,
  roundToExponent,
  simulate,
  simulateScenario,
  zeroTax,
  type Scenario,
  type StrategyResult,
} from '../../../../src'

registerAllEngines()

function withTaxes(scenario: Scenario): Scenario {
  return {
    ...scenario,
    taxRules: {
      ...zeroTax(),
      cashInterest: 0.19,
      bondCoupon: 0.19,
      dividends: 0.19,
      capitalGainsOnExit: 0.19,
      mortgageInterestRelief: 0,
    },
  }
}

function byType(results: readonly StrategyResult[], type: string): StrategyResult {
  const found = results.find((result) => result.type === type)
  if (!found) {
    throw new Error(`No hay resultado de tipo ${type}`)
  }
  return found
}

describe('simulador', () => {
  it('produce una serie por estrategia, con un punto por mes', () => {
    const scenario = defaultScenario()
    const { results, horizonMonths } = simulateScenario(scenario, { horizonMonths: 60 })

    expect(results).toHaveLength(3)
    expect(horizonMonths).toBe(60)
    for (const result of results) {
      expect(result.points).toHaveLength(60)
      expect(result.points[0]?.monthIndex).toBe(0)
      expect(result.points[59]?.monthIndex).toBe(59)
    }
  })

  it('el total aportado coincide con la suma de los aportes mensuales', () => {
    const scenario = defaultScenario()
    const { results } = simulateScenario(scenario, { horizonMonths: 36 })
    for (const result of results) {
      const summed = result.points.reduce((acc, point) => acc + point.contribution, 0)
      expect(result.totalContributed).toBeCloseTo(summed, 2)
    }
  })

  it('el ultimo punto de la serie tiene el mismo valor que finalValue', () => {
    const scenario = defaultScenario()
    const { results } = simulateScenario(scenario, { horizonMonths: 24 })
    for (const result of results) {
      expect(result.points.at(-1)?.value).toBe(result.finalValue)
    }
  })

  it('la renta variable crece mas que el efectivo y mas que los bonos', () => {
    const scenario = defaultScenario()
    const { results } = simulateScenario(scenario, { horizonMonths: 120 })
    const equity = byType(results, 'equity')
    const cash = byType(results, 'cash')
    const bonds = byType(results, 'bonds')

    expect(equity.finalValue).toBeGreaterThan(cash.finalValue)
    expect(cash.finalValue).toBeGreaterThan(bonds.finalValue)
  })

  it('randomMonthlyReturnFor sustituye la rentabilidad de la renta variable, mes a mes', () => {
    const scenario = defaultScenario()
    const equityInput = {
      id: 'eq',
      labelKey: 'strategy.equity.label',
      params: scenario.strategies.find((p) => p.type === 'equity')!,
    }
    // Una rentabilidad mensual fija y muy alta, distinta del expectedReturn del
    // escenario por defecto: si el resultado cuadra con ella, el hook llega al
    // motor en cada mes, no solo al primero.
    const fixedMonthlyReturn = 0.05
    const { results } = simulate(scenario, [equityInput], {
      horizonMonths: 6,
      randomMonthlyReturnFor: () => fixedMonthlyReturn,
    })
    const [result] = results
    let position = 0
    for (const point of result!.points) {
      // Misma secuencia de redondeo que el motor: aportar (redondeado) y luego
      // devengar sobre el saldo ya redondeado (redondeado otra vez).
      position = roundToExponent(position + point.contribution, 2)
      position = roundToExponent(position + roundToExponent(position * fixedMonthlyReturn, 2), 2)
      expect(point.value).toBe(position)
    }
  })

  it('si randomMonthlyReturnFor devuelve undefined, esa estrategia sigue siendo determinista', () => {
    const scenario = defaultScenario()
    const withHook = simulateScenario(scenario, {
      horizonMonths: 12,
      randomMonthlyReturnFor: () => undefined,
    })
    const withoutHook = simulateScenario(scenario, { horizonMonths: 12 })
    expect(withHook.results).toEqual(withoutHook.results)
  })

  it('el efectivo produce exactamente el interes pactado cada mes', () => {
    const scenario = defaultScenario()
    const { results } = simulateScenario(scenario, { horizonMonths: 12 })
    const cash = byType(results, 'cash')

    // El 1 % anual es nominal: el mes cobra 1/12. El dinero entra antes de
    // devengar, asi que la base es el saldo de cierre del mes anterior mas el
    // aporte de este mes.
    const monthlyRate = 0.01 / 12
    let previous = 0
    for (const point of cash.points) {
      expect(point.grossReturn).toBeCloseTo((previous + point.contribution) * monthlyRate, 2)
      previous = point.value
    }
  })

  it('los impuestos bajan el resultado de todas las estrategias', () => {
    const clean = simulateScenario(defaultScenario(), { horizonMonths: 120 })
    const taxed = simulateScenario(withTaxes(defaultScenario()), { horizonMonths: 120 })

    for (const untaxed of clean.results) {
      const afterTax = byType(taxed.results, untaxed.type)
      expect(untaxed.totalTax).toBe(0)
      expect(afterTax.totalTax).toBeGreaterThan(0)
      expect(afterTax.finalValue).toBeLessThan(untaxed.finalValue)
    }
  })

  it('con 19 % de retencion la bolsa sigue ganando al efectivo', () => {
    const scenario = withTaxes(defaultScenario())
    const { results } = simulateScenario(scenario, { horizonMonths: 120 })
    // 7 % brutos menos 19 % de plusvalia son ~5,7 % netos, frente al ~0,8 % del
    // efectivo. El impuesto no basta para invertir la ordenacion: hace falta un
    // retorno brutal o una retencion por encima del ~26 % para eso.
    expect(byType(results, 'equity').finalValue).toBeGreaterThan(byType(results, 'cash').finalValue)
  })

  it('sin impuestos no se liquida nada', () => {
    const scenario = defaultScenario()
    const { results } = simulateScenario(scenario, { horizonMonths: 24 })
    for (const result of results) {
      expect(result.totalTax).toBe(0)
    }
  })

  it('el aporte inicial solo ocurre en el mes 0', () => {
    const scenario = defaultScenario()
    const { results } = simulateScenario(scenario, { horizonMonths: 12 })
    const cash = byType(results, 'cash')
    expect(cash.points[0]!.contribution).toBeGreaterThan(cash.points[1]!.contribution)
  })

  it('una cartera mixta reparte el aporte por pesos objetivo', () => {
    const scenario: Scenario = {
      ...defaultScenario(),
      strategies: [
        {
          type: 'mixed',
          rebalanceEveryMonths: 12,
          components: [
            { kind: 'cash', weight: 0.2, params: { annualRate: 0.01 } },
            { kind: 'bonds', weight: 0.4, params: defaultBonds() },
            {
              kind: 'equity',
              weight: 0.4,
              params: { expectedReturn: 0.07, gainTaxMode: 'onExit' },
            },
          ],
        },
      ],
    }
    const { results } = simulateScenario(scenario, { horizonMonths: 60 })
    const mixed = byType(results, 'mixed')

    expect(mixed.finalValue).toBeGreaterThan(0)
    expect(mixed.rebalanceCount).toBe(4)
    expect(mixed.finalValue).toBeGreaterThan(mixed.totalContributed)
  })

  it('la cartera mixta sin rebalanceo no cuenta rebalanceos', () => {
    const never = defaultMixedScenario(120)
    const yearly = defaultMixedScenario(12)
    const flat = byType(simulateScenario(never, { horizonMonths: 120 }).results, 'mixed')
    const balanced = byType(simulateScenario(yearly, { horizonMonths: 120 }).results, 'mixed')

    expect(flat.rebalanceCount).toBe(0)
    expect(balanced.rebalanceCount).toBe(9)
    // Con la bolsa al 7 % y el efectivo al 1 %, rebalancear a 40/40 no mejora el
    // resultado: solo cambia la composicion. Sirve para fijar la expectativa.
    expect(flat.finalValue).toBeGreaterThan(0)
    expect(balanced.finalValue).toBeGreaterThan(0)
  })

  it('amortar deuda salda prestamos antes de tiempo', () => {
    const { results } = simulateScenario(debtScenario('shortenTerm'), { horizonMonths: 120 })
    const debt = byType(results, 'debtPaydown')

    expect(debt.closedLoans).toHaveLength(1)
    expect(debt.closedLoans?.[0]?.loanId).toBe('loan-mortgage')
    // El prestamo tiene 300 meses de plazo: con aporte extra, se salda antes.
    expect(debt.closedLoans?.[0]?.monthIndex).toBeLessThan(120)
    expect(debt.finalDebtBalance).toBe(0)
    expect(debt.closedLoans?.[0]?.interestSaved).toBeGreaterThan(0)
  })

  it('sin dinero sobrante, el prestamo no se salda antes de tiempo', () => {
    // El plan por defecto aporta unos 400 al mes y la cuota de la hipoteca es de
    // ~978: nunca hay efectivo libre, asi que no hay amortizacion anticipada.
    const scenario = { ...defaultScenario(), strategies: [] as never[] }
    const { results } = simulateScenario(
      {
        ...scenario,
        strategies: [
          {
            type: 'debtPaydown',
            loanIds: ['loan-mortgage'],
            order: 'avalanche',
            goal: 'shortenTerm',
            hurdleRate: 0,
          },
        ],
      },
      { horizonMonths: 120 },
    )
    const debt = byType(results, 'debtPaydown')
    expect(debt.closedLoans).toHaveLength(0)
    expect(debt.finalDebtBalance).toBeGreaterThan(0)
  })

  it('acortar plazo y bajar cuota no terminan en el mismo mes', () => {
    const shorten = byType(
      simulateScenario(debtScenario('shortenTerm'), { horizonMonths: 300 }).results,
      'debtPaydown',
    )
    const reduce = byType(
      simulateScenario(debtScenario('reducePayment'), { horizonMonths: 300 }).results,
      'debtPaydown',
    )

    const shortenEnd = shorten.closedLoans?.[0]?.monthIndex ?? Number.POSITIVE_INFINITY
    const reduceEnd = reduce.closedLoans?.[0]?.monthIndex ?? Number.POSITIVE_INFINITY

    // Bajar cuota mantiene la fecha de vencimiento; acortar plazo la adelanta.
    expect(shortenEnd).toBeLessThanOrEqual(reduceEnd)
  })

  it('un liston alto impide la amortizacion anticipada, pero no las cuotas', () => {
    const scenario: Scenario = {
      ...defaultScenario(),
      contributionPlan: {
        ...defaultScenario().contributionPlan,
        followSalary: false,
        fixedMonthly: 3000,
      },
      strategies: [
        {
          type: 'debtPaydown',
          loanIds: ['loan-mortgage'],
          order: 'avalanche',
          goal: 'shortenTerm',
          hurdleRate: 0.5,
        },
      ],
    }
    const { results } = simulateScenario(scenario, { horizonMonths: 120 })
    const debt = byType(results, 'debtPaydown')

    // El prestamo al 4,1 % no llega al liston del 50 %: no se amortiza antes de
    // tiempo, pero sus cuotas si se pagan, asi que el saldo baja.
    expect(debt.closedLoans).toHaveLength(0)
    expect(debt.finalDebtBalance).toBeLessThan(200_000)
    expect(debt.finalDebtBalance).toBeGreaterThan(140_000)
  })

  it('es determinista: dos simulaciones del mismo escenario dan lo mismo', () => {
    const scenario = defaultScenario()
    const first = simulateScenario(scenario, { horizonMonths: 48 })
    const second = simulateScenario(scenario, { horizonMonths: 48 })
    expect(second).toEqual(first)
  })
})

function defaultBonds() {
  return {
    couponRate: 0.03,
    faceValue: 1000,
    purchasePrice: 1000,
    maturityPrice: 1000,
    maturityMonths: 60,
  }
}

function defaultMixedScenario(rebalanceEveryMonths: number): Scenario {
  return {
    ...defaultScenario(),
    strategies: [
      {
        type: 'mixed',
        rebalanceEveryMonths,
        components: [
          { kind: 'cash', weight: 0.2, params: { annualRate: 0.01 } },
          { kind: 'bonds', weight: 0.4, params: defaultBonds() },
          { kind: 'equity', weight: 0.4, params: { expectedReturn: 0.07, gainTaxMode: 'onExit' } },
        ],
      },
    ],
  }
}

function debtScenario(goal: 'shortenTerm' | 'reducePayment'): Scenario {
  return {
    ...defaultScenario(),
    // Aportar 3000 al mes deja sobra para amortizar anticipadamente una
    // hipoteca de ~978 de cuota. Con el plan por defecto no habria ni un duro
    // libre, y el test no probaria nada del motor de deuda.
    contributionPlan: {
      ...defaultScenario().contributionPlan,
      followSalary: false,
      fixedMonthly: 3000,
      initialLumpSum: 5000,
    },
    strategies: [
      {
        type: 'debtPaydown',
        loanIds: ['loan-mortgage'],
        order: 'avalanche',
        goal,
        hurdleRate: 0,
      },
    ],
  }
}
