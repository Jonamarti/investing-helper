import { registerEngines } from '../engine'
import { bondsEngine } from './bonds'
import { cashEngine } from './cash'
import { debtPaydownEngine } from './debtPaydown'
import { equityEngine } from './equity'
import { mixedEngine } from './mixed'

export { bondsEngine, bondPriceAt, monthlyCouponOf } from './bonds'
export { cashEngine } from './cash'
export { closedLoanIds, debtPaydownEngine, loansAboveHurdle, orderLoans } from './debtPaydown'
export { equityEngine } from './equity'
export { mixedEngine } from './mixed'

/** Los cinco motores del dominio, en el orden en que los ofrece la UI. */
export const ENGINES = [
  cashEngine,
  bondsEngine,
  equityEngine,
  mixedEngine,
  debtPaydownEngine,
] as const

/**
 * Registra los motores en el motor de simulacion.
 *
 * Se llama desde el punto de entrada del paquete, no al importar el modulo:
 * un `import` con efectos secundarios haria que un simple test de una
 * estrategia registrase las otras cuatro.
 */
export function registerAllEngines(): void {
  registerEngines(ENGINES)
}
