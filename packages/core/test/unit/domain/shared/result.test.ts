import { describe, expect, it } from 'vitest'
import {
  collect,
  err,
  isErr,
  isOk,
  mapError,
  mapResult,
  ok,
  unwrap,
  unwrapOr,
} from '../../../../src/domain/shared/result'
import { InvariantError } from '../../../../src/domain/shared/assert'

describe('Result', () => {
  it('ok / err construyen las dos variantes', () => {
    expect(isOk(ok(1))).toBe(true)
    expect(isErr(err('boom'))).toBe(true)
  })

  it('mapResult solo toca el camino feliz', () => {
    expect(mapResult(ok(2), (n) => n * 3)).toEqual(ok(6))
    expect(mapResult(err<string>('boom'), (n: number) => n * 3)).toEqual(err('boom'))
  })

  it('mapError solo toca el canal del error', () => {
    // El tipo de exito `T` no se puede inferir desde una `Err`, asi que el
    // resultado sigue siendo un `Err` con el error remapeado.
    expect(mapError(err('boom'), (e) => e.length)).toEqual(err(4))
    expect(mapError(ok(1), (e: string) => e.length)).toEqual(ok(1))
  })

  it('unwrap lanza sobre Err, unwrapOr no', () => {
    expect(unwrap(ok('v'))).toBe('v')
    expect(() => unwrap(err('boom'))).toThrow(InvariantError)
    expect(unwrapOr(err('boom'), 'fallback')).toBe('fallback')
    expect(unwrapOr(ok('v'), 'fallback')).toBe('v')
  })

  it('collect corta en el primer error', () => {
    expect(collect([ok(1), ok(2)])).toEqual(ok([1, 2]))
    expect(collect([ok(1), err('boom'), ok(3)])).toEqual(err('boom'))
    expect(collect<number, string>([])).toEqual(ok([]))
  })
})
