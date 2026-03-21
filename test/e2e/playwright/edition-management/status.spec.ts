import { expect, test } from '@nuxt/test-utils/playwright'

import { getEditionStatus, loadState, setEditionStatus } from '../helpers'

test.describe.serial("Gestion du statut d'une édition", () => {
  test("s'assurer que l'édition est OFFLINE au départ", async ({ page }) => {
    const { editionId } = loadState()
    await setEditionStatus(page, editionId, 'OFFLINE')
  })

  test("l'édition a bien le statut OFFLINE", async ({ page }) => {
    const { editionId } = loadState()

    const status = await getEditionStatus(page, editionId)
    expect(status).toBe('OFFLINE')
  })

  test('passer le statut en PUBLISHED via la page de gestion', async ({ page, goto }) => {
    const { editionId } = loadState()

    await goto(`/editions/${editionId}/gestion`, { waitUntil: 'hydration' })

    // Scoper le combobox à la section statut
    const statusSection = page.locator('div:has(> div > h2:text-matches("statut", "i"))').first()
    await expect(statusSection).toBeVisible({ timeout: 10000 })

    const statusSelect = statusSection.locator('[role="combobox"]')
    await statusSelect.click()
    await page.getByRole('option', { name: /publi/i }).click()

    // Le bouton "Enregistrer" doit apparaître (changement détecté)
    const saveButton = statusSection.getByRole('button', { name: /enregistrer/i })
    await expect(saveButton).toBeVisible({ timeout: 3000 })

    // Sauvegarder et attendre la réponse API
    const [response] = await Promise.all([
      page.waitForResponse(
        (res) =>
          res.url().includes(`/api/editions/${editionId}/status`) &&
          res.request().method() === 'PATCH'
      ),
      saveButton.click(),
    ])

    expect(response.ok()).toBe(true)

    // Un toast de succès doit apparaître
    await expect(page.getByText(/statut.*mis à jour|status.*updated/i).first()).toBeVisible({
      timeout: 5000,
    })
  })

  test("l'édition a bien le statut PUBLISHED", async ({ page }) => {
    const { editionId } = loadState()

    const status = await getEditionStatus(page, editionId)
    expect(status).toBe('PUBLISHED')
  })

  test('repasser le statut en OFFLINE', async ({ page, goto }) => {
    const { editionId } = loadState()

    await goto(`/editions/${editionId}/gestion`, { waitUntil: 'hydration' })

    const statusSection = page.locator('div:has(> div > h2:text-matches("statut", "i"))').first()
    await expect(statusSection).toBeVisible({ timeout: 10000 })

    const statusSelect = statusSection.locator('[role="combobox"]')
    await statusSelect.click()
    await page.getByRole('option', { name: /hors ligne|offline/i }).click()

    const saveButton = statusSection.getByRole('button', { name: /enregistrer/i })
    await expect(saveButton).toBeVisible({ timeout: 3000 })

    const [response] = await Promise.all([
      page.waitForResponse(
        (res) =>
          res.url().includes(`/api/editions/${editionId}/status`) &&
          res.request().method() === 'PATCH'
      ),
      saveButton.click(),
    ])

    expect(response.ok()).toBe(true)
  })

  test("l'édition a bien le statut OFFLINE après le changement", async ({ page }) => {
    const { editionId } = loadState()

    const status = await getEditionStatus(page, editionId)
    expect(status).toBe('OFFLINE')
  })
})
