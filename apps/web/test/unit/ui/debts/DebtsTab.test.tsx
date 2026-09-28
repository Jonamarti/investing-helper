import { compareStrategies } from '@investing-helper/core/application'
import { defaultScenario, type Scenario } from '@investing-helper/core/domain/model'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { DebtsTab } from '../../../../src/ui/features/debts/DebtsTab'
import { useScenarioStore } from '../../../../src/ui/store/scenarioStore'

function setScenario(scenario: Scenario): void {
  useScenarioStore.setState({ scenario, comparison: compareStrategies(scenario) })
}

beforeEach(() => {
  window.localStorage.clear()
})

afterEach(() => {
  cleanup()
})

describe('DebtsTab', () => {
  it('sin prestamos, avisa de que la lista esta vacia', () => {
    setScenario({ ...defaultScenario(), loans: [] })
    render(<DebtsTab />)
    expect(screen.getByText('No hay préstamos en este escenario.')).toBeTruthy()
  })

  it('el escenario por defecto muestra su hipoteca', () => {
    setScenario(defaultScenario())
    render(<DebtsTab />)
    expect(screen.getByDisplayValue('loan.default.mortgage')).toBeTruthy()
  })

  it('anadir crea un prestamo nuevo con la divisa del escenario', () => {
    setScenario({ ...defaultScenario(), loans: [] })
    render(<DebtsTab />)

    fireEvent.click(screen.getByRole('button', { name: 'Añadir préstamo' }))

    expect(useScenarioStore.getState().scenario.loans).toHaveLength(1)
    expect(useScenarioStore.getState().scenario.loans[0]?.currency).toBe('EUR')
  })

  it('editar el nombre actualiza el prestamo en el escenario', () => {
    setScenario(defaultScenario())
    render(<DebtsTab />)

    const nameInput = screen.getByDisplayValue('loan.default.mortgage')
    fireEvent.change(nameInput, { target: { value: 'Mi hipoteca' } })

    expect(useScenarioStore.getState().scenario.loans[0]?.nameKey).toBe('Mi hipoteca')
  })

  it('editar el interes anual convierte de porcentaje a fraccion', () => {
    setScenario(defaultScenario())
    render(<DebtsTab />)

    const loanId = useScenarioStore.getState().scenario.loans[0]!.id
    const rateInput = document.getElementById(`loan-${loanId}-annualRate`) as HTMLInputElement
    // 0.041 * 100 no es exactamente "4.1" en coma flotante; solo importa que
    // el cambio de vuelta convierta bien.
    fireEvent.change(rateInput, { target: { value: '5' } })

    expect(useScenarioStore.getState().scenario.loans[0]?.annualRate).toBeCloseTo(0.05, 10)
  })

  it('borrar quita el prestamo del escenario', () => {
    setScenario(defaultScenario())
    render(<DebtsTab />)

    fireEvent.click(screen.getByRole('button', { name: 'Borrar' }))

    expect(useScenarioStore.getState().scenario.loans).toEqual([])
    expect(screen.getByText('No hay préstamos en este escenario.')).toBeTruthy()
  })
})
