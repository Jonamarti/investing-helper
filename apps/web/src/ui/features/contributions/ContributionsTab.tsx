import { useState, type ReactNode } from 'react'
import { supportedCurrencyCodes } from '@investing-helper/core/domain/shared'
import type {
  ContributionOverride,
  ContributionPlan,
  Salary,
} from '@investing-helper/core/domain/model'
import { fromPercent, toPercent } from '../../format/percentInput'
import { useTranslation } from '../../i18n'
import { useScenarioStore } from '../../store/scenarioStore'

const PRIMARY_BUTTON =
  'rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700'
const DANGER_BUTTON =
  'rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50'
const INPUT = 'w-full rounded-md border border-slate-300 px-2 py-1 text-sm'

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string
  htmlFor: string
  children: ReactNode
}) {
  return (
    <div>
      <label className="mb-1 block text-xs text-slate-500" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
    </div>
  )
}

interface SalarySectionProps {
  readonly salary: Salary
  readonly onChange: (patch: Partial<Salary>) => void
}

function SalarySection({ salary, onChange }: SalarySectionProps) {
  const { t } = useTranslation()
  const months = Array.from({ length: 12 }, (_, i) => i + 1)

  const toggleMonth = (month: number, checked: boolean): void => {
    const next = checked
      ? [...salary.extraPayMonths, month].sort((a, b) => a - b)
      : salary.extraPayMonths.filter((m) => m !== month)
    onChange({ extraPayMonths: next })
  }

  return (
    <section className="rounded-lg border border-slate-200 p-4">
      <h3 className="mb-3 text-sm font-medium text-slate-600">{t('contributions.salary.title')}</h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label={t('contributions.salary.netMonthly.label')} htmlFor="salary-net">
          <input
            id="salary-net"
            type="number"
            min={0}
            className={INPUT}
            value={salary.netMonthly}
            onChange={(e) => onChange({ netMonthly: Number(e.target.value) })}
          />
        </Field>
        <Field label={t('contributions.salary.fixedCostsMonthly.label')} htmlFor="salary-fixed">
          <input
            id="salary-fixed"
            type="number"
            min={0}
            className={INPUT}
            value={salary.fixedCostsMonthly}
            onChange={(e) => onChange({ fixedCostsMonthly: Number(e.target.value) })}
          />
        </Field>
        <Field label={t('contributions.salary.growthAnnual.label')} htmlFor="salary-growth">
          <input
            id="salary-growth"
            type="number"
            step={0.01}
            className={INPUT}
            value={toPercent(salary.growthAnnual)}
            onChange={(e) => onChange({ growthAnnual: fromPercent(Number(e.target.value)) })}
          />
        </Field>
        <Field
          label={t('contributions.salary.employeeContributionRate.label')}
          htmlFor="salary-contribution"
        >
          <input
            id="salary-contribution"
            type="number"
            step={0.01}
            min={0}
            max={99}
            className={INPUT}
            value={toPercent(salary.employeeContributionRate)}
            onChange={(e) =>
              onChange({ employeeContributionRate: fromPercent(Number(e.target.value)) })
            }
          />
        </Field>
      </div>
      <div className="mt-3">
        <span className="mb-1 block text-xs text-slate-500">
          {t('contributions.salary.extraPayMonths.label')}
        </span>
        <div className="flex flex-wrap gap-3">
          {months.map((month) => (
            <label key={month} className="flex items-center gap-1 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={salary.extraPayMonths.includes(month)}
                onChange={(e) => toggleMonth(month, e.target.checked)}
              />
              {month}
            </label>
          ))}
        </div>
      </div>
    </section>
  )
}

interface PlanSectionProps {
  readonly plan: ContributionPlan
  readonly onChange: (patch: Partial<ContributionPlan>) => void
}

function PlanSection({ plan, onChange }: PlanSectionProps) {
  const { t } = useTranslation()
  return (
    <section className="rounded-lg border border-slate-200 p-4">
      <h3 className="mb-3 text-sm font-medium text-slate-600">{t('contributions.plan.title')}</h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label={t('contributions.plan.currency.label')} htmlFor="plan-currency">
          <select
            id="plan-currency"
            className={INPUT}
            value={plan.currency}
            onChange={(e) => onChange({ currency: e.target.value })}
          >
            {supportedCurrencyCodes().map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('contributions.plan.initialLumpSum.label')} htmlFor="plan-lumpsum">
          <input
            id="plan-lumpsum"
            type="number"
            min={0}
            className={INPUT}
            value={plan.initialLumpSum}
            onChange={(e) => onChange({ initialLumpSum: Number(e.target.value) })}
          />
        </Field>
        <Field label={t('contributions.plan.savingsRate.label')} htmlFor="plan-savings">
          <input
            id="plan-savings"
            type="number"
            step={0.01}
            min={0}
            max={100}
            className={INPUT}
            value={toPercent(plan.savingsRate)}
            onChange={(e) => onChange({ savingsRate: fromPercent(Number(e.target.value)) })}
          />
        </Field>
        <Field label={t('contributions.plan.fixedMonthly.label')} htmlFor="plan-fixed">
          <input
            id="plan-fixed"
            type="number"
            min={0}
            className={INPUT}
            value={plan.fixedMonthly}
            onChange={(e) => onChange({ fixedMonthly: Number(e.target.value) })}
          />
        </Field>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <input
          id="plan-follow-salary"
          type="checkbox"
          checked={plan.followSalary}
          onChange={(e) => onChange({ followSalary: e.target.checked })}
        />
        <label className="text-sm text-slate-700" htmlFor="plan-follow-salary">
          {t('contributions.plan.followSalary.label')}
        </label>
      </div>
    </section>
  )
}

