import { describe, expect, it } from 'vitest'

import { runMonteCarlo, strategyInputsOf, type IRandomSource } from '../../../../src/application'
import {
  defaultAssumptions,
  defaultMonteCarlo,
  defaultScenario,
  registerAllEngines,
} from '../../../../src'
import type { Scenario } from '../../../../src/domain/model'

registerAllEngines()

/** RNG determinista solo para tests; la app real usa `mulberry32` en infra. */
function fakeRandom(seed: number): IRandomSource {
  let state = seed >>> 0
  return {
    next(): number {
      state = (state + 0x6d2b79f5) >>> 0
      let t = state
      t = Math.imul(t ^ (t >>> 15), t | 1)
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    },
  }
}

function equityOnlyScenario(): Scenario {
  return {
    ...defaultScenario(),
    assumptions: { ...defaultAssumptions(), horizonMonths: 24, monteCarlo: defaultMonteCarlo() },
    strategies: [{ type: 'equity', expectedReturn: 0.07, gainTaxMode: 'onExit' }],
  }
}

describe('runMonteCarlo', () => {
  it('solo acepta estrategias de renta variable', () => {
    const scenario = defaultScenario()
    const cash = strategyInputsOf(scenario).find((s) => s.params.type === 'cash')!
    expect(() => runMonteCarlo(scenario, cash, defaultMonteCarlo(), fakeRandom(1))).toThrow(
      /solo soporta estrategias "equity"/,
    )
  })

  it('con la misma semilla, el resultado es identico', () => {
    const scenario = equityOnlyScenario()
    const equity = strategyInputsOf(scenario)[0]!
    const settings = { ...defaultMonteCarlo(), paths: 50 }

    const first = runMonteCarlo(scenario, equity, settings, fakeRandom(42))
    const second = runMonteCarlo(scenario, equity, settings, fakeRandom(42))

    expect(first.finalValues).toEqual(second.finalValues)
  })

  it('semillas distintas dan trayectorias distintas', () => {
    const scenario = equityOnlyScenario()
    const equity = strategyInputsOf(scenario)[0]!
    const settings = { ...defaultMonteCarlo(), paths: 50 }

    const first = runMonteCarlo(scenario, equity, settings, fakeRandom(1))
    const second = runMonteCarlo(scenario, equity, settings, fakeRandom(2))

    expect(first.finalValues).not.toEqual(second.finalValues)
  })

  it('sin volatilidad, todos los caminos dan el mismo valor final determinista', () => {
    const scenario = equityOnlyScenario()
    const equity = strategyInputsOf(scenario)[0]!
    const settings = { ...defaultMonteCarlo(), paths: 20, equityVolatilityAnnual: 0 }

    const result = runMonteCarlo(scenario, equity, settings, fakeRandom(7))

    expect(new Set(result.finalValues).size).toBe(1)
    expect(result.p5).toBe(result.p95)
  })

  it('genera un valor final por cada camino', () => {
    const scenario = equityOnlyScenario()
    const equity = strategyInputsOf(scenario)[0]!
    const settings = { ...defaultMonteCarlo(), paths: 33 }

    const result = runMonteCarlo(scenario, equity, settings, fakeRandom(3))

    expect(result.finalValues).toHaveLength(33)
    expect(result.strategyId).toBe(equity.id)
  })

  it('sin otra estrategia con la que comparar, probBeatsBest es null', () => {
    const scenario = equityOnlyScenario()
    const equity = strategyInputsOf(scenario)[0]!
    const result = runMonteCarlo(
      scenario,
      equity,
      { ...defaultMonteCarlo(), paths: 10 },
      fakeRandom(9),
    )
    expect(result.probBeatsBest).toBeNull()
  })

  it('con otras estrategias, probBeatsBest y probBeatsInflation son fracciones validas', () => {
    const scenario = defaultScenario()
    const equity = strategyInputsOf(scenario).find((s) => s.params.type === 'equity')!
    const result = runMonteCarlo(
      scenario,
      equity,
      { ...defaultMonteCarlo(), paths: 25 },
      fakeRandom(5),
    )

    expect(result.probBeatsBest).not.toBeNull()
    expect(result.probBeatsBest!).toBeGreaterThanOrEqual(0)
    expect(result.probBeatsBest!).toBeLessThanOrEqual(1)
    expect(result.probBeatsInflation).toBeGreaterThanOrEqual(0)
    expect(result.probBeatsInflation).toBeLessThanOrEqual(1)
  })
})
