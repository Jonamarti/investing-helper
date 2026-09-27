import { assertFiniteNumber } from './assert'

/**
 * Tipos de cambio como decimales: 0.041 es un 4.1 % anual.
 *
 * Se distinguen tres familias, porque confundirlas es el error clasico al
 * mensualizar:
 *   - `Rate`           : lo que teclea el usuario (anual, nominal, decenal).
 *   - `MonthlyRate`    : aplicada a un tick mensual.
 *   - `EffectiveAnnual`: (1 + r_m)^12 - 1, comparable entre estrategias.
 */
export type Rate = number

export const PERIODS_PER_YEAR = 12

/** Tasa nominal anual -> tasa mensual por division simple. */
export function annualToMonthly(annual: Rate): Rate {
  assertFiniteNumber(annual, 'annual')
  return annual / PERIODS_PER_YEAR
}

/** Tasa mensual -> tasa nominal anual por multiplicacion simple. */
export function monthlyToAnnual(monthly: Rate): Rate {
  assertFiniteNumber(monthly, 'monthly')
  return monthly * PERIODS_PER_YEAR
}

/** Tasa mensual -> tasa anual efectiva (compuesta). Es la que se muestra. */
export function monthlyToEffectiveAnnual(monthly: Rate): Rate {
  assertFiniteNumber(monthly, 'monthly')
  return (1 + monthly) ** PERIODS_PER_YEAR - 1
}

/** Tasa anual efectiva -> tasa mensual equivalente. */
export function effectiveAnnualToMonthly(effectiveAnnual: Rate): Rate {
  assertFiniteNumber(effectiveAnnual, 'effectiveAnnual')
  return (1 + effectiveAnnual) ** (1 / PERIODS_PER_YEAR) - 1
}

/** Tasa nominal anual -> equivalente efectivo con `n` capitalizaciones. */
export function nominalToEffective(annualNominal: Rate, periodsPerYear: number): Rate {
  assertFiniteNumber(annualNominal, 'annualNominal')
  if (periodsPerYear <= 0) {
    throw new RangeError(`periodsPerYear debe ser > 0, recibido: ${periodsPerYear}`)
  }
  return (1 + annualNominal / periodsPerYear) ** periodsPerYear - 1
}

/** Tasa anual efectiva -> nominal con `n` capitalizaciones. */
export function effectiveToNominal(effectiveAnnual: Rate, periodsPerYear: number): Rate {
  assertFiniteNumber(effectiveAnnual, 'effectiveAnnual')
  if (periodsPerYear <= 0) {
    throw new RangeError(`periodsPerYear debe ser > 0, recibido: ${periodsPerYear}`)
  }
  return periodsPerYear * ((1 + effectiveAnnual) ** (1 / periodsPerYear) - 1)
}

/** Tasa real a partir de la nominal y la inflacion de referencia. */
export function realFromNominal(nominal: Rate, inflation: Rate): Rate {
  assertFiniteNumber(nominal, 'nominal')
  assertFiniteNumber(inflation, 'inflation')
  return (1 + nominal) / (1 + inflation) - 1
}

/** Tasa nominal a partir de la real y la inflacion de referencia. */
export function nominalFromReal(real: Rate, inflation: Rate): Rate {
  assertFiniteNumber(real, 'real')
  assertFiniteNumber(inflation, 'inflation')
  return (1 + real) * (1 + inflation) - 1
}

/** Indice de precios acumulado tras `months` meses de inflacion anual. */
export function priceIndex(inflationAnnual: Rate, months: number): number {
  assertFiniteNumber(inflationAnnual, 'inflationAnnual')
  if (months < 0) {
    throw new RangeError(`months no puede ser negativo: ${months}`)
  }
  return (1 + inflationAnnual) ** (months / PERIODS_PER_YEAR)
}

/** Devolucion simple de un saldo durante un mes. */
export function monthlyInterest(balance: number, monthlyRate: Rate): number {
  assertFiniteNumber(balance, 'balance')
  assertFiniteNumber(monthlyRate, 'monthlyRate')
  return balance * monthlyRate
}
