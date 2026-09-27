import type { CurrencyCode, Money, MonthIndex, Rate } from '../shared'

/**
 * Como se amortiza el capital.
 *
 * - `french`   : cuota constante (sistema frances, el habitual en hipoteca).
 * - `constant` : amortizacion constante, cuota decreciente.
 */
export type AmortizationSystem = 'french' | 'constant'

/**
 * `installment` tiene plazo y cuota fija. `revolving` es un credito revolving:
 * solo tiene pago minimo y el saldo puede crecer.
 * `mortgage` es un caso de `installment` marcado aparte porque su interes puede
 * ser deducible y su cancelacion anticipada tiene penalizacion propia.
 */
export type LoanKind = 'installment' | 'revolving' | 'mortgage'

export interface Loan {
  readonly id: string
  readonly nameKey: string
  readonly kind: LoanKind
  readonly currency: CurrencyCode
  /** Capital prestado (o saldo revolving inicial). */
  readonly principal: Money
  /** Tasa nominal anual aplicada al saldo. */
  readonly annualRate: Rate
  /** Plazo total en meses. Se ignora en `revolving`. */
  readonly termMonths: number
  readonly system: AmortizationSystem
  /** Mes en el que empieza a pagarse. 0 = ya en vigor. */
  readonly startMonth: MonthIndex
  /**
   * Cuota mensual objetivo. Si se omite, se deriva del principal, la tasa y el
   * plazo con el sistema de amortizacion declarado.
   */
  readonly monthlyPayment?: Money
  /**
   * Penalizacion por cancelar anticipadamente, como fraccion del saldo
   * pendiente (0 = sin penalizacion). No aplica a `revolving`.
   */
  readonly earlyExitPenaltyRate: Rate
  /** Si el interes de este prestamo es deducible (relief fiscal de hipoteca). */
  readonly interestDeductible: boolean
}

export function isRevolving(loan: Loan): boolean {
  return loan.kind === 'revolving'
}

export function hasFixedTerm(loan: Loan): boolean {
  return loan.kind !== 'revolving'
}

/**
 * Pago minimo mensual de un revolving: un porcentaje del saldo, acotado por un
 * suelo. Es la convencion de los productos revolving reales, donde el minimo
 * se define como "X % del saldo outstanding".
 */
export interface RevolvingTerms {
  /** Fraccion del saldo que hay que pagar cada mes (0.01 = 1 %). */
  readonly minPaymentRate: Rate
  /** Suelo absoluto del pago minimo, para no pagar 0.01 al mes. */
  readonly minPaymentFloor: Money
}

export function isLoanActiveAt(loan: Loan, month: MonthIndex): boolean {
  return month >= loan.startMonth
}

/**
 * Un prestamo queda saldado al llegar a `startMonth + termMonths` (o antes si se
 * amortiza por adelantado). Devuelve el indice de liquidacion, o `null` si el
 * horizonte no alcanza.
 */
export function payoffMonth(loan: Loan, horizonMonths: number): MonthIndex | null {
  if (isRevolving(loan)) {
    return null
  }
  const payoff = loan.startMonth + loan.termMonths
  return payoff <= horizonMonths ? payoff : null
}

/** Saldo nominal restante tras `paidMonths` cuotas, sin interes. */
export function remainingMonths(loan: Loan, paidMonths: number): number {
  if (isRevolving(loan)) {
    return Number.POSITIVE_INFINITY
  }
  return Math.max(0, loan.termMonths - paidMonths)
}
