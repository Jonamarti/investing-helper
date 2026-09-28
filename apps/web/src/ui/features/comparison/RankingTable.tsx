import type { ComparisonResultDto } from '@investing-helper/core/application'
import { formatMoney, formatPercent } from '../../format/money'
import { useTranslation } from '../../i18n'

export interface RankingTableProps {
  readonly comparison: ComparisonResultDto
  readonly currency: string
}

export function RankingTable({ comparison, currency }: RankingTableProps) {
  const { locale, t } = useTranslation()
  const strategiesById = new Map(comparison.strategies.map((s) => [s.strategyId, s]))

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full min-w-[640px] text-left text-sm">
        <caption className="sr-only">{t('comparison.ranking.title')}</caption>
        <thead className="bg-slate-100 text-slate-600">
          <tr>
            <th className="px-4 py-2 font-medium">{t('comparison.ranking.strategy')}</th>
            <th className="px-4 py-2 font-medium">{t('comparison.ranking.finalNominal')}</th>
            <th className="px-4 py-2 font-medium">{t('comparison.ranking.finalReal')}</th>
            <th className="px-4 py-2 font-medium">{t('comparison.ranking.irrAnnual')}</th>
            <th className="px-4 py-2 font-medium">{t('comparison.ranking.totalTax')}</th>
          </tr>
        </thead>
        <tbody>
          {comparison.ranking.map((strategyId, index) => {
            const strategy = strategiesById.get(strategyId)
            if (!strategy) {
              return null
            }
            return (
              <tr
                key={strategyId}
                className={
                  index === 0 ? 'bg-emerald-50 font-semibold' : 'odd:bg-white even:bg-slate-50'
                }
              >
                <td className="px-4 py-2">{t(strategy.labelKey)}</td>
                <td className="px-4 py-2">
                  {formatMoney(strategy.metrics.finalNominal, currency, locale)}
                </td>
                <td className="px-4 py-2">
                  {formatMoney(strategy.metrics.finalReal, currency, locale)}
                </td>
                <td className="px-4 py-2">
                  {strategy.metrics.irrAnnual === null
                    ? t('comparison.ranking.noIrr')
                    : formatPercent(strategy.metrics.irrAnnual, locale)}
                </td>
                <td className="px-4 py-2">
                  {formatMoney(strategy.metrics.totalTax, currency, locale)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
