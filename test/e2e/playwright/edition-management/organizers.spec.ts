import { expect, test } from '@nuxt/test-utils/playwright'

import { loadState } from '../helpers'

test.describe.serial("Gestion des organisateurs d'une édition", () => {
  test('la page organisateurs est accessible', async ({ page, goto }) => {
    const { editionId } = loadState()

    await goto(`/editions/${editionId}/gestion/organizers`, { waitUntil: 'hydration' })

    // Le titre de la section organisateurs de convention doit être visible
    await expect(
      page
        .locator('h2')
        .filter({ hasText: /organisateur/i })
        .first()
    ).toBeVisible({
      timeout: 10000,
    })

    // Le bouton "Ajouter" pour les organisateurs de convention doit être visible
    await expect(page.getByRole('button', { name: /ajouter/i }).first()).toBeVisible()
  })

  test("ouvrir la modale d'ajout d'organisateur", async ({ page, goto }) => {
    const { editionId } = loadState()

    await goto(`/editions/${editionId}/gestion/organizers`, { waitUntil: 'hydration' })
    await page.waitForSelector('h2', { timeout: 10000 })

    // Le bouton "Ajouter" à côté de "Historique" dans la section liste
    // C'est le premier bouton "Ajouter" dans la page (section convention)
    const addButtons = page.getByRole('button', { name: /ajouter/i })
    await addButtons.first().click()

    // La modale doit s'ouvrir
    const modal = page.getByRole('dialog')
    await expect(modal).toBeVisible({ timeout: 5000 })

    // Le titre de la modale
    await expect(modal.getByText(/ajouter un organisateur/i)).toBeVisible()

    // Fermer la modale
    await page.keyboard.press('Escape')
    await expect(modal).not.toBeVisible({ timeout: 3000 })
  })

  test("la section organisateurs d'édition est visible", async ({ page, goto }) => {
    const { editionId } = loadState()

    await goto(`/editions/${editionId}/gestion/organizers`, { waitUntil: 'hydration' })
    await page.waitForSelector('h2', { timeout: 10000 })

    // La section "Organisateurs présents sur cette édition" doit exister
    // Elle contient un tableau ou un message "Aucun organisateur"
    const editionSection = page
      .locator('h2')
      .filter({ hasText: /présent|édition/i })
      .first()
    await expect(editionSection).toBeVisible({ timeout: 5000 })
  })

  test("rechercher un utilisateur dans la modale d'ajout", async ({ page, goto }) => {
    const { editionId } = loadState()

    await goto(`/editions/${editionId}/gestion/organizers`, { waitUntil: 'hydration' })
    await page.waitForSelector('h2', { timeout: 10000 })

    // Ouvrir la modale
    await page
      .getByRole('button', { name: /ajouter/i })
      .first()
      .click()
    const modal = page.getByRole('dialog')
    await expect(modal).toBeVisible({ timeout: 5000 })

    // Le bouton "Ajouter" dans la modale doit être désactivé (pas d'utilisateur sélectionné)
    const addButton = modal.getByRole('button', { name: /ajouter/i })
    await expect(addButton).toBeDisabled()

    // Fermer
    await page.keyboard.press('Escape')
  })
})
