import type { Money, Rate } from '../shared'

/**
 * El conjunto de estrategias que el motor soporta hoy.
 *
 * Anadir una aqui obliga a anadir su `ParamSpec` (ver `domain/params`) y su
 * engine (ver `domain/strategies`). Ni el simulador ni la UI cambian.
 */
export const STRATEGY_TYPES = ['cash', 'bonds', 'equity', 'mixed', 'debtPaydown'] as const

export type StrategyType = (typeof STRATEGY_TYPES)[number]

/**
 * Cuenta corriente.
 *
 * Sin parametros fiscales: las retenciones viven en `Scenario.taxRules` y son
 * las mismas para todas las estrategias. Tener el tipo en dos sitios (parametro
 * de estrategia y reglas del escenario) hacia que comparar dos estrategias
 * dependiera de cual se aplicaba.
 */
export interface CashParams {
  readonly annualRate: Rate
}

/** Bono de cupon fijo que converge a su precio de madurez. */
export interface BondsParams {
  /** Cupon anual sobre el nominal. */
  readonly couponRate: Rate
  /** Nominal (valor al vencimiento). */
  readonly faceValue: Money
  /** Precio de compra por unidad de nominal. */
  readonly purchasePrice: Money
  /** Precio al que converge, por unidad de nominal. */
  readonly maturityPrice: Money
  /** Meses hasta el vencimiento. */
  readonly maturityMonths: number
}

/** Renta variable. */
export interface EquityParams {
  /** Rentabilidad esperada anual (determinista) o deriva del GBM. */
  readonly expectedReturn: Rate
  /**
   * Si las plusvalias se tributan cada ano o solo al salir. Es una decision de
   * la estrategia, no una tasa: por eso si vive aqui y no en `TaxRules`.
   */
  readonly gainTaxMode: 'annual' | 'onExit'
}

/** Cartera de varios sub-activos con rebalanceo a pesos objetivo. */
export interface MixedParams {
  readonly components: readonly MixedComponent[]
  /** Cada cuantos meses se rebalancea a los pesos objetivo. */
  readonly rebalanceEveryMonths: number
}

export interface MixedComponent {
  readonly kind: 'cash' | 'bonds' | 'equity'
  /** Peso objetivo. La suma de los pesos debe ser 1. */
  readonly weight: Rate
  /** Parametros del sub-activo, ya validados contra su `kind`. */
  readonly params: CashParams | BondsParams | EquityParams
}
/** Orden en el que se aplica el dinero extra a los prestamos. */
export type PaydownOrder = 'avalanche' | 'snowball'

/** Que se busca al amortizar: acortar plazo o bajar cuota. */
export type PaydownGoal = 'shortenTerm' | 'reducePayment'

/**
 * Amortizar deuda. El efectivo disponible se aplica a los prestamos
 * seleccionados en el orden declarado; el resto se queda en cuenta corriente.
 */
export interface DebtPaydownParams {
  readonly loanIds: readonly string[]
  readonly order: PaydownOrder
  readonly goal: PaydownGoal
  /**
   * Fraccion de la TIR fija del prestamo que se exige superar para que compense
   * amortizar. 0 = basta con que el interes pagado sea positivo.
   */
  readonly hurdleRate: Rate
}

export type StrategyParams =
  | ({ readonly type: 'cash' } & CashParams)
  | ({ readonly type: 'bonds' } & BondsParams)
  | ({ readonly type: 'equity' } & EquityParams)
  | ({ readonly type: 'mixed' } & MixedParams)
  | ({ readonly type: 'debtPaydown' } & DebtPaydownParams)

/** Clave estable para DTOs, i18n y persistencia. */
export function strategyTypeOf(params: StrategyParams): StrategyType {
  return params.type
}

/** Componentes de una cartera mixta, vacia para el resto de estrategias. */
export function mixedComponentsOf(params: StrategyParams): readonly MixedComponent[] {
  return params.type === 'mixed' ? params.components : []
}

export function isDebtStrategy(params: StrategyParams): boolean {
  return params.type === 'debtPaydown'
}
