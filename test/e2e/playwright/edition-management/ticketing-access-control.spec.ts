import { expect, test } from '@nuxt/test-utils/playwright'

import { apiDelete, apiPost, loadState, updateEdition } from '../helpers'

const BASE = 'http://localhost:3000'

/**
 * Smoke fonctionnel du CONTRÔLE D'ACCÈS billetterie (validation d'entrée le jour J),
 * cœur historique resté en `server/api/editions/[id]/ticketing/` (hors layer).
 *
 * Parcours réaliste de bout en bout :
 *  1. activation de la feature billetterie ;
 *  2. création d'un tarif (POST tiers) puis d'un participant via `add-participant-manually` ;
 *  3. recherche du participant (`search`) pour récupérer son identifiant de billet ;
 *  4. validation de son entrée (`validate-entry`) + vérification via `search`
 *     ET via `recent-validations` ;
 *  5. dévalidation (`invalidate-entry`) + vérification via `search` ;
 *  6. vérification qu'une liste `*-not-validated` répond (200) ;
 *  7. nettoyage : suppression de la commande, du tarif, et désactivation de la feature.
 *
 * Endpoints couverts :
 *  - PUT    /api/editions/:id                                  (activation/désactivation feature)
 *  - POST   /api/editions/:id/ticketing/tiers                  (tarif support du billet)
 *  - POST   /api/editions/:id/ticketing/add-participant-manually
 *  - POST   /api/editions/:id/ticketing/search
 *  - POST   /api/editions/:id/ticketing/validate-entry
 *  - POST   /api/editions/:id/ticketing/invalidate-entry
 *  - GET    /api/editions/:id/ticketing/recent-validations
 *  - GET    /api/editions/:id/ticketing/volunteers-not-validated
 *  - DELETE /api/editions/:id/ticketing/orders/:orderId        (annulation puis suppression)
 *  - DELETE /api/editions/:id/ticketing/tiers/:tierId
 *
 * Notes / hypothèses sur les contrats d'API (relus depuis les handlers) :
 *  - Toutes les réponses utilisent `createSuccessResponse(data, message?)` →
 *    enveloppe `{ success: true, data, message? }`. L'extraction reste tolérante
 *    (`body.data?.X ?? body.data ?? body`).
 *  - `add-participant-manually` attend `payerFirstName`, `payerLastName`,
 *    `payerEmail`, `items: [{ tierId, quantity }]`, et `paymentMethod` (`cash|card|check`
 *    ou `null`, défaut `null`). Avec `paymentMethod: null` la commande est créée en
 *    statut `Pending` et les items en état `Pending` (les `entryValidated` à `false`).
 *    La réponse renvoie `{ qrCode, order: { id, ..., itemCount } }` mais PAS l'id du
 *    billet (OrderItem) — on le récupère donc via `search`.
 *  - `search` attend `{ searchTerm }` (string non vide) et renvoie
 *    `data.results.{tickets,volunteers,artists,organizers,total}`. Chaque billet est
 *    exposé en `results.tickets[].participant.ticket` où `.id` est l'id du **OrderItem**
 *    (c'est cet id que `validate-entry`/`invalidate-entry` consomment pour `type: 'ticket'`).
 *    Avec `quantity: 1`, le participant créé correspond à un unique OrderItem.
 *  - `validate-entry` attend `{ participantIds: number[], type }` (`type` défaut `'ticket'`).
 *    Pour un billet, `participantIds` = ids de OrderItem. Réponse `data.validated` = nombre
 *    de validations effectuées (updateMany filtré sur `entryValidated: false` → 1 au 1er appel,
 *    0 si déjà validé).
 *  - `invalidate-entry` attend `{ participantId: number, type }` (singulier ; `type` défaut
 *    `'volunteer'`, on précise donc `'ticket'`). Réponse `data` = `null` (message seul).
 *  - `recent-validations` renvoie `data.validations[]` (max 10), incluant les billets en état
 *    `Pending` ou `Processed` validés. Notre billet `Pending` validé doit donc y apparaître,
 *    identifié par `{ id: OrderItem, type: 'ticket' }`.
 *  - `volunteers-not-validated` renvoie `data.{volunteers,total}`. On vérifie seulement
 *    qu'il répond 200 et expose un total numérique (les billets ne figurent pas dans cette
 *    liste, dédiée aux bénévoles — voir rapport).
 *  - La suppression de commande est en deux temps : un 1er DELETE passe la commande en
 *    `Refunded` (annulation), un 2nd DELETE supprime définitivement la commande déjà
 *    `Refunded`. On enchaîne donc deux DELETE pour un nettoyage complet.
 */
