import { describe, expect, it } from 'vitest'

import {
  bondsEngine,
  bondPriceAt,
  cashEngine,
  closedLoanIds,
  debtPaydownEngine,
  equityEngine,
  loansAboveHurdle,
  mixedEngine,
  monthlyCouponOf,
  orderLoans,
} from '../../../../src/domain/strategies'
import {
  initialState,
  totalValue,
  type EngineContext,
  type EngineState,
  type StrategyEngine,
} from '../../../../src/domain/engine'
import type {
  BondsParams,
  DebtPaydownParams,
  Loan,
  StrategyParams,
} from '../../../../src/domain/model'
import { roundToExponent, type MonthIndex } from '../../../../src/domain/shared'
import { zeroTax } from '../../../../src/domain/taxes'

const SCENARIO = {
  loans: [],
  startYear: 2026,
  startMonth: 1,
  baseCurrency: 'EUR',
} as never

function ctx(
  params: StrategyParams,
  monthIndex: number,
  contribution = 0,
  exponent = 2,
  rules = zeroTax(),
): EngineContext {
  return {
    scenario: SCENARIO,
    params,
    taxes: { rules, exponent },
    month: {
      monthIndex: monthIndex as MonthIndex,
      date: '2026-01',
      yearIndex: 0,
      isYearStart: false,
      isYearEnd: false,
      isYearEndBoundary: false,
      isRebalance: false,
      contribution,
      contributionRecurring: contribution,
      contributionLumpSum: 0,
      freeSalary: 1000,
    },
  }
}

/**
 * `sell` y `liquidate` son ganchos opcionales: no todos los motores los tienen.
 * Aqui se exigen, porque cada test sabe que el motor que usa si los tiene, y
 * preferimos un fallo con nombre a una asercion sobre `undefined`.
 */
function sell(
  engine: StrategyEngine,
  state: EngineState,
  monthCtx: EngineContext,
  amount: number,
): EngineState {
  if (!engine.sell) {
    throw new Error(`el motor "${engine.type}" no sabe vender`)
  }
  return engine.sell(state, monthCtx, amount)
}

function liquidate(engine: StrategyEngine, state: EngineState, monthCtx: EngineContext) {
  if (!engine.liquidate) {
    throw new Error(`el motor "${engine.type}" no sabe liquidar`)
  }
  return engine.liquidate(state, monthCtx)
}

const equityParams: StrategyParams = { type: 'equity', expectedReturn: 0.12, gainTaxMode: 'annual' }
const bondsParams: StrategyParams = {
  type: 'bonds',
  couponRate: 0.05,
  faceValue: 1000,
  purchasePrice: 950,
  maturityPrice: 1000,
  maturityMonths: 24,
}
const bonds = bondsParams as BondsParams
const cashParams: StrategyParams = { type: 'cash', annualRate: 0.03 }
const mixedParams: StrategyParams = {
  type: 'mixed',
  rebalanceEveryMonths: 12,
  components: [
    { kind: 'cash', weight: 0.5, params: { annualRate: 0.03 } },
    { kind: 'equity', weight: 0.5, params: { expectedReturn: 0.12, gainTaxMode: 'onExit' } },
  ],
}

describe('cada motor rechaza los parametros de otro', () => {
  it('el motor equivocado avisa en vez de calcular en silencio', () => {
    expect(() => cashEngine.init(ctx(bondsParams, 0))).toThrow(
      /no entiende los parametros de "bonds"/,
    )
    expect(() => bondsEngine.init(ctx(equityParams, 0))).toThrow(/"equity"/)
    expect(() => equityEngine.init(ctx(cashParams, 0))).toThrow(/"cash"/)
    expect(() => mixedEngine.init(ctx(cashParams, 0))).toThrow(/"cash"/)
    expect(() => debtPaydownEngine.init(ctx(cashParams, 0))).toThrow(/"cash"/)
  })
})

