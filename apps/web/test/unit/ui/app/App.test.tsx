import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

// El orden importa: `container` registra los motores del dominio como efecto
// secundario de importarlo. `App` (via el store de escenario) llama a
// `compareStrategies` en cuanto se importa, no solo al montar, asi que los
// motores tienen que estar registrados antes de que ese import se resuelva.
import '../../../../src/container'
import { App } from '../../../../src/app/App'

beforeEach(() => {
  window.location.hash = ''
})

afterEach(() => {
  cleanup()
})

describe('App', () => {
  it('arranca en la pestaña de comparacion y muestra una recomendacion real', async () => {
    render(<App />)

    expect(await screen.findByText('Comparador')).toBeTruthy()
    expect(await screen.findByText(/es la mejor opción/)).toBeTruthy()
    // Las tres estrategias del escenario por defecto aparecen en el ranking.
    expect(screen.getByText('Renta variable')).toBeTruthy()
    expect(screen.getByText('Cuenta corriente')).toBeTruthy()
    expect(screen.getByText('Bonos')).toBeTruthy()
  })

  it('cambiar a una pestaña sin construir actualiza el hash y avisa', async () => {
    render(<App />)
    await screen.findByText('Comparador')

    screen.getByRole('button', { name: 'Monte Carlo' }).click()

    expect(await screen.findByText(/todavía no está construida/)).toBeTruthy()
    expect(window.location.hash).toBe('#/montecarlo')
  })

  it('la pestaña de Escenarios muestra el escenario activo y su biblioteca', async () => {
    render(<App />)
    await screen.findByText('Comparador')

    screen.getByRole('button', { name: 'Escenarios' }).click()

    expect(await screen.findByText('Escenario activo')).toBeTruthy()
    expect(screen.getByText('Biblioteca')).toBeTruthy()
    expect(window.location.hash).toBe('#/scenarios')
  })
})
