import type { ParamSpec, ParamValue } from '@investing-helper/core/domain/params'
import { FieldRenderer } from './FieldRenderer'

export interface ParamsFormProps {
  readonly specs: readonly ParamSpec[]
  readonly values: Readonly<Record<string, ParamValue>>
  readonly onChange: (key: string, value: ParamValue) => void
  /** Ver `FieldRenderer`: necesario cuando puede haber mas de un formulario del mismo tipo a la vez. */
  readonly idPrefix?: string
}

/** Recorre un catalogo de `ParamSpec` entero, ocultando lo que `visibleWhen` descarte. */
export function ParamsForm({ specs, values, onChange, idPrefix }: ParamsFormProps) {
  const visible = specs.filter((spec) => !spec.visibleWhen || spec.visibleWhen(values))

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {visible.map((spec) => (
        <FieldRenderer
          key={spec.key}
          spec={spec}
          value={values[spec.key] ?? spec.default}
          onChange={(value) => onChange(spec.key, value)}
          {...(idPrefix === undefined ? {} : { idPrefix })}
        />
      ))}
    </div>
  )
}
