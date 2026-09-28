/**
 * Fraccion a puntos porcentuales para un input, redondeado a 4 decimales:
 * `0.041 * 100` es `4.1000000000000005` en coma flotante, y el usuario no ha
 * tocado nada.
 */
export function toPercent(rate: number): number {
  return Math.round(rate * 1_000_000) / 10_000
}

/** El inverso de `toPercent`, para volver a guardar la fraccion. */
export function fromPercent(percent: number): number {
  return percent / 100
}
