/**
 * Fuente de numeros aleatorios uniformes en `[0, 1)`.
 *
 * Puerto: `application` no crea la implementacion, solo la usa. La real
 * (`mulberry32`, con semilla) vive en `apps/web/src/infrastructure/rng`. Los
 * tests pueden pasar cualquier cosa determinista sin depender de esa clase.
 */
export interface IRandomSource {
  next(): number
}
