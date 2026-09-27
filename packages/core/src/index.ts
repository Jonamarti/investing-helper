/**
 * Punto de entrada unico de `@investing-helper/core`.
 *
 * La app web solo deberia importar de aqui. Todo lo que se exporta es dominio
 * puro: nada de React, nada de `window`, nada de red.
 */
export * from './domain'
export { registerAllEngines } from './domain/strategies'
