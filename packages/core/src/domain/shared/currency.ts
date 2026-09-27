import { assert } from './assert'
import type { CurrencyCode } from './money'

export type { CurrencyCode }

/** Decimales de la divisa (2 para EUR/USD, 0 para JPY/CLP). */
export interface Currency {
  readonly code: CurrencyCode
  /** Codigo ISO 4217 numerico, util para ordenar. */
  readonly numeric: string
  readonly exponent: number
  /** Locale para `Intl.NumberFormat`. */
  readonly locale: string
  readonly nameKey: string
}

/**
 * Solo las divisas que el producto ofrece de entrada. Los tipos de cambio entre
 * ellas son **manuales** (ver `infrastructure/rates/manualFxProvider.ts`): no
 * hay series historicas ni poderes adquisitivo comparables.
 */
export const CURRENCIES: readonly Currency[] = [
  { code: 'EUR', numeric: '978', exponent: 2, locale: 'es-ES', nameKey: 'currency.EUR' },
  { code: 'USD', numeric: '840', exponent: 2, locale: 'en-US', nameKey: 'currency.USD' },
  { code: 'GBP', numeric: '826', exponent: 2, locale: 'en-GB', nameKey: 'currency.GBP' },
  { code: 'CHF', numeric: '756', exponent: 2, locale: 'de-CH', nameKey: 'currency.CHF' },
  { code: 'JPY', numeric: '392', exponent: 0, locale: 'ja-JP', nameKey: 'currency.JPY' },
  { code: 'MXN', numeric: '484', exponent: 2, locale: 'es-MX', nameKey: 'currency.MXN' },
  { code: 'ARS', numeric: '032', exponent: 2, locale: 'es-AR', nameKey: 'currency.ARS' },
  { code: 'CLP', numeric: '152', exponent: 0, locale: 'es-CL', nameKey: 'currency.CLP' },
  { code: 'COP', numeric: '170', exponent: 2, locale: 'es-CO', nameKey: 'currency.COP' },
  { code: 'BRL', numeric: '986', exponent: 2, locale: 'pt-BR', nameKey: 'currency.BRL' },
  { code: 'PEN', numeric: '604', exponent: 2, locale: 'es-PE', nameKey: 'currency.PEN' },
  { code: 'SEK', numeric: '752', exponent: 2, locale: 'sv-SE', nameKey: 'currency.SEK' },
]

const BY_CODE = new Map<CurrencyCode, Currency>(
  CURRENCIES.map((currency) => [currency.code, currency]),
)

export const DEFAULT_CURRENCY: CurrencyCode = 'EUR'

/** Divisa por defecto de un escenario recien creado. */
export function defaultCurrency(): Currency {
  return currencyByCode(DEFAULT_CURRENCY)
}

/** Busca una divisa por codigo. Lanza si no la conoce. */
export function currencyByCode(code: CurrencyCode): Currency {
  const currency = BY_CODE.get(code)
  assert(currency !== undefined, `Divisa no soportada: ${code}`)
  return currency
}

/** `true` si el codigo esta entre las divisas soportadas. */
export function isSupportedCurrency(code: CurrencyCode): boolean {
  return BY_CODE.has(code)
}

/** Decimales de una divisa, o 2 si se pide el fallback. */
export function exponentOf(code: CurrencyCode): number {
  return BY_CODE.get(code)?.exponent ?? 2
}

/** Decimales de la divisa base; 2 es un default razonable y explicito. */
export function exponentOrDefault(code: CurrencyCode, fallback = 2): number {
  return BY_CODE.get(code)?.exponent ?? fallback
}

/** Codigos de las divisas soportadas, para poblar un `SelectField`. */
export function supportedCurrencyCodes(): CurrencyCode[] {
  return CURRENCIES.map((currency) => currency.code)
}