describe('cashEngine', () => {
  it('devuelve el estado intacto sin interes', () => {
    const state = cashEngine.init(ctx(cashParams, 0))
    const period = cashEngine.onMonthEnd(state, ctx(cashParams, 0))
    expect(period.events).toEqual([])
    expect(period.state).toBe(state)
  })

  it('el rebalanceo y el cierre de ano no tocan nada', () => {
    const state = cashEngine.init(ctx(cashParams, 0))
    expect(cashEngine.onRebalance(state, ctx(cashParams, 0))).toBe(state)
    expect(cashEngine.onYearEnd(state, ctx(cashParams, 0)).state).toBe(state)
    expect(cashEngine.onMonthStart(state, ctx(cashParams, 0))).toBe(state)
  })

  it('declara el interes y suma el mismo importe al saldo', () => {
    const state = cashEngine.onContribution(
      cashEngine.init(ctx(cashParams, 0)),
      ctx(cashParams, 0, 1200),
    )
    const period = cashEngine.onMonthEnd(state, ctx(cashParams, 0))
    expect(period.events).toEqual([{ kind: 'interest', gross: 3 }])
    expect(period.state.cash).toBe(1203)
  })
})

describe('bondsEngine', () => {
  it('precio y cupon en los extremos', () => {
    expect(bondPriceAt(bonds, 0)).toBe(950)
    expect(bondPriceAt(bonds, 24)).toBe(1000)
    expect(bondPriceAt(bonds, 99)).toBe(1000)
    expect(monthlyCouponOf(bonds)).toBe(4.17)
  })

  it('un plazo cero no mueve el precio', () => {
    const spot = { ...bonds, maturityMonths: 0 }
    expect(bondPriceAt(spot, 5)).toBe(950)
  })

  it('ignora una aportacion de cero', () => {
    const state = bondsEngine.init(ctx(bondsParams, 0))
    expect(bondsEngine.onContribution(state, ctx(bondsParams, 0, 0))).toBe(state)
  })

  it('no devengua nada sin unidades', () => {
    const state = bondsEngine.init(ctx(bondsParams, 0))
    const period = bondsEngine.onMonthEnd(state, ctx(bondsParams, 0))
    expect(period.events).toEqual([])
    expect(period.state).toBe(state)
  })

  it('la plusvalia final se mide contra lo pagado, no contra el precio inicial', () => {
    // Se compra a 950 en el mes 0 y a 975 en el mes 12, y se revende a precio de
    // mercado en ese mismo mes, que es 975. Solo la primera tranche se ha
    // appreciatesdo, y lo que ha ganado son los 25 que van del 950 al 975.
    const bought0 = bondsEngine.onContribution(
      bondsEngine.init(ctx(bondsParams, 0)),
      ctx(bondsParams, 0, 950),
    )
    const after0 = bondsEngine.onMonthEnd(bought0, ctx(bondsParams, 0)).state
    const after11 = bondsEngine.onMonthEnd(after0, ctx(bondsParams, 11)).state
    const bought12 = bondsEngine.onContribution(after11, ctx(bondsParams, 12, 975))
    const sold = liquidate(bondsEngine, bought12, ctx(bondsParams, 12))
    // 2 x 975 = 1950 cobrados contra 950 + 975 = 1925 pagados. Medir contra
    // `purchasePrice` declararia 50, y no declarar nada daria 0: los dos
    // atajos que este test existe para descartar.
    expect(sold.events).toEqual([{ kind: 'capitalGain', gross: 25 }])
  })

  it('una aportacion posterior no revalua las unidades ya compradas', () => {
    // El cierre de mes deja la posicion valorada al precio del mes siguiente.
    // Aportar despues no puede devolverle al lote el precio de un mes atras.
    const bought = bondsEngine.onContribution(
      bondsEngine.init(ctx(bondsParams, 0)),
      ctx(bondsParams, 0, 950),
    )
    const valued = bondsEngine.onMonthEnd(bought, ctx(bondsParams, 0)).state
    const after = bondsEngine.onContribution(valued, ctx(bondsParams, 0, 950))
    // La posicion solo crece por lo aportado, ni un centimo mas ni menos.
    expect(after.position).toBe(roundToExponent(valued.position + 950, 2))
  })

  it('una venta parcial deja el mismo precio medio', () => {
    const bought = bondsEngine.onContribution(
      bondsEngine.init(ctx(bondsParams, 0)),
      ctx(bondsParams, 0, 950),
    )
    const half = sell(bondsEngine, bought, ctx(bondsParams, 0, 0), 475)
    const rest = liquidate(bondsEngine, half, ctx(bondsParams, 0))
    // Todo se compro al mismo precio y se vende al mismo: no hay plusvalia.
    expect(rest.events).toEqual([])
  })
})

