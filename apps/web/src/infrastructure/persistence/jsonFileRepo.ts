import type { Scenario } from '@investing-helper/core/domain/model'
import { err, type Result } from '@investing-helper/core/domain/shared'
import { migrateScenarioData, type MigrationError } from './migrations'

export type ImportError =
  { readonly kind: 'invalidJson' } | { readonly kind: 'migration'; readonly error: MigrationError }

/** Serializa un escenario para exportarlo a un `.json` descargable. */
export function exportScenarioToJson(scenario: Scenario): string {
  return JSON.stringify(scenario, null, 2)
}

/**
 * Importa un escenario desde el contenido de un `.json`.
 *
 * Pasa por las mismas migraciones que la carga desde `localStorage`
 * (`migrateScenarioData`): un export de una version antigua se actualiza igual
 * que un escenario guardado hace tiempo.
 */
export function importScenarioFromJson(json: string): Result<Scenario, ImportError> {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    return err({ kind: 'invalidJson' })
  }

  const migrated = migrateScenarioData(parsed)
  if (!migrated.ok) {
    return err({ kind: 'migration', error: migrated.error })
  }
  return migrated
}
