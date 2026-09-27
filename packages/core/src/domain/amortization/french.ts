import { assertNonNegative, assertPositive, roundToExponent } from '../shared'
import type { Money } from '../shared'

/**
 * Cuota de un prestamo con amortizacion francesa (cuota constante).
 *
 *   A = P * i / (1 - (1 + i)^-n)
 *
 * Con `i = 0` la formula es 0/0 y el cuota correcto es `P / n`.
 */
export function annuityPayment(principal: Money, monthlyRate: number, months: number): Money {
  assertNonNegative(principal, 'principal')
  assertPositive(months, 'months')

  if (monthlyRate === 0) {
    return principal / months
  }
  const discount = 1 - (1 + monthlyRate) ** -months
  if (discount <= 0) {
    throw new RangeError(
      `La cuota no es calculable: (1 + i)^-n >= 1 para i=${monthlyRate}, n=${months}`,
    )
  }
  return (principal * monthlyRate) / discount
}

/**
 * Cuota del primer periodo de un prestamo con amortizacion francesa.
 * Se isolate porque el ultimo mes no se ajusta al problema de precision.
 */
export function firstPayment(
  principal: Money,
  monthlyRate: number,
  months: number,
  exponent: number,
): Money {
  return roundToExponent(annuityPayment(principal, monthlyRate, months), exponent)
}

/**
 * Parte de la cuota que se va a intereses en el primer mes.
 */
export function firstMonthInterest(principal: Money, monthlyRate: number, exponent: number): Money {
  return roundToExponent(principal * monthlyRate, exponent)
}

/**
 * Numero de cuotas necesarias para liquidar un saldo con una cuota dada.
 * Devuelve `null` si la cuota no cubre ni los intereses (bucle infinito).
 */
export function monthsToPayoff(
  principal: Money,
  monthlyRate: number,
  payment: Money,
): number | null {
  assertNonNegative(principal, 'principal')
  if (principal === 0) {
    return 0
  }
  if (monthlyRate === 0) {
    return Math.ceil(principal / payment)
  }
  if (payment <= principal * monthlyRate) {
    return null
  }
  const raw = -Math.log(1 - (principal * monthlyRate) / payment) / Math.log(1 + monthlyRate)
  return Math.ceil(raw)
}
