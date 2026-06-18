import { expect, test } from '@nuxt/test-utils/playwright'

import { apiPost, loadState, updateEdition } from '../helpers'

const BASE = 'http://localhost:3000'

/**
 * Smoke fonctionnel des objets trouvés (extraits en `layers/lost-found`).
 * L'ajout d'un objet est interdit avant le début de l'édition → on recule d'abord la date de début.
 */
test.describe.serial('Module Objets trouvés', () => {
  let itemId: number | null = null

  test.beforeAll(async () => {
    const { editionId } = loadState()
    if (!editionId) throw new Error('editionId manquant dans state.json (setup global non joué)')
  })

  test("reculer la date de début de l'édition (ajout autorisé à partir du début)", async ({
    page,
  }) => {
    const { editionId } = loadState()
    const yesterday = new Date(Date.now() - 24 * 3600_000)
    await updateEdition(page, String(editionId), { startDate: yesterday.toISOString() })
  })

  test('créer un objet trouvé via API et le voir sur la page objets trouvés', async ({
    page,
    goto,
  }) => {
    const { editionId } = loadState()
    const response = await apiPost(page, `${BASE}/api/editions/${editionId}/lost-found`, {
      data: { description: 'Doudou licorne E2E' },
    })
    expect(response.ok()).toBe(true)
    const body = await response.json()
    itemId = (body?.data ?? body)?.id
    expect(itemId).toBeTruthy()

    // La liste des objets s'affiche sur la page publique (la page de gestion est une config).
    await expect(async () => {
      await goto(`/editions/${editionId}/lost-found`, { waitUntil: 'hydration' })
      await expect(page.getByText(/doudou licorne e2e/i).first()).toBeVisible({ timeout: 5000 })
    }).toPass({ timeout: 30000, intervals: [2000, 3000, 5000] })
  })

  test('l’objet apparaît dans GET lost-found', async ({ page }) => {
    const { editionId } = loadState()
    if (!itemId) throw new Error('itemId manquant')
    const response = await page.request.get(`${BASE}/api/editions/${editionId}/lost-found`)
    expect(response.ok()).toBe(true)
    const body = await response.json()
    const items = Array.isArray(body) ? body : (body?.data ?? body?.items ?? [])
    expect(items.some((i: { id: number }) => i.id === itemId)).toBe(true)
  })
})
