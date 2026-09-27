import { assertNonNegative, roundToExponent } from '../shared'
import type { Money, MonthIndex, Rate } from '../shared'
import type { Loan } from '../model'
import { isRevolving } from '../model'

/** Lo que cuesta cerrar un prestamo antes de tiempo. */
export interface EarlyExitCost {
  /** Saldo que hay que devolver. */
  readonly balance: Money
  /** Penalizacion sobre ese saldo. */
  readonly penalty: Money
  /** Intereses del mes en el que se cancela, ya devengados. */
  readonly accruedInterest: Money
  /** Total a pagar en el momento de la cancelacion. */
  readonly total: Money
  readonly hasPenalty: boolean
}

/**
 * Coste de cancelar un prestamo con el saldo que tenga en ese momento.
 *
 * La penalizacion se aplica sobre el **saldo**, no sobre el capital inicial: es
 * como funcionan las ventanas de cancelacion anticipada. Los prestamos
 * revolving no tienen penalizacion.
 */
export function earlyExitCost(
  loan: Loan,
  balance: Money,
  monthlyRate: Rate,
  exponent: number,
): EarlyExitCost {
  assertNonNegative(balance, 'balance')

  const penaltyRate = isRevolving(loan) ? 0 : loan.earlyExitPenaltyRate
  const penalty = roundToExponent(balance * penaltyRate, exponent)
  const accruedInterest = roundToExponent(balance * monthlyRate, exponent)
  const total = roundToExponent(balance + penalty + accruedInterest, exponent)

  return {
    balance,
    penalty,
    accruedInterest,
    total,
    hasPenalty: penalty > 0,
  }
}

/**
 * Ventana de cancelacion anticipada sin coste.
 *
 * En la practica comercial la penalizacion se aplica a partir de una fecha
 * concreta; aqui se modela como "los primeros `freeMonths` meses estan
 * libres", que es el caso habitual de una hipoteca recien firmada.
 */
export function isInPenaltyWindow(loan: Loan, month: MonthIndex, freeMonths = 6): boolean {
  if (isRevolving(loan) || loan.earlyExitPenaltyRate === 0) {
    return false
  }
  return month < loan.startMonth + freeMonths
}
