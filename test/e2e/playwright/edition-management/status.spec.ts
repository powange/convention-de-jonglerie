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
 * Ouvre la page d'accueil dans un contexte vierge (visiteur non connecté)
 * et retourne la page. Le contexte est fermé automatiquement après usage.
 */
async function openAsVisitor(page: import('@playwright/test').Page) {
  const browser = page.context().browser()!
  const publicContext = await browser.newContext()
  const publicPage = await publicContext.newPage()
  await publicPage.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' })
  return { publicPage, publicContext }
}

test.describe.serial("Gestion du statut d'une édition", () => {
  test("l'édition est OFFLINE par défaut", async ({ page, goto }) => {
    const { editionId } = loadState()

    await goto(`/editions/${editionId}/gestion`, { waitUntil: 'hydration' })

    // La section statut doit être visible
    const statusSection = page.locator('div:has(> div > h2:text-matches("statut", "i"))').first()
    await expect(statusSection).toBeVisible({ timeout: 10000 })

    // Le select de statut doit afficher "Hors ligne"
    await expect(statusSection.getByText(/hors ligne|offline/i)).toBeVisible()
  })

  test("l'édition OFFLINE n'apparaît pas sur la page d'accueil", async ({ page }) => {
    const { name } = loadState()

    // Nouveau contexte sans session (visiteur non connecté)
    const { publicPage, publicContext } = await openAsVisitor(page)

    try {
      await publicPage.waitForSelector('main', { timeout: 10000 })
      await expect(publicPage.getByText(name)).not.toBeVisible({ timeout: 3000 })
    } finally {
      await publicContext.close()
    }
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

  test("l'édition PUBLISHED est visible sur la page d'accueil", async ({ page }) => {
    const { name } = loadState()

    const { publicPage, publicContext } = await openAsVisitor(page)

    try {
      await publicPage.waitForSelector('a[href*="/editions/"]', { timeout: 10000 })
      await expect(publicPage.getByText(name).first()).toBeVisible({ timeout: 5000 })
    } finally {
      await publicContext.close()
    }
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
    const { name } = loadState()

    const { publicPage, publicContext } = await openAsVisitor(page)

    try {
      await publicPage.waitForSelector('main', { timeout: 10000 })
      await expect(publicPage.getByText(name)).not.toBeVisible({ timeout: 3000 })
    } finally {
      await publicContext.close()
    }
  })
})
