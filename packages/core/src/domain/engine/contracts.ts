import type { Money, MonthIndex } from '../shared'
import type { Scenario, StrategyParams, StrategyType } from '../model'
import type { TaxableEvent, TaxableEventKind } from '../taxes'

/**
 * Contexto de un mes concreto del bucle de simulacion.
 *
 * El simulador calcula los indices y se los pasa a la estrategia: ninguna
 * estrategia sabe contar meses ni detectar años, todas reciben el mismo reloj.
 */
export interface MonthContext {
  /** Indice 0-based del mes desde el inicio del escenario. */
  readonly monthIndex: MonthIndex
  /** Clave `YYYY-MM` de este mes, ya anclada al inicio del escenario. */
  readonly date: string
  /** Indice 0-based del año desde el inicio del escenario. */
  readonly yearIndex: number
  /** Primer mes de un año natural: aqui se liquida el impuesto anual. */
  readonly isYearStart: boolean
  /** Ultimo mes del año natural. */
  readonly isYearEnd: boolean
  /** Cierre de año natural: toca rebalancear y cerrar la contabilidad anual. */
  readonly isYearEndBoundary: boolean
  /** Mes de rebalanceo, segun la configuracion de la estrategia. */
  readonly isRebalance: boolean
  /** Aporte de este mes ya resuelto (automatico + overrides). */
  readonly contribution: Money
  /** Parte del aporte que es recurrente. */
  readonly contributionRecurring: Money
  /** Parte del aporte que es puntual. */
  readonly contributionLumpSum: Money
  /** Sueldo libre de este mes, ya con pagas extra y crecimiento. */
  readonly freeSalary: Money
}

/** Acumulado del año en curso, para la liquidacion anual de impuestos. */
export interface YearToDate {
  /** Rendimiento bruto acumulado del año (intereses, cupones, dividendos). */
  readonly income: Money
  /** Plusvalias realizadas acumuladas del año. */
  readonly realizedGains: Money
  /** Impuestos ya pagados este año. */
  readonly taxPaid: Money
}

export function emptyYearToDate(): YearToDate {
  return { income: 0, realizedGains: 0, taxPaid: 0 }
}

/**
 * Estado contable de una estrategia.
 *
 * `cash` y `position` son las dos magnitudes que la UI grafica; `ytd` y
 * `scratch` son contabilidad interna. `scratch` es numerico a proposito: obliga
 * a que el estado de una estrategia sea serializable y comparable entre dos
 * simulaciones identicas. Las etiquetas (nombre del prestamo) viven en
 * `StrategyReport`, no aqui.
 */
export interface EngineState {
  /** Efectivo no invertido. */
  readonly cash: Money
  /** Valor de mercado de la posicion invertida. */
  readonly position: Money
  /** Aportaciones brutas acumuladas desde el inicio, base de la TIR. */
  readonly contributed: Money
  /** Aportaciones menos los impuestos pagados con cargo a la estrategia. */
  readonly netContributed: Money
  readonly ytd: YearToDate
  /** Estado numerico especifico de la estrategia. */
  readonly scratch: Readonly<Record<string, number>>
  /**
   * Sub-estados de una cartera mixta, uno por componente y en el mismo orden
   * que `MixedParams.components`. Vacio en el resto de estrategias.
   *
   * Es explicito y serializable a proposito: la alternativa —guardar el detalle
   * de los componentes en un `WeakMap` externo— hacia que el estado ya no se
   * pudiera comparar, clonar ni depurar, que es justo lo que necesitan los
   * tests y el worker.
   */
  readonly children: readonly EngineState[]
}

export function initialState(): EngineState {
  return {
    cash: 0,
    position: 0,
    contributed: 0,
    netContributed: 0,
    ytd: emptyYearToDate(),
    scratch: {},
    children: [],
  }
}

/** Valor total de la estrategia: efectivo mas posicion. */
export function totalValue(state: EngineState): Money {
  return state.cash + state.position
}

