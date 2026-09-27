import type { Scenario, StrategyParams } from '../model'
import { freeMonthlyInMonth, horizonOf, resolveContribution, scenarioExponent } from '../model'
import { roundToExponent, yearMonthKey, type Money, type MonthIndex } from '../shared'
import { computeTax } from '../taxes'
import type {
  EngineContext,
  EngineState,
  MonthContext,
  StateRow,
  StrategyResult,
  TaxContext,
  TaxablePeriod,
  ValuePoint,
} from './contracts'
import { payTax, totalValue, withContributed } from './contracts'
import { resolveEngine } from './registry'

/** Una estrategia a simular, con su identificador estable. */
export interface StrategyInput {
  readonly id: string
  readonly labelKey: string
  readonly params: StrategyParams
}

export interface SimulationOptions {
  /** Cuantos meses simular. Por defecto, el horizonte del escenario. */
  readonly horizonMonths?: number
}

export interface SimulationResult {
  readonly results: readonly StrategyResult[]
  readonly horizonMonths: number
  readonly exponent: number
  readonly startYear: number
  readonly startMonth: number
}

interface MonthRow extends StateRow {
  readonly month: MonthContext
  readonly value: Money
  readonly tax: Money
  readonly gross: Money
  readonly net: Money
}

function buildMonthContext(
  scenario: Scenario,
  month: MonthIndex,
  contribution: ReturnType<typeof resolveContribution>,
  freeSalary: Money,
  rebalanceEveryMonths: number,
): MonthContext {
  // El mes 0 no rebalancea: la cartera acaba de nacer con los pesos objetivo, y
  // "corregir" a si misma no seria mas que ruido (y un redondeo).
  const rebalance = month > 0 && rebalanceEveryMonths > 0 && month % rebalanceEveryMonths === 0
  return {
    monthIndex: month,
    date: yearMonthKey(scenario.startYear, scenario.startMonth, month),
    yearIndex: Math.floor(month / 12),
    isYearStart: month % 12 === 0,
    isYearEnd: month % 12 === 11,
    isYearEndBoundary: (month + 1) % 12 === 0,
    isRebalance: rebalance,
    contribution: contribution.total,
    contributionRecurring: contribution.recurring,
    contributionLumpSum: contribution.lumpSum,
    freeSalary,
  }
}

/** Limpia los parametros de rebalanceo que solo la cartera mixta define. */
function rebalancePeriodOf(params: StrategyParams): number {
  return params.type === 'mixed' ? params.rebalanceEveryMonths : 0
}

function toPoints(rows: readonly MonthRow[], exponent: number): ValuePoint[] {
  const points: ValuePoint[] = []
  let cumulative = 0
  for (const row of rows) {
    cumulative = roundToExponent(cumulative + row.month.contribution, exponent)
    points.push({
      monthIndex: row.month.monthIndex,
      date: row.month.date,
      contribution: row.month.contribution,
      cumulativeContribution: cumulative,
      // El valor lo da el motor, no `cash + position`: en una cartera mixta el
      // dinero esta repartido entre los sub-estados y el padre solo lleva la
      // contabilidad agregada.
      value: row.value,
      cash: row.state.cash,
      position: row.state.position,
      grossReturn: row.gross,
      tax: row.tax,
      netReturn: row.net,
    })
  }
  return points
}

/** Liquida los hechos imponibles de un periodo y descuenta el importe del efectivo. */
function settle(period: TaxablePeriod, taxes: TaxContext, exponent: number): EngineState {
  if (period.events.length === 0) {
    return period.state
  }
  return payTax(period.state, computeTax(period.events, taxes.rules, exponent).total, exponent)
}

