import { describe, expect, it } from 'vitest'
import {
  addMonths,
  horizonYears,
  isYearBoundary,
  monthOfYear,
  monthRange,
  monthsBetween,
  yearMonthKey,
  yearOf,
  yearsBetween,
} from '../../../../src/domain/shared/period'
import { InvariantError } from '../../../../src/domain/shared/assert'

describe('yearOf / monthOfYear', () => {
  it('descompone el indice de mes', () => {
    expect([yearOf(0), monthOfYear(0)]).toEqual([0, 0])
    expect([yearOf(11), monthOfYear(11)]).toEqual([0, 11])
    expect([yearOf(12), monthOfYear(12)]).toEqual([1, 0])
    expect([yearOf(25), monthOfYear(25)]).toEqual([2, 1])
  })

  it('rechaza indices negativos o no enteros', () => {
    expect(() => yearOf(-1)).toThrow(InvariantError)
    expect(() => monthOfYear(1.5)).toThrow(InvariantError)
  })
})

describe('isYearBoundary', () => {
  it('solo es cierto en los meses multiplos de 12', () => {
    expect(isYearBoundary(0)).toBe(true)
    expect(isYearBoundary(1)).toBe(false)
    expect(isYearBoundary(12)).toBe(true)
  })
})

describe('addMonths / monthsBetween / yearsBetween', () => {
  it('opera sobre el indice de mes', () => {
    expect(addMonths(5, 7)).toBe(12)
    expect(addMonths(12, -1)).toBe(11)
    expect(monthsBetween(3, 15)).toBe(12)
    expect(yearsBetween(0, 24)).toBe(2)
    expect(yearsBetween(0, 7)).toBeCloseTo(7 / 12, 12)
  })

  it('rechaza deltas no enteros', () => {
    expect(() => addMonths(0, 1.5)).toThrow(InvariantError)
  })
})

describe('yearMonthKey', () => {
  it('ancla la clave en el mes de referencia del escenario', () => {
    // Escenario que arranca en marzo de 2026 (mes 1 -> mes 0 = marzo)
    expect(yearMonthKey(2026, 3, 0)).toBe('2026-03')
    expect(yearMonthKey(2026, 3, 1)).toBe('2026-04')
    expect(yearMonthKey(2026, 3, 9)).toBe('2026-12')
    expect(yearMonthKey(2026, 3, 10)).toBe('2027-01')
  })

  it('funciona a final de ano con referencia en enero', () => {
    expect(yearMonthKey(2026, 1, 11)).toBe('2026-12')
    expect(yearMonthKey(2026, 1, 12)).toBe('2027-01')
  })
})

describe('monthRange', () => {
  it('es inclusivo en ambos extremos', () => {
    expect(monthRange(0)).toEqual([0])
    expect(monthRange(3)).toEqual([0, 1, 2, 3])
  })

  it('rechaza horizontes invalidos', () => {
    expect(() => monthRange(-1)).toThrow(InvariantError)
    expect(() => monthRange(1.5)).toThrow(InvariantError)
  })
})

describe('horizonYears', () => {
  it('trunca a anos completos', () => {
    expect(horizonYears(24)).toBe(2)
    expect(horizonYears(30)).toBe(2)
    expect(horizonYears(11)).toBe(0)
  })
})
