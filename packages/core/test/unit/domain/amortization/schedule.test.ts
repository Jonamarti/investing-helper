import { describe, expect, it } from 'vitest'
import {
  buildSchedule,
  interestPaidSoFar,
  interestRemaining,
  outstandingBalance,
  outstandingMonths,
  paymentFor,
  paymentForBalance,
} from '../../../../src/domain/amortization/schedule'
import { earlyExitCost, isInPenaltyWindow } from '../../../../src/domain/amortization/earlyExit'
import type { Loan } from '../../../../src/domain/model'

const mortgage: Loan = {
  id: 'm1',
  nameKey: 'test.mortgage',
  kind: 'mortgage',
  currency: 'EUR',
  principal: 100_000,
  annualRate: 0.05,
  termMonths: 360,
  system: 'french',
  startMonth: 0,
  earlyExitPenaltyRate: 0,
  interestDeductible: false,
}

const constantLoan: Loan = { ...mortgage, id: 'm2', system: 'constant' }

const RATE = 0.05 / 12

describe('buildSchedule (french)', () => {
  const schedule = buildSchedule(mortgage, 2)

  it('genera una fila por cuota', () => {
    expect(schedule.rows).toHaveLength(360)
    expect(schedule.months).toBe(360)
  })

  it('la primera cuota es la annuity redondeada al alza', () => {
    // La formula da 536.8216; al alza son 536.83, que es lo que se cobra.
    expect(schedule.firstPayment).toBe(536.83)
    expect(schedule.rows[0]?.interest).toBe(416.67)
    expect(schedule.rows[0]?.principal).toBe(120.16)
    expect(schedule.rows[0]?.balance).toBe(99_879.84)
  })

  it('la cuota es constante salvo el ajuste de cierre', () => {
    const distinct = new Set(schedule.rows.slice(0, -1).map((row) => row.payment))
    expect(distinct.size).toBe(1)
    // El ultimo mes es una cuota de cierre parcial: ya no queda capital por
    // amortizar, solo el saldo residual mas su interes.
    expect(schedule.rows.at(-1)!.payment).toBeLessThan(536.83)
    expect(schedule.rows.at(-1)!.payment).toBeGreaterThan(0)
  })

  it('salda en el plazo pactado, con una cuota de cierre parcial', () => {
    expect(schedule.rows).toHaveLength(360)
    expect(schedule.rows.at(-1)?.balance).toBe(0)
  })

  it('cuota = interes + capital en todas las filas', () => {
    for (const row of schedule.rows) {
      expect(row.principal + row.interest).toBeCloseTo(row.payment, 2)
    }
  })

  it('los intereses totales cuadran con lo pagado menos el capital', () => {
    const expected = 536.83 * 359 + 529.72
    expect(schedule.totalPaid).toBe(expected)
    expect(schedule.totalInterest).toBeCloseTo(expected - 100_000, 2)
  })

  it('el saldo decae de forma monotona', () => {
    for (let i = 1; i < schedule.rows.length; i += 1) {
      expect(schedule.rows[i]!.balance).toBeLessThan(schedule.rows[i - 1]!.balance)
    }
  })

  it('los acumulados son coherentes con las filas', () => {
    const last = schedule.rows.at(-1)!
    expect(last.cumulativePrincipal).toBe(100_000)
    expect(last.cumulativeInterest).toBe(schedule.totalInterest)
  })
})

describe('buildSchedule (amortizacion constante)', () => {
  const schedule = buildSchedule(constantLoan, 2)

  it('amortiza el mismo capital cada mes', () => {
    const principals = new Set(schedule.rows.slice(0, -1).map((row) => row.principal))
    expect(principals.size).toBe(1)
  })

  it('la cuota decrece', () => {
    expect(schedule.rows[0]!.payment).toBeGreaterThan(schedule.rows[100]!.payment)
  })

  it('salda el prestamo exactamente', () => {
    expect(schedule.rows.at(-1)?.balance).toBe(0)
  })

  it('totaliza el capital prestado', () => {
    expect(schedule.rows.at(-1)!.cumulativePrincipal).toBe(100_000)
  })
})

