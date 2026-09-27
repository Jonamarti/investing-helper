import { assert } from './assert'
import { PERIODS_PER_YEAR } from './rate'

/**
 * El tick del motor es **mensual**: `t = 0` es el mes inicial y `t = horizonMonths`
 * es el final del horizonte. Los anos solo se derivan, para pintar tablas.
 */
export type MonthIndex = number

export const FIRST_MONTH: MonthIndex = 0

/** Devuelve el numero de ano (0-based) de un indice de mes. */
export function yearOf(month: MonthIndex): number {
  assert(Number.isInteger(month) && month >= 0, `Indice de mes invalido: ${month}`)
  return Math.floor(month / PERIODS_PER_YEAR)
}

/** Devuelve el mes del ano, 0 = enero. */
export function monthOfYear(month: MonthIndex): number {
  assert(Number.isInteger(month) && month >= 0, `Indice de mes invalido: ${month}`)
  return month % PERIODS_PER_YEAR
}

/** `true` si el indice cae en el mes inicial de un ano (mes 0, 12, 24, ...). */
export function isYearBoundary(month: MonthIndex): boolean {
  return monthOfYear(month) === 0
}

/** Suma meses a un indice, admitiendo valores negativos. */
export function addMonths(month: MonthIndex, delta: number): MonthIndex {
  assert(Number.isInteger(delta), `delta debe ser entero, recibido: ${delta}`)
  return month + delta
}

/** Meses transcurridos entre dos indices. */
export function monthsBetween(from: MonthIndex, to: MonthIndex): number {
  return to - from
}

/** Convierte meses a anos con precision decimal (no trunca). */
export function yearsBetween(from: MonthIndex, to: MonthIndex): number {
  return (to - from) / PERIODS_PER_YEAR
}

/** Avanza `months` meses y devuelve el indice del mes de referencia. */
export function advanceTo(month: MonthIndex, months: number): MonthIndex {
  return month + months
}

/**
 * Etiqueta `YYYY-MM` de un mes, dado el mes de referencia del escenario.
 * Se usa como clave de los overrides manuales de aportaciones.
 */
export function yearMonthKey(
  referenceYear: number,
  referenceMonth: number,
  month: MonthIndex,
): string {
  assert(Number.isInteger(referenceYear), `referenceYear debe ser entero: ${referenceYear}`)
  assert(Number.isInteger(referenceMonth), `referenceMonth debe ser entero: ${referenceMonth}`)
  const absolute = referenceYear * 12 + (referenceMonth - 1) + month
  const year = Math.floor(absolute / 12)
  const monthOfYearValue = (absolute % 12) + 1
  return `${String(year).padStart(4, '0')}-${String(monthOfYearValue).padStart(2, '0')}`
}

/** Serie `0..horizonMonths` inclusiva. */
export function monthRange(horizonMonths: number): MonthIndex[] {
  assert(
    Number.isInteger(horizonMonths) && horizonMonths >= 0,
    `horizonte invalido: ${horizonMonths}`,
  )
  return Array.from({ length: horizonMonths + 1 }, (_, index) => index)
}

/** Numero de anos completos que cubre un horizonte en meses. */
export function horizonYears(horizonMonths: number): number {
  return Math.floor(horizonMonths / PERIODS_PER_YEAR)
}
