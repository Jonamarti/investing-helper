import { describe, expect, it } from 'vitest'
import { annuityPayment, monthsToPayoff } from '../../../../src/domain/amortization/french'
import {
  constantPrincipal,
  outstandingPrincipal,
  paymentAt,
} from '../../../../src/domain/amortization/constant'
import { InvariantError } from '../../../../src/domain/shared/assert'

/**
 * Caso de referencia: 100.000 a 5 % anual durante 30 anos.
 * Cuota teorica = 536.82, interes del primer mes = 416.67.
 * Son las cifras que aparecen en cualquier tabla de amortizacion de referencia.
 */
const PRINCIPAL = 100_000
const MONTHLY_RATE = 0.05 / 12
const MONTHS = 360

describe('annuityPayment (sistema frances)', () => {
  it('reproduce la cuota de referencia', () => {
    expect(annuityPayment(PRINCIPAL, MONTHLY_RATE, MONTHS)).toBeCloseTo(536.821623, 6)
  })

  it('con tipo 0 la cuota es el capital repartido', () => {
    expect(annuityPayment(12_000, 0, 12)).toBe(1000)
  })

  it('a mas plazo, cuota menor', () => {
    const corto = annuityPayment(PRINCIPAL, MONTHLY_RATE, 120)
    const largo = annuityPayment(PRINCIPAL, MONTHLY_RATE, 360)
    expect(corto).toBeGreaterThan(largo)
  })

  it('rechaza principal negativo y plazo no positivo', () => {
    expect(() => annuityPayment(-1, 0.01, 12)).toThrow(InvariantError)
    expect(() => annuityPayment(1000, 0.01, 0)).toThrow(InvariantError)
  })

  it('es sensible a la tasa', () => {
    expect(annuityPayment(PRINCIPAL, 0.06 / 12, MONTHS)).toBeGreaterThan(
      annuityPayment(PRINCIPAL, MONTHLY_RATE, MONTHS),
    )
  })
})

describe('monthsToPayoff', () => {
  it('devuelve el numero de cuotas de la tabla', () => {
    // La cuota redondeada al alza (536.83) salda en exactamente 360 meses.
    expect(monthsToPayoff(PRINCIPAL, MONTHLY_RATE, 536.83)).toBe(360)
  })

  it('un céntimo menos obliga a una cuota mas', () => {
    // Con 536.82 el prestamo no llega a saldarse en 360 cuotas: hace falta una
    // mas. Es la sensibilidad que hace que "cuota constante" sea un objetivo
    // con holgura y no un punto exacto.
    expect(monthsToPayoff(PRINCIPAL, MONTHLY_RATE, 536.82)).toBe(361)
  })

  it('con tipo 0 es ceil(capital / cuota)', () => {
    expect(monthsToPayoff(1000, 0, 300)).toBe(4)
  })

  it('devuelve 0 si no hay nada que pagar', () => {
    expect(monthsToPayoff(0, 0.01, 100)).toBe(0)
  })

  it('devuelve null si la cuota no cubre los intereses', () => {
    // 10 al mes contra 100 al mes de interes: nunca se saldaria.
    expect(monthsToPayoff(PRINCIPAL, MONTHLY_RATE, 10)).toBeNull()
  })
})

describe('amortizacion constante', () => {
  it('amortiza el mismo capital cada mes', () => {
    expect(constantPrincipal(12_000, 12)).toBe(1000)
  })

  it('la cuota decrece porque los intereses caen', () => {
    const primera = paymentAt(100_000, MONTHLY_RATE, 360, 0, 2)
    const ultima = paymentAt(100_000, MONTHLY_RATE, 360, 359, 2)
    expect(primera).toBeGreaterThan(ultima)
  })

  it('el saldo pendiente decae linealmente', () => {
    expect(outstandingPrincipal(12_000, 12, 0)).toBe(12_000)
    expect(outstandingPrincipal(12_000, 12, 6)).toBe(6000)
    expect(outstandingPrincipal(12_000, 12, 12)).toBe(0)
  })

  it('el saldo no se vuelve negativo mas alla del plazo', () => {
    expect(outstandingPrincipal(12_000, 12, 99)).toBe(0)
  })
})
