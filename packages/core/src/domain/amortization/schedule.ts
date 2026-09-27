import {
  annualToMonthly,
  assertNonNegative,
  assertPositive,
  roundToExponent,
  roundUpToExponent,
} from '../shared'
import type { Money, Rate } from '../shared'
import type { AmortizationSystem, Loan } from '../model'
import { annuityPayment } from './french'
import { constantPrincipal } from './constant'

/** Una linea del cuadro de amortizacion. */
export interface AmortizationRow {
  /** Numero de cuota, 1-based. */
  readonly period: number
  readonly payment: Money
  readonly interest: Money
  readonly principal: Money
  /** Saldo **despues** de aplicar la cuota. */
  readonly balance: Money
  readonly cumulativeInterest: Money
  readonly cumulativePrincipal: Money
}

export interface AmortizationSchedule {
  readonly system: AmortizationSystem
  /** Capital prestado. Permite consultar el saldo antes de la primera cuota. */
  readonly initialBalance: Money
  /** Cuota del primer mes. En `constant` decrece mes a mes. */
  readonly firstPayment: Money
  readonly rows: readonly AmortizationRow[]
  readonly totalPaid: Money
  readonly totalInterest: Money
  readonly months: number
}

/**
 * Cuota mensual que corresponde a un prestamo.
 *
 * Si el loan trae `monthlyPayment`, ese manda: el usuario puede estar pagando
 * una cuota distinta de la teorica (carencia, cuota ajustada, ...).
 */
export function paymentFor(loan: Loan, exponent: number): Money {
  const rate = annualToMonthly(loan.annualRate)
  if (loan.monthlyPayment !== undefined) {
    return loan.monthlyPayment
  }
  return roundToExponent(annuityPayment(loan.principal, rate, loan.termMonths), exponent)
}

/**
 * Construye el cuadro completo de un prestamo con plazo.
 *
 * La cuota se redondea **al alza** y la ultima fila se ajusta al saldo, de modo
 * que el cuadro termina en el plazo pactado con saldo exactamente 0. Sin esas
 * dos decisiones, el redondeo al centimo deja un residuo de ~1,32 € en una
 * hipoteca de 100.000 al 5 % a 30 anos, y el ultimo mes "paga" de mas.
 */
export function buildSchedule(loan: Loan, exponent: number): AmortizationSchedule {
  assertNonNegative(loan.principal, 'loan.principal')
  assertPositive(loan.termMonths, 'loan.termMonths')

  const rate = annualToMonthly(loan.annualRate)
  const constant = loan.system === 'constant'
  // La cuota se redondea al alza: si se redondeara a la baja, cada mes faltaria
  // una fraccion de centimo por capitalizacion y el saldo no llegaria a 0 en el
  // plazo pactado (ver `roundUpToExponent`).
  const annuity = roundUpToExponent(annuityPayment(loan.principal, rate, loan.termMonths), exponent)
  const flatPrincipal = constant ? constantPrincipal(loan.principal, loan.termMonths) : 0

  const rows: AmortizationRow[] = []
  let balance = loan.principal
  let cumulativeInterest = 0
  let cumulativePrincipal = 0
  let totalPaid = 0

  for (let period = 1; period <= loan.termMonths; period += 1) {
    const interest = roundToExponent(balance * rate, exponent)
    const isLast = period === loan.termMonths

    // En `constant` se reparte primero el capital y la cuota sale de sumar el
    // interes: al reves, el redondeo de la cuota introduciria jitter de un
    // centimo en el capital amortizado y el "mismo capital cada mes" dejaria
    // de cumplirse al centimo.
    const scheduledPrincipal = constant ? roundToExponent(flatPrincipal, exponent) : 0

    let payment: Money
    let principalPart: Money

    if (isLast) {
      principalPart = balance
      payment = roundToExponent(balance + interest, exponent)
    } else if (constant) {
      principalPart = scheduledPrincipal
      payment = roundToExponent(scheduledPrincipal + interest, exponent)
    } else {
      payment = annuity
      principalPart = roundToExponent(payment - interest, exponent)
    }

    // Si la cuota amortiza mas capital del que queda, este es el cierre real:
    // se ajusta al saldo y el prestamo termina antes del plazo nominal.
    if (principalPart >= balance) {
      principalPart = balance
      payment = roundToExponent(principalPart + interest, exponent)
    }

    const nextBalance = roundToExponent(balance - principalPart, exponent)

    cumulativeInterest = roundToExponent(cumulativeInterest + interest, exponent)
    cumulativePrincipal = roundToExponent(cumulativePrincipal + principalPart, exponent)
    totalPaid = roundToExponent(totalPaid + payment, exponent)

    rows.push({
      period,
      payment,
      interest,
      principal: principalPart,
      balance: nextBalance,
      cumulativeInterest,
      cumulativePrincipal,
    })

    balance = nextBalance
    if (balance <= 0) {
      break
    }
  }

  return {
    system: loan.system,
    initialBalance: loan.principal,
    firstPayment: rows[0]?.payment ?? 0,
    rows,
    totalPaid,
    totalInterest: cumulativeInterest,
    months: rows.length,
  }
}

/**
 * Saldo pendiente **despues** de `paidMonths` cuotas.
 *
 * Con `paidMonths = 0` se debe el capital integro, no el saldo tras la primera
 * cuota: es la consulta que hace el simulador al empezar el mes.
 */
export function outstandingBalance(schedule: AmortizationSchedule, paidMonths: number): Money {
  const index = Math.floor(paidMonths)
  if (index <= 0) {
    return schedule.initialBalance
  }
  if (index > schedule.rows.length) {
    return 0
  }
  return schedule.rows[index - 1]?.balance ?? 0
}

/** Cuotas que quedan para saldar desde `paidMonths`. */
export function outstandingMonths(schedule: AmortizationSchedule, paidMonths: number): number {
  return Math.max(0, schedule.rows.length - Math.floor(paidMonths))
}

/** Intereses pagados tras `paidMonths` cuotas. */
export function interestPaidSoFar(schedule: AmortizationSchedule, paidMonths: number): Money {
  const index = Math.floor(paidMonths)
  if (index <= 0) {
    return 0
  }
  if (index > schedule.rows.length) {
    return schedule.totalInterest
  }
  return schedule.rows[index - 1]?.cumulativeInterest ?? 0
}

/** Intereses que faltan por pagar si se sigue hasta el final. */
export function interestRemaining(
  schedule: AmortizationSchedule,
  paidMonths: number,
  exponent: number,
): Money {
  return roundToExponent(schedule.totalInterest - interestPaidSoFar(schedule, paidMonths), exponent)
}

/**
 * Cuota necesaria para saldar `balance` en `months` meses. Es la operacion
 * inversa de `annuityPayment`, y es lo que hace `reducePayment`.
 */
export function paymentForBalance(
  balance: Money,
  monthlyRate: Rate,
  months: number,
  exponent: number,
): Money {
  return roundToExponent(annuityPayment(balance, monthlyRate, months), exponent)
}
