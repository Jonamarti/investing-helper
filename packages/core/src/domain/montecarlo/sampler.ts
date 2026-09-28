import { assertFiniteNumber, PERIODS_PER_YEAR, type Rate } from '../shared'

/**
 * `domain/montecarlo` es puro a proposito: no genera numeros aleatorios, los
 * consume. Quien inyecta el generador (`nextUniform`) decide si es
 * reproducible (una semilla, en la app) o no (tests que no necesitan
 * reproducibilidad). Ver `docs/arquitectura.md`.
 */
export type UniformSource = () => number

/**
 * Normal estandar via Box-Muller, a partir de dos uniformes en `(0, 1]`.
 *
 * `u1` se acota lejos de 0 para que `Math.log` no de `-Infinity`: con un buen
 * generador la probabilidad de un 0 exacto es nula, pero el codigo no debe
 * depender de esa suerte.
 */
export function standardNormal(u1: number, u2: number): number {
  assertFiniteNumber(u1, 'u1')
  assertFiniteNumber(u2, 'u2')
  const safeU1 = Math.max(u1, Number.EPSILON)
  return Math.sqrt(-2 * Math.log(safeU1)) * Math.cos(2 * Math.PI * u2)
}

/**
 * Rentabilidad mensual de un paso de un movimiento geometrico browniano (GBM)
 * lognormal: `exp((mu - sigma^2/2)/12 + sigma/sqrt(12) * Z) - 1`.
 *
 * `mu` y `sigma` son anuales; `z` es una normal estandar. Con `sigma = 0` esto
 * es exactamente la rentabilidad mensual equivalente de `mu` (compuesta), sin
 * ruido: el modelo determinista es el caso particular sin volatilidad.
 */
export function gbmMonthlyReturn(
  expectedReturnAnnual: Rate,
  volatilityAnnual: Rate,
  z: number,
): Rate {
  assertFiniteNumber(expectedReturnAnnual, 'expectedReturnAnnual')
  assertFiniteNumber(volatilityAnnual, 'volatilityAnnual')
  assertFiniteNumber(z, 'z')
  const drift = (expectedReturnAnnual - volatilityAnnual ** 2 / 2) / PERIODS_PER_YEAR
  const monthlyVolatility = volatilityAnnual / Math.sqrt(PERIODS_PER_YEAR)
  return Math.exp(drift + monthlyVolatility * z) - 1
}

/**
 * Una trayectoria de `months` rentabilidades mensuales GBM, consumiendo dos
 * uniformes de `nextUniform` por mes (Box-Muller).
 */
export function sampleGbmPath(
  months: number,
  expectedReturnAnnual: Rate,
  volatilityAnnual: Rate,
  nextUniform: UniformSource,
): Rate[] {
  const path: Rate[] = []
  for (let month = 0; month < months; month += 1) {
    const z = standardNormal(nextUniform(), nextUniform())
    path.push(gbmMonthlyReturn(expectedReturnAnnual, volatilityAnnual, z))
  }
  return path
}
