import { assertNonNegative, monthOfYear } from '../shared'
import type { Money, MonthIndex, Rate } from '../shared'

/**
 * Nomina y gastos fijos.
 *
 * El modelo es **mensualizado**: la aportacion se deriva del sueldo libre
 * (`neto - fijos`), y las pagas extra se modelan como meses en los que entra el
 * doble. Es una simplificacion deliberada, anotada en `docs/arquitectura.md`.
 */
export interface Salary {
  readonly netMonthly: Money
  readonly fixedCostsMonthly: Money
  /**
   * Meses (1-12) en los que hay paga extra. `[7, 12]` modela 14 pagas: julio y
   * diciembre entran con el doble de neto.
   */
  readonly extraPayMonths: readonly number[]
  /** Crecimiento nominal anual, aplicado cada 12 meses. */
  readonly growthAnnual: Rate
  /** Parte de cotizaciones que el trabajador paga sobre el bruto. */
  readonly employeeContributionRate: Rate
}

/** Factor de crecimiento acumulado hasta el mes `month`. */
export function salaryGrowthFactor(salary: Salary, month: MonthIndex): number {
  const years = Math.floor(month / 12)
  return (1 + salary.growthAnnual) ** years
}

/** `true` si ese mes recibe doble paga. */
export function hasExtraPay(salary: Salary, month: MonthIndex): boolean {
  return salary.extraPayMonths.includes(monthOfYear(month) + 1)
}

/** Neto de ese mes, ya ajustado por crecimiento y por pagas extra. */
export function netSalaryInMonth(salary: Salary, month: MonthIndex): Money {
  const base = salary.netMonthly * salaryGrowthFactor(salary, month)
  return hasExtraPay(salary, month) ? base * 2 : base
}

/**
 * Dinero que queda tras los gastos fijos en ese mes concreto. Puede ser
 * negativo si los fijos superan el neto: entonces el plan de aportaciones no
 * puede aportar nada.
 */
export function freeMonthlyInMonth(salary: Salary, month: MonthIndex): Money {
  return netSalaryInMonth(salary, month) - salary.fixedCostsMonthly
}

/** Sueldo libre de un mes cualquiera, sin paga extra, ya ajustado por crecimiento. */
export function baselineFreeMonthly(salary: Salary, month: MonthIndex): Money {
  return salary.netMonthly * salaryGrowthFactor(salary, month) - salary.fixedCostsMonthly
}

/** Numero de pagas al ano que produce la configuracion de `extraPayMonths`. */
export function paymentsPerYear(salary: Salary): number {
  return 12 + salary.extraPayMonths.length
}

/** Bruto mensual equivalente, dado el neto y la cotizacion del trabajador. */
export function grossFromNet(salary: Salary): Money {
  const retained = 1 - salary.employeeContributionRate
  if (retained <= 0) {
    throw new RangeError(
      `employeeContributionRate debe ser < 1, recibido: ${salary.employeeContributionRate}`,
    )
  }
  return salary.netMonthly / retained
}

/** Coste anual para la empresa: bruto x numero de pagas. */
export function annualEmployerCost(salary: Salary): Money {
  return grossFromNet(salary) * paymentsPerYear(salary)
}

/** Sueldo libre **anual** del ano `year`, con el crecimiento ya aplicado. */
export function annualFreeMoney(salary: Salary, year: number): Money {
  const growth = salaryGrowthFactor(salary, year * 12)
  const annualNet = salary.netMonthly * growth * paymentsPerYear(salary)
  return annualNet - salary.fixedCostsMonthly * 12
}

/** Valida que los meses de paga extra sean 1-12 y no esten repetidos. */
export function validateExtraPayMonths(months: readonly number[]): string[] {
  const issues: string[] = []
  const seen = new Set<number>()
  for (const month of months) {
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      issues.push(`salary.extraPayMonths: ${month} no es un mes valido (1-12)`)
    }
    if (seen.has(month)) {
      issues.push(`salary.extraPayMonths: el mes ${month} esta repetido`)
    }
    seen.add(month)
  }
  return issues
}

/** Invariantes internas del modelo de nomina. */
export function assertSalaryIsSane(salary: Salary): void {
  assertNonNegative(salary.netMonthly, 'salary.netMonthly')
  assertNonNegative(salary.fixedCostsMonthly, 'salary.fixedCostsMonthly')
}
