import { expect, test } from '@nuxt/test-utils/playwright'

import { loadState, updateEdition } from '../helpers'

const BASE = 'http://localhost:3000'

/**
 * Smoke des repas (extraits en `layers/meals`). Le catalogue des repas est dérivé (généré depuis la
 * planif bénévoles), pas créé directement → on vérifie l'activation, le chargement de la page de
 * configuration et la réponse de l'API liste.
 */
test.describe.serial('Module Repas', () => {
  test.beforeAll(async () => {
    const { editionId } = loadState()
    if (!editionId) throw new Error('editionId manquant dans state.json (setup global non joué)')
  })

  test("activer les repas via l'API", async ({ page }) => {
    const { editionId } = loadState()
    await updateEdition(page, String(editionId), { mealsEnabled: true })
  })

  test('la page de configuration des repas se charge', async ({ page, goto }) => {
    const { editionId } = loadState()
    await goto(`/editions/${editionId}/gestion/meals`, { waitUntil: 'hydration' })
    await expect(
      page.getByRole('heading', { name: /configuration des repas/i }).first()
    ).toBeVisible({ timeout: 10000 })
  })

  test('GET meals répond', async ({ page }) => {
    const { editionId } = loadState()
    const response = await page.request.get(`${BASE}/api/editions/${editionId}/meals`)
    expect(response.ok()).toBe(true)
  })

  test('nettoyage : désactiver les repas', async ({ page }) => {
    const { editionId } = loadState()
    await updateEdition(page, String(editionId), { mealsEnabled: false })
  })
})
