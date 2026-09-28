import { create } from 'zustand'
import { compareStrategies, type ComparisonResultDto } from '@investing-helper/core/application'
import { defaultScenario, type Scenario } from '@investing-helper/core/domain/model'
import { scenarioRepo } from '../../container'
import {
  exportScenarioToJson,
  importScenarioFromJson,
} from '../../infrastructure/persistence/jsonFileRepo'
import type { ScenarioIndexEntry } from '../../infrastructure/persistence/localStorageRepo'

export type ImportResult = { readonly ok: true } | { readonly ok: false; readonly reason: string }

interface ScenarioStore {
  readonly scenario: Scenario
  readonly comparison: ComparisonResultDto
  /** La biblioteca guardada en localStorage, para la pestana de Escenarios. */
  readonly library: readonly ScenarioIndexEntry[]
  setScenario: (scenario: Scenario) => void
  refreshLibrary: () => void
  /** Guarda el escenario activo (upsert por id) con el nombre dado. */
  saveCurrentAs: (name: string) => void
  /** Reemplaza el escenario activo por uno nuevo en blanco, sin guardarlo todavia. */
  startNewScenario: () => void
  loadFromLibrary: (id: string) => void
  renameInLibrary: (id: string, name: string) => void
  duplicateInLibrary: (id: string, name: string) => void
  deleteFromLibrary: (id: string) => void
  exportCurrentToJson: () => string
  importScenarioFromJsonText: (json: string) => ImportResult
}

function withComparison(scenario: Scenario): Pick<ScenarioStore, 'scenario' | 'comparison'> {
  return { scenario, comparison: compareStrategies(scenario) }
}

/**
 * Store de zustand con el escenario activo, su comparacion ya calculada y la
 * biblioteca de escenarios guardados.
 *
 * La comparacion se recalcula en el hilo principal cada vez que cambia el
 * escenario: para el tamano de escenario actual es instantaneo, y el worker
 * (paso 16 del plan) es una optimizacion, no una necesidad todavia.
 */
export const useScenarioStore = create<ScenarioStore>((set, get) => ({
  ...withComparison(defaultScenario()),
  library: scenarioRepo.listScenarios(),

  setScenario: (scenario) => set(withComparison(scenario)),

  refreshLibrary: () => set({ library: scenarioRepo.listScenarios() }),

  saveCurrentAs: (name) => {
    scenarioRepo.saveScenario(get().scenario, name)
    get().refreshLibrary()
  },

  startNewScenario: () => {
    set(withComparison({ ...defaultScenario(), id: crypto.randomUUID() }))
  },

  loadFromLibrary: (id) => {
    const scenario = scenarioRepo.loadScenario(id)
    if (scenario) {
      set(withComparison(scenario))
    }
  },

  renameInLibrary: (id, name) => {
    scenarioRepo.renameScenario(id, name)
    get().refreshLibrary()
  },

  duplicateInLibrary: (id, name) => {
    const copy = scenarioRepo.duplicateScenario(id, crypto.randomUUID(), name)
    get().refreshLibrary()
    if (copy) {
      set(withComparison(copy))
    }
  },

  deleteFromLibrary: (id) => {
    scenarioRepo.deleteScenario(id)
    get().refreshLibrary()
  },

  exportCurrentToJson: () => exportScenarioToJson(get().scenario),

  importScenarioFromJsonText: (json) => {
    const result = importScenarioFromJson(json)
    if (!result.ok) {
      return { ok: false, reason: result.error.kind }
    }
    set(withComparison(result.value))
    return { ok: true }
  },
}))
