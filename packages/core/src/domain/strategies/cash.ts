import type { CashParams } from '../model'
import { annualToMonthly, roundToExponent } from '../shared'
import type { EngineContext, EngineState, StrategyEngine, TaxablePeriod } from '../engine'
import { declareIncome, initialState, totalValue } from '../engine'

function asCash(params: EngineContext['params']): CashParams {
  if (params.type !== 'cash') {
    throw new Error(`El motor de efectivo no entiende los parametros de "${params.type}"`)
  }
  return params
}

/**
 * Cuenta corriente.
 *
 * El dinero entra, produce el interes mensual pactado sobre todo el saldo y
 * declara el hecho imponible correspondiente. No hay posicion invertida: todo el
 * valor vive en `cash`.
 *
 * Es la referencia contra la que se comparan las demas estrategias: una cartera
 * que no supere este numero ha perdido frente a no hacer nada con el dinero.
 */
export const cashEngine: StrategyEngine = {
  type: 'cash',

  init(ctx: EngineContext): EngineState {
    asCash(ctx.params)
    return initialState()
  },

  onMonthStart(state: EngineState): EngineState {
    return state
  },

  onContribution(state: EngineState, ctx: EngineContext): EngineState {
    const { exponent } = ctx.taxes
    return { ...state, cash: roundToExponent(state.cash + ctx.month.contribution, exponent) }
  },

  onMonthEnd(state: EngineState, ctx: EngineContext): TaxablePeriod {
    const params = asCash(ctx.params)
    const { exponent } = ctx.taxes
    const monthlyRate = annualToMonthly(params.annualRate)
    const interest = roundToExponent(state.cash * monthlyRate, exponent)

    if (interest === 0) {
      return { state, events: [] }
    }

    const withInterest: EngineState = {
      ...state,
      cash: roundToExponent(state.cash + interest, exponent),
    }
    return declareIncome(withInterest, 'interest', interest, exponent)
  },

  onYearEnd(state: EngineState): TaxablePeriod {
    return { state, events: [] }
  },

  onRebalance(state: EngineState): EngineState {
    return state
  },

  value(state: EngineState) {
    return totalValue(state)
  },
}
