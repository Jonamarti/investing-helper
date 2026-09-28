import { SCENARIO_VERSION, type Scenario } from '@investing-helper/core/domain/model'
import { err, ok, type Result } from '@investing-helper/core/domain/shared'

type ScenarioData = Record<string, unknown>
type Migration = (data: ScenarioData) => ScenarioData

/**
 * Migraciones conocidas, indexadas por la version de origen: `MIGRATIONS[v]`
 * lleva un escenario de la version `v` a la `v + 1`. Hoy esta vacio:
 * `SCENARIO_VERSION` es 1 y este es el primer formato que se ha persistido.
 * Cuando `Scenario` cambie de forma, la migracion nueva se anade aqui, no se
 * reescribe el modelo para aceptar los dos formatos a la vez.
 */
const MIGRATIONS: Readonly<Record<number, Migration>> = {}

export type MigrationError =
  | { readonly kind: 'invalidShape' }
  | { readonly kind: 'unknownVersion'; readonly version: number }
  | { readonly kind: 'missingMigration'; readonly fromVersion: number }

/**
 * Encadena las migraciones conocidas hasta `SCENARIO_VERSION`.
 *
 * Si la version de los datos es mayor que la que el codigo entiende, se
 * rechaza en vez de adivinar el formato: es preferible un error explicito a
 * silenciosamente perder o corromper datos de una version futura.
 */
export function migrateScenarioData(data: unknown): Result<Scenario, MigrationError> {
  if (typeof data !== 'object' || data === null) {
    return err({ kind: 'invalidShape' })
  }

  let working = data as ScenarioData
  let version = typeof working.scenarioVersion === 'number' ? working.scenarioVersion : 0

  if (version > SCENARIO_VERSION) {
    return err({ kind: 'unknownVersion', version })
  }

  while (version < SCENARIO_VERSION) {
    const migrate = MIGRATIONS[version]
    if (!migrate) {
      return err({ kind: 'missingMigration', fromVersion: version })
    }
    working = migrate(working)
    version += 1
  }

  return ok({ ...working, scenarioVersion: SCENARIO_VERSION } as unknown as Scenario)
}
