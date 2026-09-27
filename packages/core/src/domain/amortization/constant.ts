import { assertNonNegative, assertPositive, roundToExponent } from '../shared'
import type { Money } from '../shared'

/**
 * Amortizacion con **cuota decreciente** (amortizacion constante): cada mes se
 * amortiza el mismo capital y los intereses caen porque baja el saldo.
 */
export function constantPrincipal(principal: Money, months: number): Money {
  assertNonNegative(principal, 'principal')
  assertPositive(months, 'months')
  return principal / months
}

/** Cuota del mes `index` (0-based): capital constante + interes sobre el saldo. */
export function paymentAt(
  principal: Money,
  monthlyRate: number,
  months: number,
  index: number,
  exponent: number,
): Money {
  const base = constantPrincipal(principal, months)
  const balance = outstandingPrincipal(principal, months, index)
  return roundToExponent(base + balance * monthlyRate, exponent)
}

/** Capital pendiente de amortizar al inicio del mes `index`. */
export function outstandingPrincipal(principal: Money, months: number, index: number): Money {
  assertNonNegative(principal, 'principal')
  assertPositive(months, 'months')
  if (index >= months) {
    return 0
  }
  if (index <= 0) {
    return principal
  }
  return Math.max(0, principal - (principal / months) * index)
}

/** Intereses del mes `index`: el saldo de ese mes por la tasa mensual. */
export function interestAt(
  principal: Money,
  monthlyRate: number,
  months: number,
  index: number,
  exponent: number,
): Money {
  return roundToExponent(outstandingPrincipal(principal, months, index) * monthlyRate, exponent)
}

/**
 * Cuota inicial equivalente: sirve para comparar con la francesa sin mislead con
 * la primera cuota, que es la mas alta de todo el prestamo.
 */
export function equivalentInitialPayment(
  principal: Money,
  monthlyRate: number,
  months: number,
  exponent: number,
): Money {
  return paymentAt(principal, monthlyRate, months, 0, exponent)
}
