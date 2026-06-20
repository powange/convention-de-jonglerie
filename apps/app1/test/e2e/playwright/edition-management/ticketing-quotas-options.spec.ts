import { expect, test } from '@nuxt/test-utils/playwright'

import { apiDelete, apiPost, apiPut, loadState, updateEdition } from '../helpers'

const BASE = 'http://localhost:3000'

/**
 * Smoke fonctionnel des quotas & options de la billetterie (layer `ticketing`).
 *
 * Couvre le CRUD complet via l'API (round-trips POST → GET → PUT → GET → DELETE → GET) :
 *  - Quotas : pas de pré-requis (création directe).
 *  - Options : nécessitent une configuration de billetterie externe préexistante
 *    (`createOption` lève une 400 « Aucune configuration de billeterie externe trouvée »
 *    sinon). On crée donc une config HelloAsso minimale en amont, puis on la supprime au cleanup.
 *  - Lien tarif↔quota : création d'un tarif avec `quotaIds: [quotaId]` et vérification du
 *    join `TicketingTierQuota` exposé dans GET tiers (`tier.quotas[].quotaId`).
 *
 * Formes de réponse (toutes enveloppées par `createSuccessResponse(data)` → `{ success, data }`) :
 *  - POST/PUT quota → `data` EST le quota (pas `data.quota`).
 *  - GET quotas    → `data.quotas`.
 *  - POST/PUT option → `data.option`.
 *  - GET options   → `data.options`.
 *  - POST tier     → `data.tier`. GET tiers → `data.tiers`.
 * Extraction volontairement tolérante pour rester robuste aux variations d'enveloppe.
 */
