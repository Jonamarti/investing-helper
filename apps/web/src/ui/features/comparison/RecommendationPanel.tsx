import type { ComparisonResultDto, RecommendationItemDto } from '@investing-helper/core/application'
import { formatMoney, formatPercent } from '../../format/money'
import { useTranslation, type Locale } from '../../i18n'

export interface RecommendationPanelProps {
  readonly comparison: ComparisonResultDto
  readonly currency: string
}

/**
 * Cada clave de `recommend()` (`domain/analytics/recommendation.ts`) lleva
 * parametros de una forma distinta (ids de estrategia, tasas, importes): esta
 * es la unica funcion que sabe traducir esos valores crudos a texto, para no
 * repetir el `switch` en cada sitio que pinte una recomendacion.
 */
function resolveParams(
  key: string,
  params: Readonly<Record<string, number | string>> | undefined,
  labelsById: ReadonlyMap<string, string>,
  currency: string,
  locale: Locale,
): Record<string, string | number> | undefined {
  if (!params) {
    return undefined
  }
  const labelOf = (id: unknown): string => labelsById.get(String(id)) ?? String(id)

  switch (key) {
    case 'recommendation.headline.winner':
    case 'recommendation.reason.winner':
      return { strategyId: labelOf(params.strategyId) }
    case 'recommendation.headline.tie':
    case 'recommendation.reason.tie':
      return { a: labelOf(params.a), b: labelOf(params.b) }
    case 'recommendation.reason.debtBeatsMarket':
      return {
        loanRate: formatPercent(Number(params.loanRate), locale),
        marketRate: formatPercent(Number(params.marketRate), locale),
      }
    case 'recommendation.caveat.negativeReal':
      return { netGainReal: formatMoney(Number(params.netGainReal), currency, locale) }
    case 'recommendation.caveat.highTax':
      return { taxShare: formatPercent(Number(params.taxShare), locale) }
    default:
      return params
  }
}

export function RecommendationPanel({ comparison, currency }: RecommendationPanelProps) {
  const { locale, t } = useTranslation()
  const labelsById = new Map(comparison.strategies.map((s) => [s.strategyId, t(s.labelKey)]))
  const { recommendation } = comparison

  const resolve = (item: RecommendationItemDto): string =>
    t(item.key, resolveParams(item.key, item.params, labelsById, currency, locale))

  // El titular no lleva sus propios parametros: comparte forma con la primera
  // razon (ganador o empate), que es justo la que decide el titular.
  const firstReasonParams = recommendation.reasons[0]?.params
  const headline = resolve(
    firstReasonParams === undefined
      ? { key: recommendation.headlineKey }
      : { key: recommendation.headlineKey, params: firstReasonParams },
  )

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <h3 className="mb-1 text-sm font-medium text-slate-600">
        {t('comparison.recommendation.title')}
      </h3>
      <p className="text-base font-semibold">{headline}</p>
      {recommendation.reasons.length > 0 && (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
          {recommendation.reasons.map((reason) => (
            <li key={reason.key}>{resolve(reason)}</li>
          ))}
        </ul>
      )}
      {recommendation.caveats.length > 0 && (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-700">
          {recommendation.caveats.map((caveat) => (
            <li key={caveat.key}>{resolve(caveat)}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
