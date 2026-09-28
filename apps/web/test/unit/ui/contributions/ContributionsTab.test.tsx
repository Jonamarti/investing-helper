import { compareStrategies } from '@investing-helper/core/application'
import { defaultScenario, type Scenario } from '@investing-helper/core/domain/model'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { ContributionsTab } from '../../../../src/ui/features/contributions/ContributionsTab'
import { useScenarioStore } from '../../../../src/ui/store/scenarioStore'

function setScenario(scenario: Scenario): void {
  useScenarioStore.setState({ scenario, comparison: compareStrategies(scenario) })
}

beforeEach(() => {
  window.localStorage.clear()
  setScenario(defaultScenario())
})

afterEach(() => {
  cleanup()
})

describe('ContributionsTab', () => {
  it('edita el neto mensual y los gastos fijos', () => {
    render(<ContributionsTab />)

    fireEvent.change(document.getElementById('salary-net')!, { target: { value: '3000' } })
    fireEvent.change(document.getElementById('salary-fixed')!, { target: { value: '1000' } })

    const { salary } = useScenarioStore.getState().scenario
    expect(salary.netMonthly).toBe(3000)
    expect(salary.fixedCostsMonthly).toBe(1000)
  })

  it('marcar un mes de paga extra lo anade, desmarcarlo lo quita', () => {
    render(<ContributionsTab />)
    expect(useScenarioStore.getState().scenario.salary.extraPayMonths).toEqual([7, 12])

    fireEvent.click(screen.getByRole('checkbox', { name: '3' }))
    expect(useScenarioStore.getState().scenario.salary.extraPayMonths).toEqual([3, 7, 12])

    fireEvent.click(screen.getByRole('checkbox', { name: '7' }))
    expect(useScenarioStore.getState().scenario.salary.extraPayMonths).toEqual([3, 12])
  })

  it('edita el plan de aportaciones', () => {
    render(<ContributionsTab />)

    fireEvent.change(document.getElementById('plan-lumpsum')!, { target: { value: '10000' } })
    fireEvent.click(document.getElementById('plan-follow-salary')!)

    const plan = useScenarioStore.getState().scenario.contributionPlan
    expect(plan.initialLumpSum).toBe(10_000)
    expect(plan.followSalary).toBe(false)
  })

  it('el porcentaje de ahorro se convierte de puntos a fraccion', () => {
    render(<ContributionsTab />)
    fireEvent.change(document.getElementById('plan-savings')!, { target: { value: '50' } })
    expect(useScenarioStore.getState().scenario.contributionPlan.savingsRate).toBeCloseTo(0.5, 10)
  })

  it('anadir una correccion manual la guarda en overrides', () => {
    render(<ContributionsTab />)

    fireEvent.change(document.getElementById('override-month')!, { target: { value: '2027-03' } })
    fireEvent.change(document.getElementById('override-lumpsum')!, { target: { value: '500' } })
    fireEvent.click(screen.getByRole('button', { name: 'Añadir corrección' }))

    const { overrides } = useScenarioStore.getState().scenario.contributionPlan
    expect(overrides['2027-03']).toEqual({ lumpSum: 500 })
  })

  it('sin mes indicado, anadir no hace nada', () => {
    render(<ContributionsTab />)
    fireEvent.click(screen.getByRole('button', { name: 'Añadir corrección' }))
    expect(useScenarioStore.getState().scenario.contributionPlan.overrides).toEqual({})
  })

  it('borrar una correccion la quita de overrides', () => {
    setScenario({
      ...defaultScenario(),
      contributionPlan: {
        ...defaultScenario().contributionPlan,
        overrides: { '2027-03': { lumpSum: 500 } },
      },
    })
    render(<ContributionsTab />)

    fireEvent.click(screen.getByRole('button', { name: 'Borrar' }))

    expect(useScenarioStore.getState().scenario.contributionPlan.overrides).toEqual({})
  })
})
