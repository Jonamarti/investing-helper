import { createContext, use } from 'react'
import { en } from './en'
import { es } from './es'

export type Locale = 'es' | 'en'

const DICTIONARIES: Readonly<Record<Locale, Readonly<Record<string, string>>>> = { es, en }

export const DEFAULT_LOCALE: Locale = 'es'

/** Interpola `{param}` en una plantilla ya traducida. */
function interpolate(template: string, params?: Readonly<Record<string, string | number>>): string {
  if (!params) {
    return template
  }
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  )
}

/** Traduce una clave para un idioma dado. Si no existe, devuelve la clave tal cual. */
export function translate(
  locale: Locale,
  key: string,
  params?: Readonly<Record<string, string | number>>,
): string {
  const template = DICTIONARIES[locale][key] ?? key
  return interpolate(template, params)
}

export const LocaleContext = createContext<Locale>(DEFAULT_LOCALE)

export type TranslateFn = (
  key: string,
  params?: Readonly<Record<string, string | number>>,
) => string

/** `t('clave', { param: valor })`, ligado al idioma del `LocaleContext` mas cercano. */
export function useTranslation(): { readonly locale: Locale; readonly t: TranslateFn } {
  const locale = use(LocaleContext)
  return { locale, t: (key, params) => translate(locale, key, params) }
}
