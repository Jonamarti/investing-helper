import { registerAllEngines } from '@investing-helper/core'
import { LocalStorageScenarioRepo } from './infrastructure/persistence/localStorageRepo'
import { mulberry32 } from './infrastructure/rng/mulberry32'

/**
 * Composicion manual: el unico sitio que sabe que la persistencia es
 * `localStorage` y que el motor necesita sus estrategias registradas antes de
 * simular nada. `main.tsx` importa de aqui, no de `infrastructure/**`
 * directamente.
 */
registerAllEngines()

export const scenarioRepo = new LocalStorageScenarioRepo(window.localStorage)

/** Una fuente de aleatoriedad nueva por cada corrida de Monte Carlo, con su semilla. */
export function createRandomSource(seed: number) {
  return mulberry32(seed)
}
