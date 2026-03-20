import fs from 'node:fs'

import { expect, test } from '@nuxt/test-utils/playwright'

import { conventionStateFile } from '../../../../playwright.config'

interface ConventionState {
  conventionId: string
  editionId: string
  name: string
}

function loadState(): ConventionState {
  if (!fs.existsSync(conventionStateFile)) {
    throw new Error(`State file introuvable: ${conventionStateFile}. Lancer le data-setup d'abord.`)
  }
  return JSON.parse(fs.readFileSync(conventionStateFile, 'utf-8'))
}

/**
 * Vérifie si l'édition est visible sur la page d'accueil publique via l'API.
 * Retourne true si l'édition apparaît dans la liste publique.
 */
async function isEditionVisiblePublicly(
  page: import('@playwright/test').Page,
  editionId: string
): Promise<boolean> {
  // L'API publique des éditions ne nécessite pas d'auth
  const response = await page.request.get('http://localhost:3000/api/editions')
  if (!response.ok()) return false
  const body = await response.json()
  const editions = body.data || body
  return (
    Array.isArray(editions) &&
    editions.some((e: { id: number | string }) => String(e.id) === editionId)
  )
}

test.describe.serial("Gestion du statut d'une édition", () => {
  test("s'assurer que l'édition est OFFLINE au départ", async ({ page }) => {
    const { editionId } = loadState()

    // Forcer le statut OFFLINE via API pour être indépendant de l'ordre des fichiers
    const response = await page.request.patch(
      `http://localhost:3000/api/editions/${editionId}/status`,
      {
        data: { status: 'OFFLINE' },
      }
    )
    expect(response.ok()).toBe(true)
  })

  test("l'édition OFFLINE n'apparaît pas dans la liste publique", async ({ page }) => {
    const { editionId } = loadState()

    const visible = await isEditionVisiblePublicly(page, editionId)
    expect(visible).toBe(false)
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

  test("l'édition PUBLISHED est visible dans la liste publique", async ({ page }) => {
    const { editionId } = loadState()

    const visible = await isEditionVisiblePublicly(page, editionId)
    expect(visible).toBe(true)
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

  test("l'édition repassée OFFLINE n'est plus visible publiquement", async ({ page }) => {
    const { editionId } = loadState()

    const visible = await isEditionVisiblePublicly(page, editionId)
    expect(visible).toBe(false)
  })
})
