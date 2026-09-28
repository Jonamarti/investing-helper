import type { ReactNode } from 'react'
import type { AmortizationSystem, Loan, LoanKind } from '@investing-helper/core/domain/model'
import { supportedCurrencyCodes } from '@investing-helper/core/domain/shared'
import { fromPercent, toPercent } from '../../format/percentInput'
import { useTranslation } from '../../i18n'
import { useScenarioStore } from '../../store/scenarioStore'

const LOAN_KINDS: readonly LoanKind[] = ['installment', 'mortgage', 'revolving']
const SYSTEMS: readonly AmortizationSystem[] = ['french', 'constant']

const PRIMARY_BUTTON =
  'rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700'
const DANGER_BUTTON =
  'rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50'
const INPUT = 'w-full rounded-md border border-slate-300 px-2 py-1 text-sm'

function updateLoan(loans: readonly Loan[], id: string, patch: Partial<Loan>): Loan[] {
  return loans.map((loan) => (loan.id === id ? { ...loan, ...patch } : loan))
}

function removeLoan(loans: readonly Loan[], id: string): Loan[] {
  return loans.filter((loan) => loan.id !== id)
}

function blankLoan(currency: string): Loan {
  return {
    id: crypto.randomUUID(),
    nameKey: 'Nuevo préstamo',
    kind: 'installment',
    currency,
    principal: 10_000,
    annualRate: 0.05,
    termMonths: 60,
    system: 'french',
    startMonth: 0,
    earlyExitPenaltyRate: 0,
    interestDeductible: false,
  }
}

interface FieldProps {
  readonly label: string
  readonly htmlFor: string
  readonly children: ReactNode
}

function Field({ label, htmlFor, children }: FieldProps) {
  return (
    <div>
      <label className="mb-1 block text-xs text-slate-500" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
    </div>
  )
}

interface LoanCardProps {
  readonly loan: Loan
  readonly onChange: (patch: Partial<Loan>) => void
  readonly onDelete: () => void
}

function LoanCard({ loan, onChange, onDelete }: LoanCardProps) {
  const { t } = useTranslation()
  const idOf = (field: string): string => `loan-${loan.id}-${field}`

  return (
    <li className="rounded-lg border border-slate-200 p-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label={t('debts.field.name')} htmlFor={idOf('name')}>
          <input
            id={idOf('name')}
            className={INPUT}
            value={loan.nameKey}
            onChange={(e) => onChange({ nameKey: e.target.value })}
          />
        </Field>
        <Field label={t('debts.field.kind')} htmlFor={idOf('kind')}>
          <select
            id={idOf('kind')}
            className={INPUT}
            value={loan.kind}
            onChange={(e) => onChange({ kind: e.target.value as LoanKind })}
          >
            {LOAN_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {t(`debts.kind.${kind}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('debts.field.currency')} htmlFor={idOf('currency')}>
          <select
            id={idOf('currency')}
            className={INPUT}
            value={loan.currency}
            onChange={(e) => onChange({ currency: e.target.value })}
          >
            {supportedCurrencyCodes().map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('debts.field.principal')} htmlFor={idOf('principal')}>
          <input
            id={idOf('principal')}
            type="number"
            min={0}
            className={INPUT}
            value={loan.principal}
            onChange={(e) => onChange({ principal: Number(e.target.value) })}
          />
        </Field>
        <Field label={t('debts.field.annualRate')} htmlFor={idOf('annualRate')}>
          <input
            id={idOf('annualRate')}
            type="number"
            step={0.01}
            className={INPUT}
            value={toPercent(loan.annualRate)}
            onChange={(e) => onChange({ annualRate: fromPercent(Number(e.target.value)) })}
          />
        </Field>
        <Field label={t('debts.field.termMonths')} htmlFor={idOf('term')}>
          <input
            id={idOf('term')}
            type="number"
            min={1}
            className={INPUT}
            value={loan.termMonths}
            onChange={(e) => onChange({ termMonths: Number(e.target.value) })}
          />
        </Field>
        <Field label={t('debts.field.system')} htmlFor={idOf('system')}>
          <select
            id={idOf('system')}
            className={INPUT}
            value={loan.system}
            onChange={(e) => onChange({ system: e.target.value as AmortizationSystem })}
          >
            {SYSTEMS.map((system) => (
              <option key={system} value={system}>
                {t(`debts.system.${system}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('debts.field.startMonth')} htmlFor={idOf('start')}>
          <input
            id={idOf('start')}
            type="number"
            min={0}
            className={INPUT}
            value={loan.startMonth}
            onChange={(e) => onChange({ startMonth: Number(e.target.value) })}
          />
        </Field>
        <Field label={t('debts.field.earlyExitPenaltyRate')} htmlFor={idOf('penalty')}>
          <input
            id={idOf('penalty')}
            type="number"
            step={0.01}
            min={0}
            className={INPUT}
            value={toPercent(loan.earlyExitPenaltyRate)}
            onChange={(e) =>
              onChange({ earlyExitPenaltyRate: fromPercent(Number(e.target.value)) })
            }
          />
        </Field>
        <div className="flex items-end gap-2">
          <input
            id={idOf('deductible')}
            type="checkbox"
            checked={loan.interestDeductible}
            onChange={(e) => onChange({ interestDeductible: e.target.checked })}
          />
          <label className="text-sm text-slate-700" htmlFor={idOf('deductible')}>
            {t('debts.field.interestDeductible')}
          </label>
        </div>
      </div>
      <div className="mt-3 flex justify-end">
        <button type="button" className={DANGER_BUTTON} onClick={onDelete}>
          {t('debts.delete')}
        </button>
      </div>
    </li>
  )
}

export function DebtsTab() {
  const { t } = useTranslation()
  const scenario = useScenarioStore((s) => s.scenario)
  const setScenario = useScenarioStore((s) => s.setScenario)

  const setLoans = (loans: readonly Loan[]): void => setScenario({ ...scenario, loans })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-slate-600">{t('debts.title')}</h3>
        <button
          type="button"
          className={PRIMARY_BUTTON}
          onClick={() => setLoans([...scenario.loans, blankLoan(scenario.baseCurrency)])}
        >
          {t('debts.add')}
        </button>
      </div>

      {scenario.loans.length === 0 ? (
        <p className="text-sm text-slate-500">{t('debts.empty')}</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {scenario.loans.map((loan) => (
            <LoanCard
              key={loan.id}
              loan={loan}
              onChange={(patch) => setLoans(updateLoan(scenario.loans, loan.id, patch))}
              onDelete={() => setLoans(removeLoan(scenario.loans, loan.id))}
            />
          ))}
        </ul>
      )}
    </div>
  )
}
