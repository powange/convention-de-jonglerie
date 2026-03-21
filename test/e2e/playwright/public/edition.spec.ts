import { expect, test } from '@nuxt/test-utils/playwright'
import type { Page } from '@playwright/test'

async function navigateToFirstEdition(
  page: Page,
  goto: (url: string, options?: Record<string, unknown>) => Promise<unknown>
) {
  await goto('/', { waitUntil: 'hydration' })
  await page.waitForSelector('a[href*="/editions/"]', { timeout: 10000 })

  const firstEditionLink = page.locator('a[href*="/editions/"]').first()
  const href = await firstEditionLink.getAttribute('href')
  expect(href).toBeTruthy()

  await goto(href!, { waitUntil: 'hydration' })
}

test.describe("Page d'une édition", () => {
  test("affiche les détails d'une édition", async ({ page, goto }) => {
    await navigateToFirstEdition(page, goto)

    // La page doit contenir un titre (h1)
    await expect(page.locator('h1')).toBeVisible()

    // La page doit afficher le header
    await expect(page.locator('header')).toBeVisible()
  })

  test('affiche le bouton "En savoir plus sur la convention"', async ({ page, goto }) => {
    await navigateToFirstEdition(page, goto)

    // Le bouton d'info convention doit être présent
    const infoButton = page.getByText(/en savoir plus sur la convention/i)
    await expect(infoButton).toBeVisible()

    // Cliquer pour ouvrir la modale
    await infoButton.click()

    // La modale doit s'ouvrir avec du contenu
    await expect(page.locator('[role="dialog"]')).toBeVisible()
  })

  test('affiche les onglets de navigation', async ({ page, goto }) => {
    await navigateToFirstEdition(page, goto)

    // L'onglet "À propos" doit être visible
    await expect(page.getByText(/à propos/i).first()).toBeVisible()
  })
})
