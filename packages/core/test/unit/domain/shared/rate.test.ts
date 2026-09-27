import { describe, expect, it } from 'vitest'
import {
  annualToMonthly,
  effectiveAnnualToMonthly,
  effectiveToNominal,
  monthlyInterest,
  monthlyToAnnual,
  monthlyToEffectiveAnnual,
  nominalFromReal,
  nominalToEffective,
  priceIndex,
  realFromNominal,
} from '../../../../src/domain/shared/rate'

const close = (actual: number, expected: number, precision = 10) => {
  expect(actual).toBeCloseTo(expected, precision)
}

describe('conversiones nominal <-> mensual', () => {
  it('divide y multiplica por 12', () => {
    close(annualToMonthly(0.12), 0.01)
    close(monthlyToAnnual(0.01), 0.12)
  })

  it('la division simple no es la inversa de la capitalizacion', () => {
    // 12% nominal != 12% efectivo
    const monthly = annualToMonthly(0.12)
    close(monthlyToEffectiveAnnual(monthly), 0.12682503013196972)
  })
})

describe('efectiva <-> mensual', () => {
  it('es round-trip', () => {
    const effective = 0.07
    close(monthlyToEffectiveAnnual(effectiveAnnualToMonthly(effective)), effective)
  })

  it('0% sigue siendo 0%', () => {
    expect(monthlyToEffectiveAnnual(0)).toBe(0)
    expect(effectiveAnnualToMonthly(0)).toBe(0)
  })
})

describe('nominal <-> efectiva con n capitalizaciones', () => {
  it('es round-trip', () => {
    close(effectiveToNominal(nominalToEffective(0.05, 12), 12), 0.05)
    close(nominalToEffective(effectiveToNominal(0.05, 12), 12), 0.05)
  })

  it('rechaza n no positivo', () => {
    expect(() => nominalToEffective(0.05, 0)).toThrow(RangeError)
    expect(() => effectiveToNominal(0.05, -1)).toThrow(RangeError)
  })
})

describe('tasas reales', () => {
  it('desplaza la nominal por la inflacion', () => {
    close(realFromNominal(0.05, 0.02), 0.029411764705882353)
    close(nominalFromReal(0.029411764705882353, 0.02), 0.05)
  })

  it('sin inflacion, real == nominal', () => {
    expect(realFromNominal(0.05, 0)).toBeCloseTo(0.05, 12)
  })

  it('con inflacion mayor que la nominal, la real es negativa', () => {
    expect(realFromNominal(0.02, 0.05)).toBeLessThan(0)
  })
})

describe('priceIndex', () => {
  it('acumula interpolando el factor anual', () => {
    close(priceIndex(0.02, 12), 1.02)
    close(priceIndex(0.02, 24), 1.0404)
    close(priceIndex(0.02, 0), 1)
    close(priceIndex(0.02, 6), 1.02 ** 0.5)
  })

  it('rechaza horizontes negativos', () => {
    expect(() => priceIndex(0.02, -1)).toThrow(RangeError)
  })
})

describe('monthlyInterest', () => {
  it('aplica la tasa mensual al saldo', () => {
    expect(monthlyInterest(1000, 0.01)).toBe(10)
    expect(monthlyInterest(1000, 0)).toBe(0)
  })
})
