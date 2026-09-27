import type { CurrencyCode, Money, MonthIndex, Rate } from '../shared'
import { roundToExponent, yearMonthKey } from '../shared'

/**
 * Correccion manual de un mes concreto.
 *
 * `lumpSum` es un aporte puntual; `monthlyAmount` sustituye por completo al
 * automatico de ese mes. Un override vacio (`{}`) no cambia nada.
 */
export interface ContributionOverride {
  readonly lumpSum?: Money
  readonly monthlyAmount?: Money
}

/**
 * Como se aporta dinero a la estrategia.
 *
 * El plan automatico es `initialLumpSum` al mes 0 y despues
 * `savingsRate` del sueldo libre de cada mes. Los overrides se mezclan encima
 * mes a mes, indexados por `YYYY-MM` relativo al inicio del escenario.
 */
export interface ContributionPlan {
  readonly currency: CurrencyCode
  readonly initialLumpSum: Money
  /** Fraccion del sueldo libre que se aporta (0.3 = 30 %). */
  readonly savingsRate: Rate
  /**
   * Si es `true`, el aporte mensual sigue al sueldo libre. Si es `false`, se usa
   * `fixedMonthly` constante (util para comparar "si invierto 500 al mes").
   */
  readonly followSalary: boolean
  readonly fixedMonthly: Money
  /** Clave `YYYY-MM` -> correccion manual. */
  readonly overrides: Readonly<Record<string, ContributionOverride>>
}

/** Aporte de un mes concreto, ya mezclado automatico + override. */
export interface MonthlyContribution {
  /** Aportacion recurrente de este mes. */
  readonly recurring: Money
  /** Aportes puntuales de este mes. */
  readonly lumpSum: Money
  /** Suma de ambos, que es lo que entra en la estrategia. */
  readonly total: Money
}

/**
 * Resuelve el aporte de un mes.
 *
 * @param referenceYear anio del mes 0 del escenario (para las claves YYYY-MM).
 * @param referenceMonth mes del mes 0 del escenario, 1-12.
 */
export function resolveContribution(
  plan: ContributionPlan,
  freeMonthly: Money,
  month: MonthIndex,
  referenceYear: number,
  referenceMonth: number,
): MonthlyContribution {
  const key = yearMonthKey(referenceYear, referenceMonth, month)
  const override = plan.overrides[key]

  const recurring = plan.followSalary
    ? Math.max(0, roundToExponent(freeMonthly * plan.savingsRate, 2))
    : Math.max(0, plan.fixedMonthly)

  const recurringFinal = override?.monthlyAmount ?? recurring
  const lumpSum =
    month === 0 ? plan.initialLumpSum + (override?.lumpSum ?? 0) : (override?.lumpSum ?? 0)

  return { recurring: recurringFinal, lumpSum, total: recurringFinal + lumpSum }
}

/** Claves de override que caen fuera del horizonte, para avisar en la UI. */
export function overridesOutsideHorizon(
  plan: ContributionPlan,
  horizonMonths: number,
  referenceYear: number,
  referenceMonth: number,
): string[] {
  const first = yearMonthKey(referenceYear, referenceMonth, 0)
  const last = yearMonthKey(referenceYear, referenceMonth, horizonMonths)
  return Object.keys(plan.overrides)
    .filter((key) => key < first || key > last)
    .sort()
}
