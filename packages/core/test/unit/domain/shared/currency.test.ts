import { describe, expect, it } from 'vitest'
import {
  CURRENCIES,
  currencyByCode,
  defaultCurrency,
  DEFAULT_CURRENCY,
  exponentOf,
  exponentOrDefault,
  isSupportedCurrency,
  supportedCurrencyCodes,
} from '../../../../src/domain/shared/currency'
import { InvariantError } from '../../../../src/domain/shared/assert'

describe('catalogo de divisas', () => {
  it('expone divisas con y sin subdivisiones', () => {
    expect(currencyByCode('EUR').exponent).toBe(2)
    expect(currencyByCode('JPY').exponent).toBe(0)
    expect(currencyByCode('CLP').exponent).toBe(0)
  })

  it('no tiene codigos duplicados', () => {
    const codes = supportedCurrencyCodes()
    expect(new Set(codes).size).toBe(codes.length)
  })

  it('expone un locale para cada divisa', () => {
    for (const currency of CURRENCIES) {
      expect(currency.locale).toMatch(/^[a-z]{2}-[A-Z]{2}$/)
      expect(currency.numeric).toMatch(/^\d{3}$/)
    }
  })

  it('lanza para codigos desconocidos', () => {
    expect(() => currencyByCode('XXX')).toThrow(InvariantError)
    expect(isSupportedCurrency('XXX')).toBe(false)
    expect(isSupportedCurrency('EUR')).toBe(true)
  })

  it('exponentOf cae a 2 para codigos desconocidos', () => {
    expect(exponentOf('EUR')).toBe(2)
    expect(exponentOf('XXX')).toBe(2)
    expect(exponentOrDefault('XXX', 0)).toBe(0)
  })

  it('la divisa por defecto es EUR', () => {
    expect(DEFAULT_CURRENCY).toBe('EUR')
    expect(defaultCurrency().code).toBe('EUR')
  })
})
