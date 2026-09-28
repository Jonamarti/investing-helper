import { compareStrategies } from '@investing-helper/core/application'
import { defaultScenario, type Scenario } from '@investing-helper/core/domain/model'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { AssumptionsTab } from '../../../../src/ui/features/assumptions/AssumptionsTab'
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

describe('AssumptionsTab', () => {
  it('edita la inflacion y el horizonte del escenario', () => {
    render(<AssumptionsTab />)

    fireEvent.change(document.getElementById('inflation')!, { target: { value: '3' } })
    fireEvent.change(document.getElementById('horizon')!, { target: { value: '120' } })

    const { assumptions } = useScenarioStore.getState().scenario
    expect(assumptions.inflationAnnual).toBeCloseTo(0.03, 10)
    expect(assumptions.horizonMonths).toBe(120)
  })

  it('activar Monte Carlo anade los ajustes por defecto, desactivarlo los quita', () => {
    render(<AssumptionsTab />)
    expect(useScenarioStore.getState().scenario.assumptions.monteCarlo).toBeNull()

    fireEvent.click(document.getElementById('montecarlo-enable')!)
    expect(useScenarioStore.getState().scenario.assumptions.monteCarlo).not.toBeNull()
    expect((document.getElementById('mc-paths') as HTMLInputElement).value).toBe('1000')

    fireEvent.click(document.getElementById('montecarlo-enable')!)
    expect(useScenarioStore.getState().scenario.assumptions.monteCarlo).toBeNull()
  })

  it('anadir una estrategia la agrega con sus valores por defecto', () => {
    render(<AssumptionsTab />)
    const before = useScenarioStore.getState().scenario.strategies.length

    fireEvent.click(screen.getByRole('button', { name: 'Añadir estrategia' }))

    const strategies = useScenarioStore.getState().scenario.strategies
    expect(strategies).toHaveLength(before + 1)
    expect(strategies.at(-1)?.type).toBe('cash')
  })

  it('quitar una estrategia la elimina del escenario', () => {
    render(<AssumptionsTab />)
    const before = useScenarioStore.getState().scenario.strategies.length

    fireEvent.click(screen.getAllByRole('button', { name: 'Quitar' })[0]!)

    expect(useScenarioStore.getState().scenario.strategies).toHaveLength(before - 1)
  })

  it('editar un campo de una estrategia actualiza sus parametros', () => {
    render(<AssumptionsTab />)
    const cashIndex = useScenarioStore
      .getState()
      .scenario.strategies.findIndex((s) => s.type === 'cash')

    const input = document.getElementById(`strategy-${cashIndex}-annualRate`) as HTMLInputElement
    fireEvent.change(input, { target: { value: '2' } })

    const strategy = useScenarioStore.getState().scenario.strategies[cashIndex]
    expect(strategy?.type).toBe('cash')
    expect(strategy && 'annualRate' in strategy ? strategy.annualRate : null).toBeCloseTo(0.02, 10)
  })

  it('una estrategia de amortizar deuda muestra los prestamos del escenario para elegir', () => {
    setScenario({
      ...defaultScenario(),
      strategies: [
        {
          type: 'debtPaydown',
          loanIds: [],
          order: 'avalanche',
          goal: 'shortenTerm',
          hurdleRate: 0,
        },
      ],
    })
    render(<AssumptionsTab />)

    const loanId = useScenarioStore.getState().scenario.loans[0]!.id
    const checkbox = screen.getByRole('checkbox', { name: 'loan.default.mortgage' })
    fireEvent.click(checkbox)

    const strategy = useScenarioStore.getState().scenario.strategies[0]
    expect(strategy?.type === 'debtPaydown' ? strategy.loanIds : null).toEqual([loanId])
  })

  it('una cartera mixta permite anadir y quitar componentes', () => {
    setScenario({
      ...defaultScenario(),
      strategies: [
        {
          type: 'mixed',
          rebalanceEveryMonths: 12,
          components: [{ kind: 'cash', weight: 1, params: { annualRate: 0.01 } }],
        },
      ],
    })
    render(<AssumptionsTab />)

    fireEvent.click(screen.getByRole('button', { name: 'Añadir componente' }))
    let strategy = useScenarioStore.getState().scenario.strategies[0]
    expect(strategy?.type === 'mixed' ? strategy.components : []).toHaveLength(2)

    fireEvent.click(screen.getAllByRole('button', { name: 'Quitar' }).at(-1)!)
    strategy = useScenarioStore.getState().scenario.strategies[0]
    expect(strategy?.type === 'mixed' ? strategy.components : []).toHaveLength(1)
  })
})