describe('caso limite: tipo 0', () => {
  it('sin intereses, la cuota es el capital repartido redondeado al alza', () => {
    const schedule = buildSchedule({ ...mortgage, annualRate: 0, termMonths: 12 }, 2)
    expect(schedule.firstPayment).toBe(8333.34)
    expect(schedule.totalInterest).toBe(0)
    expect(schedule.rows.at(-1)?.balance).toBe(0)
    // El ultimo mes cierra con un resto: 100.000 - 11 x 8333.34.
    expect(schedule.rows.at(-1)!.payment).toBe(8333.26)
  })
})

describe('consultas sobre el cuadro', () => {
  const schedule = buildSchedule(mortgage, 2)

  it('outstandingBalance devuelve el saldo tras n cuotas pagadas', () => {
    // Con 0 cuotas pagadas se debe el capital integro, no el saldo ya amortizado.
    expect(outstandingBalance(schedule, 0)).toBe(100_000)
    expect(outstandingBalance(schedule, 1)).toBe(schedule.rows[0]!.balance)
    expect(outstandingBalance(schedule, 12)).toBe(schedule.rows[11]!.balance)
    expect(outstandingBalance(schedule, 999)).toBe(0)
    expect(outstandingBalance(schedule, -5)).toBe(100_000)
  })

  it('outstandingMonths descuenta las cuotas pagadas', () => {
    expect(outstandingMonths(schedule, 0)).toBe(360)
    expect(outstandingMonths(schedule, 100)).toBe(260)
    expect(outstandingMonths(schedule, 400)).toBe(0)
  })

  it('los intereses pagados arrancan en 0 y el resto cuadra', () => {
    expect(interestPaidSoFar(schedule, 0)).toBe(0)
    expect(interestPaidSoFar(schedule, 1)).toBe(schedule.rows[0]!.cumulativeInterest)
    expect(interestPaidSoFar(schedule, 12)).toBe(schedule.rows[11]!.cumulativeInterest)
    expect(interestPaidSoFar(schedule, 999)).toBe(schedule.totalInterest)
    expect(interestRemaining(schedule, 0, 2)).toBe(schedule.totalInterest)
    expect(interestRemaining(schedule, 12, 2)).toBe(
      schedule.totalInterest - schedule.rows[11]!.cumulativeInterest,
    )
  })
})

describe('paymentFor', () => {
  it('usa la cuota manual si el prestamo la declara', () => {
    expect(paymentFor({ ...mortgage, monthlyPayment: 400 }, 2)).toBe(400)
  })

  it('deriva la cuota si no la hay', () => {
    expect(paymentFor(mortgage, 2)).toBe(536.82)
  })
})

describe('paymentForBalance', () => {
  it('es la inversa de amortizar un saldo en un plazo', () => {
    const payment = paymentForBalance(50_000, RATE, 240, 2)
    // Con esa cuota, 50.000 se saldan en 240 meses (aproximado por redondeo).
    const schedule = buildSchedule({ ...mortgage, principal: 50_000, termMonths: 240 }, 2)
    expect(Math.abs(schedule.firstPayment - payment)).toBeLessThanOrEqual(0.02)
  })
})

describe('earlyExitCost', () => {
  it('sin penalizacion, solo saldo + interes del mes', () => {
    const cost = earlyExitCost(mortgage, 100_000, RATE, 2)
    expect(cost.penalty).toBe(0)
    expect(cost.accruedInterest).toBe(416.67)
    expect(cost.total).toBe(100_416.67)
    expect(cost.hasPenalty).toBe(false)
  })

  it('con penalizacion, la aplica sobre el saldo', () => {
    const cost = earlyExitCost({ ...mortgage, earlyExitPenaltyRate: 0.02 }, 50_000, RATE, 2)
    expect(cost.penalty).toBe(1000)
    expect(cost.hasPenalty).toBe(true)
  })

  it('un revolving nunca penaliza', () => {
    const cost = earlyExitCost(
      { ...mortgage, kind: 'revolving', earlyExitPenaltyRate: 0.5 },
      10_000,
      RATE,
      2,
    )
    expect(cost.penalty).toBe(0)
  })
})

describe('isInPenaltyWindow', () => {
  it('durante los primeros meses hay penalizacion', () => {
    const loan = { ...mortgage, earlyExitPenaltyRate: 0.02 }
    expect(isInPenaltyWindow(loan, 3)).toBe(true)
    expect(isInPenaltyWindow(loan, 6)).toBe(false)
  })

  it('sin penalizacion declarada nunca hay ventana', () => {
    expect(isInPenaltyWindow(mortgage, 1)).toBe(false)
  })
})
