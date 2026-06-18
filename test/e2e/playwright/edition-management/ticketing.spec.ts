import { expect, test } from '@nuxt/test-utils/playwright'

import { apiDelete, apiPatch, apiPost, loadState, updateEdition } from '../helpers'

const BASE = 'http://localhost:3000'

/**
 * Smoke fonctionnel de la billetterie (extraite en `layers/ticketing`).
 * Exerce le parcours réel : activation de la feature, réglages (settings) via le port `event`
 * (round-trip PATCH → GET), création d'un tarif via l'API et rendu dans la page front, puis cleanup.
 */
test.describe.serial('Module Billetterie', () => {
  let tierId: number | null = null

  test.beforeAll(async () => {
    const { editionId } = loadState()
    if (!editionId) throw new Error('editionId manquant dans state.json (setup global non joué)')
  })

  test("activer la billetterie via l'API", async ({ page }) => {
    const { editionId } = loadState()
    await updateEdition(page, String(editionId), { ticketingEnabled: true })
  })

  test("la page gestion affiche l'entrée Billetterie", async ({ page, goto }) => {
    const { editionId } = loadState()
    await goto(`/editions/${editionId}/gestion`, { waitUntil: 'hydration' })
    await expect(page.locator('h2').filter({ hasText: /billetterie/i })).toBeVisible({
      timeout: 10000,
    })
  })

  test('settings : PATCH des réglages puis GET confirme la persistance (port event)', async ({
    page,
  }) => {
    const { editionId } = loadState()

    // Valeurs choisies différentes des défauts pour prouver l'écriture (updateSettings) + relecture
    // (getSettings) du port `event` introduit en PR #37.
    const patch = await apiPatch(page, `${BASE}/api/editions/${editionId}/ticketing/settings`, {
      data: { paymentCheck: false, allowAnonymousOrders: true },
    })
    expect(patch.ok()).toBe(true)

    const get = await page.request.get(`${BASE}/api/editions/${editionId}/ticketing/settings`)
    expect(get.ok()).toBe(true)
    const body = await get.json()
    const settings = body.data ?? body
    expect(settings.paymentCheck).toBe(false)
    expect(settings.allowAnonymousOrders).toBe(true)
  })

  test('créer un tarif via API et le voir dans la page Tarifs', async ({ page, goto }) => {
    const { editionId } = loadState()

    const response = await apiPost(page, `${BASE}/api/editions/${editionId}/ticketing/tiers`, {
      data: { name: 'Pass E2E', description: 'Tarif de test E2E', price: 1500 },
    })
    expect(response.ok()).toBe(true)
    const body = await response.json()
    tierId = body?.data?.tier?.id
    expect(tierId).toBeTruthy()

    // Re-navigue jusqu'à ce que le tarif fraîchement créé apparaisse (évite la flakiness de
    // propagation données API → rendu de la page).
    await expect(async () => {
      await goto(`/editions/${editionId}/gestion/ticketing/tiers`, { waitUntil: 'hydration' })
      await expect(page.getByRole('heading', { name: /tarifs et options/i })).toBeVisible({
        timeout: 5000,
      })
      await expect(page.getByRole('cell', { name: /pass e2e/i }).first()).toBeVisible({
        timeout: 5000,
      })
    }).toPass({ timeout: 30000, intervals: [2000, 3000, 5000] })
  })

  test('le tarif apparaît dans GET tiers', async ({ page }) => {
    const { editionId } = loadState()
    if (!tierId) throw new Error('tierId manquant')

    const response = await page.request.get(`${BASE}/api/editions/${editionId}/ticketing/tiers`)
    expect(response.ok()).toBe(true)
    const body = await response.json()
    const tiers = body?.data?.tiers ?? body?.tiers ?? []
    expect(tiers.some((t: { id: number }) => t.id === tierId)).toBe(true)
  })

  test('nettoyage : supprimer le tarif et désactiver la billetterie', async ({ page }) => {
    const { editionId } = loadState()
    if (tierId) {
      const del = await apiDelete(
        page,
        `${BASE}/api/editions/${editionId}/ticketing/tiers/${tierId}`
      )
      expect(del.ok()).toBe(true)
    }
    await updateEdition(page, String(editionId), { ticketingEnabled: false })
  })
})
