import type { MixedParams, StrategyParams } from '../model'
import { roundToExponent, type Money } from '../shared'
import type { TaxableEvent } from '../taxes'
import type {
  EngineContext,
  EngineState,
  StateRow,
  StrategyEngine,
  StrategyReport,
  TaxablePeriod,
} from '../engine'
import { initialState, totalValue, withChildren, withScratch } from '../engine'
import { bondsEngine } from './bonds'
import { cashEngine } from './cash'
import { equityEngine } from './equity'

/** Claves de `scratch` que usa este motor. */
const REBALANCES = 'mixed.rebalances'

function asMixed(params: StrategyParams): MixedParams {
  if (params.type !== 'mixed') {
    throw new Error(`El motor mixto no entiende los parametros de "${params.type}"`)
  }
  return params
}

/**
 * Motor de un componente. Se apoya en los motores unitarios en vez de
 * reimplementar la contabilidad de cada activo: si el motor de efectivo cambia,
 * el efectivo de la mixta cambia con el, y no hay dos implementaciones que
 * puedan divergir.
 */
function engineFor(kind: 'cash' | 'bonds' | 'equity'): StrategyEngine {
  switch (kind) {
    case 'cash':
      return cashEngine
    case 'bonds':
      return bondsEngine
    case 'equity':
      return equityEngine
  }
}

/**
 * Contexto de un componente, con sus propios parametros.
 *
 * `MixedComponent.params` no lleva el discriminante `type` —el `kind` ya lo dice
 * —, pero los motores unitarios validan `params.type`. Aqui se lo añade, que es
 * la unica conversion del repo entre las dos formas.
 */
function childContext(ctx: EngineContext, index: number): EngineContext {
  const component = asMixed(ctx.params).components[index]!
  return { ...ctx, params: { type: component.kind, ...component.params } as StrategyParams }
}

/** Total de la cartera, sumando los sub-estados. */
function portfolioValue(state: EngineState): Money {
  return state.children.reduce((acc, child) => acc + totalValue(child), 0)
}

/**
 * Aplica un mismo gancho a todos los componentes y concatena los hechos
 * imponibles que declaran. Es el unico sitio donde se recorre `children`, y el
 * indice se pasa al callback: buscar el hijo con `indexOf` fallaria en cuanto
 * dos componentes tengan estados estructuralmente iguales.
 */
function mapChildren(
  state: EngineState,
  ctx: EngineContext,
  run: (child: EngineState, childCtx: EngineContext, index: number) => TaxablePeriod,
): TaxablePeriod {
  const events: TaxableEvent[] = []
  const children = state.children.map((child, index) => {
    const result = run(child, childContext(ctx, index), index)
    events.push(...result.events)
    return result.state
  })
  return { state: withChildren(state, children), events }
}

/**
 * Mueve valor entre componentes hasta alcanzar los pesos objetivo.
 *
 * Se apoya en los ganchos de los hijos en vez de editar sus numeros: la venta la
 * hace `sell` del hijo que sobra (que ademas actualiza su `scratch`) y la compra
 * la hace `onContribution` del hijo que falta. Asi, un componente que sepa
 * mas cosas de si mismo —que es el caso de los bonos, con sus unidades— no queda
 * desincronizado de la cartera que lo contiene.
 *
 * El dinero pasa por dos contadores distintos, y esa distincion es la que hace
 * que el rebalanceo no cree ni destruya valor:
 *
 * - `budget` es cuanto se puede mover en total, el tope de la operacion. El
 *   `min()` entre exceso y deficit es lo que garantiza que el dinero no aparece
 *   ni desaparece por redondeo: lo que no cabe al otro lado se queda donde
 *   estaba, en vez de salirse de la cartera.
 * - `pot` es el dinero que el padre tiene realmente en la mano tras la fase 1,
 *   y es el unico que reparte en la fase 2.
 *
 * Compartir un unico contador entre las dos fases haria que el padre repartiera
 * un presupuesto que ya habia gastado pagando al primer vendedor, y cada
 * rebalanceo se llevaria por delante la diferencia: con un solo contador, lo
 * entregado por los que sobran se pierde en vez de acabar en los que faltan.
 *
 * Rebalancear no declara plusvalias: el modelo trata el cambio de composicion
 * como neutro a efectos fiscales. Ver el contrato de `sell`.
 */
