import type { TaxRules } from './taxEngine'

/**
 * Presets fiscales.
 *
 * Ninguno es una declaracion de la ley: son puntos de partida redondeados que
 * el usuario ajusta. El nombre lleva el ano para que quede explicito que envejece.
 */

/** Sin impuestos. Es el preset por defecto de la app. */
export function zeroTax(): TaxRules {
  return {
    cashInterest: 0,
    bondCoupon: 0,
    dividends: 0,
    capitalGainsAnnual: 0,
    capitalGainsOnExit: 0,
    mortgageInterestRelief: 0,
  }
}

/**
 * Retenciones tipicas de un ahorro espanol, redondeadas: 19 % sobre dividendos
 * y plusvalias, 21 % de deduccion de hipoteca.
 *
 * **Aproximado y sin fecha de vigencia**: se ofrece como punto de partida, y el
 * usuario es quien decide. No confundir con una consulta fiscal.
 */
export function spainApprox(): TaxRules {
  return {
    cashInterest: 0,
    bondCoupon: 0.19,
    dividends: 0.19,
    capitalGainsAnnual: 0.19,
    capitalGainsOnExit: 0.19,
    mortgageInterestRelief: 0.21,
  }
}

/** Sin tributacion sobre plusvalias (planes, fondos, cuentas dentro de wrappers). */
export function taxSheltered(): TaxRules {
  return {
    cashInterest: 0,
    bondCoupon: 0,
    dividends: 0,
    capitalGainsAnnual: 0,
    capitalGainsOnExit: 0,
    mortgageInterestRelief: 0.2,
  }
}

export type TaxPresetId = 'zero' | 'spain' | 'sheltered'

export const TAX_PRESETS: Readonly<Record<TaxPresetId, () => TaxRules>> = {
  zero: zeroTax,
  spain: spainApprox,
  sheltered: taxSheltered,
}

export function taxPreset(id: TaxPresetId): TaxRules {
  return TAX_PRESETS[id]()
}
