import { assertFiniteNumber } from './assert'

/**
 * Cantidad monetaria en **unidades mayores** de su divisa (euros, dolares, yen...).
 *
 * No se usan enteros de centimos: la app es multi-moneda y JPY no tiene
 * subdivisiones, asi que la escala tiene que depender de la divisa, no del tipo.
 * Ver `docs/arquitectura.md` seccion "Dinero".
 */
export type Money = number

/** Code ISO 4217. */
export type CurrencyCode = string

/**
 * Redondea a los decimales de la divisa usando redondeo simetrico
 * (media unidad hacia fuera: 2.5 -> 3, -2.5 -> -3).
 *
 * El `+ Number.EPSILON * |scaled|` corrige el error de representacion binaria:
 * sin el, `roundToExponent(1.005, 2)` daria 1 en vez de 1.01.
 */
export function roundToExponent(value: number, exponent: number): number {
  assertFiniteNumber(value, 'value')
  if (!Number.isInteger(exponent)) {
    throw new TypeError(`El exponente de la divisa debe ser entero, recibido: ${exponent}`)
  }
  if (exponent < 0) {
    throw new RangeError(`El exponente de la divisa no puede ser negativo: ${exponent}`)
  }
  const factor = 10 ** exponent
  const scaled = value * factor
  const corrected = scaled + Math.sign(scaled) * Math.abs(scaled) * Number.EPSILON * 4
  // `Math.round` saca los negativos hacia +Infinity (round(-2.5) === -2), asi que
  // el sesgo se corrige desplazando la magnitud en la direccion del signo.
  // `|| 0` colapsa el -0 que produce Math.round en valores negativos pequenos.
  return Math.round(corrected) / factor || 0
}

/** Redondea importes a los decimales de la divisa. */
export function roundMoney(value: Money, exponent: number): Money {
  return roundToExponent(value, exponent)
}

/**
 * Redondea **al alza** a los decimales de la divisa.
 *
 * Es lo que necesita una cuota de prestamo: si se redondea a la baja, cada mes
 * falta una fraccion de centimo por capitalizacion, y al cabo de 300 meses el
 * saldo final ya no llega a 0 (en una hipoteca de 100.000 al 5 % son ~1,32 €).
 * Redondeando al alza, la cuota es siempre pagable y el cuadro termina en el
 * plazo pactado.
 */
export function roundUpToExponent(value: number, exponent: number): Money {
  assertFiniteNumber(value, 'value')
  if (!Number.isInteger(exponent) || exponent < 0) {
    throw new RangeError(`Exponente de divisa invalido: ${exponent}`)
  }
  if (exponent === 0) {
    return Math.ceil(value) || 0
  }
  const factor = 10 ** exponent
  const scaled = value * factor
  const corrected = scaled + Math.sign(scaled) * Math.abs(scaled) * Number.EPSILON * 4
  return Math.ceil(corrected) / factor || 0
}

/** `a + b`. No redondea: los operandos ya estan redondeados. */
export function addMoney(a: Money, b: Money): Money {
  return a + b
}

/** `a - b`. */
export function subMoney(a: Money, b: Money): Money {
  return a - b
}

/** `a * b`. El redondeo es responsabilidad del llamante (ver `scaleMoney`). */
export function mulMoney(a: Money, b: number): Money {
  return a * b
}

/** `a / b`, con `b === 0` devuelve 0 en vez de `Infinity`. */
export function divMoney(a: Money, b: number): Money {
  return b === 0 ? 0 : a / b
}

/** Escala un importe y redondea al final, no en cada multiplicacion. */
export function scaleMoney(amount: Money, factor: number, exponent: number): Money {
  return roundToExponent(amount * factor, exponent)
}

/** `max(0, amount)`. Un saldo de deuda nunca es negativo. */
export function nonNegativeMoney(amount: Money): Money {
  return amount < 0 ? 0 : amount
}

/** Suma una lista de importes. */
export function sumMoney(values: readonly Money[], exponent: number): Money {
  return roundToExponent(
    values.reduce((acc, value) => acc + value, 0),
    exponent,
  )
}
