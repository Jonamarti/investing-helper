import type { BondsParams } from '../model'
import { roundToExponent, type Money } from '../shared'
import type { EngineContext, EngineState, StrategyEngine, TaxablePeriod } from '../engine'
import { declareIncome, initialState, totalValue, withScratch } from '../engine'

/** Claves de `scratch` que usa este motor. */
const UNITS = 'bonds.units'
const PRICE = 'bonds.price'
const MONTHS_HELD = 'bonds.monthsHeld'
const REBALANCES = 'bonds.rebalances'
const COST_BASIS = 'bonds.costBasis'

function asBonds(params: EngineContext['params']): BondsParams {
  if (params.type !== 'bonds') {
    throw new Error(`El motor de bonos no entiende los parametros de "${params.type}"`)
  }
  return params
}

/**
 * Precio de un bono en el mes `month`, interpolando linealmente entre el precio
 * de compra y el de madurez.
 *
 * Un bono con cupon fijo no es un producto al que se le aplique una
 * rentabilidad: cotiza. El camino de precios mas simple que respeta el
 * vencimiento es la interpolacion lineal entre compra y madurez.
 *
 * Interpolar el precio, y no la rentabilidad, es lo que hace que el cupon se
 * pague como cupon y que la valorizacion llegue a `maturityPrice` en el mes
 * exacto del vencimiento.
 */
export function bondPriceAt(params: BondsParams, month: number): Money {
  const { purchasePrice, maturityPrice, maturityMonths } = params
  if (maturityMonths <= 0) {
    return purchasePrice
  }
  if (month >= maturityMonths) {
    return maturityPrice
  }
  if (month <= 0) {
    return purchasePrice
  }
  const progress = month / maturityMonths
  return roundToExponent(purchasePrice + (maturityPrice - purchasePrice) * progress, 4)
}

/** Cupon mensual de una unidad de nominal. */
export function monthlyCouponOf(params: BondsParams): Money {
  return roundToExponent((params.faceValue * params.couponRate) / 12, 2)
}

/**
 * Bono de cupon fijo.
 *
 * El valor de la posicion es `units x price`, y el cupon se paga como hecho
 * imponible `coupon`. Al mes del vencimiento el precio es `maturityPrice` y no
 * queda nada mas que cobrar: el motor no reinvierte, sale de la posicion.
 */