function simulateOne(scenario: Scenario, strategy: StrategyInput, horizon: number): StrategyResult {
  const engine = resolveEngine(strategy.params.type)
  const exponent = scenarioExponent(scenario)
  const taxes: TaxContext = { rules: scenario.taxRules, exponent }
  const rebalanceEveryMonths = rebalancePeriodOf(strategy.params)

  const monthAt = (month: MonthIndex): MonthContext => {
    const freeSalary = freeMonthlyInMonth(scenario.salary, month)
    const contribution = resolveContribution(
      scenario.contributionPlan,
      freeSalary,
      month,
      scenario.startYear,
      scenario.startMonth,
    )
    return buildMonthContext(scenario, month, contribution, freeSalary, rebalanceEveryMonths)
  }

  const initial: EngineContext = {
    scenario,
    params: strategy.params,
    month: monthAt(0 as MonthIndex),
    taxes,
  }

  let state = engine.init(initial)
  const rows: MonthRow[] = []

  for (let month = 0 as MonthIndex; month < horizon; month = (month + 1) as MonthIndex) {
    const monthCtx = monthAt(month)
    const ctx: EngineContext = { scenario, params: strategy.params, month: monthCtx, taxes }
    const previousValue = totalValue(state)

    state = engine.onMonthStart(state, ctx)

    if (monthCtx.contribution !== 0) {
      state = withContributed(engine.onContribution(state, ctx), monthCtx.contribution, exponent)
    }

    const monthEnd = engine.onMonthEnd(state, ctx)
    state = settle(monthEnd, taxes, exponent)
    const monthTax = computeTax(monthEnd.events, taxes.rules, exponent).total

    if (monthCtx.isYearEndBoundary) {
      state = settle(engine.onYearEnd(state, ctx), taxes, exponent)
    }

    if (monthCtx.isRebalance) {
      state = engine.onRebalance(state, ctx)
    }

    const value = engine.value(state)
    rows.push({
      monthIndex: month,
      state,
      month: monthCtx,
      value,
      tax: monthTax,
      gross: roundToExponent(value - previousValue - monthCtx.contribution, exponent),
      net: roundToExponent(value - previousValue - monthCtx.contribution - monthTax, exponent),
    })
  }

  const lastMonth = rows.length - 1
  const finalMonth = monthAt(lastMonth as MonthIndex)
  const finalCtx: EngineContext = { scenario, params: strategy.params, month: finalMonth, taxes }

  /**
   * Liquidacion final.
   *
   * Sin esto, una estrategia que solo tributa al vender (`gainTaxMode: 'onExit'`)
   * no pagaria nunca ese impuesto, y la TIR de la bolsa no seria comparable con
   * la del efectivo. La venta es neutra en valor: solo cambia el impuesto, y por
   * eso se aplica sobre el ultimo punto de la serie en vez de anadir otro.
   */
  let finalState = state
  if (engine.liquidate) {
    const exit = engine.liquidate(state, finalCtx)
    finalState = settle(exit, taxes, exponent)
    const last = rows[lastMonth]
    if (last) {
      const exitTax = computeTax(exit.events, taxes.rules, exponent).total
      rows[lastMonth] = {
        ...last,
        state: finalState,
        value: engine.value(finalState),
        tax: roundToExponent(last.tax + exitTax, exponent),
        net: roundToExponent(last.net - exitTax, exponent),
      }
    }
  }

  return {
    strategyId: strategy.id,
    type: strategy.params.type,
    labelKey: strategy.labelKey,
    points: toPoints(rows, exponent),
    finalValue: engine.value(finalState),
    totalContributed: finalState.contributed,
    totalTax: finalState.ytd.taxPaid,
    ...(engine.report ? engine.report(finalState, finalCtx, rows) : {}),
  }
}

/** Simula varias estrategias del mismo escenario y devuelve las series. */
export function simulate(
  scenario: Scenario,
  strategies: readonly StrategyInput[],
  options: SimulationOptions = {},
): SimulationResult {
  const horizon = options.horizonMonths ?? horizonOf(scenario)
  return {
    results: strategies.map((strategy) => simulateOne(scenario, strategy, horizon)),
    horizonMonths: horizon,
    exponent: scenarioExponent(scenario),
    startYear: scenario.startYear,
    startMonth: scenario.startMonth,
  }
}

/** Simula el escenario con sus propias estrategias, sin identificadores propios. */
export function simulateScenario(
  scenario: Scenario,
  options: SimulationOptions = {},
): SimulationResult {
  const strategies: StrategyInput[] = scenario.strategies.map((params, index) => ({
    id: `${params.type}-${index}`,
    labelKey: `strategy.${params.type}.label`,
    params,
  }))
  return simulate(scenario, strategies, options)
}

export { resolveEngine }