test.describe.serial('Module Billetterie — quotas & options', () => {
  let quotaId: number | null = null
  let optionId: number | null = null
  let tierId: number | null = null
  // Config de billetterie externe créée pour permettre la création d'options.
  let externalConfigCreated = false

  test.beforeAll(async () => {
    const { editionId } = loadState()
    if (!editionId) throw new Error('editionId manquant dans state.json (setup global non joué)')
  })

  test("activer la billetterie via l'API", async ({ page }) => {
    const { editionId } = loadState()
    await updateEdition(page, String(editionId), { ticketingEnabled: true })
  })

  // ──────────────────────────────────────────────
  // Quotas : CRUD complet
  // ──────────────────────────────────────────────

  test('quotas : créer (POST) puis le retrouver dans GET', async ({ page }) => {
    const { editionId } = loadState()

    const response = await apiPost(page, `${BASE}/api/editions/${editionId}/ticketing/quotas`, {
      data: { title: 'Quota E2E', description: 'Quota de test E2E', quantity: 50 },
    })
    expect(response.ok()).toBe(true)
    const body = await response.json()
    // POST quota → `createSuccessResponse(quota)` : le quota est directement dans `data`.
    const quota = body.data?.quota ?? body.data ?? body
    quotaId = quota?.id
    expect(quotaId).toBeTruthy()
    expect(quota.title).toBe('Quota E2E')
    expect(quota.quantity).toBe(50)

    const get = await page.request.get(`${BASE}/api/editions/${editionId}/ticketing/quotas`)
    expect(get.ok()).toBe(true)
    const getBody = await get.json()
    const quotas = getBody.data?.quotas ?? getBody.data ?? getBody.quotas ?? []
    expect(quotas.some((q: { id: number }) => q.id === quotaId)).toBe(true)
  })

  test('quotas : modifier (PUT) puis vérifier la persistance', async ({ page }) => {
    const { editionId } = loadState()
    if (!quotaId) throw new Error('quotaId manquant')

    const put = await apiPut(
      page,
      `${BASE}/api/editions/${editionId}/ticketing/quotas/${quotaId}`,
      { data: { title: 'Quota E2E modifié', description: 'Maj E2E', quantity: 75 } }
    )
    expect(put.ok()).toBe(true)
    const putBody = await put.json()
    const updated = putBody.data?.quota ?? putBody.data ?? putBody
    expect(updated.title).toBe('Quota E2E modifié')
    expect(updated.quantity).toBe(75)

    const get = await page.request.get(`${BASE}/api/editions/${editionId}/ticketing/quotas`)
    expect(get.ok()).toBe(true)
    const getBody = await get.json()
    const quotas = getBody.data?.quotas ?? getBody.data ?? getBody.quotas ?? []
    const found = quotas.find((q: { id: number }) => q.id === quotaId)
    expect(found).toBeTruthy()
    expect(found.title).toBe('Quota E2E modifié')
    expect(found.quantity).toBe(75)
  })

  // ──────────────────────────────────────────────
  // Options : nécessitent une config billetterie externe
  // ──────────────────────────────────────────────

  test('options : préparer une config billetterie externe (HelloAsso minimale)', async ({
    page,
  }) => {
    const { editionId } = loadState()

    const response = await apiPost(page, `${BASE}/api/editions/${editionId}/ticketing/external`, {
      data: {
        provider: 'HELLOASSO',
        helloAsso: {
          clientId: 'e2e-client-id',
          clientSecret: 'e2e-client-secret',
          organizationSlug: 'e2e-orga',
          formType: 'Event',
          formSlug: 'e2e-form',
        },
      },
    })
    expect(response.ok()).toBe(true)
    externalConfigCreated = true

    // GET confirme la présence de la config (pré-requis à la création d'options).
    const get = await page.request.get(`${BASE}/api/editions/${editionId}/ticketing/external`)
    expect(get.ok()).toBe(true)
    const getBody = await get.json()
    const data = getBody.data ?? getBody
    expect(data.hasConfig).toBe(true)
  })

  test('options : créer (POST) puis la retrouver dans GET', async ({ page }) => {
    const { editionId } = loadState()

    const response = await apiPost(page, `${BASE}/api/editions/${editionId}/ticketing/options`, {
      data: {
        name: 'Option E2E',
        description: 'Option de test E2E',
        type: 'CHECKBOX',
        isRequired: false,
        price: 500,
      },
    })
    expect(response.ok()).toBe(true)
    const body = await response.json()
    // POST option → `createSuccessResponse({ option })`.
    const option = body.data?.option ?? body.data ?? body
    optionId = option?.id
    expect(optionId).toBeTruthy()
    expect(option.name).toBe('Option E2E')

    const get = await page.request.get(`${BASE}/api/editions/${editionId}/ticketing/options`)
    expect(get.ok()).toBe(true)
    const getBody = await get.json()
    const options = getBody.data?.options ?? getBody.data ?? getBody.options ?? []
    expect(options.some((o: { id: number }) => o.id === optionId)).toBe(true)
  })

  test('options : modifier (PUT) puis vérifier la persistance', async ({ page }) => {
    const { editionId } = loadState()
    if (!optionId) throw new Error('optionId manquant')

    const put = await apiPut(
      page,
      `${BASE}/api/editions/${editionId}/ticketing/options/${optionId}`,
      {
        data: {
          name: 'Option E2E modifiée',
          description: 'Maj E2E',
          type: 'CHECKBOX',
          isRequired: true,
          price: 750,
        },
      }
    )
    expect(put.ok()).toBe(true)
    const putBody = await put.json()
    const updated = putBody.data?.option ?? putBody.data ?? putBody
    expect(updated.name).toBe('Option E2E modifiée')

    const get = await page.request.get(`${BASE}/api/editions/${editionId}/ticketing/options`)
    expect(get.ok()).toBe(true)
    const getBody = await get.json()
    const options = getBody.data?.options ?? getBody.data ?? getBody.options ?? []
    const found = options.find((o: { id: number }) => o.id === optionId)
    expect(found).toBeTruthy()
    expect(found.name).toBe('Option E2E modifiée')
    expect(found.isRequired).toBe(true)
  })

  // ──────────────────────────────────────────────
  // Bonus : lien tarif ↔ quota
  // ──────────────────────────────────────────────

  test('tarif ↔ quota : créer un tarif lié au quota et vérifier le lien', async ({ page }) => {
    const { editionId } = loadState()
    if (!quotaId) throw new Error('quotaId manquant')

    const response = await apiPost(page, `${BASE}/api/editions/${editionId}/ticketing/tiers`, {
      data: { name: 'Tarif lié quota E2E', price: 2000, quotaIds: [quotaId] },
    })
    expect(response.ok()).toBe(true)
    const body = await response.json()
    const tier = body.data?.tier ?? body.data ?? body
    tierId = tier?.id
    expect(tierId).toBeTruthy()

    // GET tiers → chaque tier inclut `quotas: [{ quotaId, quota: {…} }]` (join TicketingTierQuota).
    const get = await page.request.get(`${BASE}/api/editions/${editionId}/ticketing/tiers`)
    expect(get.ok()).toBe(true)
    const getBody = await get.json()
    const tiers = getBody.data?.tiers ?? getBody.data ?? getBody.tiers ?? []
    const found = tiers.find((t: { id: number }) => t.id === tierId)
    expect(found).toBeTruthy()
    const quotaLinks: Array<{ quotaId?: number; quota?: { id: number } }> = found.quotas ?? []
    expect(quotaLinks.some((link) => link.quotaId === quotaId || link.quota?.id === quotaId)).toBe(
      true
    )
  })

  // ──────────────────────────────────────────────
  // Assertion UI légère
  // ──────────────────────────────────────────────

  test('UI : la page Tarifs et options est accessible', async ({ page, goto }) => {
    const { editionId } = loadState()

    // Re-navigue jusqu'à ce que le heading apparaisse (évite la flakiness d'hydratation).
    await expect(async () => {
      await goto(`/editions/${editionId}/gestion/ticketing/tiers`, { waitUntil: 'hydration' })
      await expect(page.getByRole('heading', { name: /tarifs et options/i })).toBeVisible({
        timeout: 5000,
      })
    }).toPass({ timeout: 40000, intervals: [2000, 3000, 5000] })
  })

  // ──────────────────────────────────────────────
  // Cleanup : DELETE des entités créées + désactivation
  // ──────────────────────────────────────────────

  test('nettoyage : supprimer tarif, option, quota et config externe', async ({ page }) => {
    const { editionId } = loadState()

    // Tarif lié (le supprimer avant le quota : le tarif référence le quota).
    if (tierId) {
      const del = await apiDelete(
        page,
        `${BASE}/api/editions/${editionId}/ticketing/tiers/${tierId}`
      )
      expect(del.ok()).toBe(true)
    }

    // Option → DELETE puis vérifier l'absence dans GET.
    if (optionId) {
      const del = await apiDelete(
        page,
        `${BASE}/api/editions/${editionId}/ticketing/options/${optionId}`
      )
      expect(del.ok()).toBe(true)

      const get = await page.request.get(`${BASE}/api/editions/${editionId}/ticketing/options`)
      expect(get.ok()).toBe(true)
      const getBody = await get.json()
      const options = getBody.data?.options ?? getBody.data ?? getBody.options ?? []
      expect(options.some((o: { id: number }) => o.id === optionId)).toBe(false)
    }

    // Quota → DELETE puis vérifier l'absence dans GET.
    if (quotaId) {
      const del = await apiDelete(
        page,
        `${BASE}/api/editions/${editionId}/ticketing/quotas/${quotaId}`
      )
      expect(del.ok()).toBe(true)

      const get = await page.request.get(`${BASE}/api/editions/${editionId}/ticketing/quotas`)
      expect(get.ok()).toBe(true)
      const getBody = await get.json()
      const quotas = getBody.data?.quotas ?? getBody.data ?? getBody.quotas ?? []
      expect(quotas.some((q: { id: number }) => q.id === quotaId)).toBe(false)
    }

    // Config billetterie externe → DELETE.
    if (externalConfigCreated) {
      const del = await apiDelete(page, `${BASE}/api/editions/${editionId}/ticketing/external`)
      expect(del.ok()).toBe(true)
    }

    await updateEdition(page, String(editionId), { ticketingEnabled: false })
  })
})
