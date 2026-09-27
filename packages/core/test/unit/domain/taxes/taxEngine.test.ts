import { describe, expect, it } from 'vitest'

import {
  computeTax,
  noTaxCharge,
  spainApprox,
  sumCharges,
  taxPreset,
  taxSheltered,
  TAXABLE_EVENT_KINDS,
  TAX_PRESETS,
  zeroTax,
  type TaxRules,
  type TaxableEvent,
} from '../../../../src/domain/taxes'

const rules: TaxRules = {
  cashInterest: 0.19,
  bondCoupon: 0.19,
  dividends: 0.19,
  capitalGainsAnnual: 0.19,
  capitalGainsOnExit: 0.19,
  mortgageInterestRelief: 0.19,
}

describe('zeroTax', () => {
  it('no liquida nada', () => {
    const charge = computeTax([{ kind: 'interest', gross: 1000 }], zeroTax(), 2)
    expect(charge.total).toBe(0)
    expect(charge.byKind.interest).toBe(0)
  })
})

describe('computeTax', () => {
  it('aplica el tipo de cada hecho imponible', () => {
    const events: TaxableEvent[] = [
      { kind: 'interest', gross: 1000 },
      { kind: 'coupon', gross: 2000 },
      { kind: 'dividend', gross: 500 },
      { kind: 'capitalGain', gross: 4000 },
    ]
    const charge = computeTax(events, rules, 2)
    expect(charge.byKind.interest).toBe(190)
    expect(charge.byKind.coupon).toBe(380)
    expect(charge.byKind.dividend).toBe(95)
    expect(charge.byKind.capitalGain).toBe(760)
    expect(charge.total).toBe(1425)
  })

  it('el relief de hipoteca resta', () => {
    const charge = computeTax(
      [
        { kind: 'interest', gross: 1000 },
        { kind: 'mortgageInterestRelief', gross: 1000 },
      ],
      rules,
      2,
    )
    expect(charge.byKind.mortgageInterestRelief).toBe(-190)
    expect(charge.total).toBe(0)
  })

  it('ignora los hechos con importe cero', () => {
    const charge = computeTax([{ kind: 'interest', gross: 0 }], rules, 2)
    expect(charge.total).toBe(0)
  })

  it('ignora los hechos sin tipo aplicable', () => {
    const charge = computeTax([{ kind: 'interest', gross: 1000 }], zeroTax(), 2)
    expect(charge.total).toBe(0)
  })

  it('redondea al exponente', () => {
    const charge = computeTax([{ kind: 'interest', gross: 333 }], rules, 0)
    expect(charge.byKind.interest).toBe(63)
  })
})

describe('noTaxCharge', () => {
  it('tiene todos los tipos a cero', () => {
    const charge = noTaxCharge()
    expect(charge.total).toBe(0)
    for (const kind of TAXABLE_EVENT_KINDS) {
      expect(charge.byKind[kind]).toBe(0)
    }
  })
})

describe('sumCharges', () => {
  it('suma varios cargos por tipo', () => {
    const total = sumCharges(
      [
        computeTax([{ kind: 'interest', gross: 1000 }], rules, 2),
        computeTax(
          [
            { kind: 'interest', gross: 500 },
            { kind: 'coupon', gross: 100 },
          ],
          rules,
          2,
        ),
      ],
      2,
    )
    expect(total.byKind.interest).toBe(285)
    expect(total.byKind.coupon).toBe(19)
    expect(total.total).toBe(304)
  })

  it('sumar nada es cero', () => {
    expect(sumCharges([], 2).total).toBe(0)
  })
})

describe('presets fiscales', () => {
  it('el preset por defecto no grava nada', () => {
    expect(zeroTax().cashInterest).toBe(0)
    expect(zeroTax().capitalGainsOnExit).toBe(0)
  })

  it('el preset espanol grava cupones, dividendos y plusvalias', () => {
    const spain = spainApprox()
    expect(spain.bondCoupon).toBe(0.19)
    expect(spain.dividends).toBe(0.19)
    expect(spain.capitalGainsOnExit).toBe(0.19)
    // El interes de una cuenta corriente no se grava en Espana.
    expect(spain.cashInterest).toBe(0)
  })

  it('el preset opaco no grava plusvalias', () => {
    const sheltered = taxSheltered()
    expect(sheltered.capitalGainsOnExit).toBe(0)
    expect(sheltered.dividends).toBe(0)
    // La deduccion de hipoteca se mantiene: es independiente del envoltorio.
    expect(sheltered.mortgageInterestRelief).toBeGreaterThan(0)
  })

  it('todos los presets cubren los seis tipos con valores en [0, 1]', () => {
    // Las plusvalias tienen dos reglas (anual y al salir), asi que el tipo de
    // hecho `capitalGain` no es un nombre de clave valido.
    const ruleKeyFor: Record<(typeof TAXABLE_EVENT_KINDS)[number], keyof TaxRules> = {
      interest: 'cashInterest',
      coupon: 'bondCoupon',
      dividend: 'dividends',
      capitalGain: 'capitalGainsOnExit',
      mortgageInterestRelief: 'mortgageInterestRelief',
    }
    for (const preset of [zeroTax(), spainApprox(), taxSheltered()]) {
      for (const kind of TAXABLE_EVENT_KINDS) {
        const value = preset[ruleKeyFor[kind]]
        expect(value).toBeGreaterThanOrEqual(0)
        expect(value).toBeLessThanOrEqual(1)
      }
    }
  })

  it('taxPreset devuelve el preset pedido', () => {
    expect(taxPreset('zero')).toEqual(zeroTax())
    expect(taxPreset('spain')).toEqual(spainApprox())
    expect(taxPreset('sheltered')).toEqual(taxSheltered())
  })

  it('el registro de presets tiene una entrada por id', () => {
    expect(Object.keys(TAX_PRESETS).sort()).toEqual(['sheltered', 'spain', 'zero'])
  })
})