test.describe.serial("Module Billetterie — contrôle d'accès (validation d'entrée)", () => {
  // IDs créés, conservés pour le nettoyage final (filet de sécurité si un test échoue).
  let tierId: number | null = null
  let orderId: number | null = null
  let orderItemId: number | null = null

  // Identité unique du participant pour fiabiliser la recherche (`searchTerm`).
  const stamp = Date.now()
  const payerFirstName = 'Entree'
  const payerLastName = `E2E${stamp}`
  const payerEmail = `e2e-access-control-${stamp}@example.com`

  test.beforeAll(async () => {
    const { editionId } = loadState()
    if (!editionId) throw new Error('editionId manquant dans state.json (setup global non joué)')
  })

  test("activer la billetterie via l'API", async ({ page }) => {
    const { editionId } = loadState()
    await updateEdition(page, String(editionId), { ticketingEnabled: true })
  })

  test('créer un tarif support du billet via API', async ({ page }) => {
    const { editionId } = loadState()

    const response = await apiPost(page, `${BASE}/api/editions/${editionId}/ticketing/tiers`, {
      data: {
        name: 'Pass contrôle accès E2E',
        description: 'Tarif E2E contrôle accès',
        price: 1000,
      },
    })
    expect(response.ok()).toBe(true)

    const body = await response.json()
    const tier = body.data?.tier ?? body.data ?? body
    tierId = tier?.id ?? null
    expect(tierId).toBeTruthy()
  })

  test('créer un participant via add-participant-manually', async ({ page }) => {
    const { editionId } = loadState()
    if (!tierId) throw new Error('tierId manquant')

    const response = await apiPost(
      page,
      `${BASE}/api/editions/${editionId}/ticketing/add-participant-manually`,
      {
        data: {
          payerFirstName,
          payerLastName,
          payerEmail,
          items: [{ tierId, quantity: 1 }],
          // paymentMethod: null (défaut) → commande/item en `Pending`, entryValidated=false.
          paymentMethod: null,
        },
      }
    )
    expect(response.ok()).toBe(true)

    const body = await response.json()
    const data = body.data ?? body
    const order = data.order ?? data
    orderId = order?.id ?? null
    expect(orderId).toBeTruthy()
    // Un seul item (quantity: 1) attendu pour ce participant.
    expect(order.itemCount).toBe(1)
    expect(data.qrCode).toBeTruthy()
  })

  test('rechercher le participant via search (il apparaît)', async ({ page }) => {
    const { editionId } = loadState()
    if (!orderId) throw new Error('orderId manquant')

    const response = await apiPost(page, `${BASE}/api/editions/${editionId}/ticketing/search`, {
      // On recherche sur le nom unique du participant créé.
      data: { searchTerm: payerLastName },
    })
    expect(response.ok()).toBe(true)

    const body = await response.json()
    const results = body.data?.results ?? body.data ?? body
    expect(Array.isArray(results.tickets)).toBe(true)

    // Retrouver notre billet via l'email unique du payeur/participant.
    const ticketEntry = results.tickets.find(
      (t: { participant: { ticket: { user: { email: string } } } }) =>
        t.participant?.ticket?.user?.email === payerEmail
    )
    expect(ticketEntry).toBeTruthy()

    const ticket = ticketEntry.participant.ticket
    // `ticket.id` est l'id du OrderItem — consommé par validate/invalidate (type 'ticket').
    orderItemId = ticket.id ?? null
    expect(orderItemId).toBeTruthy()
    // À ce stade, l'entrée n'est pas encore validée.
    expect(ticket.entryValidated).toBe(false)
  })

  test('valider son entrée via validate-entry', async ({ page }) => {
    const { editionId } = loadState()
    if (!orderItemId) throw new Error('orderItemId manquant')

    const response = await apiPost(
      page,
      `${BASE}/api/editions/${editionId}/ticketing/validate-entry`,
      {
        data: { participantIds: [orderItemId], type: 'ticket' },
      }
    )
    expect(response.ok()).toBe(true)

    const body = await response.json()
    const data = body.data ?? body
    // 1 validation effectuée (l'item était `entryValidated: false`).
    expect(data.validated).toBe(1)
  })

  test('la validation est reflétée par search (entryValidated = true)', async ({ page }) => {
    const { editionId } = loadState()
    if (!orderItemId) throw new Error('orderItemId manquant')

    const response = await apiPost(page, `${BASE}/api/editions/${editionId}/ticketing/search`, {
      data: { searchTerm: payerLastName },
    })
    expect(response.ok()).toBe(true)

    const body = await response.json()
    const results = body.data?.results ?? body.data ?? body
    const ticketEntry = results.tickets.find(
      (t: { participant: { ticket: { id: number } } }) => t.participant?.ticket?.id === orderItemId
    )
    expect(ticketEntry).toBeTruthy()
    expect(ticketEntry.participant.ticket.entryValidated).toBe(true)
    expect(ticketEntry.participant.ticket.entryValidatedAt).toBeTruthy()
  })

  test('la validation apparaît dans recent-validations', async ({ page }) => {
    const { editionId } = loadState()
    if (!orderItemId) throw new Error('orderItemId manquant')

    const response = await page.request.get(
      `${BASE}/api/editions/${editionId}/ticketing/recent-validations`
    )
    expect(response.ok()).toBe(true)

    const body = await response.json()
    const data = body.data ?? body
    const validations = data.validations ?? data
    expect(Array.isArray(validations)).toBe(true)

    // Notre billet validé (type 'ticket') doit figurer dans les dernières validations.
    const found = validations.find(
      (v: { id: number; type: string }) => v.id === orderItemId && v.type === 'ticket'
    )
    expect(found).toBeTruthy()
    expect(found.email).toBe(payerEmail)
  })

  test('dévalider son entrée via invalidate-entry', async ({ page }) => {
    const { editionId } = loadState()
    if (!orderItemId) throw new Error('orderItemId manquant')

    const response = await apiPost(
      page,
      `${BASE}/api/editions/${editionId}/ticketing/invalidate-entry`,
      {
        // `participantId` au singulier ; on précise `type: 'ticket'` (défaut serveur = 'volunteer').
        data: { participantId: orderItemId, type: 'ticket' },
      }
    )
    expect(response.ok()).toBe(true)
  })

  test('la dévalidation est reflétée par search (entryValidated = false)', async ({ page }) => {
    const { editionId } = loadState()
    if (!orderItemId) throw new Error('orderItemId manquant')

    const response = await apiPost(page, `${BASE}/api/editions/${editionId}/ticketing/search`, {
      data: { searchTerm: payerLastName },
    })
    expect(response.ok()).toBe(true)

    const body = await response.json()
    const results = body.data?.results ?? body.data ?? body
    const ticketEntry = results.tickets.find(
      (t: { participant: { ticket: { id: number } } }) => t.participant?.ticket?.id === orderItemId
    )
    expect(ticketEntry).toBeTruthy()
    expect(ticketEntry.participant.ticket.entryValidated).toBe(false)

    // Après dévalidation, le billet ne doit plus figurer dans recent-validations.
    const recent = await page.request.get(
      `${BASE}/api/editions/${editionId}/ticketing/recent-validations`
    )
    expect(recent.ok()).toBe(true)
    const recentBody = await recent.json()
    const validations = recentBody.data?.validations ?? recentBody.data ?? recentBody
    expect(
      validations.some(
        (v: { id: number; type: string }) => v.id === orderItemId && v.type === 'ticket'
      )
    ).toBe(false)
  })

  test('une liste *-not-validated répond (200) et expose un total', async ({ page }) => {
    const { editionId } = loadState()

    // On exerce `volunteers-not-validated` comme représentant des listes `*-not-validated`
    // (mêmes permissions `canAccessEditionDataOrAccessControl`). Les billets ne figurent pas
    // dans cette liste (dédiée aux bénévoles) — on vérifie donc seulement le contrat de réponse.
    const response = await page.request.get(
      `${BASE}/api/editions/${editionId}/ticketing/volunteers-not-validated`
    )
    expect(response.ok()).toBe(true)

    const body = await response.json()
    const data = body.data ?? body
    expect(Array.isArray(data.volunteers)).toBe(true)
    expect(typeof data.total).toBe('number')
  })

  test('nettoyage : supprimer la commande, le tarif et désactiver la billetterie', async ({
    page,
  }) => {
    const { editionId } = loadState()

    // Suppression de la commande en deux temps : DELETE #1 → annulation (Refunded),
    // DELETE #2 → suppression définitive de la commande Refunded.
    if (orderId) {
      const cancel = await apiDelete(
        page,
        `${BASE}/api/editions/${editionId}/ticketing/orders/${orderId}`
      )
      expect(cancel.ok()).toBe(true)

      const hardDelete = await apiDelete(
        page,
        `${BASE}/api/editions/${editionId}/ticketing/orders/${orderId}`
      )
      expect(hardDelete.ok()).toBe(true)
      orderId = null
      orderItemId = null
    }

    if (tierId) {
      const del = await apiDelete(
        page,
        `${BASE}/api/editions/${editionId}/ticketing/tiers/${tierId}`
      )
      expect(del.ok()).toBe(true)
      tierId = null
    }

    await updateEdition(page, String(editionId), { ticketingEnabled: false })
  })
})
