import { create } from 'zustand'
import { compareStrategies, type ComparisonResultDto } from '@investing-helper/core/application'
import { defaultScenario, type Scenario } from '@investing-helper/core/domain/model'

interface ScenarioStore {
  readonly scenario: Scenario
  readonly comparison: ComparisonResultDto
  setScenario: (scenario: Scenario) => void
}

/**
 * Store de zustand con el escenario activo y su comparacion ya calculada.
 *
 * La comparacion se recalcula en el hilo principal cada vez que cambia el
 * escenario: para el tamano de escenario actual es instantaneo, y el worker
 * (paso 16 del plan) es una optimizacion, no una necesidad todavia. Cargar y
 * guardar en `localStorage` es cosa de la pestana de Escenarios, que consume
 * este store; todavia no existe (ver docs/plan.md, §5).
 */
export const useScenarioStore = create<ScenarioStore>((set) => {
  const initialScenario = defaultScenario()
  return {
    scenario: initialScenario,
    comparison: compareStrategies(initialScenario),
    setScenario: (scenario) => set({ scenario, comparison: compareStrategies(scenario) }),
  }
})
