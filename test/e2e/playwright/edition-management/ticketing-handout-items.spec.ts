import { expect, test } from '@nuxt/test-utils/playwright'

import { apiDelete, apiPatch, apiPost, apiPut, loadState, updateEdition } from '../helpers'

const BASE = 'http://localhost:3000'

/**
 * Smoke fonctionnel des « articles à remettre » de la billetterie
 * (handout items, extraits dans `layers/ticketing`).
 *
 * Exerce le CRUD réel via l'API :
 *  - activation de la feature billetterie + handout items (settings.patch),
 *  - création (POST) → relecture (GET) → modification (PUT) → vérification →
 *    suppression (DELETE) → absence confirmée,
 *  - puis un rendu léger de la page de gestion (heading visible),
 *  - et enfin le cleanup.
 *
 * Endpoints couverts :
 *  - PATCH /api/editions/:id/ticketing/settings           (active handoutItemsEnabled)
 *  - POST  /api/editions/:id/ticketing/handout-items      (création)
 *  - GET   /api/editions/:id/ticketing/handout-items      (liste, wrapper { handoutItems })
 *  - PUT   /api/editions/:id/ticketing/handout-items/:itemId  (modification)
 *  - DELETE /api/editions/:id/ticketing/handout-items/:itemId (suppression)
 */
test.describe.serial('Module Billetterie — Articles à remettre', () => {
  let itemId: number | null = null
  const itemName = 'Bracelet E2E'
  const itemNameUpdated = 'Bracelet E2E (modifié)'

  test.beforeAll(async () => {
    const { editionId } = loadState()
    if (!editionId) throw new Error('editionId manquant dans state.json (setup global non joué)')
  })

  test("activer la billetterie + les articles à remettre via l'API", async ({ page }) => {
    const { editionId } = loadState()

    // 1) Activer la feature billetterie au niveau de l'édition.
    await updateEdition(page, String(editionId), { ticketingEnabled: true })

    // 2) Activer explicitement les articles à remettre via les settings (port event).
    //    Les endpoints handout-items ne gardent que sur `canAccessEditionData`, mais on
    //    reproduit le parcours réaliste : on bascule le réglage puis on le relit.
    const patch = await apiPatch(page, `${BASE}/api/editions/${editionId}/ticketing/settings`, {
      data: { handoutItemsEnabled: true },
    })
    expect(patch.ok()).toBe(true)

    const get = await page.request.get(`${BASE}/api/editions/${editionId}/ticketing/settings`)
    expect(get.ok()).toBe(true)
    const body = await get.json()
    const settings = body.data ?? body
    expect(settings.handoutItemsEnabled).toBe(true)
  })

  test('créer un article à remettre via API (POST)', async ({ page }) => {
    const { editionId } = loadState()

    const response = await apiPost(
      page,
      `${BASE}/api/editions/${editionId}/ticketing/handout-items`,
      { data: { name: itemName } }
    )
    expect(response.ok()).toBe(true)

    const body = await response.json()
    // L'endpoint renvoie `createSuccessResponse(item)` → l'item créé est directement
    // dans `body.data`. Extraction tolérante au cas où une couche `item` serait ajoutée.
    const item = body?.data?.item ?? body?.data ?? body
    itemId = item?.id ?? null
    expect(itemId).toBeTruthy()
    expect(item?.name).toBe(itemName)
  })

  test("l'article apparaît dans GET handout-items", async ({ page }) => {
    const { editionId } = loadState()
    if (!itemId) throw new Error('itemId manquant')

    const response = await page.request.get(
      `${BASE}/api/editions/${editionId}/ticketing/handout-items`
    )
    expect(response.ok()).toBe(true)

    const body = await response.json()
    // Le GET racine renvoie `createSuccessResponse({ handoutItems })`.
    // Extraction tolérante : wrapper { handoutItems }, ou tableau brut.
    const items = body?.data?.handoutItems ?? body?.handoutItems ?? body?.data ?? body ?? []
    expect(Array.isArray(items)).toBe(true)
    expect(items.some((i: { id: number }) => i.id === itemId)).toBe(true)
  })

  test("modifier l'article via API (PUT) puis vérifier", async ({ page }) => {
    const { editionId } = loadState()
    if (!itemId) throw new Error('itemId manquant')

    const response = await apiPut(
      page,
      `${BASE}/api/editions/${editionId}/ticketing/handout-items/${itemId}`,
      { data: { name: itemNameUpdated } }
    )
    expect(response.ok()).toBe(true)

    const body = await response.json()
    const item = body?.data?.item ?? body?.data ?? body
    expect(item?.name).toBe(itemNameUpdated)

    // Confirme la persistance côté liste.
    const get = await page.request.get(`${BASE}/api/editions/${editionId}/ticketing/handout-items`)
    expect(get.ok()).toBe(true)
    const getBody = await get.json()
    const items = getBody?.data?.handoutItems ?? getBody?.handoutItems ?? getBody?.data ?? []
    const updated = items.find((i: { id: number }) => i.id === itemId)
    expect(updated?.name).toBe(itemNameUpdated)
  })

  test('la page gestion affiche le heading « Articles à remettre »', async ({ page, goto }) => {
    const { editionId } = loadState()

    // Re-navigue jusqu'à ce que la page soit hydratée et le titre rendu (évite la
    // flakiness de propagation chargement édition → rendu de la page).
    await expect(async () => {
      await goto(`/editions/${editionId}/gestion/ticketing/handout-items`, {
        waitUntil: 'hydration',
      })
      await expect(page.getByRole('heading', { name: /articles à remettre/i }).first()).toBeVisible(
        { timeout: 5000 }
      )
    }).toPass({ timeout: 30000, intervals: [2000, 3000, 5000] })
  })

  test("supprimer l'article via API (DELETE) puis confirmer son absence", async ({ page }) => {
    const { editionId } = loadState()
    if (!itemId) throw new Error('itemId manquant')

    const del = await apiDelete(
      page,
      `${BASE}/api/editions/${editionId}/ticketing/handout-items/${itemId}`
    )
    expect(del.ok()).toBe(true)

    const response = await page.request.get(
      `${BASE}/api/editions/${editionId}/ticketing/handout-items`
    )
    expect(response.ok()).toBe(true)
    const body = await response.json()
    const items = body?.data?.handoutItems ?? body?.handoutItems ?? body?.data ?? []
    expect(items.some((i: { id: number }) => i.id === itemId)).toBe(false)

    // L'article est supprimé : on évite que le cleanup ne retente une suppression.
    itemId = null
  })

  test('nettoyage : supprimer un éventuel article résiduel et désactiver la billetterie', async ({
    page,
  }) => {
    const { editionId } = loadState()
    if (itemId) {
      const del = await apiDelete(
        page,
        `${BASE}/api/editions/${editionId}/ticketing/handout-items/${itemId}`
      )
      expect(del.ok()).toBe(true)
    }
    await updateEdition(page, String(editionId), { ticketingEnabled: false })
  })
})
