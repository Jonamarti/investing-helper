import type { Scenario } from '@investing-helper/core/domain/model'
import { migrateScenarioData } from './migrations'

const INDEX_KEY = 'investing-helper:v1:index'
const SETTINGS_KEY = 'investing-helper:v1:settings'
const scenarioKey = (id: string): string => `investing-helper:v1:scenario:${id}`

/** Entrada de la biblioteca: lo que se lista sin cargar el escenario entero. */
export interface ScenarioIndexEntry {
  readonly id: string
  /** Nombre visible, editable por el usuario (independiente de `Scenario.nameKey`). */
  readonly name: string
  readonly updatedAt: string
}

export interface AppSettings {
  readonly language: 'es' | 'en'
  readonly lastTab: string
}

function readJson<T>(storage: Storage, key: string): T | null {
  const raw = storage.getItem(key)
  if (raw === null) {
    return null
  }
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function writeJson(storage: Storage, key: string, value: unknown): void {
  storage.setItem(key, JSON.stringify(value))
}

/**
 * Biblioteca de escenarios sobre `localStorage`.
 *
 * Claves y formato en `docs/plan.md`, seccion "Persistencia". Recibe el
 * `Storage` por constructor (no usa `window.localStorage` directamente) para
 * poder probarla sin un DOM real y para que, si algun dia hay mas de un
 * almacen, no haga falta tocar esta clase.
 */
export class LocalStorageScenarioRepo {
  private readonly storage: Storage

  constructor(storage: Storage) {
    this.storage = storage
  }

  listScenarios(): readonly ScenarioIndexEntry[] {
    return readJson<ScenarioIndexEntry[]>(this.storage, INDEX_KEY) ?? []
  }

  /** `null` si el id no existe, el JSON esta corrupto o su version no se puede migrar. */
  loadScenario(id: string): Scenario | null {
    const raw = readJson<unknown>(this.storage, scenarioKey(id))
    if (raw === null) {
      return null
    }
    const migrated = migrateScenarioData(raw)
    return migrated.ok ? migrated.value : null
  }

  /** Guarda (crea o actualiza) un escenario y su entrada en el indice. */
  saveScenario(scenario: Scenario, name: string): void {
    writeJson(this.storage, scenarioKey(scenario.id), scenario)
    const index = this.listScenarios()
    const updatedAt = new Date().toISOString()
    const exists = index.some((entry) => entry.id === scenario.id)
    const nextIndex = exists
      ? index.map((entry) => (entry.id === scenario.id ? { ...entry, name, updatedAt } : entry))
      : [...index, { id: scenario.id, name, updatedAt }]
    writeJson(this.storage, INDEX_KEY, nextIndex)
  }

  /** Solo toca el indice: el `Scenario` guardado no cambia. */
  renameScenario(id: string, name: string): void {
    const index = this.listScenarios()
    if (!index.some((entry) => entry.id === id)) {
      return
    }
    const updatedAt = new Date().toISOString()
    writeJson(
      this.storage,
      INDEX_KEY,
      index.map((entry) => (entry.id === id ? { ...entry, name, updatedAt } : entry)),
    )
  }

  /**
   * Copia un escenario con un id nuevo (lo decide el llamante: este repo no
   * genera identificadores). Devuelve `null` si el original no existe.
   */
  duplicateScenario(id: string, newId: string, newName: string): Scenario | null {
    const source = this.loadScenario(id)
    if (!source) {
      return null
    }
    const copy: Scenario = { ...source, id: newId }
    this.saveScenario(copy, newName)
    return copy
  }

  deleteScenario(id: string): void {
    this.storage.removeItem(scenarioKey(id))
    writeJson(
      this.storage,
      INDEX_KEY,
      this.listScenarios().filter((entry) => entry.id !== id),
    )
  }

  loadSettings(): AppSettings | null {
    return readJson<AppSettings>(this.storage, SETTINGS_KEY)
  }

  saveSettings(settings: AppSettings): void {
    writeJson(this.storage, SETTINGS_KEY, settings)
  }
}