/** Un punto de la serie temporal que se dibuja en el grafico. */
export interface ValuePoint {
  readonly monthIndex: MonthIndex
  readonly date: string
  /** Aporte de este mes. */
  readonly contribution: Money
  /** Aportaciones acumuladas hasta este mes. */
  readonly cumulativeContribution: Money
  /** Valor total de la estrategia al cierre de este mes. */
  readonly value: Money
  /** Efectivo sin invertir. */
  readonly cash: Money
  /** Valor de la posicion invertida. */
  readonly position: Money
  /** Rendimiento bruto del mes, antes de impuestos. */
  readonly grossReturn: Money
  /** Impuestos pagados en este mes. */
  readonly tax: Money
  /** Rendimiento neto del mes: `value - value previo - contribution - tax`. */
  readonly netReturn: Money
}

/** Todo lo que una estrategia expone a la UI y a la analitica. */
export interface StrategyResult {
  readonly strategyId: string
  readonly type: StrategyType
  readonly labelKey: string
  readonly points: readonly ValuePoint[]
  readonly finalValue: Money
  readonly totalContributed: Money
  readonly totalTax: Money
  /** Saldo de deuda viva al final del horizonte, para las estrategias de deuda. */
  readonly finalDebtBalance?: Money
  /** Prestamos liquidados antes de tiempo, con el mes y el ahorro. */
  readonly closedLoans?: readonly ClosedLoan[]
  /** Reparto del impuesto pagado por tipo de hecho imponible. */
  readonly taxByKind?: Readonly<Record<TaxableEventKind, Money>>
  /** Cuantos rebalanceos se han ejecutado. */
  readonly rebalanceCount?: number
}

export interface ClosedLoan {
  readonly loanId: string
  readonly loanNameKey: string
  /** Mes en el que se salda. */
  readonly monthIndex: MonthIndex
  /** Intereses que se han dejado de pagar desde el inicio hasta el cierre. */
  readonly interestSaved: Money
  /** Bonus de cancelacion anticipada pagado. */
  readonly penalty: Money
}

/** Lo que el motor necesita saber ademas del mes para operar. */
export interface TaxContext {
  readonly rules: Scenario['taxRules']
  readonly exponent: number
}

/**
 * Todo lo que recibe un motor en cada gancho.
 *
 * Se agrupa en un unico objeto a proposito: con cinco parametros sueltos
 * (`state, ctx, scenario, params, taxes`) es facil pasar el escenario donde
 * tocaba el parametro, y el compilador no ayuda porque todos son objetos.
 */
export interface EngineContext {
  readonly scenario: Scenario
  readonly params: StrategyParams
  readonly month: MonthContext
  readonly taxes: TaxContext
}

/** Cierra de mes o de año: el estado nuevo y los hechos imponibles declarados. */
export interface TaxablePeriod {
  readonly state: EngineState
  readonly events: readonly TaxableEvent[]
}

/** Aportes de `StrategyResult` que solo aporta la estrategia que los tiene. */
export type StrategyReport = Pick<
  StrategyResult,
  'finalDebtBalance' | 'closedLoans' | 'taxByKind' | 'rebalanceCount'
>

/**
 * Motor de una estrategia.
 *
 * El simulador es un nucleo y no sabe nada de bonos ni de bolsa: solo llama a
 * estos ganchos en orden. Una estrategia nueva se registra aqui y el comparador
 * la ofrece sin tocar el simulador.
 */ export interface StrategyEngine {
  readonly type: StrategyType

  /** Estado inicial, antes del primer aporte. */
  init(ctx: EngineContext): EngineState

  /**
   * Fase 1: abre el mes. Aqui una estrategia de deuda calcula cuanto efectivo
   * hay disponible y que cuota hay que pagar.
   */
  onMonthStart(state: EngineState, ctx: EngineContext): EngineState

  /** Fase 2: entra el aporte. */
  onContribution(state: EngineState, ctx: EngineContext): EngineState

  /**
   * Fase 3: cierra el mes. Es donde se devenga la rentabilidad y se reportan
   * los hechos imponibles del mes.
   */
  onMonthEnd(state: EngineState, ctx: EngineContext): TaxablePeriod

  /**
   * Fase 4: cambia de año. Liquida el impuesto anual sobre lo acumulado y
   * reinicia el acumulado.
   */
  onYearEnd(state: EngineState, ctx: EngineContext): TaxablePeriod

  /** Fase 5: rebalanceo a pesos objetivo, si la estrategia lo tiene. */
  onRebalance(state: EngineState, ctx: EngineContext): EngineState

  /**
   * Venta parcial, **sin declarar plusvalia**, para rebalancear.
   *
   * Es distinta de `liquidate` a proposito. Rebalancear es cambiar la
   * composicion de la cartera, no realizar una plusvalia: si el rebalanceo
   * tributara cada vez, la comparacion entre una cartera rebalanceada y otra no
   * rebalanceada mediria el coste fiscal de rebalancear, que es justo lo que
   * el usuario quiere poder medir aparte.
   *
   * @param amount importe a convertir de posicion a efectivo.
   */
  sell?(state: EngineState, ctx: EngineContext, amount: Money): EngineState

  /** Valor total al cierre de un mes. */
  value(state: EngineState): Money

  /**
   * Liquidacion final, si la estrategia tiene una. La TIR la necesita: sin
   * vender el capital final, una estrategia con fiscalidad de salida
   * (`gainTaxMode: 'onExit'`) no pagaria nunca ese impuesto y no seria
   * comparable con el efectivo, que tributa mes a mes.
   *
   * Devuelve hechos imponibles como `onMonthEnd`, porque la venta es un hecho
   * imponible mas, no una excepcion al circuito fiscal.
   */
  liquidate?(state: EngineState, ctx: EngineContext): TaxablePeriod

  /** Datos del resultado que solo esta estrategia tiene. */
  report?(state: EngineState, ctx: EngineContext, rows: readonly StateRow[]): StrategyReport
}

