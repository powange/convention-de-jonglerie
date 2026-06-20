import { expect, test } from '@nuxt/test-utils/playwright'

import { apiDelete, apiPost, loadState } from '../helpers'

const BASE = 'http://localhost:3000'

/**
 * Smoke fonctionnel du covoiturage (extrait en `layers/carpool`) : création d'une offre via l'API,
 * présence dans la liste, et rendu sur la page publique de covoiturage. Pas de flag d'activation.
 */
test.describe.serial('Module Covoiturage', () => {
  let offerId: number | null = null

  test.beforeAll(async () => {
    const { editionId } = loadState()
    if (!editionId) throw new Error('editionId manquant dans state.json (setup global non joué)')
  })

  test('créer une offre de covoiturage via API et la voir sur la page publique', async ({
    page,
    goto,
  }) => {
    const { editionId } = loadState()
    const tripDate = new Date(Date.now() + 7 * 24 * 3600_000)

    const response = await apiPost(page, `${BASE}/api/editions/${editionId}/carpool-offers`, {
      data: {
        locationCity: 'Lyon',
        locationAddress: '1 Place Bellecour',
        tripDate: tripDate.toISOString(),
        availableSeats: 3,
        direction: 'TO_EVENT',
        description: 'Trajet de test E2E',
      },
    })
    expect(response.ok()).toBe(true)
    const body = await response.json()
    offerId = (body?.data ?? body)?.id
    expect(offerId).toBeTruthy()

    await expect(async () => {
      await goto(`/editions/${editionId}/carpool`, { waitUntil: 'hydration' })
      await expect(page.getByText(/lyon/i).first()).toBeVisible({ timeout: 5000 })
    }).toPass({ timeout: 30000, intervals: [2000, 3000, 5000] })
  })

  test('l’offre apparaît dans GET carpool-offers', async ({ page }) => {
    const { editionId } = loadState()
    if (!offerId) throw new Error('offerId manquant')
    const response = await page.request.get(`${BASE}/api/editions/${editionId}/carpool-offers`)
    expect(response.ok()).toBe(true)
    const body = await response.json()
    const offers = Array.isArray(body) ? body : (body?.data ?? body?.offers ?? [])
    expect(offers.some((o: { id: number }) => o.id === offerId)).toBe(true)
  })

  test('nettoyage : supprimer l’offre', async ({ page }) => {
    if (!offerId) return
    const del = await apiDelete(page, `${BASE}/api/carpool-offers/${offerId}`)
    expect(del.ok()).toBe(true)
  })
})
