import { expect, test } from '@nuxt/test-utils/playwright'

import { loadState, setEditionStatus } from '../helpers'

const UPDATED_CITY = 'Lyon E2E'
const UPDATED_ADDRESS = '42 Rue de la Jonglerie'
const EDITION_NAME = `Édition E2E ${Date.now()}`

test.describe.serial("Modification des informations générales d'une édition", () => {
  test("modifier le nom, l'adresse et la ville", async ({ page, goto }) => {
    const { editionId } = loadState()

    await goto(`/editions/${editionId}/gestion/general-info`, { waitUntil: 'hydration' })

    // Attendre que le formulaire soit chargé
    await page.waitForSelector('input', { timeout: 10000 })

    // Modifier le nom de l'édition
    const nameInput = page.locator('input').first()
    await nameInput.clear()
    await nameInput.fill(EDITION_NAME)

    // Modifier l'adresse (addressLine1)
    const addressInput = page.getByPlaceholder(/123.*jonglerie/i)
    await addressInput.clear()
    await addressInput.fill(UPDATED_ADDRESS)

    // Modifier la ville
    const cityField = page.getByLabel(/ville|city/i)
    await cityField.clear()
    await cityField.fill(UPDATED_CITY)

    // Cliquer sur Enregistrer et attendre la réponse API
    const saveButton = page.getByRole('button', { name: /enregistrer/i })
    await saveButton.scrollIntoViewIfNeeded()

    const [response] = await Promise.all([
      page.waitForResponse(
        (res) =>
          res.url().includes(`/api/editions/${editionId}`) && res.request().method() === 'PUT'
      ),
      saveButton.click(),
    ])

    expect(response.ok()).toBe(true)

    // Toast de succès
    await expect(page.getByText(/enregistr|sauvegard|succès|saved/i).first()).toBeVisible({
      timeout: 5000,
    })
  })

  /**
   * Le bouton qui ouvre un lien externe, au bout de chaque champ d'adresse.
   *
   * Ce qui se vérifie ici tient en deux points, et ce sont les deux qui peuvent casser en
   * silence : le bouton reste ÉTEINT tant qu'il n'y a rien à ouvrir — un champ vide, ou une
   * adresse sans protocole comme « www.exemple.org », qui est ce qu'on colle le plus souvent —
   * et il s'allume dès que l'adresse est suivable.
   *
   * La page n'était couverte par aucun test : elle est rendue côté client derrière
   * `auth-protected`, et un `curl` y reçoit la coquille de l'application avec un franc 200.
   */
  test('le bouton d’ouverture suit la validité du lien', async ({ page, goto }) => {
    const { editionId } = loadState()

    const exceptions: string[] = []
    page.on('pageerror', (erreur) => exceptions.push(String(erreur)))

    await goto(`/editions/${editionId}/gestion/external-links`, { waitUntil: 'hydration' })

    // Désigné par son rôle et son nom, jamais par sa position : la page en porte cinq
    // identiques, et un index se décalerait au premier champ ajouté.
    const champ = page.getByRole('textbox').first()
    const bouton = page.getByRole('button', { name: /ouvrir dans un nouvel onglet/i }).first()

    await expect(champ).toBeVisible({ timeout: 15000 })
    await expect(bouton).toBeDisabled()

    // Ce qu'on colle le plus souvent, et qui n'est pas suivable en l'état.
    await champ.fill('www.exemple.org')
    await expect(bouton).toBeDisabled()

    await champ.fill('https://www.exemple.org')
    await expect(bouton).toBeEnabled()

    expect(exceptions, `exceptions : ${exceptions.join(' | ')}`).toEqual([])
  })

  test('les modifications sont persistées après rechargement', async ({ page, goto }) => {
    const { editionId } = loadState()

    await goto(`/editions/${editionId}/gestion/general-info`, { waitUntil: 'hydration' })
    await page.waitForSelector('input', { timeout: 10000 })

    // Le nom doit contenir la valeur modifiée
    await expect(page.locator('input').first()).toHaveValue(EDITION_NAME)

    // L'adresse doit contenir la valeur modifiée
    await expect(page.getByPlaceholder(/123.*jonglerie/i)).toHaveValue(UPDATED_ADDRESS)

    // La ville doit contenir la valeur modifiée
    await expect(page.getByLabel(/ville|city/i)).toHaveValue(UPDATED_CITY)
  })

  test("publier l'édition pour vérifier les infos côté public", async ({ page, goto }) => {
    const { editionId } = loadState()

    await goto(`/editions/${editionId}/gestion`, { waitUntil: 'hydration' })

    // Changer le statut en PUBLISHED
    const statusSection = page.locator('div:has(> div > h2:text-matches("statut", "i"))').first()
    await expect(statusSection).toBeVisible({ timeout: 10000 })

    const statusSelect = statusSection.locator('[role="combobox"]')
    await statusSelect.click()
    await page.getByRole('option', { name: /publi/i }).click()

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

  test('la page publique affiche les infos modifiées', async ({ page }) => {
    const { editionId } = loadState()

    // Vérifier les infos via l'API publique de l'édition
    const response = await page.request.get(`http://localhost:3000/api/editions/${editionId}`)
    expect(response.ok()).toBe(true)

    const body = await response.json()
    const edition = body.data || body

    expect(edition.name).toBe(EDITION_NAME)
    expect(edition.addressLine1).toBe(UPDATED_ADDRESS)
    expect(edition.city).toBe(UPDATED_CITY)
  })

  test("remettre l'édition en OFFLINE", async ({ page, goto }) => {
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
})
