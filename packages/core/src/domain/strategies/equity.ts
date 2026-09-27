import type { EquityParams } from '../model'
import { annualToMonthly, roundToExponent, type Money } from '../shared'
import type { EngineContext, EngineState, StrategyEngine, TaxablePeriod } from '../engine'
import { initialState, totalValue, withRealizedGains, withScratch } from '../engine'

/** Claves de `scratch` que usa este motor. */
const COST_BASIS = 'equity.costBasis'
const GAINS_TAXED = 'equity.gainsTaxed'
const REBALANCES = 'equity.rebalances'

function asEquity(params: EngineContext['params']): EquityParams {
  if (params.type !== 'equity') {
    throw new Error(`El motor de renta variable no entiende los parametros de "${params.type}"`)
  }
  return params
}

/** Venta que no declara plusvalia: rebalancear y pagar impuestos no es invertir. */
function sellForTax(state: EngineState, amount: Money, exponent: number): EngineState {
  const sold = roundToExponent(Math.min(amount, state.position), exponent)
  if (sold <= 0) {
    return state
  }
  return {
    ...state,
    cash: roundToExponent(state.cash + sold, exponent),
    position: roundToExponent(state.position - sold, exponent),
  }
}

/**
 * Renta variable.
 *
 * Modelo determinista de rentabilidad compuesta: cada mes el valor crece a la
 * tasa mensual equivalente a `expectedReturn`. El GBM con volatilidad vive en
 * Monte Carlo (ver `domain/montecarlo`), que inyecta la serie de rentabilidades
 * en lugar de reimplementar la contabilidad.
 *
 * `scratch` guarda la base fiscal de la posicion (`COST_BASIS`): sin ella no se
 * puede calcular la plusvalia al vender ni el impuesto si tributa cada ano.
 */
export const equityEngine: StrategyEngine = {
  type: 'equity',

  init(ctx: EngineContext): EngineState {
    asEquity(ctx.params)
    return withScratch(initialState(), { [COST_BASIS]: 0, [GAINS_TAXED]: 0, [REBALANCES]: 0 })
  },

  onMonthStart(state: EngineState): EngineState {
    return state
  },

  onContribution(state: EngineState, ctx: EngineContext): EngineState {
    const { exponent } = ctx.taxes
    const amount = ctx.month.contribution
    return withScratch(
      {
        ...state,
        position: roundToExponent(state.position + amount, exponent),
      },
      { [COST_BASIS]: roundToExponent((state.scratch[COST_BASIS] ?? 0) + amount, exponent) },
    )
  },

  onMonthEnd(state: EngineState, ctx: EngineContext): TaxablePeriod {
    const params = asEquity(ctx.params)
    const { exponent } = ctx.taxes
    const monthlyRate = annualToMonthly(params.expectedReturn)
    const growth = roundToExponent(state.position * monthlyRate, exponent)
    if (growth === 0) {
      return { state, events: [] }
    }
    return {
      state: { ...state, position: roundToExponent(state.position + growth, exponent) },
      events: [],
    }
  },

  /**
   * Tributacion anual de la plusvalia.
   *
   * Dos cosas que no son evidentes y que estan ambas aqui:
   *
   * 1. Solo se declara **la parte nueva** de la plusvalia. La posicion no se
   *    reinvierte ni se vende, asi que la plusvalia de un ano sigue dentro del
   *    valor al ano siguiente: sin `GAINS_TAXED`, el mismo euro se gravaria
   *    todos los años hasta el final del horizonte.
   * 2. El impuesto se paga **vendiendo**, no de un efectivo que no existe. Toda
   *    la riqueza de esta estrategia esta en `position` y su `cash` es cero, asi
   *    que si el simulador lo descontara de ahi el resultado seria una cuenta
   *    corriente negativa. Vender para pagar es lo que hace un broker de verdad.
   */
  onYearEnd(state: EngineState, ctx: EngineContext): TaxablePeriod {
    const params = asEquity(ctx.params)
    const { exponent } = ctx.taxes
    if (params.gainTaxMode !== 'annual') {
      return { state, events: [] }
    }

    const basis = state.scratch[COST_BASIS] ?? 0
    const position = roundToExponent(state.position, exponent)
    const gain = roundToExponent(position - basis, exponent)
    // Si el valor ha bajado, lo ya tributado se recorta: la minusvalidad compensa
    // plusvalidades futuras dentro del mismo regimen.
    const alreadyTaxed = state.scratch[GAINS_TAXED] ?? 0
    const taxable = roundToExponent(Math.max(0, gain - alreadyTaxed), exponent)

    if (taxable <= 0) {
      return {
        state: withScratch(state, { [GAINS_TAXED]: Math.max(0, gain) }),
        events: [],
      }
    }

    // El tipo sale de `TaxRules`, la unica fuente: el motor no lo inventa, solo
    // lo consulta para dimensionar la venta que lo financia.
    const tax = roundToExponent(taxable * ctx.taxes.rules.capitalGainsAnnual, exponent)
    const funded = tax > 0 ? sellForTax(state, tax, exponent) : state

    return {
      state: withScratch(withRealizedGains(funded, taxable, exponent), {
        [GAINS_TAXED]: Math.max(0, gain),
      }),
      events: [{ kind: 'capitalGain', gross: taxable }],
    }
  },

  onRebalance(state: EngineState): EngineState {
    return withScratch(state, { [REBALANCES]: (state.scratch[REBALANCES] ?? 0) + 1 })
  },

  sell(state: EngineState, ctx: EngineContext, amount: Money): EngineState {
    return sellForTax(state, amount, ctx.taxes.exponent)
  },

  value(state: EngineState) {
    return totalValue(state)
  },

  /**
   * Venta total al final del horizonte. Es lo que hace comparable la TIR: sin
   * este gancho, la bolsa tributaria al salir nunca pagaria nada y la comparacion
   * con el efectivo (que tributa cada mes) estaria sesgada a favor de la bolsa.
   */
  liquidate(state: EngineState, ctx: EngineContext): TaxablePeriod {
    const params = asEquity(ctx.params)
    const { exponent } = ctx.taxes
    const basis = state.scratch[COST_BASIS] ?? 0
    const position = roundToExponent(state.position, exponent)
    const gain = roundToExponent(position - basis, exponent)

    const withSale: EngineState = {
      ...state,
      cash: roundToExponent(state.cash + position, exponent),
      position: 0,
    }

    if (gain <= 0 || params.gainTaxMode === 'annual') {
      return {
        state: withScratch(withSale, { [COST_BASIS]: 0, [GAINS_TAXED]: 0 }),
        events: [],
      }
    }
    return {
      state: withScratch(withRealizedGains(withSale, gain, exponent), {
        [COST_BASIS]: 0,
        [GAINS_TAXED]: 0,
      }),
      events: [{ kind: 'capitalGain', gross: gain }],
    }
  },

  report(state) {
    return { rebalanceCount: state.scratch[REBALANCES] ?? 0 }
  },
}