export const bondsEngine: StrategyEngine = {
  type: 'bonds',

  init(ctx: EngineContext): EngineState {
    const params = asBonds(ctx.params)
    return withScratch(initialState(), {
      [UNITS]: 0,
      [PRICE]: params.purchasePrice,
      [MONTHS_HELD]: 0,
      [REBALANCES]: 0,
      [COST_BASIS]: 0,
    })
  },

  onMonthStart(state: EngineState): EngineState {
    return state
  },

  onContribution(state: EngineState, ctx: EngineContext): EngineState {
    const params = asBonds(ctx.params)
    const { exponent } = ctx.taxes
    const amount = ctx.month.contribution
    if (amount <= 0) {
      return state
    }

    const price = bondPriceAt(params, ctx.month.monthIndex)
    const units = (state.scratch[UNITS] ?? 0) + amount / price

    // La posicion crece justo lo aportado, en vez de recalcularse como
    // `units x precio del mes`. Las unidades que ya estaban valoradas por el
    // cierre del mes anterior lo estan al precio de entonces, que no es
    // necesariamente el de hoy: revaluarlas aqui las haria retroceder un mes y
    // el rebalanceo de una cartera mixta perderia ese dinero por el camino.
    return withScratch(
      { ...state, position: roundToExponent(state.position + amount, exponent) },
      {
        [UNITS]: units,
        [PRICE]: price,
        [MONTHS_HELD]: (state.scratch[MONTHS_HELD] ?? 0) + 1,
        // Coste medio ponderado: el dinero realmente pagado, mes a mes. Es lo
        // que permite vender a mercado en un mes cualquiera y declarar solo la
        // plusvalia de los units que se venden.
        [COST_BASIS]: roundToExponent((state.scratch[COST_BASIS] ?? 0) + amount, exponent),
      },
    )
  },

  onMonthEnd(state: EngineState, ctx: EngineContext): TaxablePeriod {
    const params = asBonds(ctx.params)
    const { exponent } = ctx.taxes
    const units = state.scratch[UNITS] ?? 0
    if (units <= 0) {
      return { state, events: [] }
    }

    const month = ctx.month.monthIndex
    const nextPrice = bondPriceAt(params, month + 1)

    // Cupon del mes sobre las unidades que hay al inicio de este mes.
    const coupon = roundToExponent(units * monthlyCouponOf(params), exponent)
    // La valorizacion se mueve de `price` a `nextPrice`; el cupon ya esta
    // cobrado y no se vuelve a incluir.
    const matured = month + 1 >= params.maturityMonths
    // Al vencimiento el bono se amortiza: el nominal entra en efectivo. Sin esta
    // linea, la posicion desapareceria del balance sin devolver un euro y la
    // cartera pareceria haber perdido el principal.
    const redemption = matured ? roundToExponent(units * params.maturityPrice, exponent) : 0
    const newUnits = matured ? 0 : units
    const newPosition = roundToExponent(newUnits * nextPrice, exponent)

    const withCoupon: EngineState = {
      ...state,
      cash: roundToExponent(state.cash + coupon + redemption, exponent),
      position: newPosition,
    }
    const declared = declareIncome(withCoupon, 'coupon', coupon, exponent)
    return {
      state: withScratch(declared.state, {
        [UNITS]: newUnits,
        [PRICE]: nextPrice,
        // El nominal amortizado consume su coste: lo que queda son unidades con
        // su propia base, no las mismas units de antes.
        [COST_BASIS]: matured ? 0 : (state.scratch[COST_BASIS] ?? 0),
      }),
      events: declared.events,
    }
  },

  onYearEnd(state: EngineState): TaxablePeriod {
    return { state, events: [] }
  },

  onRebalance(state: EngineState): EngineState {
    return withScratch(state, { [REBALANCES]: (state.scratch[REBALANCES] ?? 0) + 1 })
  },

  sell(state: EngineState, ctx: EngineContext, amount: Money): EngineState {
    const { exponent } = ctx.taxes
    const price = bondPriceAt(asBonds(ctx.params), ctx.month.monthIndex)
    const units = state.scratch[UNITS] ?? 0
    const soldUnits = Math.min(units, amount / price)
    // Coste medio: al vender unas units sale su parte proporcional del coste, y
    // el resto mantiene el mismo precio medio.
    const basis = state.scratch[COST_BASIS] ?? 0
    const averageCost = units > 0 ? basis / units : 0
    return withScratch(
      {
        ...state,
        cash: roundToExponent(state.cash + soldUnits * price, exponent),
        position: roundToExponent(state.position - soldUnits * price, exponent),
      },
      {
        [UNITS]: units - soldUnits,
        [COST_BASIS]: roundToExponent(basis - soldUnits * averageCost, exponent),
      },
    )
  },

  value(state: EngineState) {
    return totalValue(state)
  },

  /** Venta total al final del horizonte. */
  liquidate(state: EngineState, ctx: EngineContext): TaxablePeriod {
    const params = asBonds(ctx.params)
    const { exponent } = ctx.taxes
    const units = state.scratch[UNITS] ?? 0
    const price = bondPriceAt(params, ctx.month.monthIndex)
    // La venta en el mercado de secundarios no paga cupon: el valor acumulado ya
    // lo incluye. La plusvalia es el precio de hoy menos lo que costo de verdad,
    // que no es `purchasePrice` salvo que todo se comprase el primer mes.
    const proceeds = roundToExponent(units * price, exponent)
    const gain = roundToExponent(proceeds - (state.scratch[COST_BASIS] ?? 0), exponent)
    return {
      state: withScratch(
        { ...state, cash: roundToExponent(state.cash + proceeds, exponent), position: 0 },
        { [UNITS]: 0, [COST_BASIS]: 0 },
      ),
      events: gain > 0 ? [{ kind: 'capitalGain', gross: gain }] : [],
    }
  },

  report(state) {
    return { rebalanceCount: state.scratch[REBALANCES] ?? 0 }
  },
}
