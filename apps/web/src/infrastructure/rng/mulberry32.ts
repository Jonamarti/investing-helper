import type { IRandomSource } from '@investing-helper/core/application/ports'

/**
 * Implementacion de `IRandomSource`: mulberry32, un PRNG de 32 bits, rapido y
 * con periodo suficiente para unos miles de trayectorias Monte Carlo. No es
 * criptografico ni falta que lo sea: solo necesita ser reproducible con la
 * misma semilla.
 */
export function mulberry32(seed: number): IRandomSource {
  let state = seed >>> 0
  return {
    next(): number {
      state = (state + 0x6d2b79f5) >>> 0
      let t = state
      t = Math.imul(t ^ (t >>> 15), t | 1)
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    },
  }
}
