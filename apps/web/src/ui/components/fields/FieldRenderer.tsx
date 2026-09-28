import { supportedCurrencyCodes } from '@investing-helper/core/domain/shared'
import type { ParamSpec, ParamValue } from '@investing-helper/core/domain/params'
import { fromPercent, toPercent } from '../../format/percentInput'
import { useTranslation } from '../../i18n'

const INPUT = 'w-full rounded-md border border-slate-300 px-2 py-1 text-sm'
const LABEL = 'mb-1 block text-xs text-slate-500'

export interface FieldRendererProps {
  readonly spec: ParamSpec
  readonly value: ParamValue
  readonly onChange: (value: ParamValue) => void
  /**
   * Antepuesto al `id` del input. Dos specs con la misma `key` (dos
   * estrategias `cash`, dos componentes mixtos del mismo tipo) generan el
   * mismo id sin esto, y el `<label for>` del segundo apunta al input del
   * primero.
   */
  readonly idPrefix?: string
}

/**
 * Recorre un `ParamSpec` (el catalogo declarativo de `domain/params`) y elige
 * el input segun `kind`. Ninguna estrategia se nombra aqui: anadir un campo a
 * una estrategia es anadir una entrada al catalogo, no tocar este componente.
 * Ver docs/plan.md, §3.4.
 */
export function FieldRenderer({ spec, value, onChange, idPrefix }: FieldRendererProps) {
  const { t } = useTranslation()
  const id = `${idPrefix ?? 'field'}-${spec.key}`
  const label = t(spec.labelKey)

  switch (spec.kind) {
    case 'boolean':
      return (
        <div className="flex items-end gap-2">
          <input
            id={id}
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked)}
          />
          <label className="text-sm text-slate-700" htmlFor={id}>
            {label}
          </label>
        </div>
      )

    case 'select':
      return (
        <div>
          <label className={LABEL} htmlFor={id}>
            {label}
          </label>
          <select
            id={id}
            className={INPUT}
            value={String(value)}
            onChange={(e) => onChange(e.target.value)}
          >
            {spec.options?.map((option) => (
              <option key={option.value} value={option.value}>
                {t(option.labelKey)}
              </option>
            ))}
          </select>
        </div>
      )

    case 'currency':
      return (
        <div>
          <label className={LABEL} htmlFor={id}>
            {label}
          </label>
          <select
            id={id}
            className={INPUT}
            value={String(value)}
            onChange={(e) => onChange(e.target.value)}
          >
            {supportedCurrencyCodes().map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </div>
      )

    case 'percent':
      return (
        <div>
          <label className={LABEL} htmlFor={id}>
            {label}
          </label>
          <input
            id={id}
            type="number"
            step={(spec.step ?? 0.0001) * 100}
            min={spec.min === undefined ? undefined : spec.min * 100}
            max={spec.max === undefined ? undefined : spec.max * 100}
            className={INPUT}
            value={toPercent(Number(value))}
            onChange={(e) => onChange(fromPercent(Number(e.target.value)))}
          />
        </div>
      )

    case 'money':
    case 'number':
    case 'month':
      return (
        <div>
          <label className={LABEL} htmlFor={id}>
            {label}
          </label>
          <input
            id={id}
            type="number"
            step={spec.step}
            min={spec.min}
            max={spec.max}
            className={INPUT}
            value={Number(value)}
            onChange={(e) => onChange(Number(e.target.value))}
          />
        </div>
      )
  }
}
