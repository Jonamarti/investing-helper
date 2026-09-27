import type { CurrencyCode } from '../shared'
import { DEFAULT_CURRENCY, exponentOrDefault, isSupportedCurrency } from '../shared'
import type { Assumptions } from './assumptions'
import { defaultAssumptions, defaultMonteCarlo, effectiveHorizon } from './assumptions'
import type { ContributionPlan } from './contributionPlan'
import type { ExchangeRateTable } from './exchangeRates'
import { identityRates } from './exchangeRates'
import type { Loan } from './loan'
import type { Salary } from './salary'
import type { StrategyParams } from './strategy'
import type { TaxRules } from '../taxes'
import { zeroTax } from '../taxes'

/**
 * Version del formato persistido (localStorage, JSON, URL compartida).
 *
 * Sube cuando cambie la forma de `Scenario`. `application/usecases/
 * migrateScenario.ts` encadena las migraciones conocidas; si la version es
 * mayor que la que el codigo entiende, se rechaza el estado en vez de
 * adivinar.
 */
export const SCENARIO_VERSION = 1

/**
 * Agregado raiz. Todo lo que el motor necesita para simular, y nada mas.
 *
 * Es un valor plano y serializable: se puede escribir tal cual en
 * `localStorage`, en un `.json` o en la URL compartida.
 */
export interface Scenario {
  readonly scenarioVersion: number
  readonly id: string
  /** Clave de i18n del nombre; el usuario puede renombrar con un override. */
  readonly nameKey: string
  /** Anio y mes (1-12) del mes 0 del escenario. Ancla las claves YYYY-MM. */
  readonly startYear: number
  readonly startMonth: number
  readonly baseCurrency: CurrencyCode
  readonly assumptions: Assumptions
  readonly salary: Salary
  readonly contributionPlan: ContributionPlan
  readonly loans: readonly Loan[]
  readonly strategies: readonly StrategyParams[]
  readonly exchangeRates: ExchangeRateTable
  readonly taxRules: TaxRules
}

/** Decimales de la divisa base del escenario. */
export function scenarioExponent(scenario: Scenario): number {
  return exponentOrDefault(scenario.baseCurrency, 2)
}

/** Horizonte de simulacion en meses. */
export function horizonOf(scenario: Scenario): number {
  return effectiveHorizon(scenario.assumptions)
}

/** Divisas que aparecen en el escenario ademas de la base. */
export function foreignCurrencies(scenario: Scenario): CurrencyCode[] {
  const codes = new Set<CurrencyCode>()
  if (scenario.contributionPlan.currency !== scenario.baseCurrency) {
    codes.add(scenario.contributionPlan.currency)
  }
  for (const loan of scenario.loans) {
    if (loan.currency !== scenario.baseCurrency) {
      codes.add(loan.currency)
    }
  }
  return [...codes]
}

/** `true` si el escenario necesita tipos de cambio que la tabla no cubre. */
export function needsExchangeRates(scenario: Scenario): boolean {
  return foreignCurrencies(scenario).length > 0
}

/** Prestamos referenciados por alguna estrategia, ya resueltos. */
export function loansForStrategy(scenario: Scenario, loanIds: readonly string[]): Loan[] {
  return loanIds
    .map((id) => scenario.loans.find((loan) => loan.id === id))
    .filter((loan): loan is Loan => loan !== undefined)
}

/** Busca un prestamo por id. */
export function findLoan(scenario: Scenario, id: string): Loan | undefined {
  return scenario.loans.find((loan) => loan.id === id)
}

/**
 * Escenario por defecto de una app recien abierta: tres estrategias
 * comparables con datos redondos, para que el usuario vea una diferencia antes
 * de tocar nada.
 */
export function defaultScenario(): Scenario {
  return {
    scenarioVersion: SCENARIO_VERSION,
    id: 'default',
    nameKey: 'scenario.default.name',
    startYear: new Date().getFullYear(),
    startMonth: new Date().getMonth() + 1,
    baseCurrency: DEFAULT_CURRENCY,
    assumptions: { ...defaultAssumptions(), monteCarlo: null },
    salary: {
      netMonthly: 2500,
      fixedCostsMonthly: 1200,
      extraPayMonths: [7, 12],
      growthAnnual: 0.02,
      employeeContributionRate: 0,
    },
    contributionPlan: {
      currency: DEFAULT_CURRENCY,
      initialLumpSum: 5000,
      savingsRate: 0.3,
      followSalary: true,
      fixedMonthly: 400,
      overrides: {},
    },
    loans: [
      {
        id: 'loan-mortgage',
        nameKey: 'loan.default.mortgage',
        kind: 'mortgage',
        currency: DEFAULT_CURRENCY,
        principal: 200_000,
        annualRate: 0.041,
        termMonths: 300,
        system: 'french',
        startMonth: 0,
        earlyExitPenaltyRate: 0,
        interestDeductible: true,
      },
    ],
    strategies: [
      {
        type: 'cash',
        annualRate: 0.01,
      },
      {
        type: 'bonds',
        couponRate: 0.03,
        faceValue: 1000,
        purchasePrice: 1000,
        maturityPrice: 1000,
        maturityMonths: 60,
      },
      {
        type: 'equity',
        expectedReturn: 0.07,
        gainTaxMode: 'onExit',
      },
    ],
    exchangeRates: identityRates(DEFAULT_CURRENCY),
    taxRules: zeroTax(),
  }
}

/** `true` si la divisa base es de las soportadas. */
export function hasSupportedBaseCurrency(scenario: Scenario): boolean {
  return isSupportedCurrency(scenario.baseCurrency)
}

/** Monte Carlo por defecto, para el boton "activar" de la pestana Monte Carlo. */
export { defaultMonteCarlo }
