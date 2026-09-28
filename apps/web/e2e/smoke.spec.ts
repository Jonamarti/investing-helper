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

test('cambiar de pestaña actualiza el hash y el contenido, sin recargar la pagina', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.getByText(/es la mejor opción/)).toBeVisible()

  await page.getByRole('button', { name: 'Escenarios' }).click()

  await expect(page.getByText(/todavía no está construida/)).toBeVisible()
  await expect(page).toHaveURL(/#\/scenarios$/)
})
