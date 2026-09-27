import { describe, expect, it } from 'vitest'
import {
  addMoney,
  divMoney,
  mulMoney,
  nonNegativeMoney,
  roundToExponent,
  scaleMoney,
  subMoney,
  sumMoney,
} from '../../../../src/domain/shared/money'
import { InvariantError } from '../../../../src/domain/shared/assert'

describe('roundToExponent', () => {
  it('redondea a los decimales de la divisa', () => {
    expect(roundToExponent(1.234, 2)).toBe(1.23)
    expect(roundToExponent(1.235, 2)).toBe(1.24)
  })

  it('redondea simetricamente, media unidad hacia fuera', () => {
    expect(roundToExponent(2.5, 0)).toBe(3)
    expect(roundToExponent(-2.5, 0)).toBe(-3)
    expect(roundToExponent(0.125, 2)).toBe(0.13)
    expect(roundToExponent(-0.125, 2)).toBe(-0.13)
  })

  it('corrige el error de representacion binaria', () => {
    // Sin la correccion de EPSILON, 1.005 * 100 = 100.49999999999999 -> 1
    expect(roundToExponent(1.005, 2)).toBe(1.01)
    expect(roundToExponent(8.475, 2)).toBe(8.48)
  })

  it('soporta exponente 0 (JPY, CLP)', () => {
    expect(roundToExponent(1234.56, 0)).toBe(1235)
    expect(roundToExponent(1234.4, 0)).toBe(1234)
  })

  it('no produce -0', () => {
    expect(Object.is(roundToExponent(-0.001, 2), 0)).toBe(true)
  })

  it('rechaza valores no finitos', () => {
    expect(() => roundToExponent(Number.NaN, 2)).toThrow(InvariantError)
    expect(() => roundToExponent(Number.POSITIVE_INFINITY, 2)).toThrow(InvariantError)
  })

  it('rechaza exponentes no enteros o negativos', () => {
    expect(() => roundToExponent(1, 1.5)).toThrow(TypeError)
    expect(() => roundToExponent(1, -1)).toThrow(RangeError)
  })
})

describe('aritmetica de importes', () => {
  it('suma, resta y multiplica', () => {
    expect(addMoney(1.1, 2.2)).toBe(3.3000000000000003)
    expect(subMoney(5, 1.5)).toBe(3.5)
    expect(mulMoney(3, 4)).toBe(12)
  })

  it('divMoney devuelve 0 en vez de Infinity al dividir por cero', () => {
    expect(divMoney(10, 2)).toBe(5)
    expect(divMoney(10, 0)).toBe(0)
  })

  it('scaleMoney redondea al final, no en cada paso', () => {
    // 0.1 * 3 redondeado a 2 decimales daria 0.3; el error acumulado se evita
    //|scaleando una vez sobre la suma.
    expect(scaleMoney(sumMoney([0.1, 0.1, 0.1], 2), 1, 2)).toBe(0.3)
  })

  it('nonNegativeMoney satura en 0', () => {
    expect(nonNegativeMoney(-5)).toBe(0)
    expect(nonNegativeMoney(5)).toBe(5)
  })

  it('sumMoney redondea el total', () => {
    expect(sumMoney([0.1, 0.2], 2)).toBe(0.3)
    expect(sumMoney([], 2)).toBe(0)
  })
})