interface OverridesSectionProps {
  readonly overrides: Readonly<Record<string, ContributionOverride>>
  readonly onChange: (overrides: Record<string, ContributionOverride>) => void
}

function OverridesSection({ overrides, onChange }: OverridesSectionProps) {
  const { t } = useTranslation()
  const [monthKey, setMonthKey] = useState('')
  const [lumpSum, setLumpSum] = useState('')
  const [monthlyAmount, setMonthlyAmount] = useState('')

  const entries = Object.entries(overrides).sort(([a], [b]) => a.localeCompare(b))

  const add = (): void => {
    if (!monthKey.trim()) {
      return
    }
    const override: ContributionOverride = {
      ...(lumpSum.trim() ? { lumpSum: Number(lumpSum) } : {}),
      ...(monthlyAmount.trim() ? { monthlyAmount: Number(monthlyAmount) } : {}),
    }
    onChange({ ...overrides, [monthKey.trim()]: override })
    setMonthKey('')
    setLumpSum('')
    setMonthlyAmount('')
  }

  const remove = (key: string): void => {
    const next = { ...overrides }
    delete next[key]
    onChange(next)
  }

  return (
    <section className="rounded-lg border border-slate-200 p-4">
      <h3 className="mb-3 text-sm font-medium text-slate-600">
        {t('contributions.overrides.title')}
      </h3>
      {entries.length === 0 ? (
        <p className="mb-3 text-sm text-slate-500">{t('contributions.overrides.empty')}</p>
      ) : (
        <ul className="mb-3 flex flex-col gap-2">
          {entries.map(([key, override]) => (
            <li key={key} className="flex items-center gap-3 text-sm text-slate-700">
              <span className="font-mono">{key}</span>
              {override.lumpSum !== undefined && <span>+{override.lumpSum}</span>}
              {override.monthlyAmount !== undefined && <span>= {override.monthlyAmount}/mes</span>}
              <button type="button" className={DANGER_BUTTON} onClick={() => remove(key)}>
                {t('contributions.overrides.remove')}
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-end gap-3">
        <Field label={t('contributions.overrides.monthKey.label')} htmlFor="override-month">
          <input
            id="override-month"
            className={INPUT}
            placeholder="2027-01"
            value={monthKey}
            onChange={(e) => setMonthKey(e.target.value)}
          />
        </Field>
        <Field label={t('contributions.overrides.lumpSum.label')} htmlFor="override-lumpsum">
          <input
            id="override-lumpsum"
            type="number"
            className={INPUT}
            value={lumpSum}
            onChange={(e) => setLumpSum(e.target.value)}
          />
        </Field>
        <Field label={t('contributions.overrides.monthlyAmount.label')} htmlFor="override-monthly">
          <input
            id="override-monthly"
            type="number"
            className={INPUT}
            value={monthlyAmount}
            onChange={(e) => setMonthlyAmount(e.target.value)}
          />
        </Field>
        <button type="button" className={PRIMARY_BUTTON} onClick={add}>
          {t('contributions.overrides.add')}
        </button>
      </div>
    </section>
  )
}

export function ContributionsTab() {
  const scenario = useScenarioStore((s) => s.scenario)
  const setScenario = useScenarioStore((s) => s.setScenario)

  return (
    <div className="flex flex-col gap-6">
      <SalarySection
        salary={scenario.salary}
        onChange={(patch) => setScenario({ ...scenario, salary: { ...scenario.salary, ...patch } })}
      />
      <PlanSection
        plan={scenario.contributionPlan}
        onChange={(patch) =>
          setScenario({ ...scenario, contributionPlan: { ...scenario.contributionPlan, ...patch } })
        }
      />
      <OverridesSection
        overrides={scenario.contributionPlan.overrides}
        onChange={(overrides) =>
          setScenario({
            ...scenario,
            contributionPlan: { ...scenario.contributionPlan, overrides },
          })
        }
      />
    </div>
  )
}
