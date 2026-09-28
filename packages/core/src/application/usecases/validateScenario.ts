import {
  findLoan,
  horizonOf,
  overridesOutsideHorizon,
  validateExtraPayMonths,
  type Scenario,
} from '../../domain/model'
import { validateStrategyParams, type ParamIssue } from '../../domain/params'

/** Un problema de validacion del escenario completo, con la ruta del campo afectado. */
export type ScenarioIssue = ParamIssue

function prefixed(issue: ParamIssue, prefix: string): ScenarioIssue {
  return { ...issue, path: `${prefix}.${issue.path}` }
}

/**
 * Valida un escenario completo: cada estrategia contra su catalogo
 * (`validateStrategyParams`), mas las reglas que solo tienen sentido mirando el
 * escenario entero (prestamos referenciados que existen, sin duplicados,
 * sueldo no negativo, pagas extra validas, overrides dentro del horizonte).
 *
 * Devuelve una lista vacia si todo es correcto: la UI decide si bloquear el
 * calculo con esto, no esta funcion.
 */
export function validateScenario(scenario: Scenario): readonly ScenarioIssue[] {
  const issues: ScenarioIssue[] = []

  if (scenario.strategies.length === 0) {
    issues.push({ path: 'strategies', messageKey: 'validation.needsAtLeastOneStrategy' })
  }

  scenario.strategies.forEach((params, index) => {
    const prefix = `strategies.${index}`
    for (const issue of validateStrategyParams(params)) {
      issues.push(prefixed(issue, prefix))
    }
    if (params.type === 'debtPaydown') {
      for (const loanId of params.loanIds) {
        if (!findLoan(scenario, loanId)) {
          issues.push({
            path: `${prefix}.loanIds`,
            messageKey: 'validation.unknownLoan',
            params: { loanId },
          })
        }
      }
    }
  })

  const seenLoanIds = new Set<string>()
  for (const loan of scenario.loans) {
    if (seenLoanIds.has(loan.id)) {
      issues.push({
        path: 'loans',
        messageKey: 'validation.duplicateLoanId',
        params: { loanId: loan.id },
      })
    }
    seenLoanIds.add(loan.id)
  }

  if (scenario.salary.netMonthly < 0) {
    issues.push({ path: 'salary.netMonthly', messageKey: 'validation.positiveRequired' })
  }
  if (scenario.salary.fixedCostsMonthly < 0) {
    issues.push({ path: 'salary.fixedCostsMonthly', messageKey: 'validation.positiveRequired' })
  }

  // `validateExtraPayMonths`/`overridesOutsideHorizon` devuelven texto plano,
  // no claves de i18n: se muestran tal cual hasta que tengan sus propias
  // claves (`validation.raw` de momento).
  for (const message of validateExtraPayMonths(scenario.salary.extraPayMonths)) {
    issues.push({
      path: 'salary.extraPayMonths',
      messageKey: 'validation.raw',
      params: { message },
    })
  }
  for (const message of overridesOutsideHorizon(
    scenario.contributionPlan,
    horizonOf(scenario),
    scenario.startYear,
    scenario.startMonth,
  )) {
    issues.push({
      path: 'contributionPlan.overrides',
      messageKey: 'validation.raw',
      params: { message },
    })
  }

  return issues
}

export function isValidScenario(scenario: Scenario): boolean {
  return validateScenario(scenario).length === 0
}
