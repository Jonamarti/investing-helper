import { annuityPayment } from '../amortization'
import type { DebtPaydownParams, Loan } from '../model'
import { loansForStrategy, scenarioExponent } from '../model'
import { annualToMonthly, roundToExponent, type Money, type MonthIndex } from '../shared'
import type { TaxableEvent } from '../taxes'
import type {
  ClosedLoan,
  EngineContext,
  EngineState,
  StateRow,
  StrategyEngine,
  StrategyReport,
  TaxablePeriod,
} from '../engine'
import { initialState, totalValue, withScratch } from '../engine'

/**
 * Estado numerico por prestamo, en `scratch`.
 *
 * Todo son numeros porque el estado de una estrategia tiene que ser serializable
 * y comparable. Las etiquetas (nombre del prestamo) viven en `report`.
 */
const OUTSTANDING = 'debt.outstanding'
const CLOSED_COUNT = 'debt.closedCount'

const balanceKey = (id: string): string => `debt.${id}.balance`
const paymentKey = (id: string): string => `debt.${id}.payment`
const interestPaidKey = (id: string): string => `debt.${id}.interestPaid`
const penaltyKey = (id: string): string => `debt.${id}.penalty`
const interestSavedKey = (id: string): string => `debt.${id}.interestSaved`
const closedMonthKey = (id: string): string => `debt.${id}.closedMonth`

function asDebt(params: EngineContext['params']): DebtPaydownParams {
  if (params.type !== 'debtPaydown') {
    throw new Error(`El motor de deuda no entiende los parametros de "${params.type}"`)
  }
  return params
}

/** Prestamos de la estrategia, ya resueltos. */
function selectedLoans(ctx: EngineContext): Loan[] {
  return loansForStrategy(ctx.scenario, asDebt(ctx.params).loanIds)
}

/**
 * Orden en el que se aplica el dinero extra a cada prestamo.
 *
 * `avalanche` (el mas caro primero) minimiza el interes total; `snowball` (el
 * mas pequeno primero) minimiza el numero de prestamos a liquidar. Es el mismo
 * criterio que usan las herramientas de amortizacion, no una preferencia
 * estetica: por eso el orden se elige aqui y no en la UI.
 */
export function orderLoans(loans: readonly Loan[], order: DebtPaydownParams['order']): Loan[] {
  const sorted = [...loans]
  if (order === 'avalanche') {
    return sorted.sort((a, b) => b.annualRate - a.annualRate || a.principal - b.principal)
  }
  return sorted.sort((a, b) => a.principal - b.principal || b.annualRate - a.annualRate)
}

/**
 * Prestamos que merece la pena amortizar: los que pagan mas que el liston.
 *
 * Con `hurdleRate = 0` son todos los que tienen interes, que es el caso por
 * defecto. Con un liston alto, un prestamo al 1 % no se toca aunque haya
 * dinero: el usuario ha dicho que ese dinero tiene un destino mejor.
 */
export function loansAboveHurdle(loans: readonly Loan[], hurdleRate: number): Loan[] {
  return loans.filter((loan) => loan.annualRate > hurdleRate)
}

/** Prestamos que ya estan pagados del todo. */
export function closedLoanIds(state: EngineState, loans: readonly Loan[]): string[] {
  return loans
    .filter((loan) => (state.scratch[balanceKey(loan.id)] ?? 0) <= 0)
    .map((loan) => loan.id)
}

/** Intereses que el prestamo habria costado hasta el final de su plazo. */
function contractualInterest(loan: Loan, exponent: number): Money {
  const months = Math.max(0, loan.termMonths - loan.startMonth)
  const monthlyRate = annualToMonthly(loan.annualRate)
  if (months === 0) {
    return 0
  }
  const payment = roundToExponent(annuityPayment(loan.principal, monthlyRate, months), exponent)
  return roundToExponent(payment * months - loan.principal, exponent)
}

