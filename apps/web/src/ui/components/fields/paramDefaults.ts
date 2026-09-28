import type { ParamSpec, ParamValue } from '@investing-helper/core/domain/params'

/** Valores por defecto de un catalogo, para sembrar un componente/estrategia nuevo. */
export function defaultsOf(specs: readonly ParamSpec[]): Record<string, ParamValue> {
  const values: Record<string, ParamValue> = {}
  for (const spec of specs) {
    values[spec.key] = spec.default
  }
  return values
}
