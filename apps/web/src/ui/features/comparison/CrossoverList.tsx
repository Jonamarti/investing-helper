import type { ComparisonResultDto } from '@investing-helper/core/application'
import { useTranslation } from '../../i18n'

export interface CrossoverListProps {
  readonly comparison: ComparisonResultDto
}

export function CrossoverList({ comparison }: CrossoverListProps) {
  const { t } = useTranslation()
  const labelsById = new Map(comparison.strategies.map((s) => [s.strategyId, t(s.labelKey)]))

  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <h3 className="mb-2 text-sm font-medium text-slate-600">
        {t('comparison.crossovers.title')}
      </h3>
      {comparison.crossovers.length === 0 ? (
        <p className="text-sm text-slate-500">{t('comparison.crossovers.empty')}</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {comparison.crossovers.map((crossover) => (
            <li key={`${crossover.leaderBefore}-${crossover.leaderAfter}-${crossover.monthIndex}`}>
              {t('comparison.crossovers.item', {
                after: labelsById.get(crossover.leaderAfter) ?? crossover.leaderAfter,
                before: labelsById.get(crossover.leaderBefore) ?? crossover.leaderBefore,
                month: crossover.monthIndex,
              })}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