function rebalance(state: EngineState, ctx: EngineContext): EngineState {
  const params = asMixed(ctx.params)
  const { exponent } = ctx.taxes
  const total = portfolioValue(state)
  if (total <= 0) {
    return state
  }

  const targets = params.components.map((component) =>
    roundToExponent(total * component.weight, exponent),
  )
  const values = state.children.map((child) => totalValue(child))
  const excess = values.map((value, index) =>
    roundToExponent(value - (targets[index] ?? 0), exponent),
  )
  const deficit = values.map((value, index) =>
    roundToExponent((targets[index] ?? 0) - value, exponent),
  )

  let budget = roundToExponent(
    Math.min(
      excess.reduce((acc, value) => acc + Math.max(0, value), 0),
      deficit.reduce((acc, value) => acc + Math.max(0, value), 0),
    ),
    exponent,
  )
  if (budget <= 0) {
    return state
  }

  // Fase 1: los que exceden venden el exceso y lo entregan al padre.
  let pot = 0
  let moved = false
  let children = state.children.map((child, index) => {
    if (excess[index]! <= 0 || budget <= 0) {
      return child
    }
    const amount = roundToExponent(Math.min(excess[index]!, budget), exponent)
    const sub = engineFor(params.components[index]!.kind)
    const sold = sub.sell ? sub.sell(child, childContext(ctx, index), amount) : child
    // El efectivo del hijo sale de la cartera. Un hijo de efectivo no necesita
    // `sell` —su saldo es su valor— y tambien entrega aqui.
    const delivered = roundToExponent(Math.min(amount, sold.cash), exponent)
    if (delivered <= 0) {
      return sold
    }
    budget = roundToExponent(budget - delivered, exponent)
    pot = roundToExponent(pot + delivered, exponent)
    moved = true
    return { ...sold, cash: roundToExponent(sold.cash - delivered, exponent) }
  })

  // Fase 2: el padre reparte lo que tiene en la mano, en orden. Solo sale de
  // `pot`, nunca de `budget`: lo que no llego a recogerse no se reparte.
  children = children.map((child, index) => {
    if (deficit[index]! <= 0 || pot <= 0) {
      return child
    }
    const amount = roundToExponent(Math.min(deficit[index]!, pot), exponent)
    pot = roundToExponent(pot - amount, exponent)
    const sub = engineFor(params.components[index]!.kind)
    return sub.onContribution(child, contributionContext(ctx, index, amount))
  })

  return moved ? withChildren(state, children) : state
}

/** Contexto de un componente con un aporte sintetico, para comprar en el. */
function contributionContext(ctx: EngineContext, index: number, amount: Money): EngineContext {
  const base = childContext(ctx, index)
  return {
    ...base,
    month: { ...base.month, contribution: amount, contributionRecurring: amount },
  }
}

/**
 * Cartera de varios sub-activos con rebalanceo periodico a pesos objetivo.
 *
 * El aporte se reparte ya en proporcion a los pesos objetivo, de modo que el
 * rebalanceo solo tiene que corregir la deriva acumulada entre renders distintos
 * de cada activo.
 */
export const mixedEngine: StrategyEngine = {
  type: 'mixed',

  init(ctx: EngineContext): EngineState {
    const params = asMixed(ctx.params)
    const children = params.components.map((component, index) => {
      const sub = engineFor(component.kind)
      return sub.init(childContext(ctx, index))
    })
    return withChildren(withScratch(initialState(), { [REBALANCES]: 0 }), children)
  },

  onMonthStart(state: EngineState, ctx: EngineContext): EngineState {
    const children = state.children.map((child, index) => {
      const sub = engineFor(asMixed(ctx.params).components[index]!.kind)
      return sub.onMonthStart(child, childContext(ctx, index))
    })
    return withChildren({ ...state }, children)
  },

  /**
   * El aporte se entrega a cada hijo por su propio gancho, no se guarda en su
   * efectivo: el hijo sabe donde invertir segun su estrategia (el efectivo lo
   * deja en `cash`, la bolsa lo pasa a `position`, los bonos compran unidades).
   * Guardarlo en `cash` y confiar en que el dinero se quedara parado.
   */
  onContribution(state: EngineState, ctx: EngineContext): EngineState {
    const params = asMixed(ctx.params)
    const { exponent } = ctx.taxes
    const amount = ctx.month.contribution
    if (amount === 0) {
      return state
    }

    // El ultimo componente absorbe el redondeo: si no, cada mes quedarian
    // centimos sin destino, y en 300 meses son unos 3 €.
    let distributed = 0
    const children = state.children.map((child, index) => {
      const isLast = index === params.components.length - 1
      const share = isLast
        ? roundToExponent(amount - distributed, exponent)
        : roundToExponent(amount * params.components[index]!.weight, exponent)
      distributed = roundToExponent(distributed + share, exponent)
      if (share === 0) {
        return child
      }
      const sub = engineFor(params.components[index]!.kind)
      return sub.onContribution(child, contributionContext(ctx, index, share))
    })
    return withChildren({ ...state }, children)
  },

  onMonthEnd(state: EngineState, ctx: EngineContext): TaxablePeriod {
    return mapChildren(state, ctx, (child, childCtx, index) =>
      engineFor(asMixed(ctx.params).components[index]!.kind).onMonthEnd(child, childCtx),
    )
  },

  onYearEnd(state: EngineState, ctx: EngineContext): TaxablePeriod {
    return mapChildren(state, ctx, (child, childCtx, index) =>
      engineFor(asMixed(ctx.params).components[index]!.kind).onYearEnd(child, childCtx),
    )
  },

  /**
   * Solo cuenta como rebalanceo el que de verdad movio dinero: una cartera vacia
   * o ya en sus pesos objetivo se devuelve intacta, contador incluido.
   */
  onRebalance(state: EngineState, ctx: EngineContext): EngineState {
    const balanced = rebalance(state, ctx)
    if (balanced === state) {
      return state
    }
    return withScratch(balanced, { [REBALANCES]: (balanced.scratch[REBALANCES] ?? 0) + 1 })
  },

  value(state: EngineState) {
    return portfolioValue(state)
  },

  liquidate(state: EngineState, ctx: EngineContext): TaxablePeriod {
    return mapChildren(state, ctx, (child, childCtx, index) => {
      const sub = engineFor(asMixed(ctx.params).components[index]!.kind)
      return sub.liquidate ? sub.liquidate(child, childCtx) : { state: child, events: [] }
    })
  },

  report(state: EngineState, _ctx: EngineContext, _rows: readonly StateRow[]): StrategyReport {
    return { rebalanceCount: state.scratch[REBALANCES] ?? 0 }
  },
}
