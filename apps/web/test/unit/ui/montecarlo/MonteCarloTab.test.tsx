import { compareStrategies } from '@investing-helper/core/application'
import {
  defaultMonteCarlo,
  defaultScenario,
  type Scenario,
} from '@investing-helper/core/domain/model'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { MonteCarloTab } from '../../../../src/ui/features/montecarlo/MonteCarloTab'
import { useScenarioStore } from '../../../../src/ui/store/scenarioStore'

function setScenario(scenario: Scenario): void {
  useScenarioStore.setState({
    scenario,
    comparison: compareStrategies(scenario),
    monteCarloResult: null,
  })
}

beforeEach(() => {
  window.localStorage.clear()
})

afterEach(() => {
  cleanup()
})

describe('MonteCarloTab', () => {
  it('sin Monte Carlo activado, avisa de que hay que activarlo', () => {
    setScenario(defaultScenario())
    render(<MonteCarloTab />)
    expect(screen.getByText(/Monte Carlo no está activado/)).toBeTruthy()
  })

  it('activado pero sin estrategia de renta variable, avisa de que anada una', () => {
    setScenario({
      ...defaultScenario(),
      strategies: [{ type: 'cash', annualRate: 0.01 }],
      assumptions: { ...defaultScenario().assumptions, monteCarlo: defaultMonteCarlo() },
    })
    render(<MonteCarloTab />)
    expect(screen.getByText(/No hay ninguna estrategia de renta variable/)).toBeTruthy()
  })

  it('ejecutar Monte Carlo muestra percentiles y probabilidades', () => {
    setScenario({
      ...defaultScenario(),
      assumptions: {
        ...defaultScenario().assumptions,
        monteCarlo: { ...defaultMonteCarlo(), paths: 20 },
      },
    })
    render(<MonteCarloTab />)

    expect(screen.queryByText(/Mediana/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Ejecutar Monte Carlo' }))

    expect(screen.getByText(/Mediana/)).toBeTruthy()
    expect(screen.getByText(/20 trayectorias/)).toBeTruthy()
    expect(useScenarioStore.getState().monteCarloResult?.finalValues).toHaveLength(20)
  })

  it('cambiar de escenario limpia el resultado anterior', () => {
    setScenario({
      ...defaultScenario(),
      assumptions: {
        ...defaultScenario().assumptions,
        monteCarlo: { ...defaultMonteCarlo(), paths: 10 },
      },
    })
    render(<MonteCarloTab />)
    fireEvent.click(screen.getByRole('button', { name: 'Ejecutar Monte Carlo' }))
    expect(useScenarioStore.getState().monteCarloResult).not.toBeNull()

    useScenarioStore.getState().setScenario(defaultScenario())
    expect(useScenarioStore.getState().monteCarloResult).toBeNull()
  })
})
