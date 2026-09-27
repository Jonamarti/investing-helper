import type { Rate } from '../shared'

/** Ajustes de la simulacion Monte Carlo. */
export interface MonteCarloSettings {
  /** Numero de trayectorias. 1000 es un buen compromiso velocidad/utilidad. */
  readonly paths: number
  /**
   * Semilla del generador. Va en la URL compartida: con la misma semilla y los
   * mismos parametros, el resultado es identico.
   */
  readonly seed: number
  /** Volatilidad anualizada del underlying de renta variable. */
  readonly equityVolatilityAnnual: Rate
  /**
   * Correlacion con el resto de activos. 0 = independiente. El modelo actual es
   * un unico factor, asi que solo aplica a renta variable.
   */
  readonly correlationWithCash: Rate
}

/** Supuestos globales del escenario. */
export interface Assumptions {
  /** Inflacion anual, usada para el poder de compra. */
  readonly inflationAnnual: Rate
  /** Horizonte de la simulacion en meses. */
  readonly horizonMonths: number
  /** `null` = solo una simulacion determinista. */
  readonly monteCarlo: MonteCarloSettings | null
}

export function isMonteCarloEnabled(assumptions: Assumptions): boolean {
  return assumptions.monteCarlo !== null
}

/** Numero de meses de la simulacion, con un suelo de 1. */
export function effectiveHorizon(assumptions: Assumptions): number {
  return Math.max(1, Math.floor(assumptions.horizonMonths))
}

/** Ajustes por defecto de una app recien abierta. */
export function defaultMonteCarlo(): MonteCarloSettings {
  return {
    paths: 1000,
    seed: 20260101,
    equityVolatilityAnnual: 0.18,
    correlationWithCash: 0,
  }
}

/** Supuestos por defecto: 2.5 % de inflacion, 20 anos, sin Monte Carlo. */
export function defaultAssumptions(): Assumptions {
  return {
    inflationAnnual: 0.025,
    horizonMonths: 240,
    monteCarlo: null,
  }
}
