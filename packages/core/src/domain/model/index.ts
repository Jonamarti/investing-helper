export { hasFixedTerm, isLoanActiveAt, isRevolving, payoffMonth, remainingMonths } from './loan'
export type { AmortizationSystem, Loan, LoanKind, RevolvingTerms } from './loan'

export {
  annualEmployerCost,
  annualFreeMoney,
  assertSalaryIsSane,
  baselineFreeMonthly,
  freeMonthlyInMonth,
  grossFromNet,
  hasExtraPay,
  netSalaryInMonth,
  paymentsPerYear,
  salaryGrowthFactor,
  validateExtraPayMonths,
} from './salary'
export type { Salary } from './salary'

export { overridesOutsideHorizon, resolveContribution } from './contributionPlan'
export type {
  ContributionOverride,
  ContributionPlan,
  MonthlyContribution,
} from './contributionPlan'

export {
  defaultAssumptions,
  defaultMonteCarlo,
  effectiveHorizon,
  isMonteCarloEnabled,
} from './assumptions'
export type { Assumptions, MonteCarloSettings } from './assumptions'

export { canConvert, convertMoney, identityRates, rateBetween } from './exchangeRates'
export type { ExchangeRateTable } from './exchangeRates'

export { isDebtStrategy, mixedComponentsOf, strategyTypeOf, STRATEGY_TYPES } from './strategy'
export type {
  BondsParams,
  CashParams,
  DebtPaydownParams,
  EquityParams,
  MixedComponent,
  MixedParams,
  PaydownGoal,
  PaydownOrder,
  StrategyParams,
  StrategyType,
} from './strategy'

export {
  defaultScenario,
  findLoan,
  foreignCurrencies,
  hasSupportedBaseCurrency,
  horizonOf,
  loansForStrategy,
  needsExchangeRates,
  scenarioExponent,
  SCENARIO_VERSION,
} from './scenario'
export type { Scenario } from './scenario'
