import { expect, test } from '@nuxt/test-utils/playwright'

import { apiDelete, apiPost, apiPut, loadState, updateEdition } from '../helpers'

const BASE = 'http://localhost:3000'

/**
 * Smoke fonctionnel de la CONFIG EXTERNE de billetterie (extraite en `layers/ticketing`).
 *
 * Couvre deux familles d'endpoints qui stockent des credentials chiffrés :
 *  - SumUp (`/ticketing/sumup/config`) : upsert via PUT, relecture via GET (l'`affiliateKey`
 *    est renvoyée en clair par le serveur pour construire le deep link `sumupmerchant://`),
 *    puis suppression.
 *  - Billetterie externe (`/ticketing/external`) : POST d'un provider HELLOASSO avec sa
 *    sous-config, GET de vérification (le `clientSecret` n'est jamais renvoyé), DELETE.
 *
 * Permissions : l'utilisateur E2E est créateur/auteur de l'édition → `canManageTicketing`
 * (SumUp) et `canManageEditionVolunteers` (externe) passent.
 *
 * ⚠️ `test.describe.serial` : les tests partagent l'état (config persistée en base) et doivent
 * s'exécuter dans l'ordre. Le cleanup final supprime les deux configs même en cas d'échec
 * partiel (DELETE idempotents / tolérants).
 */
