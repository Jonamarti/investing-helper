import { assert } from '../shared'
import type { CurrencyCode, Money } from '../shared'
import { roundToExponent } from '../shared'

/**
 * Tipos de cambio **manuales**, expresados como `units of "to" per 1 "from"`.
 *
 * No hay series historicas ni poderes adquisitivo comparables: la app no
 * finge saber mas de lo que el usuario teclea. Ver `docs/arquitectura.md`.
 */
export interface ExchangeRateTable {
  readonly base: CurrencyCode
  /** `rates[EUR] = 1`, `rates[USD] = 1.08`. */
  readonly rates: Readonly<Record<CurrencyCode, number>>
}

/** Tabla identidad: todo a 1. Util para escenarios de una sola divisa. */
export function identityRates(base: CurrencyCode): ExchangeRateTable {
  return { base, rates: { [base]: 1 } }
}

/** Tipo de cambio efectivo entre dos divisas, segun la tabla. */
export function rateBetween(
  table: ExchangeRateTable,
  from: CurrencyCode,
  to: CurrencyCode,
): number {
  if (from === to) {
    return 1
  }
  const fromRate = table.rates[from]
  const toRate = table.rates[to]
  assert(
    fromRate !== undefined && toRate !== undefined,
    `Falta tipo de cambio en la tabla para ${from} -> ${to}. Anadelo en Supuestos.`,
  )
  return toRate / fromRate
}

/** Convierte un importe entre divisas redondeando al exponente del destino. */
export function convertMoney(
  amount: Money,
  from: CurrencyCode,
  to: CurrencyCode,
  table: ExchangeRateTable,
  exponent: number,
): Money {
  if (from === to) {
    return amount
  }
  return roundToExponent(amount * rateBetween(table, from, to), exponent)
}

/** `true` si la tabla puede convertir entre estas dos divisas. */
export function canConvert(
  table: ExchangeRateTable,
  from: CurrencyCode,
  to: CurrencyCode,
): boolean {
  return from === to || (table.rates[from] !== undefined && table.rates[to] !== undefined)
}
