import { describe, expect, it } from 'vitest'

import {
  bondsEngine,
  bondPriceAt,
  cashEngine,
  debtPaydownEngine,
  equityEngine,
  mixedEngine,
  monthlyCouponOf,
} from '../../../../src/domain/strategies'
import {
  initialState,
  totalValue,
  type EngineContext,
  type EngineState,
  type StrategyEngine,
} from '../../../../src/domain/engine'
import type { BondsParams, StrategyParams } from '../../../../src/domain/model'
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
})