/** Una fila del histórico que `report` puede inspeccionar. */
export interface StateRow {
  readonly monthIndex: MonthIndex
  readonly state: EngineState
}

/* ------------------------------------------------------------------ */
/* Constructores de estado                                              */
/* ------------------------------------------------------------------ */

export function withCash(state: EngineState, cash: Money): EngineState {
  return { ...state, cash }
}

export function withPosition(state: EngineState, position: Money): EngineState {
  return { ...state, position }
}

export function withContributed(
  state: EngineState,
  contributed: Money,
  exponent: number,
): EngineState {
  return {
    ...state,
    contributed: round(state.contributed + contributed, exponent),
    netContributed: round(state.netContributed + contributed, exponent),
  }
}

export function withYtd(state: EngineState, ytd: YearToDate): EngineState {
  return { ...state, ytd }
}

export function withYearIncome(state: EngineState, income: Money, exponent: number): EngineState {
  return { ...state, ytd: { ...state.ytd, income: round(state.ytd.income + income, exponent) } }
}

export function withRealizedGains(
  state: EngineState,
  realizedGains: Money,
  exponent: number,
): EngineState {
  return {
    ...state,
    ytd: { ...state.ytd, realizedGains: round(state.ytd.realizedGains + realizedGains, exponent) },
  }
}

export function withTaxPaid(state: EngineState, tax: Money, exponent: number): EngineState {
  return { ...state, ytd: { ...state.ytd, taxPaid: round(state.ytd.taxPaid + tax, exponent) } }
}

export function withScratch(
  state: EngineState,
  scratch: Readonly<Record<string, number>>,
): EngineState {
  return { ...state, scratch: { ...state.scratch, ...scratch } }
}

/** Reemplaza los sub-estados de una cartera mixta. */
export function withChildren(state: EngineState, children: readonly EngineState[]): EngineState {
  return { ...state, children }
}

/** Descuento un impuesto del efectivo y lo anota en el acumulado del año. */
export function payTax(state: EngineState, tax: Money, exponent: number): EngineState {
  return withTaxPaid(withCash(state, round(state.cash - tax, exponent)), tax, exponent)
}

function round(value: number, exponent: number): Money {
  const factor = 10 ** exponent
  return (
    Math.round((value + Math.sign(value) * Math.abs(value) * Number.EPSILON * 4) * factor) / factor
  )
}

/**
 * Acumula un hecho imponible del mes y devuelve el estado actualizado junto
 * con el evento, para que el simulador lo liquide una sola vez.
 */
export function declareIncome(
  state: EngineState,
  kind: 'interest' | 'coupon' | 'dividend',
  gross: Money,
  exponent: number,
): TaxablePeriod {
  if (gross === 0) {
    return { state, events: [] }
  }
  return {
    state: withYearIncome(state, gross, exponent),
    events: [{ kind, gross }],
  }
}

/** Reinicia el acumulado anual tras la liquidacion. */
export function resetYearToDate(state: EngineState): EngineState {
  return { ...state, ytd: { ...emptyYearToDate(), taxPaid: state.ytd.taxPaid } }
}
