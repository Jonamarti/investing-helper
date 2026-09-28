import { defaultScenario, SCENARIO_VERSION } from '@investing-helper/core'
import { describe, expect, it } from 'vitest'

import {
  exportScenarioToJson,
  importScenarioFromJson,
} from '../../../../src/infrastructure/persistence/jsonFileRepo'

describe('exportScenarioToJson / importScenarioFromJson', () => {
  it('exportar e importar de vuelta da el mismo escenario', () => {
    const scenario = defaultScenario()
    const json = exportScenarioToJson(scenario)
    const result = importScenarioFromJson(json)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toEqual(scenario)
    }
  })

  it('un JSON invalido no se puede importar', () => {
    const result = importScenarioFromJson('{ esto no es json')
    expect(result).toEqual({ ok: false, error: { kind: 'invalidJson' } })
  })

  it('una version futura desconocida se rechaza con el motivo de la migracion', () => {
    const json = JSON.stringify({ ...defaultScenario(), scenarioVersion: SCENARIO_VERSION + 1 })
    const result = importScenarioFromJson(json)
    expect(result).toEqual({
      ok: false,
      error: {
        kind: 'migration',
        error: { kind: 'unknownVersion', version: SCENARIO_VERSION + 1 },
      },
    })
  })
})
