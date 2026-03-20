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

test.describe.serial("Activation et désactivation des fonctionnalités d'une édition", () => {
  const features = [
    { label: /gestion des bénévoles/i, dashboardSection: /gestion des bénévoles/i },
    { label: /repas/i, dashboardSection: /repas/i },
    { label: /artistes/i, dashboardSection: /artistes/i },
    { label: /billetterie/i, dashboardSection: /billetterie/i },
    { label: /ateliers/i, dashboardSection: /ateliers/i },
  ]

  test('toutes les features sont désactivées par défaut', async ({ page, goto }) => {
    const { editionId } = loadState()

    await goto(`/editions/${editionId}/gestion/features`, { waitUntil: 'hydration' })

    // Attendre que la page soit complètement chargée
    await page.waitForSelector('h1', { timeout: 15000 })

    // Tous les switches doivent être décochés (aria-checked="false")
    const switches = page.getByRole('switch')
    const count = await switches.count()
    expect(count).toBeGreaterThanOrEqual(5)

    for (let i = 0; i < count; i++) {
      await expect(switches.nth(i)).toHaveAttribute('aria-checked', 'false')
    }
  })

  test('le dashboard ne montre pas les sections des features désactivées', async ({
    page,
    goto,
  }) => {
    const { editionId } = loadState()

    await goto(`/editions/${editionId}/gestion`, { waitUntil: 'hydration' })
    await page.waitForSelector('h2', { timeout: 10000 })

    for (const feature of features) {
      await expect(
        page.locator('h2').filter({ hasText: feature.dashboardSection })
      ).not.toBeVisible({ timeout: 2000 })
    }
  })

  test('activer les bénévoles et la billetterie', async ({ page, goto }) => {
    const { editionId } = loadState()

    await goto(`/editions/${editionId}/gestion/features`, { waitUntil: 'hydration' })
    await page.waitForSelector('[role="switch"]', { timeout: 10000 })

    // Les switches sont dans l'ordre : bénévoles(0), repas(1), artistes(2), billetterie(3), workshops(4), carte(5)
    const switches = page.getByRole('switch')

    // Activer les bénévoles (index 0)
    const [response1] = await Promise.all([
      page.waitForResponse(
        (res) =>
          res.url().includes(`/api/editions/${editionId}`) && res.request().method() === 'PUT'
      ),
      switches.nth(0).click(),
    ])
    expect(response1.ok()).toBe(true)

    // Activer la billetterie (index 3)
    const [response2] = await Promise.all([
      page.waitForResponse(
        (res) =>
          res.url().includes(`/api/editions/${editionId}`) && res.request().method() === 'PUT'
      ),
      switches.nth(3).click(),
    ])
    expect(response2.ok()).toBe(true)
  })

  test('le dashboard affiche les sections bénévoles et billetterie', async ({ page, goto }) => {
    const { editionId } = loadState()

    await goto(`/editions/${editionId}/gestion`, { waitUntil: 'hydration' })
    await page.waitForSelector('h2', { timeout: 10000 })

    // Sections activées doivent être visibles
    await expect(page.locator('h2').filter({ hasText: /gestion des bénévoles/i })).toBeVisible({
      timeout: 5000,
    })
    await expect(page.locator('h2').filter({ hasText: /billetterie/i })).toBeVisible({
      timeout: 5000,
    })

    // Sections non activées restent invisibles
    await expect(page.locator('h2').filter({ hasText: /artistes/i })).not.toBeVisible({
      timeout: 2000,
    })
  })

  test('désactiver les bénévoles et la billetterie', async ({ page, goto }) => {
    const { editionId } = loadState()

    await goto(`/editions/${editionId}/gestion/features`, { waitUntil: 'hydration' })
    await page.waitForSelector('[role="switch"]', { timeout: 10000 })

    const switches = page.getByRole('switch')

    // Désactiver les bénévoles (index 0)
    const [response1] = await Promise.all([
      page.waitForResponse(
        (res) =>
          res.url().includes(`/api/editions/${editionId}`) && res.request().method() === 'PUT'
      ),
      switches.nth(0).click(),
    ])
    expect(response1.ok()).toBe(true)

    // Désactiver la billetterie (index 3)
    const [response2] = await Promise.all([
      page.waitForResponse(
        (res) =>
          res.url().includes(`/api/editions/${editionId}`) && res.request().method() === 'PUT'
      ),
      switches.nth(3).click(),
    ])
    expect(response2.ok()).toBe(true)
  })

  test('le dashboard ne montre plus les sections désactivées', async ({ page, goto }) => {
    const { editionId } = loadState()

    await goto(`/editions/${editionId}/gestion`, { waitUntil: 'hydration' })
    await page.waitForSelector('h2', { timeout: 10000 })

    await expect(page.locator('h2').filter({ hasText: /gestion des bénévoles/i })).not.toBeVisible({
      timeout: 2000,
    })
    await expect(page.locator('h2').filter({ hasText: /billetterie/i })).not.toBeVisible({
      timeout: 2000,
    })
  })
})
