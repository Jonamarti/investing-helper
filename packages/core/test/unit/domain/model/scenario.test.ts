import { describe, expect, it } from 'vitest'

import {
  defaultAssumptions,
  defaultMonteCarlo,
  effectiveHorizon,
  isMonteCarloEnabled,
} from '../../../../src/domain/model'
import { resolveContribution, overridesOutsideHorizon } from '../../../../src/domain/model'
import type { ContributionPlan } from '../../../../src/domain/model'
import {
  defaultScenario,
  findLoan,
  foreignCurrencies,
  hasSupportedBaseCurrency,
  horizonOf,
  loansForStrategy,
  needsExchangeRates,
  scenarioExponent,
} from '../../../../src/domain/model'

describe('assumptions', () => {
  it('viene con 240 meses, 2,5 % de inflacion y sin Monte Carlo', () => {
    const assumptions = defaultAssumptions()
    expect(assumptions.horizonMonths).toBe(240)
    expect(assumptions.inflationAnnual).toBe(0.025)
    expect(isMonteCarloEnabled(assumptions)).toBe(false)
  })

  it('el Monte Carlo se activa al.enabled', () => {
    expect(isMonteCarloEnabled({ ...defaultAssumptions(), monteCarlo: defaultMonteCarlo() })).toBe(
      true,
    )
  })

  it('el horizonte efectivo nunca baja de un mes', () => {
    expect(effectiveHorizon({ ...defaultAssumptions(), horizonMonths: 0 })).toBe(1)
    expect(effectiveHorizon({ ...defaultAssumptions(), horizonMonths: -10 })).toBe(1)
  })

  it('el horizonte efectivo trunca los meses fraccionarios', () => {
    expect(effectiveHorizon({ ...defaultAssumptions(), horizonMonths: 100.9 })).toBe(100)
  })

  it('los ajustes de Monte Carlo por defecto son razonables', () => {
    const mc = defaultMonteCarlo()
    expect(mc.paths).toBe(1000)
    expect(mc.seed).toBeGreaterThan(0)
    expect(mc.equityVolatilityAnnual).toBeGreaterThan(0)
  })
})

describe('contributionPlan', () => {
  const plan: ContributionPlan = {
    currency: 'EUR',
    initialLumpSum: 5000,
    savingsRate: 0.3,
    followSalary: true,
    fixedMonthly: 400,
    overrides: {},
  }

  it('el mes 0 incluye el capital inicial', () => {
    const resolved = resolveContribution(plan, 1300, 0, 2026, 1)
    expect(resolved.lumpSum).toBe(5000)
    expect(resolved.recurring).toBe(390)
    expect(resolved.total).toBe(5390)
  })

  it('aporta una fraccion del sueldo libre cada mes', () => {
    expect(resolveContribution(plan, 1300, 5, 2026, 1).total).toBe(390)
  })

  it('usa el importe fijo si no sigue al sueldo', () => {
    const fixed = resolveContribution({ ...plan, followSalary: false }, 1300, 5, 2026, 1)
    expect(fixed.recurring).toBe(400)
  })

  it('un override mensual sustituye al automatico', () => {
    const withOverride = resolveContribution(
      { ...plan, overrides: { '2026-06': { monthlyAmount: 1000 } } },
      1300,
      5,
      2026,
      1,
    )
    expect(withOverride.recurring).toBe(1000)
  })

  it('un aporte puntual se suma al recurrente', () => {
    const withLump = resolveContribution(
      { ...plan, overrides: { '2026-06': { lumpSum: 700 } } },
      1300,
      5,
      2026,
      1,
    )
    expect(withLump.total).toBe(1090)
  })

  it('no aporta nada si el sueldo libre es negativo', () => {
    expect(resolveContribution(plan, -500, 5, 2026, 1).recurring).toBe(0)
  })

  it('ancla las claves al inicio del escenario', () => {
    // Empezando en marzo, el mes 10 es enero del año siguiente.
    const result = resolveContribution(plan, 1300, 10, 2026, 3)
    expect(result.recurring).toBe(390)
    const keys = overridesOutsideHorizon(
      { ...plan, overrides: { '2026-01': {}, '2027-01': {} } },
      12,
      2026,
      3,
    )
    expect(keys).toEqual(['2026-01'])
  })
})

describe('scenario', () => {
  it('el escenario por defecto es coherente consigo mismo', () => {
    const scenario = defaultScenario()
    expect(scenario.scenarioVersion).toBeGreaterThan(0)
    expect(scenario.strategies).toHaveLength(3)
    expect(scenario.loans).toHaveLength(1)
    // La tabla de cambios es la identidad: solo aparece si hace falta.
    expect(scenario.exchangeRates.rates).toEqual({ EUR: 1 })
  })

  it('el exponente sale de la divisa base', () => {
    expect(scenarioExponent(defaultScenario())).toBe(2)
    expect(scenarioExponent({ ...defaultScenario(), baseCurrency: 'JPY' })).toBe(0)
  })

  it('el horizonte viene de los supuestos', () => {
    expect(horizonOf(defaultScenario())).toBe(240)
  })

  it('detecta las divisas ajenas al escenario', () => {
    const scenario = defaultScenario()
    expect(foreignCurrencies(scenario)).toEqual([])
    expect(needsExchangeRates(scenario)).toBe(false)

    const withDollar = {
      ...scenario,
      contributionPlan: { ...scenario.contributionPlan, currency: 'USD' as const },
    }
    expect(foreignCurrencies(withDollar)).toEqual(['USD'])
    expect(needsExchangeRates(withDollar)).toBe(true)
  })

  it('resuelve prestamos por id, ignorando los que no existen', () => {
    const scenario = defaultScenario()
    expect(loansForStrategy(scenario, ['loan-mortgage'])).toHaveLength(1)
    expect(loansForStrategy(scenario, ['no-existe'])).toHaveLength(0)
    expect(findLoan(scenario, 'loan-mortgage')?.principal).toBe(200_000)
    expect(findLoan(scenario, 'no-existe')).toBeUndefined()
  })

  it('reconoce la divisa base soportada', () => {
    expect(hasSupportedBaseCurrency(defaultScenario())).toBe(true)
    expect(hasSupportedBaseCurrency({ ...defaultScenario(), baseCurrency: 'XYZ' as never })).toBe(
      false,
    )
  })
})
