import { describe, expect, it } from 'vitest'

import {
  hasFixedTerm,
  isLoanActiveAt,
  isRevolving,
  payoffMonth,
  remainingMonths,
  type Loan,
} from '../../../../src/domain/model'

const mortgage: Loan = {
  id: 'm',
  nameKey: 'loan.test',
  kind: 'mortgage',
  currency: 'EUR',
  principal: 200_000,
  annualRate: 0.041,
  termMonths: 300,
  system: 'french',
  startMonth: 0,
  earlyExitPenaltyRate: 0,
  interestDeductible: true,
}

const card: Loan = {
  ...mortgage,
  id: 'c',
  kind: 'revolving',
  termMonths: 0,
  interestDeductible: false,
}

describe('clasificacion de prestamos', () => {
  it('distingue revolving de plazo fijo', () => {
    expect(isRevolving(mortgage)).toBe(false)
    expect(isRevolving(card)).toBe(true)
    expect(hasFixedTerm(mortgage)).toBe(true)
    expect(hasFixedTerm(card)).toBe(false)
  })
})

describe('isLoanActiveAt', () => {
  it('empieza en su startMonth', () => {
    expect(isLoanActiveAt(mortgage, 0)).toBe(true)
    expect(isLoanActiveAt({ ...mortgage, startMonth: 6 }, 5)).toBe(false)
    expect(isLoanActiveAt({ ...mortgage, startMonth: 6 }, 6)).toBe(true)
  })
})

describe('payoffMonth', () => {
  it('devuelve el mes de liquidacion si el horizonte llega', () => {
    expect(payoffMonth(mortgage, 300)).toBe(300)
    expect(payoffMonth(mortgage, 400)).toBe(300)
  })

  it('devuelve null si el horizonte se queda corto', () => {
    expect(payoffMonth(mortgage, 240)).toBeNull()
  })

  it('tiene en cuenta el arranque diferido', () => {
    expect(payoffMonth({ ...mortgage, startMonth: 12 }, 320)).toBe(312)
  })

  it('nunca liquida un revolving', () => {
    expect(payoffMonth(card, 999)).toBeNull()
  })
})

describe('remainingMonths', () => {
  it('descuenta las cuotas ya pagadas', () => {
    expect(remainingMonths(mortgage, 0)).toBe(300)
    expect(remainingMonths(mortgage, 100)).toBe(200)
  })

  it('no baja de cero', () => {
    expect(remainingMonths(mortgage, 500)).toBe(0)
  })

  it('un revolving no tiene plazo', () => {
    expect(remainingMonths(card, 10)).toBe(Number.POSITIVE_INFINITY)
  })
})
