import type { StrategyParams } from '../model'
import { mixedComponentSpecsFor, paramSpecsFor } from './catalog'
import type { MixedKind, ParamSpec } from './spec'

/**
 * Un problema de validacion, con la ruta del campo afectada para que la UI
 * pueda resaltar el input exacto.
 */
export interface ParamIssue {
  /** Ruta estable, p. ej. `equity.expectedReturn` o `mixed.equity.couponRate`. */
  readonly path: string
  /** Clave i18n del mensaje. */
  readonly messageKey: string
  /** Valores para interpolar en el mensaje. */
  readonly params?: Readonly<Record<string, string | number>>
}

const TOLERANCE = 1e-9

function checkSpec(spec: ParamSpec, value: unknown, path: string, out: ParamIssue[]): void {
  if (typeof spec.default === 'number') {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      out.push({ path, messageKey: 'validation.expectedNumber' })
      return
    }
    if (spec.min !== undefined && value < spec.min - TOLERANCE) {
      out.push({ path, messageKey: 'validation.min', params: { min: spec.min } })
    }
    if (spec.max !== undefined && value > spec.max + TOLERANCE) {
      out.push({ path, messageKey: 'validation.max', params: { max: spec.max } })
    }
    return
  }

  if (typeof spec.default === 'boolean') {
    if (typeof value !== 'boolean') {
      out.push({ path, messageKey: 'validation.expectedBoolean' })
    }
    return
  }

  if (typeof value !== 'string' || value.length === 0) {
    out.push({ path, messageKey: 'validation.expectedOption' })
    return
  }
  if (spec.options && !spec.options.some((option) => option.value === value)) {
    out.push({ path, messageKey: 'validation.unknownOption' })
  }
}

function checkSpecs(
  specs: readonly ParamSpec[],
  values: Readonly<Record<string, unknown>>,
  prefix: string,
  out: ParamIssue[],
): void {
  for (const spec of specs) {
    const path = prefix ? `${prefix}.${spec.key}` : spec.key
    const value = values[spec.key]
    if (value === undefined) {
      out.push({ path, messageKey: 'validation.required' })
      continue
    }
    checkSpec(spec, value, path, out)
  }
}

function checkMixedComponent(
  component: Readonly<Record<string, unknown>>,
  kind: MixedKind,
  index: number,
  out: ParamIssue[],
): void {
  const prefix = `mixed.components.${index}.${kind}`

  if (typeof component.weight !== 'number' || !Number.isFinite(component.weight)) {
    out.push({ path: `${prefix}.weight`, messageKey: 'validation.expectedNumber' })
  } else if (component.weight < 0) {
    out.push({ path: `${prefix}.weight`, messageKey: 'validation.min', params: { min: 0 } })
  } else if (component.weight > 1 + TOLERANCE) {
    out.push({ path: `${prefix}.weight`, messageKey: 'validation.max', params: { max: 1 } })
  }

  const subParams = component.params
  if (typeof subParams !== 'object' || subParams === null) {
    out.push({ path: `${prefix}.params`, messageKey: 'validation.required' })
    return
  }
  checkSpecs(mixedComponentSpecsFor(kind), subParams as Record<string, unknown>, prefix, out)
}

/**
 * Valida unos `StrategyParams` contra el catalogo declarativo y las reglas que
 * solo se pueden comprobar mirando la estrategia entera.
 *
 * Devuelve una lista vacia si todo es correcto: la UI decide si bloquear el
 * calculo, pero el motor tambien valida por si acaso.
 */
export function validateStrategyParams(params: StrategyParams): readonly ParamIssue[] {
  const out: ParamIssue[] = []
  const records = params as unknown as Readonly<Record<string, unknown>>

  if (params.type === 'mixed') {
    checkSpecs(paramSpecsFor('mixed'), records, '', out)

    const components = records.components
    if (!Array.isArray(components) || components.length === 0) {
      out.push({ path: 'mixed.components', messageKey: 'validation.mixedNeedsComponents' })
      return out
    }

    let total = 0
    let allKindsKnown = true
    components.forEach((component, index) => {
      const typed = component as unknown as { kind?: MixedKind }
      if (typed.kind !== 'cash' && typed.kind !== 'bonds' && typed.kind !== 'equity') {
        allKindsKnown = false
        out.push({
          path: `mixed.components.${index}.kind`,
          messageKey: 'validation.unknownComponent',
        })
        return
      }
      const record = component as unknown as Readonly<Record<string, unknown>>
      if (typeof record.weight === 'number') {
        total += record.weight
      }
      checkMixedComponent(record, typed.kind, index, out)
    })

    // Con un `kind` desconocido los pesos ya no son comparables: avisar tambien
    // de que no suman 1 seria ruido en cascada sobre un dato ya invalido.
    if (allKindsKnown && Math.abs(total - 1) > 1e-6) {
      out.push({
        path: 'mixed.components',
        messageKey: 'validation.weightsMustSumToOne',
        params: { sum: total.toFixed(4) },
      })
    }
    return out
  }

  checkSpecs(paramSpecsFor(params.type), records, params.type, out)

  if (params.type === 'bonds') {
    if (params.purchasePrice <= 0) {
      out.push({ path: 'bonds.purchasePrice', messageKey: 'validation.positiveRequired' })
    }
    if (params.maturityMonths < 1) {
      out.push({ path: 'bonds.maturityMonths', messageKey: 'validation.positiveRequired' })
    }
  }

  if (params.type === 'debtPaydown' && params.loanIds.length === 0) {
    out.push({ path: 'debtPaydown.loanIds', messageKey: 'validation.debtNeedsLoans' })
  }

  return out
}

export function isValidStrategyParams(params: StrategyParams): boolean {
  return validateStrategyParams(params).length === 0
}
