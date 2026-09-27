export { annuityPayment, firstMonthInterest, firstPayment, monthsToPayoff } from './french'

export {
  constantPrincipal,
  equivalentInitialPayment,
  interestAt,
  outstandingPrincipal,
  paymentAt,
} from './constant'

export {
  buildSchedule,
  interestPaidSoFar,
  interestRemaining,
  outstandingBalance,
  outstandingMonths,
  paymentFor,
  paymentForBalance,
} from './schedule'
export type { AmortizationRow, AmortizationSchedule } from './schedule'

export { earlyExitCost, isInPenaltyWindow } from './earlyExit'
export type { EarlyExitCost } from './earlyExit'
