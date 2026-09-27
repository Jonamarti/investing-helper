import type { StrategyType } from '../model'

/** Como se pinta el campo en la UI. */
export type FieldKind = 'money' | 'percent' | 'number' | 'select' | 'boolean' | 'month' | 'currency'

export type ParamValue = number | string | boolean

export interface ParamOption {
  readonly value: string
  readonly labelKey: string
}

/**
 * Descripcion **declarativa** de un parametro de estrategia.
 *
 * La UI no conoce ninguna estrategia: recorre el `ParamSpec` y elige el
 * componente segun `kind`. Anadir un campo a una estrategia es anadir una
 * entrada aqui, no tocar JSX.
 */
export interface ParamSpec {
  readonly key: string
  readonly kind: FieldKind
  /** Clave i18n de la etiqueta. */
  readonly labelKey: string
  /** Clave i18n de la ayuda contextual. */
  readonly helpKey?: string
  /** Clave i18n del grupo (seccion del formulario). */
  readonly groupKey?: string
  readonly default: ParamValue
  readonly min?: number
  readonly max?: number
  readonly step?: number
  readonly options?: readonly ParamOption[]
  /** Oculta el campo segun el estado de los demas parametros. */
  readonly visibleWhen?: (params: Readonly<Record<string, ParamValue>>) => boolean
}

/** Un `ParamSpec` con sus campos obligatorios, para no repetirlos. */
type Spec = ParamSpec

const RATE_STEP = 0.0001

/**
 * Nota sobre impuestos: **ninguna** estrategia declara tipos aqui. Las
 * retenciones viven todas en `Scenario.taxRules`, una sola vez, para que
 * comparar dos estrategias no dependa de cual se aplicaba. Lo que si es
 * decision de la estrategia —el momento de tributar la plusvalia— si aparece.
 */

export const CASH_SPECS: readonly Spec[] = [
  {
    key: 'annualRate',
    kind: 'percent',
    labelKey: 'params.cash.annualRate.label',
    helpKey: 'params.cash.annualRate.help',
    default: 0.01,
    min: -0.1,
    max: 0.2,
    step: RATE_STEP,
  },
]

export const BONDS_SPECS: readonly Spec[] = [
  {
    key: 'couponRate',
    kind: 'percent',
    labelKey: 'params.bonds.couponRate.label',
    helpKey: 'params.bonds.couponRate.help',
    default: 0.03,
    min: 0,
    max: 0.2,
    step: RATE_STEP,
  },
  {
    key: 'faceValue',
    kind: 'money',
    labelKey: 'params.bonds.faceValue.label',
    default: 1000,
    min: 0,
    step: 100,
  },
  {
    key: 'purchasePrice',
    kind: 'money',
    labelKey: 'params.bonds.purchasePrice.label',
    helpKey: 'params.bonds.purchasePrice.help',
    default: 1000,
    min: 0,
    step: 1,
  },
  {
    key: 'maturityPrice',
    kind: 'money',
    labelKey: 'params.bonds.maturityPrice.label',
    default: 1000,
    min: 0,
    step: 1,
  },
  {
    key: 'maturityMonths',
    kind: 'number',
    labelKey: 'params.bonds.maturityMonths.label',
    default: 60,
    min: 1,
    max: 600,
    step: 1,
  },
]

export const EQUITY_SPECS: readonly Spec[] = [
  {
    key: 'expectedReturn',
    kind: 'percent',
    labelKey: 'params.equity.expectedReturn.label',
    helpKey: 'params.equity.expectedReturn.help',
    default: 0.07,
    min: -0.5,
    max: 0.5,
    step: RATE_STEP,
  },
  {
    key: 'gainTaxMode',
    kind: 'select',
    labelKey: 'params.equity.gainTaxMode.label',
    helpKey: 'params.equity.gainTaxMode.help',
    default: 'onExit',
    options: [
      { value: 'onExit', labelKey: 'params.equity.gainTaxMode.option.onExit' },
      { value: 'annual', labelKey: 'params.equity.gainTaxMode.option.annual' },
    ],
  },
]

export const DEBT_SPECS: readonly Spec[] = [
  {
    key: 'order',
    kind: 'select',
    labelKey: 'params.debt.order.label',
    helpKey: 'params.debt.order.help',
    default: 'avalanche',
    options: [
      { value: 'avalanche', labelKey: 'params.debt.order.option.avalanche' },
      { value: 'snowball', labelKey: 'params.debt.order.option.snowball' },
    ],
  },
  {
    key: 'goal',
    kind: 'select',
    labelKey: 'params.debt.goal.label',
    helpKey: 'params.debt.goal.help',
    default: 'shortenTerm',
    options: [
      { value: 'shortenTerm', labelKey: 'params.debt.goal.option.shortenTerm' },
      { value: 'reducePayment', labelKey: 'params.debt.goal.option.reducePayment' },
    ],
  },
  {
    key: 'hurdleRate',
    kind: 'percent',
    labelKey: 'params.debt.hurdleRate.label',
    helpKey: 'params.debt.hurdleRate.help',
    default: 0,
    min: -0.1,
    max: 0.3,
    step: RATE_STEP,
  },
]

/** Sub-tipos que admite una cartera mixta. */
export const MIXED_KINDS = ['cash', 'bonds', 'equity'] as const
export type MixedKind = (typeof MIXED_KINDS)[number]

export const MIXED_SPECS: readonly Spec[] = [
  {
    key: 'rebalanceEveryMonths',
    kind: 'number',
    labelKey: 'params.mixed.rebalanceEveryMonths.label',
    helpKey: 'params.mixed.rebalanceEveryMonths.help',
    default: 12,
    min: 1,
    max: 120,
    step: 1,
  },
]

/** Parametros de cada tipo de estrategia, indexados por `StrategyType`. */
export const PARAM_SPECS: Readonly<Record<StrategyType, readonly ParamSpec[]>> = {
  cash: CASH_SPECS,
  bonds: BONDS_SPECS,
  equity: EQUITY_SPECS,
  mixed: MIXED_SPECS,
  debtPaydown: DEBT_SPECS,
}

/** Parametros aplicables a un componente de cartera mixta. */
export const MIXED_COMPONENT_SPECS: Readonly<Record<MixedKind, readonly ParamSpec[]>> = {
  cash: CASH_SPECS,
  bonds: BONDS_SPECS,
  equity: EQUITY_SPECS,
}
