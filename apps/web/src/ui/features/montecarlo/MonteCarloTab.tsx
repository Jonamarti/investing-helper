import { useState } from 'react'
import { strategyInputsOf, type MonteCarloResultDto } from '@investing-helper/core/application'
import { formatMoney, formatPercent } from '../../format/money'
import { useTranslation, type Locale } from '../../i18n'
import { useScenarioStore } from '../../store/scenarioStore'

const PRIMARY_BUTTON =
  'rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700'
const INPUT = 'w-full rounded-md border border-slate-300 px-2 py-1 text-sm'

interface StatProps {
  readonly label: string
  readonly value: string
}

function Stat({ label, value }: StatProps) {
  return (
    <div className="rounded-md border border-slate-100 bg-slate-50 p-3 text-center">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-base font-semibold text-slate-800">{value}</div>
    </div>
  )
}

interface ResultsPanelProps {
  readonly result: MonteCarloResultDto
  readonly currency: string
  readonly locale: Locale
}

function ResultsPanel({ result, currency, locale }: ResultsPanelProps) {
  const { t } = useTranslation()
  const money = (value: number): string => formatMoney(value, currency, locale)

  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <h3 className="mb-3 text-sm font-medium text-slate-600">
        {t('montecarlo.results.title', { paths: result.finalValues.length })}
      </h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat label={t('montecarlo.results.p5')} value={money(result.p5)} />
        <Stat label={t('montecarlo.results.p25')} value={money(result.p25)} />
        <Stat label={t('montecarlo.results.p50')} value={money(result.p50)} />
        <Stat label={t('montecarlo.results.p75')} value={money(result.p75)} />
        <Stat label={t('montecarlo.results.p95')} value={money(result.p95)} />
      </div>
      <p className="mt-3 text-sm text-slate-700">
        {result.probBeatsBest === null
          ? t('montecarlo.results.probBeatsBestNone')
          : t('montecarlo.results.probBeatsBest', {
              value: formatPercent(result.probBeatsBest, locale),
            })}
      </p>
      <p className="text-sm text-slate-700">
        {t('montecarlo.results.probBeatsInflation', {
          value: formatPercent(result.probBeatsInflation, locale),
        })}
      </p>
    </div>
  )
}

export function MonteCarloTab() {
  const { t, locale } = useTranslation()
  const scenario = useScenarioStore((s) => s.scenario)
  const result = useScenarioStore((s) => s.monteCarloResult)
  const runMonteCarloFor = useScenarioStore((s) => s.runMonteCarloFor)

  const equityStrategies = strategyInputsOf(scenario).filter(
    (strategy) => strategy.params.type === 'equity',
  )
  const [selectedId, setSelectedId] = useState<string | undefined>(equityStrategies[0]?.id)
  const currentId =
    selectedId && equityStrategies.some((s) => s.id === selectedId)
      ? selectedId
      : equityStrategies[0]?.id

  if (!scenario.assumptions.monteCarlo) {
    return <p className="text-slate-500">{t('montecarlo.disabled')}</p>
  }
  if (equityStrategies.length === 0 || !currentId) {
    return <p className="text-slate-500">{t('montecarlo.noEquity')}</p>
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        {equityStrategies.length > 1 && (
          <div>
            <label className="mb-1 block text-xs text-slate-500" htmlFor="montecarlo-strategy">
              {t('montecarlo.strategy.label')}
            </label>
            <select
              id="montecarlo-strategy"
              className={INPUT}
              value={currentId}
              onChange={(e) => setSelectedId(e.target.value)}
            >
              {equityStrategies.map((strategy) => (
                <option key={strategy.id} value={strategy.id}>
                  {strategy.id}
                </option>
              ))}
            </select>
          </div>
        )}
        <button
          type="button"
          className={PRIMARY_BUTTON}
          onClick={() => runMonteCarloFor(currentId)}
        >
          {t('montecarlo.run')}
        </button>
      </div>

      {result && <ResultsPanel result={result} currency={scenario.baseCurrency} locale={locale} />}
    </div>
  )
}
