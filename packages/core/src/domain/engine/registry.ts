import type { StrategyType } from '../model'
import type { StrategyEngine } from './contracts'

/**
 * Motores registrados por tipo de estrategia.
 *
 * El registro se puebla con `registerEngines` desde `domain/strategies/index.ts`.
 * Vive aparte de los motores para que un motor no importe al registro (y el
 * registro no importe a un motor): la dependencia va en un solo sentido y
 * `resolveEngine` es el unico punto de acoplamiento.
 */
const engines = new Map<StrategyType, StrategyEngine>()

/** Registra un motor. Sustituye el anterior si el tipo ya estaba. */
export function registerEngine(engine: StrategyEngine): void {
  engines.set(engine.type, engine)
}

export function registerEngines(list: readonly StrategyEngine[]): void {
  for (const engine of list) {
    registerEngine(engine)
  }
}

/**
 * Motor de un tipo de estrategia.
 *
 * @throws si el tipo no tiene motor: es un fallo de wiring, no de datos, y debe
 * saltar en desarrollo en vez de degradar en silencio.
 */
export function resolveEngine(type: StrategyType): StrategyEngine {
  const engine = engines.get(type)
  if (!engine) {
    throw new Error(
      `No hay motor registrado para la estrategia "${type}". Registrado: ${[...engines.keys()].join(', ') || '(ninguno)'}`,
    )
  }
  return engine
}

export function hasEngine(type: StrategyType): boolean {
  return engines.has(type)
}

export function registeredTypes(): StrategyType[] {
  return [...engines.keys()]
}

/** Vacia el registro. Solo para tests. */
export function clearEngines(): void {
  engines.clear()
}