describe('equityEngine', () => {
  it('no devenga con rentabilidad cero', () => {
    const zero: StrategyParams = { type: 'equity', expectedReturn: 0, gainTaxMode: 'onExit' }
    const state = equityEngine.onContribution(equityEngine.init(ctx(zero, 0)), ctx(zero, 0, 1000))
    const period = equityEngine.onMonthEnd(state, ctx(zero, 0))
    expect(period.events).toEqual([])
    expect(period.state.position).toBe(1000)
  })

  it('el año siguiente solo declara la plusvalia nueva', () => {
    const rules = { ...zeroTax(), capitalGainsAnnual: 0.19 }
    let state = equityEngine.onContribution(
      equityEngine.init(ctx(equityParams, 0, 0, 2, rules)),
      ctx(equityParams, 0, 1000, 2, rules),
    )
    // 12 meses de devengo al 12 % anual.
    for (let month = 0; month < 12; month += 1) {
      state = equityEngine.onMonthEnd(state, ctx(equityParams, month, 0, 2, rules)).state
    }
    const firstYear = equityEngine.onYearEnd(state, ctx(equityParams, 11, 0, 2, rules))
    expect(firstYear.events[0]?.gross).toBeGreaterThan(0)

    // A partir del estado que devuelve el cierre de ano, no del anterior: el
    // impuesto del primer ano ya se ha pagado vendiendo, y esa posicion —mas
    // corta— es la que sigue devengando.
    state = firstYear.state
    for (let month = 12; month < 24; month += 1) {
      state = equityEngine.onMonthEnd(state, ctx(equityParams, month, 0, 2, rules)).state
    }
    const secondYear = equityEngine.onYearEnd(state, ctx(equityParams, 23, 0, 2, rules))
    const taxable = secondYear.events[0]?.gross ?? 0

    // El segundo ano declara menos que el primero: la plusvalia del primer ano ya
    // se gravó, y repetirla seria gravar el mismo euro doce veces.
    expect(taxable).toBeGreaterThan(0)
    expect(taxable).toBeLessThan(firstYear.events[0]!.gross)
  })

  it('el impuesto anual se paga vendiendo, dejando el efectivo en positivo', () => {
    const rules = { ...zeroTax(), capitalGainsAnnual: 0.19 }
    let state = equityEngine.onContribution(
      equityEngine.init(ctx(equityParams, 0, 0, 2, rules)),
      ctx(equityParams, 0, 10_000, 2, rules),
    )
    for (let month = 0; month < 12; month += 1) {
      state = equityEngine.onMonthEnd(state, ctx(equityParams, month, 0, 2, rules)).state
    }
    const declared = equityEngine.onYearEnd(state, ctx(equityParams, 11, 0, 2, rules))
    const tax = roundToExponent((declared.events[0]?.gross ?? 0) * 0.19, 2)
    expect(declared.state.cash).toBeCloseTo(tax, 2)
    // Al simular, el descuento deja el efectivo en cero, no en negativo.
    expect(declared.state.cash - tax).toBeGreaterThanOrEqual(0)
  })

  it('sin plusvalia no hay hecho imponible', () => {
    const rules = { ...zeroTax(), capitalGainsAnnual: 0.19 }
    const down: StrategyParams = { type: 'equity', expectedReturn: -0.2, gainTaxMode: 'annual' }
    let state = equityEngine.onContribution(
      equityEngine.init(ctx(down, 0, 0, 2, rules)),
      ctx(down, 0, 1000, 2, rules),
    )
    for (let month = 0; month < 12; month += 1) {
      state = equityEngine.onMonthEnd(state, ctx(down, month, 0, 2, rules)).state
    }
    expect(equityEngine.onYearEnd(state, ctx(down, 11, 0, 2, rules)).events).toEqual([])
  })

  it('vender mas de lo que hay no crea efectivo negativo', () => {
    const state = equityEngine.onContribution(
      equityEngine.init(ctx(equityParams, 0)),
      ctx(equityParams, 0, 100),
    )
    const sold = sell(equityEngine, state, ctx(equityParams, 0), 9999)
    expect(sold.position).toBe(0)
    expect(sold.cash).toBe(100)
  })

  it('el informe cuenta los rebalanceos', () => {
    const state = equityEngine.onRebalance(
      equityEngine.init(ctx(equityParams, 0)),
      ctx(equityParams, 0),
    )
    expect(equityEngine.report?.(state, ctx(equityParams, 0), [])).toEqual({ rebalanceCount: 1 })
  })
})

