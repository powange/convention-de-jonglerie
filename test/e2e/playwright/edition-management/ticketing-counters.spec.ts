import { expect, test } from '@nuxt/test-utils/playwright'

import { apiDelete, apiPatch, apiPost, loadState, updateEdition } from '../helpers'

const BASE = 'http://localhost:3000'

/**
 * Smoke fonctionnel des compteurs / points de vente de la billetterie
 * (`layers/ticketing`, ressource `ticketingCounter`).
 *
 * Exerce le parcours réel : activation de la feature, CRUD du compteur via l'API
 * (POST → GET liste → GET unitaire), mutations de la valeur via les sous-ressources
 * PATCH (increment / decrement / reset), rendu de la page de gestion, puis cleanup.
 *
 * Le modèle de compteur est volontairement minimal : `{ id, name, token, value }`.
 * La seule donnée requise à la création est `name`. Il n'existe pas d'endpoint de
 * renommage (PUT) ; les seules « modifications » possibles portent sur `value` via
 * les PATCH increment/decrement/reset — c'est donc ce qui tient lieu de round-trip
 * « modifier → vérifier » ici.
 */
test.describe.serial('Module Billetterie — Compteurs', () => {
  let counterId: number | null = null

  test.beforeAll(async () => {
    const { editionId } = loadState()
    if (!editionId) throw new Error('editionId manquant dans state.json (setup global non joué)')
  })

  test("activer la billetterie via l'API", async ({ page }) => {
    const { editionId } = loadState()
    await updateEdition(page, String(editionId), { ticketingEnabled: true })
  })

  test('créer un compteur via API (POST)', async ({ page }) => {
    const { editionId } = loadState()

    const response = await apiPost(page, `${BASE}/api/editions/${editionId}/ticketing/counters`, {
      data: { name: 'Compteur E2E' },
    })
    expect(response.ok()).toBe(true)

    const body = await response.json()
    // Extraction tolérante : la réponse standard est `createSuccessResponse({ counter })`
    // → `body.data.counter`, mais on retombe sur `body.data` / `body` au cas où.
    const counter = body?.data?.counter ?? body?.data ?? body
    counterId = counter?.id
    expect(counterId).toBeTruthy()
    expect(counter?.name).toBe('Compteur E2E')
    // Un compteur fraîchement créé démarre à 0.
    expect(counter?.value).toBe(0)
  })

  test('le compteur apparaît dans GET counters (liste)', async ({ page }) => {
    const { editionId } = loadState()
    if (!counterId) throw new Error('counterId manquant')

    const response = await page.request.get(`${BASE}/api/editions/${editionId}/ticketing/counters`)
    expect(response.ok()).toBe(true)

    const body = await response.json()
    const counters = body?.data?.counters ?? body?.counters ?? body?.data ?? []
    expect(counters.some((c: { id: number }) => c.id === counterId)).toBe(true)
  })

  test('GET unitaire du compteur retourne ses informations', async ({ page }) => {
    const { editionId } = loadState()
    if (!counterId) throw new Error('counterId manquant')

    const response = await page.request.get(
      `${BASE}/api/editions/${editionId}/ticketing/counters/${counterId}`
    )
    expect(response.ok()).toBe(true)

    const body = await response.json()
    const counter = body?.data?.counter ?? body?.data ?? body
    expect(counter?.id).toBe(counterId)
    expect(counter?.name).toBe('Compteur E2E')
  })

  test('incrémenter le compteur (PATCH increment) puis vérifier la valeur', async ({ page }) => {
    const { editionId } = loadState()
    if (!counterId) throw new Error('counterId manquant')

    // step explicite pour prouver l'incrément (défaut serveur = 1).
    const patch = await apiPatch(
      page,
      `${BASE}/api/editions/${editionId}/ticketing/counters/${counterId}/increment`,
      { data: { step: 3 } }
    )
    expect(patch.ok()).toBe(true)

    const patchBody = await patch.json()
    const updated = patchBody?.data?.counter ?? patchBody?.data ?? patchBody
    expect(updated?.value).toBe(3)

    // Relecture via GET unitaire pour confirmer la persistance.
    const get = await page.request.get(
      `${BASE}/api/editions/${editionId}/ticketing/counters/${counterId}`
    )
    expect(get.ok()).toBe(true)
    const getBody = await get.json()
    const counter = getBody?.data?.counter ?? getBody?.data ?? getBody
    expect(counter?.value).toBe(3)
  })

  test('décrémenter le compteur (PATCH decrement) puis vérifier la valeur', async ({ page }) => {
    const { editionId } = loadState()
    if (!counterId) throw new Error('counterId manquant')

    const patch = await apiPatch(
      page,
      `${BASE}/api/editions/${editionId}/ticketing/counters/${counterId}/decrement`,
      { data: { step: 1 } }
    )
    expect(patch.ok()).toBe(true)

    const patchBody = await patch.json()
    const updated = patchBody?.data?.counter ?? patchBody?.data ?? patchBody
    // 3 (increment précédent) - 1 = 2
    expect(updated?.value).toBe(2)
  })

  test('réinitialiser le compteur (PATCH reset) puis vérifier la valeur', async ({ page }) => {
    const { editionId } = loadState()
    if (!counterId) throw new Error('counterId manquant')

    const patch = await apiPatch(
      page,
      `${BASE}/api/editions/${editionId}/ticketing/counters/${counterId}/reset`
    )
    expect(patch.ok()).toBe(true)

    const patchBody = await patch.json()
    const updated = patchBody?.data?.counter ?? patchBody?.data ?? patchBody
    expect(updated?.value).toBe(0)
  })

  test('la page de gestion des compteurs affiche le titre', async ({ page, goto }) => {
    const { editionId } = loadState()

    // Re-navigue jusqu'à ce que le heading stable de la page soit visible (évite la
    // flakiness d'hydratation / chargement de l'édition côté store).
    await expect(async () => {
      await goto(`/editions/${editionId}/gestion/ticketing/counter`, { waitUntil: 'hydration' })
      await expect(page.getByRole('heading', { name: /compteurs/i }).first()).toBeVisible({
        timeout: 5000,
      })
    }).toPass({ timeout: 30000, intervals: [2000, 3000, 5000] })
  })

  test('nettoyage : supprimer le compteur et désactiver la billetterie', async ({ page }) => {
    const { editionId } = loadState()

    if (counterId) {
      const del = await apiDelete(
        page,
        `${BASE}/api/editions/${editionId}/ticketing/counters/${counterId}`
      )
      expect(del.ok()).toBe(true)

      // Le compteur ne doit plus apparaître dans la liste.
      const response = await page.request.get(
        `${BASE}/api/editions/${editionId}/ticketing/counters`
      )
      expect(response.ok()).toBe(true)
      const body = await response.json()
      const counters = body?.data?.counters ?? body?.counters ?? body?.data ?? []
      expect(counters.some((c: { id: number }) => c.id === counterId)).toBe(false)
    }

    await updateEdition(page, String(editionId), { ticketingEnabled: false })
  })
})
