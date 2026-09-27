import { describe, expect, it } from 'vitest'

import {
  allParamSpecs,
  defaultMixedComponents,
  defaultParamsFor,
  isValidStrategyParams,
  mixedComponentSpecsFor,
  paramSpecsFor,
  validateStrategyParams,
} from '../../../../src/domain/params'
import { STRATEGY_TYPES, type StrategyParams } from '../../../../src/domain/model'

describe('catalogo de parametros', () => {
  it('tiene specs para los cinco tipos de estrategia', () => {
    for (const type of STRATEGY_TYPES) {
      const specs = paramSpecsFor(type)
      expect(specs.length).toBeGreaterThan(0)
      for (const spec of specs) {
        expect(spec.labelKey).toMatch(/^params\./)
      }
    }
  })

  it('no repite claves dentro de una estrategia', () => {
    for (const type of STRATEGY_TYPES) {
      const keys = paramSpecsFor(type).map((spec) => spec.key)
      expect(new Set(keys).size).toBe(keys.length)
    }
  })

  it('los valores por defecto cumplen sus propios limites', () => {
    for (const spec of allParamSpecs()) {
      if (typeof spec.default !== 'number') continue
      if (spec.min !== undefined) expect(spec.default).toBeGreaterThanOrEqual(spec.min)
      if (spec.max !== undefined) expect(spec.default).toBeLessThanOrEqual(spec.max)
    }
  })

  it('expone specs por componente de cartera mixta', () => {
    expect(mixedComponentSpecsFor('cash').map((s) => s.key)).toContain('annualRate')
    expect(mixedComponentSpecsFor('bonds').map((s) => s.key)).toContain('couponRate')
    expect(mixedComponentSpecsFor('equity').map((s) => s.key)).toContain('expectedReturn')
  })

  it('los parametros por defecto son validos', () => {
    for (const type of STRATEGY_TYPES) {
      const params = defaultParamsFor(type)
      if (type === 'debtPaydown') {
        // Sin prestamos seleccionados el tipo no es valido: se comprueba aparte.
        expect(validateStrategyParams(params)).toEqual([
          { path: 'debtPaydown.loanIds', messageKey: 'validation.debtNeedsLoans' },
        ])
        continue
      }
      expect(validateStrategyParams(params)).toEqual([])
      expect(params.type).toBe(type)
    }
  })

  it('la cartera mixta por defecto reparte 100 %', () => {
    const components = defaultMixedComponents()
    const total = components.reduce((acc, component) => acc + component.weight, 0)
    expect(total).toBeCloseTo(1, 10)
  })
})

describe('validateStrategyParams', () => {
  it('detecta un porcentaje fuera de rango', () => {
    const params = defaultParamsFor('equity') as Extract<StrategyParams, { type: 'equity' }>
    const issues = validateStrategyParams({ ...params, expectedReturn: 5 })
    expect(issues).toEqual([
      { path: 'equity.expectedReturn', messageKey: 'validation.max', params: { max: 0.5 } },
    ])
  })

  it('detecta un parametro ausente', () => {
    const params = defaultParamsFor('cash') as unknown as Record<string, unknown>
    delete params.annualRate
    expect(validateStrategyParams(params as unknown as StrategyParams)).toEqual([
      { path: 'cash.annualRate', messageKey: 'validation.required' },
    ])
  })

  it('detecta un valor no numerico', () => {
    const params = defaultParamsFor('cash') as unknown as Record<string, unknown>
    params.annualRate = 'mucho'
    expect(validateStrategyParams(params as unknown as StrategyParams)).toEqual([
      { path: 'cash.annualRate', messageKey: 'validation.expectedNumber' },
    ])
  })

  it('rechaza una opcion de select desconocida', () => {
    const params = defaultParamsFor('equity') as unknown as Record<string, unknown>
    params.gainTaxMode = 'everyOtherTuesday'
    expect(validateStrategyParams(params as unknown as StrategyParams)).toEqual([
      { path: 'equity.gainTaxMode', messageKey: 'validation.unknownOption' },
    ])
  })

  it('exige que los pesos de la cartera mixta sumen 1', () => {
    const params = defaultParamsFor('mixed') as Extract<StrategyParams, { type: 'mixed' }>
    const skewed = { ...params, components: params.components.map((c) => ({ ...c, weight: 0.5 })) }
    const issues = validateStrategyParams(skewed)
    expect(issues).toHaveLength(1)
    expect(issues[0]?.messageKey).toBe('validation.weightsMustSumToOne')
  })

  it('exige al menos un componente en la cartera mixta', () => {
    const params = defaultParamsFor('mixed') as Extract<StrategyParams, { type: 'mixed' }>
    expect(validateStrategyParams({ ...params, components: [] })).toEqual([
      { path: 'mixed.components', messageKey: 'validation.mixedNeedsComponents' },
    ])
  })

  it('valida los sub-parametros de cada componente mixto', () => {
    const params = defaultParamsFor('mixed') as Extract<StrategyParams, { type: 'mixed' }>
    const components = params.components.map((component) =>
      component.kind === 'bonds'
        ? { ...component, params: { ...component.params, couponRate: 9 } }
        : component,
    )
    const issues = validateStrategyParams({ ...params, components })
    expect(issues).toEqual([
      {
        path: 'mixed.components.1.bonds.couponRate',
        messageKey: 'validation.max',
        params: { max: 0.2 },
      },
    ])
  })

  it('rechaza pesos negativos', () => {
    const params = defaultParamsFor('mixed') as Extract<StrategyParams, { type: 'mixed' }>
    const components = params.components.map((c, i) => (i === 0 ? { ...c, weight: -0.2 } : c))
    expect(validateStrategyParams({ ...params, components })).toContainEqual({
      path: 'mixed.components.0.cash.weight',
      messageKey: 'validation.min',
      params: { min: 0 },
    })
  })

  it('exige un precio de compra positivo en bonos', () => {
    const params = defaultParamsFor('bonds') as Extract<StrategyParams, { type: 'bonds' }>
    expect(validateStrategyParams({ ...params, purchasePrice: 0 })).toEqual([
      { path: 'bonds.purchasePrice', messageKey: 'validation.positiveRequired' },
    ])
  })

  it('exige al menos un prestamo en debtPaydown', () => {
    const params = defaultParamsFor('debtPaydown') as Extract<
      StrategyParams,
      { type: 'debtPaydown' }
    >
    expect(isValidStrategyParams(params)).toBe(false)
    expect(isValidStrategyParams({ ...params, loanIds: ['a'] })).toBe(true)
  })

  it('rechaza un componente mixto de tipo desconocido', () => {
    const params = defaultParamsFor('mixed') as unknown as Record<string, unknown>
    params.components = [{ kind: 'crypto', weight: 1 }]
    expect(validateStrategyParams(params as unknown as StrategyParams)).toEqual([
      { path: 'mixed.components.0.kind', messageKey: 'validation.unknownComponent' },
    ])
  })
})
