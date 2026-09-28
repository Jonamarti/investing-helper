import { useState, type ReactNode } from 'react'
import {
  MIXED_KINDS,
  defaultParamsFor,
  mixedComponentSpecsFor,
  paramSpecsFor,
  type MixedKind,
  type ParamValue,
} from '@investing-helper/core/domain/params'
import {
  defaultMonteCarlo,
  STRATEGY_TYPES,
  type Assumptions,
  type BondsParams,
  type CashParams,
  type EquityParams,
  type Loan,
  type MixedComponent,
  type Scenario,
  type StrategyParams,
  type StrategyType,
} from '@investing-helper/core/domain/model'
import { defaultsOf } from '../../components/fields/paramDefaults'
import { ParamsForm } from '../../components/fields/ParamsForm'
import { fromPercent, toPercent } from '../../format/percentInput'
import { useTranslation } from '../../i18n'
import { useScenarioStore } from '../../store/scenarioStore'

const PRIMARY_BUTTON =
  'rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700'
const SECONDARY_BUTTON =
  'rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50'
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

interface GlobalAssumptionsProps {
  readonly assumptions: Assumptions
  readonly onChange: (patch: Partial<Assumptions>) => void
}

function GlobalAssumptions({ assumptions, onChange }: GlobalAssumptionsProps) {
  const { t } = useTranslation()
  const mc = assumptions.monteCarlo

  const setMonteCarlo = (patch: Partial<NonNullable<Assumptions['monteCarlo']>>): void => {
    if (mc) {
      onChange({ monteCarlo: { ...mc, ...patch } })
    }
  }

  return (
    <section className="rounded-lg border border-slate-200 p-4">
      <h3 className="mb-3 text-sm font-medium text-slate-600">{t('assumptions.title')}</h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label={t('assumptions.inflationAnnual.label')} htmlFor="inflation">
          <input
            id="inflation"
            type="number"
            step={0.01}
            className={INPUT}
            value={toPercent(assumptions.inflationAnnual)}
            onChange={(e) => onChange({ inflationAnnual: fromPercent(Number(e.target.value)) })}
          />
        </Field>
        <Field label={t('assumptions.horizonMonths.label')} htmlFor="horizon">
          <input
            id="horizon"
            type="number"
            min={1}
            className={INPUT}
            value={assumptions.horizonMonths}
            onChange={(e) => onChange({ horizonMonths: Number(e.target.value) })}
          />
        </Field>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <input
          id="montecarlo-enable"
          type="checkbox"
          checked={mc !== null}
          onChange={(e) => onChange({ monteCarlo: e.target.checked ? defaultMonteCarlo() : null })}
        />
        <label className="text-sm text-slate-700" htmlFor="montecarlo-enable">
          {t('assumptions.montecarlo.enable')}
        </label>
      </div>

      {mc && (
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label={t('assumptions.montecarlo.paths.label')} htmlFor="mc-paths">
            <input
              id="mc-paths"
              type="number"
              min={100}
              step={100}
              className={INPUT}
              value={mc.paths}
              onChange={(e) => setMonteCarlo({ paths: Number(e.target.value) })}
            />
          </Field>
          <Field label={t('assumptions.montecarlo.seed.label')} htmlFor="mc-seed">
            <input
              id="mc-seed"
              type="number"
              className={INPUT}
              value={mc.seed}
              onChange={(e) => setMonteCarlo({ seed: Number(e.target.value) })}
            />
          </Field>
          <Field
            label={t('assumptions.montecarlo.equityVolatilityAnnual.label')}
            htmlFor="mc-volatility"
          >
            <input
              id="mc-volatility"
              type="number"
              step={0.01}
              className={INPUT}
              value={toPercent(mc.equityVolatilityAnnual)}
              onChange={(e) =>
                setMonteCarlo({ equityVolatilityAnnual: fromPercent(Number(e.target.value)) })
              }
            />
          </Field>
          <Field
            label={t('assumptions.montecarlo.correlationWithCash.label')}
            htmlFor="mc-correlation"
          >
            <input
              id="mc-correlation"
              type="number"
              step={0.01}
              className={INPUT}
              value={toPercent(mc.correlationWithCash)}
              onChange={(e) =>
                setMonteCarlo({ correlationWithCash: fromPercent(Number(e.target.value)) })
              }
            />
          </Field>
        </div>
      )}
    </section>
  )
}

