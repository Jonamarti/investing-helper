import { describe, expect, it } from 'vitest'

import { gbmMonthlyReturn, sampleGbmPath, standardNormal } from '../../../../src/domain/montecarlo'
import { annualToMonthly } from '../../../../src/domain/shared'

/**
 * Generador seguido, solo para tests: la app real usa `mulberry32` en
 * `apps/web/src/infrastructure`, pero `domain/montecarlo` no conoce esa
 * implementacion (no tiene dependencias). Aqui basta con algo determinista.
 */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

describe('standardNormal', () => {
  it('con uniformes fijas da siempre el mismo valor', () => {
    expect(standardNormal(0.5, 0.5)).toBeCloseTo(standardNormal(0.5, 0.5), 12)
  })
})

describe('gbmMonthlyReturn', () => {
  it('sin volatilidad es exp(mu/12) - 1 exacto, sin importar Z', () => {
    // Con sigma = 0 el termino de ruido se anula (se multiplica por sigma):
    // cualquier Z da el mismo resultado, el de la capitalizacion continua.
    const monthlyRate = Math.exp(annualToMonthly(0.07)) - 1
    expect(gbmMonthlyReturn(0.07, 0, 1.5)).toBeCloseTo(monthlyRate, 12)
    expect(gbmMonthlyReturn(0.07, 0, -3)).toBeCloseTo(monthlyRate, 12)
  })

  it('con volatilidad, Z positivo da mas rentabilidad que Z negativo', () => {
    const up = gbmMonthlyReturn(0.07, 0.18, 1)
    const down = gbmMonthlyReturn(0.07, 0.18, -1)
    expect(up).toBeGreaterThan(down)
  })

  it('Z = 0 es el mismo drift que la aproximacion lineal de expectedReturn/12 menos la mitad de la varianza mensual', () => {
    const monthly = gbmMonthlyReturn(0.06, 0.2, 0)
    const monthlyVariance = (0.2 / Math.sqrt(12)) ** 2
    const expectedLog = annualToMonthly(0.06) - monthlyVariance / 2
    expect(Math.log(1 + monthly)).toBeCloseTo(expectedLog, 10)
  })
})

describe('sampleGbmPath', () => {
  it('la misma semilla produce siempre la misma trayectoria', () => {
    const pathA = sampleGbmPath(24, 0.07, 0.18, mulberry32(42))
    const pathB = sampleGbmPath(24, 0.07, 0.18, mulberry32(42))
    expect(pathA).toEqual(pathB)
  })

  it('semillas distintas producen trayectorias distintas', () => {
    const pathA = sampleGbmPath(24, 0.07, 0.18, mulberry32(1))
    const pathB = sampleGbmPath(24, 0.07, 0.18, mulberry32(2))
    expect(pathA).not.toEqual(pathB)
  })

  it('tiene un valor por mes', () => {
    const path = sampleGbmPath(36, 0.05, 0.15, mulberry32(7))
    expect(path).toHaveLength(36)
  })
})
