/**
 * Barrel de `application`: casos de uso + puertos + DTOs.
 *
 * `application/**` solo importa `domain/**` (regla 2 de
 * `docs/arquitectura.md`); esta es la capa que `ui/**` deberia usar para todo
 * lo que no sean value objects (`Money`/`Rate`, de `domain/shared`).
 */
export * from './dto'
export * from './ports'
export * from './usecases'
