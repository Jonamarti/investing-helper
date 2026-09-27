import type { Money, Rate } from '../shared'
import { roundToExponent } from '../shared'

/**
 * Parametros fiscales, **configurables por el usuario**.
 *
 * Esto no es un simulador fiscal: no hay IRPF, no hay tramos, no hay
 * calendario. Son las fracciones que el usuario dice que se le retienen, para
 * que la comparacion sea justa entre estrategias. Ver `docs/arquitectura.md`.
 */
export interface TaxRules {
  /** Retencion sobre intereses de cuenta. */
  readonly cashInterest: Rate
  /** Retencion sobre cupones de bonos. */
  readonly bondCoupon: Rate
  /** Retencion sobre dividendos. */
  readonly dividends: Rate
  /** Retencion sobre plusvalias cuando se tributa cada ano. */
  readonly capitalGainsAnnual: Rate
  /** Retencion sobre plusvalias al vender. */
  readonly capitalGainsOnExit: Rate
  /** Deduccion del interes de hipoteca sobre la tributacion del trabajo. */
  readonly mortgageInterestRelief: Rate
}

/** Hechos imponibles que reportan los engines de estrategia. */
export type TaxableEvent =
  | { readonly kind: 'interest'; readonly gross: Money }
  | { readonly kind: 'coupon'; readonly gross: Money }
  | { readonly kind: 'dividend'; readonly gross: Money }
  | { readonly kind: 'capitalGain'; readonly gross: Money }
  | {
      readonly kind: 'mortgageInterestRelief'
      readonly gross: Money
    }

export type TaxableEventKind = TaxableEvent['kind']

export const TAXABLE_EVENT_KINDS: readonly TaxableEventKind[] = [
  'interest',
  'coupon',
  'dividend',
  'capitalGain',
  'mortgageInterestRelief',
]

/** Resultado de liquidar los hechos imponibles de un mes. */
export interface TaxCharge {
  readonly total: Money
  readonly byKind: Readonly<Record<TaxableEventKind, Money>>
}

function zeroByKind(): Record<TaxableEventKind, Money> {
  return {
    interest: 0,
    coupon: 0,
    dividend: 0,
    capitalGain: 0,
    mortgageInterestRelief: 0,
  }
}

function rateFor(rules: TaxRules, event: TaxableEvent): Rate {
  switch (event.kind) {
    case 'interest':
      return rules.cashInterest
    case 'coupon':
      return rules.bondCoupon
    case 'dividend':
      return rules.dividends
    case 'capitalGain':
      return rules.capitalGainsOnExit
    case 'mortgageInterestRelief':
      return rules.mortgageInterestRelief
    default:
      return 0
  }
}

/**
 * El relief de hipoteca no es un ingreso: **resta** de la tributacion. Por eso
 * se liquida con signo negativo aunque `gross` sea positivo.
 */
function isDeduction(event: TaxableEvent): boolean {
  return event.kind === 'mortgageInterestRelief'
}

/**
 * Liquida los hechos imponibles de un mes.
 *
 * @param exponent decimales de la divisa del escenario.
 */
export function computeTax(
  events: readonly TaxableEvent[],
  rules: TaxRules,
  exponent: number,
): TaxCharge {
  const byKind = zeroByKind()
  let total = 0

  for (const event of events) {
    const rate = rateFor(rules, event)
    if (rate === 0 || event.gross === 0) {
      continue
    }
    const amount = roundToExponent(event.gross * rate, exponent)
    const signed = isDeduction(event) ? -Math.abs(amount) : amount
    byKind[event.kind] += signed
    total += signed
  }

  return { total: roundToExponent(total, exponent), byKind }
}

/** Sin hechos imponibles. */
export function noTaxCharge(): TaxCharge {
  return { total: 0, byKind: zeroByKind() }
}

/** Total de un conjunto de cargos, para agregar a lo largo de un mes. */
export function sumCharges(charges: readonly TaxCharge[], exponent: number): TaxCharge {
  const byKind = zeroByKind()
  let total = 0
  for (const charge of charges) {
    for (const kind of TAXABLE_EVENT_KINDS) {
      byKind[kind] += charge.byKind[kind]
    }
    total += charge.total
  }
  return { total: roundToExponent(total, exponent), byKind }
}
