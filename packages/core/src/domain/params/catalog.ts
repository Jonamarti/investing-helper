import type { MixedComponent, StrategyParams, StrategyType } from '../model'
import {
  MIXED_COMPONENT_SPECS,
  MIXED_KINDS,
  PARAM_SPECS,
  type MixedKind,
  type ParamSpec,
  type ParamValue,
} from './spec'

export { MIXED_COMPONENT_SPECS, MIXED_KINDS, PARAM_SPECS } from './spec'
export type { MixedKind, ParamSpec, ParamValue } from './spec'

/**
 * Parametros declarativos de una estrategia.
 *
 * La UI recorre esto y no sabe que existe `cash` o `equity`: por eso el catalogo
 * es la unica fuente de verdad sobre que campos hay y con que limites.
 */
export function paramSpecsFor(type: StrategyType): readonly ParamSpec[] {
  return PARAM_SPECS[type]
}

/** Parametros declarativos de un componente de cartera mixta. */
export function mixedComponentSpecsFor(kind: MixedKind): readonly ParamSpec[] {
  return MIXED_COMPONENT_SPECS[kind]
}

/** Todos los specs, aplanados y con su ruta completa, para busquedas e i18n. */
export function allParamSpecs(): readonly (ParamSpec & { readonly path: string })[] {
  const out: (ParamSpec & { readonly path: string })[] = []

  for (const [type, specs] of Object.entries(PARAM_SPECS)) {
    for (const spec of specs) {
      out.push({ ...spec, path: `${type}.${spec.key}` })
    }
  }
  for (const kind of MIXED_KINDS) {
    for (const spec of MIXED_COMPONENT_SPECS[kind]) {
      out.push({ ...spec, path: `mixed.${kind}.${spec.key}` })
    }
  }
  return out
}

function defaultOf(specs: readonly ParamSpec[]): Record<string, ParamValue> {
  const values: Record<string, ParamValue> = {}
  for (const spec of specs) {
    values[spec.key] = spec.default
  }
  return values
}

function defaultComponent(kind: MixedKind, weight: number): MixedComponent {
  const values = defaultOf(MIXED_COMPONENT_SPECS[kind])
  switch (kind) {
    case 'cash':
      return { kind, weight, params: { annualRate: Number(values.annualRate) } }
    case 'bonds':
      return {
        kind,
        weight,
        params: {
          couponRate: Number(values.couponRate),
          faceValue: Number(values.faceValue),
          purchasePrice: Number(values.purchasePrice),
          maturityPrice: Number(values.maturityPrice),
          maturityMonths: Number(values.maturityMonths),
        },
      }
    case 'equity':
      return {
        kind,
        weight,
        params: { expectedReturn: Number(values.expectedReturn), gainTaxMode: 'onExit' },
      }
  }
}

/** Reparto por defecto de una cartera mixta: 20 % efectivo, 40 % bonos, 40 % bolsa. */
export function defaultMixedComponents(): readonly MixedComponent[] {
  return [
    defaultComponent('cash', 0.2),
    defaultComponent('bonds', 0.4),
    defaultComponent('equity', 0.4),
  ]
}

/**
 * `StrategyParams` inicial de un tipo, derivado de los valores por defecto del
 * catalogo. La UI llama a esto al añadir una estrategia nueva.
 */
export function defaultParamsFor(type: StrategyType): StrategyParams {
  const values = defaultOf(PARAM_SPECS[type])

  switch (type) {
    case 'cash':
      return { type, annualRate: Number(values.annualRate) }
    case 'bonds':
      return {
        type,
        couponRate: Number(values.couponRate),
        faceValue: Number(values.faceValue),
        purchasePrice: Number(values.purchasePrice),
        maturityPrice: Number(values.maturityPrice),
        maturityMonths: Number(values.maturityMonths),
      }
    case 'equity':
      return {
        type,
        expectedReturn: Number(values.expectedReturn),
        gainTaxMode: 'onExit',
      }
    case 'mixed':
      return {
        type,
        components: defaultMixedComponents(),
        rebalanceEveryMonths: Number(values.rebalanceEveryMonths),
      }
    case 'debtPaydown':
      return {
        type,
        loanIds: [],
        order: 'avalanche',
        goal: 'shortenTerm',
        hurdleRate: Number(values.hurdleRate),
      }
  }
}