describe('mixedEngine', () => {
  function run(horizon: number, contribution: number): EngineState {
    let state = mixedEngine.init(ctx(mixedParams, 0))
    for (let month = 0; month < horizon; month += 1) {
      const monthCtx = ctx(mixedParams, month, contribution)
      state = mixedEngine.onContribution(state, monthCtx)
      state = mixedEngine.onMonthEnd(state, monthCtx).state
      if (month > 0 && month % 12 === 0) {
        state = mixedEngine.onRebalance(state, ctx(mixedParams, month))
      }
    }
    return state
  }

  it('el rebalanceo conserva el valor de la cartera', () => {
    let state = mixedEngine.init(ctx(mixedParams, 0))
    for (let month = 0; month < 24; month += 1) {
      const monthCtx = ctx(mixedParams, month, 1000)
      state = mixedEngine.onContribution(state, monthCtx)
      state = mixedEngine.onMonthEnd(state, monthCtx).state
      if (month > 0 && month % 12 === 0) {
        const before = mixedEngine.value(state)
        const after = mixedEngine.onRebalance(state, ctx(mixedParams, month))
        // Mover dinero entre componentes no lo crea: la cartera vale lo mismo
        // antes y despues del rebalanceo.
        expect(roundToExponent(mixedEngine.value(after), 6)).toBe(roundToExponent(before, 6))
        state = after
      }
    }
  })

  it('el rebalanceo conserva el valor tambien con bonos dentro', () => {
    // Los bonos valoran su posicion mes a mes, y rebalancearlos obliga a
    // comprar y vender unidades a precio de mercado. Es el camino por el que el
    // dinero se puede perder sin que se note en ninguna cuenta.
    const withBonds: StrategyParams = {
      type: 'mixed',
      rebalanceEveryMonths: 12,
      components: [
        { kind: 'cash', weight: 0.2, params: { annualRate: 0.03 } },
        {
          kind: 'bonds',
          weight: 0.4,
          params: {
            couponRate: 0.05,
            faceValue: 1000,
            purchasePrice: 950,
            maturityPrice: 1000,
            maturityMonths: 60,
          },
        },
        { kind: 'equity', weight: 0.4, params: { expectedReturn: 0.12, gainTaxMode: 'onExit' } },
      ],
    }
    let state = mixedEngine.init(ctx(withBonds, 0))
    for (let month = 0; month < 36; month += 1) {
      const monthCtx = ctx(withBonds, month, 1000)
      state = mixedEngine.onContribution(state, monthCtx)
      state = mixedEngine.onMonthEnd(state, monthCtx).state
      if (month > 0 && month % 12 === 0) {
        const before = mixedEngine.value(state)
        const after = mixedEngine.onRebalance(state, ctx(withBonds, month))
        expect(roundToExponent(mixedEngine.value(after), 6)).toBe(roundToExponent(before, 6))
        state = after
      }
    }
  })

  it('deja de crecer sin motivo cuando ya esta en los pesos objetivo', () => {
    const months = 48
    const withRebalance = run(months, 1000)
    const atTarget = roundToExponent(
      withRebalance.children.reduce((acc, child) => acc + totalValue(child), 0),
      6,
    )
    // 1000 al mes, con un año de más de rentals, no puede multiplicarse.
    expect(atTarget).toBeLessThan(48 * 1000 * 1.5)
  })

  it('ignora un aporte de cero', () => {
    const state = mixedEngine.init(ctx(mixedParams, 0))
    expect(mixedEngine.onContribution(state, ctx(mixedParams, 0, 0))).toBe(state)
  })

  it('rebalancear una cartera vacia no hace nada', () => {
    const state = mixedEngine.init(ctx(mixedParams, 0))
    expect(mixedEngine.onRebalance(state, ctx(mixedParams, 0))).toBe(state)
  })

  it('un peso de cero no recibe dinero', () => {
    const skewed: StrategyParams = {
      ...mixedParams,
      components: [
        { kind: 'cash', weight: 0, params: { annualRate: 0.03 } },
        { kind: 'equity', weight: 1, params: { expectedReturn: 0.12, gainTaxMode: 'onExit' } },
      ],
    }
    const state = mixedEngine.onContribution(mixedEngine.init(ctx(skewed, 0)), ctx(skewed, 0, 1000))
    expect(totalValue(state.children[0]!)).toBe(0)
    expect(totalValue(state.children[1]!)).toBe(1000)
  })

  it('el efectivo sobrante nunca se sale de la cartera', () => {
    let state = mixedEngine.init(ctx(mixedParams, 0))
    for (let month = 0; month < 24; month += 1) {
      const monthCtx = ctx(mixedParams, month, 1000)
      state = mixedEngine.onContribution(state, monthCtx)
      state = mixedEngine.onMonthEnd(state, monthCtx).state
      if (month > 0 && month % 12 === 0) {
        state = mixedEngine.onRebalance(state, ctx(mixedParams, month))
      }
      expect(state.children.every((child) => child.cash >= 0)).toBe(true)
    }
  })
})

