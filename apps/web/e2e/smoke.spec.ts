import { expect, test } from '@playwright/test'

test('carga el comparador y muestra una recomendacion sobre el escenario por defecto', async ({
  page,
}) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'investing-helper' })).toBeVisible()
  await expect(page.getByText(/es la mejor opción/)).toBeVisible()

  // Las tres estrategias del escenario por defecto aparecen en el ranking.
  await expect(page.getByRole('cell', { name: 'Renta variable' })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'Cuenta corriente' })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'Bonos' })).toBeVisible()
})

test('un hash que no es ninguna pestaña conocida avisa de que no esta construida', async ({
  page,
}) => {
  await page.goto('/#/no-existe')
  await expect(page.getByText(/todavía no está construida/)).toBeVisible()
})

test('Monte Carlo avisa de que hay que activarlo en Supuestos', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText(/es la mejor opción/)).toBeVisible()

  await page.getByRole('button', { name: 'Monte Carlo' }).click()

  await expect(page.getByText(/Monte Carlo no está activado/)).toBeVisible()
  await expect(page).toHaveURL(/#\/montecarlo$/)
})

test('la pestaña de Escenarios guarda el escenario activo en la biblioteca', async ({ page }) => {
  await page.goto('/#/scenarios')

  await expect(page.getByText('Escenario activo')).toBeVisible()
  await expect(page.getByText('Todavía no has guardado ningún escenario.')).toBeVisible()

  await page.getByRole('button', { name: 'Guardar en la biblioteca' }).click()

  await expect(page.getByText('Todavía no has guardado ningún escenario.')).toBeHidden()
  await expect(page.getByRole('button', { name: 'Cargar' })).toBeVisible()
})