interface LoanCheckboxListProps {
  readonly loans: readonly Loan[]
  readonly selected: readonly string[]
  readonly onChange: (ids: string[]) => void
}

function LoanCheckboxList({ loans, selected, onChange }: LoanCheckboxListProps) {
  const { t } = useTranslation()
  if (loans.length === 0) {
    return <p className="mt-3 text-sm text-slate-500">{t('assumptions.strategies.loans.empty')}</p>
  }
  return (
    <div className="mt-3">
      <h5 className="mb-1 text-xs text-slate-500">{t('assumptions.strategies.loans.title')}</h5>
      <div className="flex flex-wrap gap-4">
        {loans.map((loan) => (
          <label key={loan.id} className="flex items-center gap-1.5 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={selected.includes(loan.id)}
              onChange={(e) =>
                onChange(
                  e.target.checked
                    ? [...selected, loan.id]
                    : selected.filter((id) => id !== loan.id),
                )
              }
            />
            {t(loan.nameKey)}
          </label>
        ))}
      </div>
    </div>
  )
}

function defaultMixedComponentParams(kind: MixedKind): CashParams | BondsParams | EquityParams {
  return defaultsOf(mixedComponentSpecsFor(kind)) as unknown as
    CashParams | BondsParams | EquityParams
}

interface MixedComponentsEditorProps {
  readonly components: readonly MixedComponent[]
  readonly onChange: (components: MixedComponent[]) => void
}

