import { Fragment } from 'react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { ComparisonResultDto } from '@investing-helper/core/application'
import { formatMoney } from '../../format/money'
import { useTranslation } from '../../i18n'

export interface NetWorthChartProps {
  readonly comparison: ComparisonResultDto
  readonly currency: string
}

/** Una serie por estrategia, ademas de un color estable: no depende del orden del ranking. */
const PALETTE = ['#2563eb', '#059669', '#d97706', '#dc2626', '#7c3aed'] as const

function nominalKey(strategyId: string): string {
  return `${strategyId}__nominal`
}

function realKey(strategyId: string): string {
  return `${strategyId}__real`
}

/** Combina las series de cada estrategia en filas por mes, como pide Recharts. */
function buildChartData(comparison: ComparisonResultDto): Record<string, number>[] {
  const [first] = comparison.strategies
  if (!first) {
    return []
  }
  return first.points.map((point, index) => {
    const row: Record<string, number> = { monthIndex: point.monthIndex }
    for (const strategy of comparison.strategies) {
      row[nominalKey(strategy.strategyId)] = strategy.points[index]?.value ?? 0
      row[realKey(strategy.strategyId)] = strategy.realPoints[index]?.value ?? 0
    }
    return row
  })
}

export function NetWorthChart({ comparison, currency }: NetWorthChartProps) {
  const { locale, t } = useTranslation()
  const data = buildChartData(comparison)

  return (
    <div className="h-80 w-full rounded-lg border border-slate-200 p-4">
      <h3 className="mb-2 text-sm font-medium text-slate-600">{t('comparison.chart.title')}</h3>
      <ResponsiveContainer width="100%" height="90%">
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey="monthIndex"
            type="number"
            domain={['dataMin', 'dataMax']}
            tick={{ fontSize: 12 }}
          />
          <YAxis
            tick={{ fontSize: 12 }}
            tickFormatter={(value: number) => formatMoney(value, currency, locale)}
            width={90}
          />
          <Tooltip formatter={(value) => formatMoney(Number(value), currency, locale)} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {comparison.strategies.map((strategy, index) => {
            const color = PALETTE[index % PALETTE.length] ?? PALETTE[0]
            const label = t(strategy.labelKey)
            return (
              <Fragment key={strategy.strategyId}>
                <Line
                  type="monotone"
                  dataKey={nominalKey(strategy.strategyId)}
                  name={t('comparison.chart.nominal', { label })}
                  stroke={color}
                  dot={false}
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey={realKey(strategy.strategyId)}
                  name={t('comparison.chart.real', { label })}
                  stroke={color}
                  strokeDasharray="4 4"
                  dot={false}
                  strokeWidth={1.5}
                />
              </Fragment>
            )
          })}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
