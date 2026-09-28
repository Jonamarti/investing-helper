import { compareStrategies } from '@investing-helper/core/application'
import { defaultScenario } from '@investing-helper/core/domain/model'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ScenariosTab } from '../../../../src/ui/features/scenarios/ScenariosTab'
import { useScenarioStore } from '../../../../src/ui/store/scenarioStore'

/** El input del nombre activo, sin ambiguedad con las filas de la biblioteca. */
function activeNameInput(): HTMLInputElement {
  return document.getElementById('current-scenario-name') as HTMLInputElement
}

function resetStore(): void {
  window.localStorage.clear()
  const scenario = defaultScenario()
  useScenarioStore.setState({
    scenario,
    comparison: compareStrategies(scenario),
    library: [],
  })
}

beforeEach(() => {
  resetStore()
  // jsdom no implementa createObjectURL/revokeObjectURL.
  URL.createObjectURL = vi.fn(() => 'blob:mock')
  URL.revokeObjectURL = vi.fn()
})

afterEach(() => {
  cleanup()
})

describe('ScenariosTab', () => {
  it('empieza con el nombre del escenario por defecto y la biblioteca vacia', () => {
    render(<ScenariosTab />)
    expect(activeNameInput().value).toBe('Escenario por defecto')
    expect(screen.getByText('Todavía no has guardado ningún escenario.')).toBeTruthy()
  })

  it('guardar anade una entrada a la biblioteca', () => {
    render(<ScenariosTab />)
    fireEvent.click(screen.getByRole('button', { name: 'Guardar en la biblioteca' }))

    expect(activeNameInput().value).toBe('Escenario por defecto')
    expect(useScenarioStore.getState().library).toHaveLength(1)
  })

  it('guardar dos veces el mismo escenario actualiza la entrada, no la duplica', () => {
    render(<ScenariosTab />)
    fireEvent.click(screen.getByRole('button', { name: 'Guardar en la biblioteca' }))
    fireEvent.click(screen.getByRole('button', { name: 'Guardar en la biblioteca' }))

    expect(useScenarioStore.getState().library).toHaveLength(1)
  })

  it('duplicar crea una segunda entrada y activa la copia', () => {
    render(<ScenariosTab />)
    fireEvent.click(screen.getByRole('button', { name: 'Guardar en la biblioteca' }))
    fireEvent.click(screen.getByRole('button', { name: 'Duplicar' }))

    expect(useScenarioStore.getState().library).toHaveLength(2)
    // El escenario activo pasa a ser la copia, con su propio nombre.
    expect(activeNameInput().value).toBe('Escenario por defecto (2)')
  })

  it('renombrar en la biblioteca actualiza el nombre al perder el foco', () => {
    render(<ScenariosTab />)
    fireEvent.click(screen.getByRole('button', { name: 'Guardar en la biblioteca' }))

    const libraryInput = document.getElementById(
      `rename-${useScenarioStore.getState().scenario.id}`,
    ) as HTMLInputElement
    fireEvent.change(libraryInput, { target: { value: 'Mi escenario' } })
    fireEvent.blur(libraryInput)

    expect(useScenarioStore.getState().library[0]?.name).toBe('Mi escenario')
  })

  it('borrar quita la entrada de la biblioteca', () => {
    render(<ScenariosTab />)
    fireEvent.click(screen.getByRole('button', { name: 'Guardar en la biblioteca' }))
    fireEvent.click(screen.getByRole('button', { name: 'Borrar' }))

    expect(useScenarioStore.getState().library).toEqual([])
    expect(screen.getByText('Todavía no has guardado ningún escenario.')).toBeTruthy()
  })

  it('nuevo escenario en blanco cambia el id activo sin tocar la biblioteca', () => {
    render(<ScenariosTab />)
    fireEvent.click(screen.getByRole('button', { name: 'Guardar en la biblioteca' }))
    const savedId = useScenarioStore.getState().scenario.id

    fireEvent.click(screen.getByRole('button', { name: 'Nuevo escenario en blanco' }))

    expect(useScenarioStore.getState().scenario.id).not.toBe(savedId)
    expect(useScenarioStore.getState().library).toHaveLength(1)
  })

  it('exportar no revienta (createObjectURL esta mockeado)', () => {
    render(<ScenariosTab />)
    fireEvent.click(screen.getByRole('button', { name: 'Exportar a JSON' }))
    expect(URL.createObjectURL).toHaveBeenCalled()
  })

  it('importar un JSON valido carga ese escenario como activo', async () => {
    render(<ScenariosTab />)
    const imported = { ...defaultScenario(), id: 'importado-123' }
    const file = new File([JSON.stringify(imported)], 'escenario.json', {
      type: 'application/json',
    })

    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => {
      expect(useScenarioStore.getState().scenario.id).toBe('importado-123')
    })
  })

  it('importar un JSON invalido muestra el motivo del error', async () => {
    render(<ScenariosTab />)
    const file = new File(['{ esto no es json'], 'escenario.json', { type: 'application/json' })

    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [file] } })

    expect(await screen.findByText(/No se ha podido importar/)).toBeTruthy()
  })
})
