import { afterEach, describe, expect, it } from 'vitest'

import {
  clearEngines,
  hasEngine,
  registerEngines,
  registeredTypes,
  resolveEngine,
} from '../../../../src/domain/engine'
import {
  isDebtStrategy,
  mixedComponentsOf,
  strategyTypeOf,
  STRATEGY_TYPES,
  type StrategyParams,
} from '../../../../src/domain/model'
import { ENGINES, registerAllEngines } from '../../../../src/domain/strategies'

afterEach(() => {
  clearEngines()
})

describe('registro de motores', () => {
  it('falla con un mensaje util si no hay nada registrado', () => {
    expect(() => resolveEngine('cash')).toThrow(/No hay motor registrado para la estrategia "cash"/)
    expect(() => resolveEngine('cash')).toThrow(/\(ninguno\)/)
  })

  it('registra uno a uno y resuelve', () => {
    registerAllEngines()
    expect(hasEngine('cash')).toBe(true)
    expect(resolveEngine('cash').type).toBe('cash')
  })

  it('registerEngines acepta la lista completa', () => {
    registerEngines(ENGINES)
    expect(registeredTypes().sort()).toEqual([...STRATEGY_TYPES].sort())
  })

  it('registrar dos veces el mismo tipo sustituye, no duplica', () => {
    registerAllEngines()
    const before = registeredTypes().length
    registerAllEngines()
    expect(registeredTypes()).toHaveLength(before)
  })

  it('el error lista los tipos ya registrados', () => {
    registerEngines([ENGINES[0]])
    expect(() => resolveEngine('equity')).toThrow(/Registrado: /)
  })

  it('cada motor registrado cubre su propio tipo', () => {
    for (const engine of ENGINES) {
      expect(STRATEGY_TYPES).toContain(engine.type)
    }
  })
})

describe('inspeccion de parametros', () => {
  const cash: StrategyParams = { type: 'cash', annualRate: 0.02 }
  const mixed: StrategyParams = {
    type: 'mixed',
    rebalanceEveryMonths: 12,
    components: [
      { kind: 'cash', weight: 0.5, params: { annualRate: 0.02 } },
      { kind: 'equity', weight: 0.5, params: { expectedReturn: 0.07, gainTaxMode: 'onExit' } },
    ],
  }
  const debt: StrategyParams = {
    type: 'debtPaydown',
    loanIds: ['loan-mortgage'],
    order: 'avalanche',
    goal: 'shortenTerm',
    hurdleRate: 0,
  }

  it('devuelve el tipo tal cual', () => {
    expect(strategyTypeOf(cash)).toBe('cash')
    expect(strategyTypeOf(mixed)).toBe('mixed')
    expect(strategyTypeOf(debt)).toBe('debtPaydown')
  })

  it('solo la mixta tiene componentes', () => {
    expect(mixedComponentsOf(mixed)).toHaveLength(2)
    expect(mixedComponentsOf(cash)).toEqual([])
    expect(mixedComponentsOf(debt)).toEqual([])
  })

  it('solo debtPaydown es estrategia de deuda', () => {
    expect(isDebtStrategy(debt)).toBe(true)
    expect(isDebtStrategy(cash)).toBe(false)
  })
})
