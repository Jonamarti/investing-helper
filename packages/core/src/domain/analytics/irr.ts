import { err, monthlyToEffectiveAnnual, ok, type Rate, type Result } from '../shared'

/**
 * Por que la TIR puede no existir o no converger:
 *
 * - `noSignChange`: los flujos son todos del mismo signo (o cero). Sin una
 *   salida y una entrada no hay tasa que iguale el VAN a cero.
 * - `noConvergence`: hay cambio de signo, pero ni Newton-Raphson ni la
 *   biseccion de respaldo encuentran una raiz en el rango explorado.
 */
export type IrrError = 'noSignChange' | 'noConvergence'

const TOLERANCE = 1e-9
const MAX_NEWTON_ITERATIONS = 50
const MAX_BISECTION_ITERATIONS = 200
const MAX_BRACKET_EXPANSIONS = 60
const NEWTON_SEED = 0.01

function netPresentValue(monthlyRate: Rate, flows: readonly number[]): number {
  let total = 0
  for (let month = 0; month < flows.length; month += 1) {
    total += flows[month]! / (1 + monthlyRate) ** month
  }
  return total
}

function netPresentValueDerivative(monthlyRate: Rate, flows: readonly number[]): number {
  let total = 0
  for (let month = 1; month < flows.length; month += 1) {
    total += (-month * flows[month]!) / (1 + monthlyRate) ** (month + 1)
  }
  return total
}

function hasSignChange(flows: readonly number[]): boolean {
  return flows.some((flow) => flow > 0) && flows.some((flow) => flow < 0)
}

/** Newton-Raphson desde una semilla razonable. `null` si diverge o no converge. */
function solveByNewton(flows: readonly number[]): Rate | null {
  let rate = NEWTON_SEED
  for (let iteration = 0; iteration < MAX_NEWTON_ITERATIONS; iteration += 1) {
    const value = netPresentValue(rate, flows)
    if (Math.abs(value) < TOLERANCE) {
      return rate
    }
    const derivative = netPresentValueDerivative(rate, flows)
    if (derivative === 0) {
      return null
    }
    const next = rate - value / derivative
    if (!Number.isFinite(next) || next <= -1) {
      return null
    }
    rate = next
  }
  return null
}

/** Biseccion de respaldo: busca un intervalo donde el VAN cambie de signo y lo acota. */
function solveByBisection(flows: readonly number[]): Rate | null {
  let low = -0.999999
  let high = 1
  let valueAtLow = netPresentValue(low, flows)
  let valueAtHigh = netPresentValue(high, flows)

  let expansions = 0
  while (valueAtLow * valueAtHigh > 0 && expansions < MAX_BRACKET_EXPANSIONS) {
    high *= 2
    valueAtHigh = netPresentValue(high, flows)
    expansions += 1
  }
  if (valueAtLow * valueAtHigh > 0) {
    return null
  }

  for (let iteration = 0; iteration < MAX_BISECTION_ITERATIONS; iteration += 1) {
    const mid = (low + high) / 2
    const valueAtMid = netPresentValue(mid, flows)
    if (Math.abs(valueAtMid) < TOLERANCE || (high - low) / 2 < 1e-12) {
      return mid
    }
    if (valueAtLow * valueAtMid < 0) {
      high = mid
    } else {
      low = mid
      valueAtLow = valueAtMid
    }
  }
  return (low + high) / 2
}

/**
 * TIR money-weighted de una serie de flujos mensuales, anualizada.
 *
 * `flows[0]` es el flujo del mes 0. El uso previsto: `-aportacion` cada mes y
 * `+valor final` sumado al ultimo mes (ver `metrics.ts`).
 */
export function irrMonthly(flows: readonly number[]): Result<Rate, IrrError> {
  if (!hasSignChange(flows)) {
    return err('noSignChange')
  }

  const monthlyRate = solveByNewton(flows) ?? solveByBisection(flows)
  if (monthlyRate === null || monthlyRate <= -1) {
    return err('noConvergence')
  }

  return ok(monthlyToEffectiveAnnual(monthlyRate))
}