describe('debtPaydownEngine', () => {
  const debtParams: StrategyParams = {
    type: 'debtPaydown',
    loanIds: [],
    order: 'avalanche',
    goal: 'shortenTerm',
    hurdleRate: 0,
  }

  it('sin prestamos seleccionados no hace nada', () => {
    const state = debtPaydownEngine.init(ctx(debtParams, 0))
    const period = debtPaydownEngine.onMonthEnd(state, ctx(debtParams, 0))
    expect(period.events).toEqual([])
    expect(period.state.cash).toBe(0)
    expect(debtPaydownEngine.onRebalance(state, ctx(debtParams, 0))).toBe(state)
    expect(debtPaydownEngine.onYearEnd(state, ctx(debtParams, 0)).state).toBe(state)
    expect(initialState().cash).toBe(0)
  })

  function loan(over: Partial<Loan> & Pick<Loan, 'id' | 'principal' | 'annualRate'>): Loan {
    return {
      nameKey: `loan.${over.id}`,
      kind: 'installment',
      currency: 'EUR',
      system: 'french',
      termMonths: 120,
      startMonth: 0,
      earlyExitPenaltyRate: 0,
      interestDeductible: false,
      ...over,
    }
  }

  /** Prestamos de la cartera: uno barato y grande, uno caro y pequeno, la hipoteca. */
  const CAR_A = loan({ id: 'carA', principal: 30000, annualRate: 0.03, termMonths: 120 })
  const CAR_B = loan({
    id: 'carB',
    principal: 5000,
    annualRate: 0.09,
    termMonths: 60,
    earlyExitPenaltyRate: 0.005,
  })
  const HIPO = loan({
    id: 'hipo',
    principal: 200000,
    annualRate: 0.045,
    termMonths: 360,
    kind: 'mortgage',
    interestDeductible: true,
  })

  function debtOf(
    loanIds: string[],
    over: Partial<Omit<DebtPaydownParams, 'type' | 'loanIds'>> = {},
  ): StrategyParams {
    return {
      type: 'debtPaydown',
      loanIds,
      order: 'avalanche',
      goal: 'shortenTerm',
      hurdleRate: 0,
      ...over,
    }
  }

  function debtCtx(
    params: StrategyParams,
    monthIndex: number,
    contribution: number,
    loans: readonly Loan[],
  ): EngineContext {
    return {
      ...ctx(params, monthIndex, contribution),
      scenario: { loans, startYear: 2026, startMonth: 1, baseCurrency: 'EUR' } as never,
    }
  }

  /**
   * Un mes completo en el orden real del motor: aportar, y despues cerrar el
   * mes. Asignar el aporte al final daria el mismo resultado, porque
   * `onMonthEnd` no mira la aportacion, pero leerlo asi evita depender de que
   * `ctx.month.contribution` valga 0 en la segunda llamada.
   */
  function runMonth(
    params: StrategyParams,
    loans: readonly Loan[],
    monthIndex: number,
    contribution: number,
    from?: EngineState,
  ) {
    const funding = debtCtx(params, monthIndex, contribution, loans)
    const funded = debtPaydownEngine.onContribution(
      from ?? debtPaydownEngine.init(funding),
      funding,
    )
    return debtPaydownEngine.onMonthEnd(funded, debtCtx(params, monthIndex, 0, loans))
  }

  const balance = (state: EngineState, id: string): number =>
    state.scratch[`debt.${id}.balance`] ?? 0
  const quota = (state: EngineState, id: string): number => state.scratch[`debt.${id}.payment`] ?? 0
  const bonus = (state: EngineState, id: string): number => state.scratch[`debt.${id}.penalty`] ?? 0

  it('la cuota inicial sale de la amortizacion francesa y el adeudado es la suma', () => {
    const params = debtOf(['carA', 'carB', 'hipo'])
    const state = debtPaydownEngine.init(debtCtx(params, 0, 0, [CAR_A, CAR_B, HIPO]))
    expect(quota(state, 'hipo')).toBe(1013.37)
    expect(quota(state, 'carA')).toBe(289.68)
    expect(quota(state, 'carB')).toBe(103.79)
    expect(state.scratch['debt.outstanding']).toBe(235000)
  })

  it('un prestamo que ya ha terminado su plazo se paga entero y no genera interes ahorrado', () => {
    // Plazo y fecha de inicio coinciden: no queda ni un mes, asi que la cuota
    // es el capital y no hay contrato al que ahorrarse interes.
    const zapata = loan({
      id: 'zapata',
      principal: 12000,
      annualRate: 0.06,
      termMonths: 12,
      startMonth: 12,
    })
    const params = debtOf(['zapata'])
    const loans = [zapata]
    const state = debtPaydownEngine.init(debtCtx(params, 0, 0, loans))
    expect(quota(state, 'zapata')).toBe(12000)

    // Antes de empezar no paga nada.
    const before = runMonth(params, loans, 0, 0, state)
    expect(balance(before.state, 'zapata')).toBe(12000)
    expect(before.state.cash).toBe(0)

    const first = runMonth(params, loans, 12, 0, before.state)
    expect(balance(first.state, 'zapata')).toBe(60)

    const closed = runMonth(params, loans, 13, 0, first.state)
    expect(balance(closed.state, 'zapata')).toBe(0)
    expect(closed.state.scratch['debt.zapata.interestSaved']).toBe(0)
    expect(closed.state.scratch['debt.zapata.closedMonth']).toBe(13)
  })

  it('avalanche va al mas caro y snowball al mas pequeno', () => {
    const loans = [HIPO, CAR_A, CAR_B]
    expect(orderLoans(loans, 'avalanche').map((l) => l.id)).toEqual(['carB', 'hipo', 'carA'])
    expect(orderLoans(loans, 'snowball').map((l) => l.id)).toEqual(['carB', 'carA', 'hipo'])
    expect(loans.map((l) => l.id)).toEqual(['hipo', 'carA', 'carB'])
  })

  it('el desempate solo decide cuando la clave principal deja empate', () => {
    const barato = loan({ id: 'barato', principal: 1000, annualRate: 0.05 })
    const caro = loan({ id: 'caro', principal: 2000, annualRate: 0.05 })
    expect(orderLoans([caro, barato], 'avalanche').map((l) => l.id)).toEqual(['barato', 'caro'])

    const barato2 = loan({ id: 'barato2', principal: 5000, annualRate: 0.02 })
    const caro2 = loan({ id: 'caro2', principal: 5000, annualRate: 0.08 })
    expect(orderLoans([barato2, caro2], 'snowball').map((l) => l.id)).toEqual(['caro2', 'barato2'])
  })

  it('el liston deja fuera del aporte extra a los prestamos que no lo superan', () => {
    const loans = [CAR_B, CAR_A]
    expect(loansAboveHurdle(loans, 0).map((l) => l.id)).toEqual(['carB', 'carA'])
    expect(loansAboveHurdle(loans, 0.05).map((l) => l.id)).toEqual(['carB'])
    expect(loansAboveHurdle(loans, 0.99)).toEqual([])
  })

  it('con el liston por encima de la tasa el prestamo se sigue pagando pero no se adelanta', () => {
    const params = debtOf(['carB'], { hurdleRate: 0.5 })
    const { state } = runMonth(params, [CAR_B], 0, 1000)
    expect(balance(state, 'carB')).toBe(4933.71)
    expect(state.cash).toBe(896.21)
    expect(bonus(state, 'carB')).toBe(0)
  })

  it('el sobrante se aplica al prestamo mas caro, y el resto a la cuenta', () => {
    const params = debtOf(['carB'])
    const { state } = runMonth(params, [CAR_B], 0, 1000)
    expect(balance(state, 'carB')).toBe(4037.5)
    expect(bonus(state, 'carB')).toBe(4.48)
    // El bonus sale del efectivo despues de amortizar, asi que puede dejarlo
    // en negativo: la aportacion cubria 1000 y el prestamo gastado 1004.48.
    expect(state.cash).toBeCloseTo(-4.48, 5)
  })

  it('las cuotas que no cubren la aportacion salen del patrimonio, no de la nada', () => {
    const params = debtOf(['carA', 'carB', 'hipo'])
    const { state } = runMonth(params, [CAR_A, CAR_B, HIPO], 0, 1000)
    // 1000 de aporte frente a 1406.84 de cuota mensual: el desajuste es real.
    expect(state.cash).toBeCloseTo(-406.84, 5)
    expect(balance(state, 'hipo')).toBe(199736.63)
    expect(balance(state, 'carA')).toBe(29785.32)
    expect(balance(state, 'carB')).toBe(4933.71)
  })

  it('el interes de hipoteca deducible se declara como hecho imponible', () => {
    const params = debtOf(['hipo'], { hurdleRate: 0.5 })
    const { events, state } = runMonth(params, [HIPO], 0, 2000)
    expect(events).toEqual([{ kind: 'mortgageInterestRelief', gross: 750 }])
    expect(state.cash).toBe(986.63)
  })

  it('un prestamo corriente no genera relief, ni aunque se amortice por adelantado', () => {
    const params = debtOf(['carA'])
    const { events } = runMonth(params, [CAR_A], 0, 2000)
    expect(events).toEqual([])
  })

  it('reducePayment abarata la cuota y shortenTerm la deja igual', () => {
    const loans = [HIPO]
    const reduce = runMonth(debtOf(['hipo'], { goal: 'reducePayment' }), loans, 0, 5000)
    // Se adelantan 3986.63 y la cuota se recalcula sobre el plazo que queda.
    expect(balance(reduce.state, 'hipo')).toBe(195750)
    expect(quota(reduce.state, 'hipo')).toBe(991.84)
    expect(reduce.state.cash).toBe(0)

    const shorten = runMonth(debtOf(['hipo'], { goal: 'shortenTerm' }), loans, 0, 5000)
    expect(balance(shorten.state, 'hipo')).toBe(195750)
    expect(quota(shorten.state, 'hipo')).toBe(1013.37)
  })

  it('un cierre por adelantado se informa con el mes, el interes ahorrado y el bonus', () => {
    const params = debtOf(['carB'])
    const loans = [CAR_B]
    const { state } = runMonth(params, loans, 0, 10000)

    expect(balance(state, 'carB')).toBe(0)
    expect(state.cash).toBe(4937.83)
    expect(bonus(state, 'carB')).toBe(24.67)
    expect(state.scratch['debt.closedCount']).toBe(1)

    const report = debtPaydownEngine.report?.(state, debtCtx(params, 0, 0, loans), [])
    expect(report?.finalDebtBalance).toBe(0)
    expect(report?.closedLoans).toHaveLength(1)
    const [closed] = report?.closedLoans ?? []
    expect(closed?.loanId).toBe('carB')
    expect(closed?.loanNameKey).toBe('loan.carB')
    expect(closed?.monthIndex).toBe(0)
    // 1227.4 de interes contractual menos los 37.5 del primer mes.
    expect(closed?.interestSaved).toBe(1189.9)
    expect(closed?.penalty).toBe(24.67)

    // Al mes siguiente ya no hay nada que cobrar ni que declarar.
    const after = runMonth(params, loans, 1, 0, state)
    expect(after.events).toEqual([])
    expect(after.state.cash).toBe(4937.83)
  })

  it('el informe no inventa cierres para prestamos sin saldo registrado', () => {
    const params = debtOf(['carB'])
    const report = debtPaydownEngine.report?.(initialState(), debtCtx(params, 0, 0, [CAR_B]), [])
    expect(report?.closedLoans).toEqual([])
    expect(report?.finalDebtBalance).toBe(0)
  })

  it('cuenta como saldados los prestamos sin saldo, tb los que no estan', () => {
    const state: EngineState = { ...initialState(), scratch: { 'debt.carA.balance': 4933.71 } }
    expect(closedLoanIds(state, [CAR_A, CAR_B])).toEqual(['carB'])
  })

  it('el inicio de mes no toca el estado y el valor es el efectivo mas la posicion', () => {
    const params = debtOf(['carB'])
    const loans = [CAR_B]
    const state = debtPaydownEngine.init(debtCtx(params, 0, 0, loans))
    expect(debtPaydownEngine.onMonthStart(state, debtCtx(params, 0, 0, loans))).toBe(state)

    const { state: after } = runMonth(params, loans, 0, 10000)
    expect(debtPaydownEngine.value(after)).toBe(4937.83)
  })

  it('el motor de deuda avisa si le llegan parametros de otra estrategia', () => {
    const params = debtOf(['carB'])
    const state = debtPaydownEngine.init(debtCtx(params, 0, 0, [CAR_B]))
    expect(() => debtPaydownEngine.onMonthEnd(state, debtCtx(cashParams, 0, 0, [CAR_B]))).toThrow(
      /"cash"/,
    )
  })
})
