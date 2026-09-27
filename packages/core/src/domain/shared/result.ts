import { assert } from './assert'

/**
 * Tipos de error sin excepciones.
 *
 * El motor no lanza para entradas invalidas: devuelve `Result` para que la UI
 * pueda pintar los errores de validacion campo a campo.
 */
export type Result<T, E> = Ok<T> | Err<E>

export interface Ok<T> {
  readonly ok: true
  readonly value: T
}

export interface Err<E> {
  readonly ok: false
  readonly error: E
}

export function ok<T>(value: T): Ok<T> {
  return { ok: true, value }
}

export function err<E>(error: E): Err<E> {
  return { ok: false, error }
}

export function isOk<T, E>(result: Result<T, E>): result is Ok<T> {
  return result.ok
}

export function isErr<T, E>(result: Result<T, E>): result is Err<E> {
  return !result.ok
}

export function mapResult<T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> {
  return result.ok ? ok(fn(result.value)) : result
}

export function mapError<T, E, F>(result: Result<T, E>, fn: (error: E) => F): Result<T, F> {
  return result.ok ? result : err(fn(result.error))
}

/** Extrae el valor; lanza si es `Err`. Para tests y para callers internos. */
export function unwrap<T, E>(result: Result<T, E>): T {
  assert(result.ok, 'unwrap() sobre un Err')
  return result.value
}

export function unwrapOr<T, E>(result: Result<T, E>, fallback: T): T {
  return result.ok ? result.value : fallback
}

/** Colapsa una lista de `Result` en un `Result` de lista. Corta en el primer error. */
export function collect<T, E>(results: readonly Result<T, E>[]): Result<T[], E> {
  const values: T[] = []
  for (const result of results) {
    if (!result.ok) {
      return result
    }
    values.push(result.value)
  }
  return ok(values)
}