function MixedComponentsEditor({ components, onChange }: MixedComponentsEditorProps) {
  const { t } = useTranslation()

  const updateComponent = (index: number, patch: Partial<MixedComponent>): void => {
    onChange(components.map((c, i) => (i === index ? ({ ...c, ...patch } as MixedComponent) : c)))
  }

  return (
    <div className="mt-3 rounded-md border border-slate-100 bg-slate-50 p-3">
      <div className="mb-2 flex items-center justify-between">
        <h5 className="text-xs text-slate-500">{t('assumptions.strategies.mixed.title')}</h5>
        <button
          type="button"
          className={SECONDARY_BUTTON}
          onClick={() =>
            onChange([
              ...components,
              { kind: 'cash', weight: 0, params: defaultMixedComponentParams('cash') },
            ])
          }
        >
          {t('assumptions.strategies.mixed.add')}
        </button>
      </div>
      <ul className="flex flex-col gap-3">
        {components.map((component, index) => (
          <li key={index} className="rounded-md border border-slate-200 bg-white p-3">
            <div className="mb-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Field
                label={t('assumptions.strategies.mixed.kind.label')}
                htmlFor={`mixed-${index}-kind`}
              >
                <select
                  id={`mixed-${index}-kind`}
                  className={INPUT}
                  value={component.kind}
                  onChange={(e) => {
                    const kind = e.target.value as MixedKind
                    updateComponent(index, { kind, params: defaultMixedComponentParams(kind) })
                  }}
                >
                  {MIXED_KINDS.map((kind) => (
                    <option key={kind} value={kind}>
                      {t(`strategy.${kind}.label`)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field
                label={t('assumptions.strategies.mixed.weight.label')}
                htmlFor={`mixed-${index}-weight`}
              >
                <input
                  id={`mixed-${index}-weight`}
                  type="number"
                  step={0.01}
                  min={0}
                  max={1}
                  className={INPUT}
                  value={component.weight}
                  onChange={(e) => updateComponent(index, { weight: Number(e.target.value) })}
                />
              </Field>
            </div>
            <ParamsForm
              specs={mixedComponentSpecsFor(component.kind)}
              values={component.params as unknown as Record<string, ParamValue>}
              onChange={(key, value) =>
                updateComponent(index, {
                  params: { ...component.params, [key]: value } as CashParams,
                })
              }
              idPrefix={`mixed-${index}-field`}
            />
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                className={DANGER_BUTTON}
                onClick={() => onChange(components.filter((_, i) => i !== index))}
              >
                {t('assumptions.strategies.mixed.remove')}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

interface StrategyCardProps {
  readonly strategy: StrategyParams
  readonly index: number
  readonly loans: readonly Loan[]
  readonly onChange: (next: StrategyParams) => void
  readonly onRemove: () => void
}

function StrategyCard({ strategy, index, loans, onChange, onRemove }: StrategyCardProps) {
  const { t } = useTranslation()
  const specs = paramSpecsFor(strategy.type)
  const values = strategy as unknown as Record<string, ParamValue>

  const setField = (key: string, value: ParamValue): void => {
    onChange({ ...strategy, [key]: value } as StrategyParams)
  }

  return (
    <li className="rounded-lg border border-slate-200 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-slate-700">
          {t(`strategy.${strategy.type}.label`)}
        </h4>
        <button type="button" className={DANGER_BUTTON} onClick={onRemove}>
          {t('assumptions.strategies.remove')}
        </button>
      </div>

      <ParamsForm
        specs={specs}
        values={values}
        onChange={setField}
        idPrefix={`strategy-${index}`}
      />

      {strategy.type === 'debtPaydown' && (
        <LoanCheckboxList
          loans={loans}
          selected={strategy.loanIds}
          onChange={(loanIds) => onChange({ ...strategy, loanIds })}
        />
      )}

      {strategy.type === 'mixed' && (
        <MixedComponentsEditor
          components={strategy.components}
          onChange={(components) => onChange({ ...strategy, components })}
        />
      )}
    </li>
  )
}

interface StrategiesSectionProps {
  readonly scenario: Scenario
  readonly onChangeStrategies: (strategies: readonly StrategyParams[]) => void
}

function StrategiesSection({ scenario, onChangeStrategies }: StrategiesSectionProps) {
  const { t } = useTranslation()
  const [newType, setNewType] = useState<StrategyType>('cash')

  return (
    <section className="rounded-lg border border-slate-200 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-medium text-slate-600">{t('assumptions.strategies.title')}</h3>
        <div className="flex items-center gap-2">
          <select
            className={INPUT}
            value={newType}
            onChange={(e) => setNewType(e.target.value as StrategyType)}
          >
            {STRATEGY_TYPES.map((type) => (
              <option key={type} value={type}>
                {t(`strategy.${type}.label`)}
              </option>
            ))}
          </select>
          <button
            type="button"
            className={PRIMARY_BUTTON}
            onClick={() => onChangeStrategies([...scenario.strategies, defaultParamsFor(newType)])}
          >
            {t('assumptions.strategies.add')}
          </button>
        </div>
      </div>

      {scenario.strategies.length === 0 ? (
        <p className="text-sm text-slate-500">{t('assumptions.strategies.empty')}</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {scenario.strategies.map((strategy, index) => (
            <StrategyCard
              key={index}
              strategy={strategy}
              index={index}
              loans={scenario.loans}
              onChange={(next) =>
                onChangeStrategies(scenario.strategies.map((s, i) => (i === index ? next : s)))
              }
              onRemove={() => onChangeStrategies(scenario.strategies.filter((_, i) => i !== index))}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

export function AssumptionsTab() {
  const scenario = useScenarioStore((s) => s.scenario)
  const setScenario = useScenarioStore((s) => s.setScenario)

  return (
    <div className="flex flex-col gap-6">
      <GlobalAssumptions
        assumptions={scenario.assumptions}
        onChange={(patch) =>
          setScenario({ ...scenario, assumptions: { ...scenario.assumptions, ...patch } })
        }
      />
      <StrategiesSection
        scenario={scenario}
        onChangeStrategies={(strategies) => setScenario({ ...scenario, strategies })}
      />
    </div>
  )
}
