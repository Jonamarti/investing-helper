import { defaultScenario, type Scenario } from '@investing-helper/core'
import { beforeEach, describe, expect, it } from 'vitest'

import { LocalStorageScenarioRepo } from '../../../../src/infrastructure/persistence/localStorageRepo'

/**
 * `Storage` en memoria, para no depender de si el runner trae `localStorage`
 * real ni de que un test deje basura para el siguiente.
 */
class FakeStorage implements Storage {
  private readonly data = new Map<string, string>()

  get length(): number {
    return this.data.size
  }

  clear(): void {
    this.data.clear()
  }

  getItem(key: string): string | null {
    return this.data.get(key) ?? null
  }

  key(index: number): string | null {
    return [...this.data.keys()][index] ?? null
  }

  removeItem(key: string): void {
    this.data.delete(key)
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value)
  }
}

function scenarioWithId(id: string): Scenario {
  return { ...defaultScenario(), id }
}

describe('LocalStorageScenarioRepo', () => {
  let storage: FakeStorage
  let repo: LocalStorageScenarioRepo

  beforeEach(() => {
    storage = new FakeStorage()
    repo = new LocalStorageScenarioRepo(storage)
  })

  it('una biblioteca vacia no tiene escenarios', () => {
    expect(repo.listScenarios()).toEqual([])
    expect(repo.loadScenario('no-existe')).toBeNull()
  })

  it('guardar anade una entrada al indice y el escenario se puede recargar', () => {
    const scenario = scenarioWithId('a')
    repo.saveScenario(scenario, 'Mi escenario')

    expect(repo.listScenarios()).toHaveLength(1)
    expect(repo.listScenarios()[0]?.name).toBe('Mi escenario')
    expect(repo.loadScenario('a')).toEqual(scenario)
  })

  it('guardar dos veces el mismo id actualiza la entrada, no la duplica', () => {
    repo.saveScenario(scenarioWithId('a'), 'Nombre 1')
    repo.saveScenario(scenarioWithId('a'), 'Nombre 2')

    expect(repo.listScenarios()).toHaveLength(1)
    expect(repo.listScenarios()[0]?.name).toBe('Nombre 2')
  })

  it('renombrar solo toca el indice, no el escenario guardado', () => {
    const scenario = scenarioWithId('a')
    repo.saveScenario(scenario, 'Original')
    repo.renameScenario('a', 'Nuevo nombre')

    expect(repo.listScenarios()[0]?.name).toBe('Nuevo nombre')
    expect(repo.loadScenario('a')).toEqual(scenario)
  })

  it('renombrar un id que no existe no hace nada', () => {
    repo.renameScenario('fantasma', 'x')
    expect(repo.listScenarios()).toEqual([])
  })

  it('duplicar copia el contenido con un id nuevo y una entrada propia', () => {
    repo.saveScenario(scenarioWithId('a'), 'Original')
    const copy = repo.duplicateScenario('a', 'b', 'Copia de Original')

    expect(copy?.id).toBe('b')
    expect(repo.listScenarios()).toHaveLength(2)
    expect(repo.loadScenario('a')?.id).toBe('a')
    expect(repo.loadScenario('b')?.id).toBe('b')
  })

  it('duplicar un id que no existe devuelve null y no crea nada', () => {
    expect(repo.duplicateScenario('fantasma', 'b', 'x')).toBeNull()
    expect(repo.listScenarios()).toEqual([])
  })

  it('borrar quita el escenario y su entrada del indice', () => {
    repo.saveScenario(scenarioWithId('a'), 'Original')
    repo.deleteScenario('a')

    expect(repo.listScenarios()).toEqual([])
    expect(repo.loadScenario('a')).toBeNull()
  })

  it('los ajustes se guardan y se recuperan tal cual', () => {
    expect(repo.loadSettings()).toBeNull()
    repo.saveSettings({ language: 'es', lastTab: 'comparison' })
    expect(repo.loadSettings()).toEqual({ language: 'es', lastTab: 'comparison' })
  })

  it('un escenario con JSON corrupto en el almacen se trata como inexistente', () => {
    storage.setItem('investing-helper:v1:scenario:corrupto', '{ esto no es json')
    expect(repo.loadScenario('corrupto')).toBeNull()
  })
})
