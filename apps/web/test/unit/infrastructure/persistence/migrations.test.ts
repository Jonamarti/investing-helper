import { defaultScenario, SCENARIO_VERSION } from '@investing-helper/core'
import { describe, expect, it } from 'vitest'

import { migrateScenarioData } from '../../../../src/infrastructure/persistence/migrations'

describe('migrateScenarioData', () => {
  it('un escenario en la version actual pasa sin cambios', () => {
    const scenario = defaultScenario()
    const result = migrateScenarioData(scenario)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toEqual(scenario)
    }
  })

  it('una version futura desconocida se rechaza, no se adivina', () => {
    const result = migrateScenarioData({
      ...defaultScenario(),
      scenarioVersion: SCENARIO_VERSION + 1,
    })
    expect(result).toEqual({
      ok: false,
      error: { kind: 'unknownVersion', version: SCENARIO_VERSION + 1 },
    })
  })

  it('sin scenarioVersion (version 0 implicita) y sin migracion registrada, falla explicito', () => {
    // Hoy no hay ninguna migracion 0 -> 1: es el primer formato que se ha
    // persistido, asi que un objeto sin version no es un escenario valido.
    const result = migrateScenarioData({ id: 'x' })
    expect(result).toEqual({ ok: false, error: { kind: 'missingMigration', fromVersion: 0 } })
  })

  it('datos que no son un objeto se rechazan', () => {
    expect(migrateScenarioData(null)).toEqual({ ok: false, error: { kind: 'invalidShape' } })
    expect(migrateScenarioData('no soy un escenario')).toEqual({
      ok: false,
      error: { kind: 'invalidShape' },
    })
    expect(migrateScenarioData(42)).toEqual({ ok: false, error: { kind: 'invalidShape' } })
  })
})
