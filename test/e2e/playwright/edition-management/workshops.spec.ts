import { expect, test } from '@nuxt/test-utils/playwright'

import { apiDelete, apiPost, loadState, updateEdition } from '../helpers'

const BASE = 'http://localhost:3000'

/**
 * Smoke fonctionnel des ateliers (extraits en `layers/workshops`).
 * Un atelier doit se situer dans la plage de dates de l'édition (start = J+7, end = J+9 au setup).
 */
test.describe.serial('Module Ateliers', () => {
  let workshopId: number | null = null

  test.beforeAll(async () => {
    const { editionId } = loadState()
    if (!editionId) throw new Error('editionId manquant dans state.json (setup global non joué)')
  })

  test("activer les ateliers via l'API", async ({ page }) => {
    const { editionId } = loadState()
    await updateEdition(page, String(editionId), { workshopsEnabled: true })
  })

  test('créer un atelier via API et le voir sur la page ateliers', async ({ page, goto }) => {
    const { editionId } = loadState()
    // Créneau clairement dans la plage de l'édition (J+7.5 → J+7.5 +2h, donc entre J+7 et J+9)
    const start = new Date(Date.now() + 7.5 * 24 * 3600_000)
    const end = new Date(start.getTime() + 2 * 3600_000)

    const response = await apiPost(page, `${BASE}/api/editions/${editionId}/workshops`, {
      data: {
        title: 'Atelier diabolo E2E',
        description: 'Atelier de test E2E',
        startDateTime: start.toISOString(),
        endDateTime: end.toISOString(),
      },
    })
    expect(response.ok()).toBe(true)
    const body = await response.json()
    workshopId = (body?.data ?? body)?.id
    expect(workshopId).toBeTruthy()

    // Les ateliers sont listés sur la page publique (la page de gestion gère lieux/carte).
    await expect(async () => {
      await goto(`/editions/${editionId}/workshops`, { waitUntil: 'hydration' })
      await expect(page.getByText(/atelier diabolo e2e/i).first()).toBeVisible({ timeout: 5000 })
    }).toPass({ timeout: 30000, intervals: [2000, 3000, 5000] })
  })

  test('l’atelier apparaît dans GET workshops', async ({ page }) => {
    const { editionId } = loadState()
    if (!workshopId) throw new Error('workshopId manquant')
    const response = await page.request.get(`${BASE}/api/editions/${editionId}/workshops`)
    expect(response.ok()).toBe(true)
    const body = await response.json()
    const items = Array.isArray(body) ? body : (body?.data ?? body?.workshops ?? [])
    expect(items.some((w: { id: number }) => w.id === workshopId)).toBe(true)
  })

  test('nettoyage : supprimer l’atelier et désactiver les ateliers', async ({ page }) => {
    const { editionId } = loadState()
    if (workshopId) {
      const del = await apiDelete(page, `${BASE}/api/editions/${editionId}/workshops/${workshopId}`)
      expect(del.ok()).toBe(true)
    }
    await updateEdition(page, String(editionId), { workshopsEnabled: false })
  })
})