/**
 * Amortizar deuda.
 *
 * El aporte entra en efectivo y cada mes se aplica en dos pasos: primero las
 * cuotas obligatorias de todos los prestamos, despues el dinero que sobren como
 * amortizacion anticipada del prestamo que toque. Lo que no llega a cubrir
 * cuota se queda en la cuenta y forma parte del patrimonio de la estrategia.
 *
 * `goal` cambia una sola cosa, y de forma verificable:
 *
 * - `shortenTerm`: la amortizacion anticipada baja el saldo y la cuota se
 *   queda igual, asi que el prestamo se salda antes.
 * - `reducePayment`: la amortizacion anticipada baja el saldo y la cuota se
 *   recalcula sobre el plazo que queda, asi que el prestamo se salda en la misma
 *   fecha pero pagando menos cada mes.
 *
 * La unica diferencia en el codigo es si se toca `paymentKey`; el resto de la
 * contabilidad es identico.
 */
export const debtPaydownEngine: StrategyEngine = {
  type: 'debtPaydown',

  init(ctx: EngineContext): EngineState {
    const params = asDebt(ctx.params)
    const exponent = ctx.taxes.exponent
    const loans = orderLoans(selectedLoans(ctx), params.order)
    const scratch: Record<string, number> = { [OUTSTANDING]: 0, [CLOSED_COUNT]: 0 }

    for (const loan of loans) {
      const months = Math.max(0, loan.termMonths - loan.startMonth)
      const monthlyRate = annualToMonthly(loan.annualRate)
      scratch[balanceKey(loan.id)] = loan.principal
      scratch[paymentKey(loan.id)] =
        months === 0
          ? loan.principal
          : roundToExponent(annuityPayment(loan.principal, monthlyRate, months), exponent)
      scratch[interestPaidKey(loan.id)] = 0
      scratch[penaltyKey(loan.id)] = 0
      scratch[interestSavedKey(loan.id)] = 0
      scratch[closedMonthKey(loan.id)] = -1
    }

    return withScratch(initialState(), {
      ...scratch,
      [OUTSTANDING]: roundToExponent(
        loans.reduce((acc, l) => acc + l.principal, 0),
        exponent,
      ),
    })
  },

  onMonthStart(state: EngineState): EngineState {
    return state
  },

  onContribution(state: EngineState, ctx: EngineContext): EngineState {
    const { exponent } = ctx.taxes
    return { ...state, cash: roundToExponent(state.cash + ctx.month.contribution, exponent) }
  },

  onMonthEnd(state: EngineState, ctx: EngineContext): TaxablePeriod {
    const params = asDebt(ctx.params)
    const exponent = ctx.taxes.exponent
    const month = ctx.month.monthIndex
    const events: TaxableEvent[] = []
    const scratch = { ...state.scratch }

    // Todos los prestamos seleccionados pagan su cuota, este mes y los
    // siguientes. El liston de rentabilidad solo decide quien recibe el aporte
    // extra: un prestamo por debajo del liston se sigue pagando, no se ignora.
    const all = orderLoans(selectedLoans(ctx), params.order)
    const eligible = new Set(loansAboveHurdle(all, params.hurdleRate).map((loan) => loan.id))
    let cash = state.cash

    // 1) Cuotas obligatorias.
    for (const loan of all) {
      const balance = scratch[balanceKey(loan.id)] ?? 0
      if (balance <= 0 || month < loan.startMonth) {
        continue
      }

      const monthlyRate = annualToMonthly(loan.annualRate)
      const interest = roundToExponent(balance * monthlyRate, exponent)
      const scheduled = scratch[paymentKey(loan.id)] ?? 0
      const payment = Math.min(scheduled, roundToExponent(balance + interest, exponent))
      const principalPart = roundToExponent(payment - interest, exponent)

      cash = roundToExponent(cash - payment, exponent)
      const nextBalance = roundToExponent(balance - principalPart, exponent)
      scratch[balanceKey(loan.id)] = nextBalance
      scratch[interestPaidKey(loan.id)] = roundToExponent(
        (scratch[interestPaidKey(loan.id)] ?? 0) + interest,
        exponent,
      )

      if (nextBalance <= 0) {
        scratch[balanceKey(loan.id)] = 0
        scratch[interestSavedKey(loan.id)] = Math.max(
          0,
          roundToExponent(
            contractualInterest(loan, exponent) - (scratch[interestPaidKey(loan.id)] ?? 0),
            exponent,
          ),
        )
        scratch[closedMonthKey(loan.id)] = month
      }

      // La deduccion del interes de hipoteca es un hecho imponible negativo: lo
      // declara la estrategia para que el motor fiscal lo reste.
      if (loan.interestDeductible && interest > 0) {
        events.push({ kind: 'mortgageInterestRelief', gross: interest })
      }
    }

    // 2) Amortizacion anticipada con el efectivo que sobren, solo en los
    //    prestamos que superan el liston y en el orden elegido.
    for (const loan of all) {
      if (cash <= 0) {
        break
      }
      if (!eligible.has(loan.id)) {
        continue
      }
      const balance = scratch[balanceKey(loan.id)] ?? 0
      if (balance <= 0) {
        continue
      }

      const applied = Math.min(cash, balance)
      const penalty = roundToExponent(applied * (loan.earlyExitPenaltyRate ?? 0), exponent)
      cash = roundToExponent(cash - applied - penalty, exponent)
      scratch[penaltyKey(loan.id)] = roundToExponent(
        (scratch[penaltyKey(loan.id)] ?? 0) + penalty,
        exponent,
      )

      const nextBalance = roundToExponent(balance - applied, exponent)
      scratch[balanceKey(loan.id)] = nextBalance

      if (params.goal === 'reducePayment' && nextBalance > 0) {
        // Misma fecha de vencimiento, cuota mas baja: se recalcula la cuota
        // sobre los meses que quedaban.
        const monthsLeft = Math.max(1, loan.termMonths - month)
        scratch[paymentKey(loan.id)] = roundToExponent(
          annuityPayment(nextBalance, annualToMonthly(loan.annualRate), monthsLeft),
          exponent,
        )
      }

      if (nextBalance <= 0) {
        scratch[balanceKey(loan.id)] = 0
        scratch[closedMonthKey(loan.id)] = month
        scratch[interestSavedKey(loan.id)] = Math.max(
          0,
          roundToExponent(
            contractualInterest(loan, exponent) - (scratch[interestPaidKey(loan.id)] ?? 0),
            exponent,
          ),
        )
      }
    }

    const outstanding = all.reduce((acc, loan) => acc + (scratch[balanceKey(loan.id)] ?? 0), 0)
    const closedCount = all.filter((loan) => (scratch[balanceKey(loan.id)] ?? 0) <= 0).length

    return {
      state: withScratch(
        { ...state, cash },
        {
          ...scratch,
          [OUTSTANDING]: roundToExponent(outstanding, exponent),
          [CLOSED_COUNT]: closedCount,
        },
      ),
      events,
    }
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

  report(state: EngineState, ctx: EngineContext, _rows: readonly StateRow[]): StrategyReport {
    const ordered = orderLoans(selectedLoans(ctx), asDebt(ctx.params).order)
    const closed: ClosedLoan[] = []

    for (const loan of ordered) {
      const closedMonth = state.scratch[closedMonthKey(loan.id)]
      if (closedMonth === undefined || closedMonth < 0) {
        continue
      }
      closed.push({
        loanId: loan.id,
        loanNameKey: loan.nameKey,
        monthIndex: closedMonth as MonthIndex,
        interestSaved: state.scratch[interestSavedKey(loan.id)] ?? 0,
        penalty: state.scratch[penaltyKey(loan.id)] ?? 0,
      })
    }

    return {
      finalDebtBalance: roundToExponent(
        state.scratch[OUTSTANDING] ?? 0,
        scenarioExponent(ctx.scenario),
      ),
      closedLoans: closed,
    }
  },
}
