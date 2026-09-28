import type { Locale } from '../i18n'

const INTL_LOCALE: Readonly<Record<Locale, string>> = { es: 'es-ES', en: 'en-US' }

export function formatMoney(value: number, currency: string, locale: Locale): string {
  return new Intl.NumberFormat(INTL_LOCALE[locale], {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatPercent(value: number, locale: Locale, digits = 1): string {
  return new Intl.NumberFormat(INTL_LOCALE[locale], {
    style: 'percent',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value)
}
