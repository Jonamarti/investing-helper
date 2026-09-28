import fc from 'fast-check'
import { describe, expect, it } from 'vitest'

import { deflate, realSeries } from '../../../../src/domain/analytics'
import { priceIndex } from '../../../../src/domain/shared'
import type { ValuePoint } from '../../../../src/domain/engine'

describe('deflate', () => {
  it('deflacta 12 meses al 2 % anual', () => {
    // month 11 cierra con 12 meses de inflacion acumulada: priceIndex(0.02, 12) = 1.02.
    expect(deflate(1000, 0.02, 11)).toBeCloseTo(1000 / 1.02, 8)
  })

  it('sin inflacion, el valor real es el nominal', () => {
    expect(deflate(1000, 0, 11)).toBe(1000)
  })

  it('reinflactar recupera el valor de partida', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -1_000_000, max: 1_000_000, noNaN: true }),
        fc.double({ min: -0.3, max: 0.3, noNaN: true }),
        fc.integer({ min: 0, max: 600 }),
        (value, inflationAnnual, monthIndex) => {
          const real = deflate(value, inflationAnnual, monthIndex)
          const nominal = real * priceIndex(inflationAnnual, monthIndex + 1)
          expect(nominal).toBeCloseTo(value, 6)
        },
      ),
    )
  })
})

describe('realSeries', () => {
  it('deflacta cada punto y redondea al exponente de la divisa', () => {
    const points: ValuePoint[] = [
      {
        monthIndex: 0,
        date: '2026-01',
        contribution: 1000,
        cumulativeContribution: 1000,
        value: 1000,
        cash: 1000,
        position: 0,
        grossReturn: 0,
        tax: 0,
        netReturn: 0,
      },
      {
        monthIndex: 11,
        date: '2026-12',
        contribution: 0,
        cumulativeContribution: 1000,
        value: 1000,
        cash: 1000,
        position: 0,
        grossReturn: 0,
        tax: 0,
        netReturn: 0,
      },
    ]
    const series = realSeries(points, 0.02, 2)
    expect(series).toHaveLength(2)
    expect(series[0]?.value).toBeCloseTo(1000 / Math.pow(1.02, 1 / 12), 2)
    expect(series[1]?.value).toBeCloseTo(1000 / 1.02, 2)
  })
})
