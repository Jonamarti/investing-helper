import { describe, expect, it } from 'vitest'

import { isValidScenario, validateScenario } from '../../../../src/application'
import { defaultScenario } from '../../../../src'
import type { Scenario } from '../../../../src/domain/model'

describe('validateScenario', () => {
  it('el escenario por defecto es valido', () => {
    const scenario = defaultScenario()
    expect(validateScenario(scenario)).toEqual([])
    expect(isValidScenario(scenario)).toBe(true)
  })

  it('sin estrategias, avisa de que hace falta al menos una', () => {
    const scenario: Scenario = { ...defaultScenario(), strategies: [] }
    const issues = validateScenario(scenario)
    expect(issues).toContainEqual({
      path: 'strategies',
      messageKey: 'validation.needsAtLeastOneStrategy',
    })
  })

  it('una estrategia de deuda que referencia un prestamo inexistente, avisa', () => {
    const scenario: Scenario = {
      ...defaultScenario(),
      strategies: [
        {
          type: 'debtPaydown',
          loanIds: ['no-existe'],
          order: 'avalanche',
          goal: 'shortenTerm',
          hurdleRate: 0,
        },
      ],
    }
    const issues = validateScenario(scenario)
    expect(issues).toContainEqual({
      path: 'strategies.0.loanIds',
      messageKey: 'validation.unknownLoan',
      params: { loanId: 'no-existe' },
    })
  })

  it('prestamos con el mismo id, avisa de la duplicidad', () => {
    const base = defaultScenario()
    const loan = base.loans[0]!
    const scenario: Scenario = { ...base, loans: [loan, { ...loan }] }
    const issues = validateScenario(scenario)
    expect(issues).toContainEqual({
      path: 'loans',
      messageKey: 'validation.duplicateLoanId',
      params: { loanId: loan.id },
    })
  })

  it('un sueldo neto negativo, avisa', () => {
    const base = defaultScenario()
    const scenario: Scenario = { ...base, salary: { ...base.salary, netMonthly: -100 } }
    const issues = validateScenario(scenario)
    expect(issues).toContainEqual({
      path: 'salary.netMonthly',
      messageKey: 'validation.positiveRequired',
    })
  })

  it('una paga extra fuera de 1-12, avisa', () => {
    const base = defaultScenario()
    const scenario: Scenario = { ...base, salary: { ...base.salary, extraPayMonths: [13] } }
    const issues = validateScenario(scenario)
    expect(issues.some((issue) => issue.messageKey === 'validation.raw')).toBe(true)
  })

  it('los problemas de cada estrategia llevan el prefijo de su indice', () => {
    const base = defaultScenario()
    const scenario: Scenario = {
      ...base,
      strategies: [{ type: 'equity', expectedReturn: -999, gainTaxMode: 'onExit' }],
    }
    const issues = validateScenario(scenario)
    expect(issues.some((issue) => issue.path.startsWith('strategies.0.'))).toBe(true)
  })
})
