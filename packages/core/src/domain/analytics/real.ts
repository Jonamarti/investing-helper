import { priceIndex, roundToExponent, type Money, type MonthIndex, type Rate } from '../shared'
import type { ValuePoint } from '../engine'

/**
 * Valor de un importe del mes `monthIndex` en poder de compra del mes 0.
 *
 * El cierre del mes `t` ya lleva devengados `t + 1` meses de inflacion: el mes 0
 * cierra con un mes de inflacion acumulada, no con cero. Deflactar con `t` en vez
 * de `t + 1` dejaria el primer mes sin ajustar.
 */
export function deflate(value: Money, inflationAnnual: Rate, monthIndex: MonthIndex): Money {
  return value / priceIndex(inflationAnnual, monthIndex + 1)
}

/** Un punto de la serie ya deflactado a poder de compra del mes 0. */
export interface RealPoint {
  readonly monthIndex: MonthIndex
  readonly date: string
  readonly value: Money
}

/** Serie de valores reales, para dibujar junto a la nominal. */
export function realSeries(
  points: readonly ValuePoint[],
  inflationAnnual: Rate,
  exponent: number,
): RealPoint[] {
  return points.map((point) => ({
    monthIndex: point.monthIndex,
    date: point.date,
    value: roundToExponent(deflate(point.value, inflationAnnual, point.monthIndex), exponent),
  }))
}
