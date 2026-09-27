/**
 * Barrel de `domain/shared`.
 *
 * Es la unica parte de `domain` que la capa `ui` puede importar: son value
 * objects y funciones puras, sin dependencias de otros modulos.
 * Ver `docs/arquitectura.md`.
 */
export {
  addMoney,
  divMoney,
  mulMoney,
  nonNegativeMoney,
  roundMoney,
  roundToExponent,
  roundUpToExponent,
  scaleMoney,
  subMoney,
  sumMoney,
} from './money'
export type { CurrencyCode, Money } from './money'

export {
  assert,
  assertFiniteNumber,
  assertNever,
  assertNonEmpty,
  assertNonNegative,
  assertPositive,
  InvariantError,
} from './assert'

export { collect, err, isErr, isOk, mapError, mapResult, ok, unwrap, unwrapOr } from './result'
export type { Err, Ok, Result } from './result'

export {
  addMonths,
  advanceTo,
  FIRST_MONTH,
  horizonYears,
  isYearBoundary,
  monthOfYear,
  monthRange,
  monthsBetween,
  yearMonthKey,
  yearOf,
  yearsBetween,
} from './period'
export type { MonthIndex } from './period'

export {
  annualToMonthly,
  effectiveAnnualToMonthly,
  effectiveToNominal,
  monthlyInterest,
  monthlyToAnnual,
  monthlyToEffectiveAnnual,
  nominalFromReal,
  nominalToEffective,
  PERIODS_PER_YEAR,
  priceIndex,
  realFromNominal,
} from './rate'
export type { Rate } from './rate'

export {
  CURRENCIES,
  currencyByCode,
  defaultCurrency,
  DEFAULT_CURRENCY,
  exponentOf,
  exponentOrDefault,
  isSupportedCurrency,
  supportedCurrencyCodes,
} from './currency'
export type { Currency } from './currency'
