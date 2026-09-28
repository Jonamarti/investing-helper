import fc from 'fast-check'
import { describe, expect, it } from 'vitest'

import { irrMonthly } from '../../../../src/domain/analytics'
import { effectiveAnnualToMonthly, unwrap } from '../../../../src/domain/shared'

describe('irrMonthly', () => {
  it('recupera el 10 % anual de una inversion de 1000 a 1100 en 12 meses', () => {
    // -1000 en el mes 0, +1100 en el mes 12: (1+r)^12 = 1.1 exactamente.
    const flows = new Array(13).fill(0)
    flows[0] = -1000
    flows[12] = 1100
    const result = irrMonthly(flows)
    expect(result.ok).toBe(true)
    expect(unwrap(result)).toBeCloseTo(0.1, 6)
  })

  it('sin crecimiento la TIR es cero', () => {
    // -1000, -1000, +2000: se recupera exactamente lo aportado.
    const result = irrMonthly([-1000, -1000, 2000])
    expect(result.ok).toBe(true)
    expect(unwrap(result)).toBeCloseTo(0, 8)
  })

  it('sin cambio de signo no hay TIR', () => {
    expect(irrMonthly([1000, 2000, 3000])).toEqual({ ok: false, error: 'noSignChange' })
    expect(irrMonthly([0, 0, 0])).toEqual({ ok: false, error: 'noSignChange' })
  })

  it('un unico flujo tampoco tiene TIR', () => {
    expect(irrMonthly([1000])).toEqual({ ok: false, error: 'noSignChange' })
  })

  it('recurre a la biseccion cuando Newton-Raphson oscila sin converger', () => {
    // Newton oscila indefinidamente sobre estos flujos (verificado por fuera);
    // la biseccion si encuentra la raiz, con VAN(1.6704) ~ 0.
    const flows = [-5000, 20000, -20000, 6000]
    const result = irrMonthly(flows)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(Number.isFinite(result.value)).toBe(true)
    }
  })

  it('sin raiz real, ni Newton ni la biseccion convergen', () => {
    // 20x^2 - 25x + 41 = 0 (con x = 1/(1+r)) tiene discriminante negativo: no
    // hay ninguna tasa real que iguale el VAN a cero, aunque haya cambio de signo.
    expect(irrMonthly([41, -25, 20])).toEqual({ ok: false, error: 'noConvergence' })
  })

  it('un crecimiento compuesto constante recupera la tasa anual de partida', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.001, max: 0.25, noNaN: true }),
        fc.integer({ min: 2, max: 240 }),
        fc.double({ min: 100, max: 100_000, noNaN: true }),
        (annualRate, months, principal) => {
          const monthlyRate = effectiveAnnualToMonthly(annualRate)
          const finalValue = principal * (1 + monthlyRate) ** (months - 1)
          const flows = new Array(months).fill(0)
          flows[0] = -principal
          flows[months - 1] += finalValue

          const result = irrMonthly(flows)
          expect(result.ok).toBe(true)
          if (result.ok) {
            expect(result.value).toBeCloseTo(annualRate, 2)
          }
        },
      ),
    )
  })
})
