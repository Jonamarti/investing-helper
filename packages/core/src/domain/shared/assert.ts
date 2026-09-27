/**
 * Utilidades de asercion para invariantes internas del motor.
 *
 * Son `assert`, no validaciones: describen cosas que no deberian poder pasar.
 * La validacion de entrada del usuario vive en `application/usecases/
 * validateScenario.ts` y devuelve `ValidationIssue[]`, no lanza.
 */

export class InvariantError extends Error {
  override readonly name = 'InvariantError'
}

export function assert(
  condition: unknown,
  message = 'Invariante del motor rota',
): asserts condition {
  if (!condition) {
    throw new InvariantError(message)
  }
}

export function assertFiniteNumber(value: number, label = 'valor'): void {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new InvariantError(
      `Se esperaba un numero finito en "${label}", recibido: ${String(value)}`,
    )
  }
}

export function assertNonNegative(value: number, label = 'valor'): void {
  assertFiniteNumber(value, label)
  if (value < 0) {
    throw new InvariantError(`Se esperaba un valor >= 0 en "${label}", recibido: ${value}`)
  }
}

export function assertPositive(value: number, label = 'valor'): void {
  assertFiniteNumber(value, label)
  if (value <= 0) {
    throw new InvariantError(`Se esperaba un valor > 0 en "${label}", recibido: ${value}`)
  }
}

export function assertNonEmpty<T>(values: readonly T[], label = 'lista'): void {
  assert(values.length > 0, `Se esperaba una lista no vacia en "${label}"`)
}

/**
 * Marker para exhaustividad de `switch`. Si se anade un miembro a una union y
 * se olvida un `case`, el compilador falla aqui.
 */
export function assertNever(value: never, context = 'valor'): never {
  throw new InvariantError(`Caso no contemplado en ${context}: ${JSON.stringify(value)}`)
}