test.describe.serial('Module Billetterie — config externe (SumUp + billetterie externe)', () => {
  test.beforeAll(async () => {
    const { editionId } = loadState()
    if (!editionId) throw new Error('editionId manquant dans state.json (setup global non joué)')
  })

  test("activer la billetterie via l'API", async ({ page }) => {
    const { editionId } = loadState()
    await updateEdition(page, String(editionId), { ticketingEnabled: true })
  })

  // ──────────────────────────────────────────────
  // SumUp : PUT → GET → DELETE → GET (null)
  // ──────────────────────────────────────────────

  test('SumUp : PUT crée la config puis GET la relit (affiliateKey en clair)', async ({ page }) => {
    const { editionId } = loadState()

    const put = await apiPut(page, `${BASE}/api/editions/${editionId}/ticketing/sumup/config`, {
      data: { affiliateKey: 'sup_aff_E2E', appId: 'com.example.e2e' },
    })
    expect(put.ok()).toBe(true)

    const get = await page.request.get(`${BASE}/api/editions/${editionId}/ticketing/sumup/config`)
    expect(get.ok()).toBe(true)
    const body = await get.json()
    // Réponse attendue : { success, data: { config: { affiliateKey, appId, updatedAt } } }
    const config = body.data?.config ?? body.config ?? body.data ?? body
    expect(config).toBeTruthy()
    expect(config.appId).toBe('com.example.e2e')
    // L'affiliateKey est déchiffrée et renvoyée en clair (cf. config.get.ts)
    expect(config.affiliateKey).toBe('sup_aff_E2E')
  })

  test('SumUp : DELETE supprime la config puis GET renvoie config null', async ({ page }) => {
    const { editionId } = loadState()

    const del = await apiDelete(page, `${BASE}/api/editions/${editionId}/ticketing/sumup/config`)
    expect(del.ok()).toBe(true)

    const get = await page.request.get(`${BASE}/api/editions/${editionId}/ticketing/sumup/config`)
    expect(get.ok()).toBe(true)
    const body = await get.json()
    // Après suppression, le serveur renvoie { data: { config: null } }
    const config = body.data?.config ?? body.config ?? null
    expect(config).toBeNull()
  })

  // ──────────────────────────────────────────────
  // Billetterie externe (HelloAsso) : POST → GET → DELETE → GET (absent)
  // ──────────────────────────────────────────────

  test('Externe : POST crée une config HelloAsso puis GET la confirme', async ({ page }) => {
    const { editionId } = loadState()

    // Champs requis du schéma zod (POST external/index.post.ts) pour provider HELLOASSO :
    // clientId, clientSecret (obligatoire à la création), organizationSlug, formType, formSlug.
    const post = await apiPost(page, `${BASE}/api/editions/${editionId}/ticketing/external`, {
      data: {
        provider: 'HELLOASSO',
        helloAsso: {
          clientId: 'e2e-client-id',
          clientSecret: 'e2e-client-secret',
          organizationSlug: 'e2e-org-slug',
          formType: 'Event',
          formSlug: 'e2e-form-slug',
        },
      },
    })
    expect(post.ok()).toBe(true)

    const get = await page.request.get(`${BASE}/api/editions/${editionId}/ticketing/external`)
    expect(get.ok()).toBe(true)
    const body = await get.json()
    // Réponse attendue : { success, data: { hasConfig: true, config: { provider, helloAssoConfig: {...} } } }
    const data = body.data ?? body
    expect(data.hasConfig).toBe(true)
    const config = data.config
    expect(config).toBeTruthy()
    expect(config.provider).toBe('HELLOASSO')
    // Le clientSecret n'est jamais renvoyé ; les autres champs HelloAsso le sont.
    expect(config.helloAssoConfig).toBeTruthy()
    expect(config.helloAssoConfig.organizationSlug).toBe('e2e-org-slug')
    expect(config.helloAssoConfig.formType).toBe('Event')
    expect(config.helloAssoConfig.formSlug).toBe('e2e-form-slug')
    expect(config.helloAssoConfig.clientSecret).toBeUndefined()
  })

  test('Externe : DELETE supprime la config puis GET renvoie hasConfig false', async ({ page }) => {
    const { editionId } = loadState()

    const del = await apiDelete(page, `${BASE}/api/editions/${editionId}/ticketing/external`)
    expect(del.ok()).toBe(true)

    const get = await page.request.get(`${BASE}/api/editions/${editionId}/ticketing/external`)
    expect(get.ok()).toBe(true)
    const body = await get.json()
    const data = body.data ?? body
    expect(data.hasConfig).toBe(false)
    expect(data.config ?? null).toBeNull()
  })

  // ──────────────────────────────────────────────
  // Assertion UI légère : la page de config externe rend bien
  // ──────────────────────────────────────────────

  test('la page gestion billetterie externe affiche le titre et les providers', async ({
    page,
    goto,
  }) => {
    const { editionId } = loadState()

    // Re-navigue jusqu'à ce que la page hydrate et affiche un élément stable (évite la
    // flakiness d'hydratation / de propagation des permissions).
    await expect(async () => {
      await goto(`/editions/${editionId}/gestion/ticketing/external`, {
        waitUntil: 'hydration',
      })
      await expect(page.getByRole('heading', { name: /billeterie externe/i })).toBeVisible({
        timeout: 5000,
      })
      // Cartes des providers (h2 « HelloAsso » et « Infomaniak »)
      await expect(page.getByRole('heading', { name: /helloasso/i })).toBeVisible({
        timeout: 5000,
      })
    }).toPass({ timeout: 30000, intervals: [2000, 3000, 5000] })
  })

  // ──────────────────────────────────────────────
  // Nettoyage : supprimer les deux configs + désactiver la billetterie
  // ──────────────────────────────────────────────

  test('nettoyage : supprimer les configs et désactiver la billetterie', async ({ page }) => {
    const { editionId } = loadState()

    // DELETE SumUp — tolérant : la config a déjà été supprimée plus haut, mais le handler
    // utilise deleteMany (idempotent) donc le DELETE reste OK.
    const delSumup = await apiDelete(
      page,
      `${BASE}/api/editions/${editionId}/ticketing/sumup/config`
    )
    expect(delSumup.ok()).toBe(true)

    // DELETE externe — tolérant : si déjà supprimée, le handler renvoie 404 (pas d'erreur fatale).
    await apiDelete(page, `${BASE}/api/editions/${editionId}/ticketing/external`)

    await updateEdition(page, String(editionId), { ticketingEnabled: false })
  })
})
