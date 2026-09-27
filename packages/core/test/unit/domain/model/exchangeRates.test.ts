import { describe, expect, it } from 'vitest'

import {
  canConvert,
  convertMoney,
  identityRates,
  rateBetween,
  type ExchangeRateTable,
} from '../../../../src/domain/model'

const table: ExchangeRateTable = {
  base: 'EUR',
  rates: { EUR: 1, USD: 1.08, JPY: 0.0062 },
}

describe('identityRates', () => {
  it('solo conoce la divisa base, a tipo 1', () => {
    expect(identityRates('EUR')).toEqual({ base: 'EUR', rates: { EUR: 1 } })
  })
})

describe('rateBetween', () => {
  it('es 1 si la divisa es la misma', () => {
    expect(rateBetween(table, 'USD', 'USD')).toBe(1)
  })

  it('va de la divisa con mas unidades a la que tiene menos', () => {
    // 1 USD son 1,08 EUR.
    expect(rateBetween(table, 'USD', 'EUR')).toBeCloseTo(1 / 1.08, 10)
    expect(rateBetween(table, 'EUR', 'USD')).toBeCloseTo(1.08, 10)
  })

  it('es simetrico: ir y volver devuelve el importe', () => {
    const there = convertMoney(1000, 'EUR', 'USD', table, 2)
    const back = convertMoney(there, 'USD', 'EUR', table, 2)
    expect(back).toBeCloseTo(1000, 1)
  })

  it('falla si la tabla no cubre una divisa', () => {
    expect(() => rateBetween(table, 'GBP', 'EUR')).toThrow(/Falta tipo de cambio/)
  })
})

describe('convertMoney', () => {
  it('no toca el importe si la divisa no cambia', () => {
    expect(convertMoney(1234.56, 'EUR', 'EUR', table, 2)).toBe(1234.56)
  })

  it('redondea al exponente del destino', () => {
    // 1000 EUR son 1080 USD; y 1000 USD son 925,93 EUR.
    expect(convertMoney(1000, 'EUR', 'USD', table, 2)).toBe(1080)
    expect(convertMoney(1000, 'USD', 'EUR', table, 2)).toBe(925.93)
  })

  it('respeta las divisas sin decimales', () => {
    // La tabla dice 1 EUR = 0,0062 JPY, asi que 1000 EUR son 6,2 yenes. Con el
    // exponente del yen (0) eso se redondea a 6.
    expect(convertMoney(1000, 'EUR', 'JPY', table, 0)).toBe(6)
    // En sentido contrario el yen si tiene decimales que conservar.
    expect(convertMoney(1000, 'JPY', 'EUR', table, 2)).toBe(161290.32)
  })
})

describe('canConvert', () => {
  it('es cierto cuando las dos divisas estan', () => {
    expect(canConvert(table, 'EUR', 'USD')).toBe(true)
    expect(canConvert(table, 'USD', 'EUR')).toBe(true)
  })

  it('es cierto si no hay que convertir', () => {
    expect(canConvert(identityRates('EUR'), 'EUR', 'EUR')).toBe(true)
  })

  it('es falso si falta alguna', () => {
    expect(canConvert(table, 'EUR', 'GBP')).toBe(false)
  })
})
