import { expect, test } from '@nuxt/test-utils/playwright'

import { apiDelete, apiPost, loadState, updateEdition } from '../helpers'

test.describe.serial('Module Stock matériel', () => {
  let stockGroupId: number | null = null
  let stockItemId: number | null = null
  let stockReservationId: number | null = null

  test.beforeAll(async () => {
    const { editionId } = loadState()
    if (!editionId) throw new Error('editionId manquant dans state.json (setup global non joué)')
  })

  test("activer le module stock via l'API", async ({ page }) => {
    const { editionId } = loadState()
    await updateEdition(page, String(editionId), { stockEnabled: true })
  })

  test("la sidebar affiche l'entrée Stock matériel", async ({ page, goto }) => {
    const { editionId } = loadState()
    await goto(`/editions/${editionId}/gestion`, { waitUntil: 'hydration' })
    await expect(page.locator('h2').filter({ hasText: /stock mat/i })).toBeVisible({
      timeout: 10000,
    })
  })

  test('page stock : empty state au démarrage', async ({ page, goto }) => {
    const { editionId } = loadState()
    await goto(`/editions/${editionId}/gestion/stock`, { waitUntil: 'hydration' })
    await expect(page.getByRole('heading', { name: /stock mat/i }).first()).toBeVisible({
      timeout: 10000,
    })
    // Bouton nouveau groupe visible
    await expect(page.getByRole('button', { name: /nouveau groupe/i }).first()).toBeVisible({
      timeout: 5000,
    })
  })

  test('créer un groupe via API et le voir dans la liste', async ({ page, goto }) => {
    const { editionId } = loadState()
    const response = await apiPost(
      page,
      `http://localhost:3000/api/editions/${editionId}/stock-groups`,
      {
        data: {
          name: 'Éclairage E2E',
          description: 'Groupe de test E2E',
          // Le parcours réserve du matériel plus bas : sans ce réglage, le groupe est créé sans
          // système de réservation — c'est désormais le défaut, tout le matériel ne se réservant
          // pas — et l'API refuse, à juste titre.
          reservationsEnabled: true,
        },
      }
    )
    expect(response.ok()).toBe(true)
    const body = await response.json()
    stockGroupId = body?.data?.group?.id
    expect(stockGroupId).toBeTruthy()

    // Re-navigue jusqu'à ce que le groupe fraîchement créé apparaisse
    // (évite la flakiness de propagation données API → rendu de la page)
    await expect(async () => {
      await goto(`/editions/${editionId}/gestion/stock`, { waitUntil: 'hydration' })
      await expect(page.getByRole('heading', { name: /éclairage e2e/i })).toBeVisible({
        timeout: 5000,
      })
    }).toPass({ timeout: 30000, intervals: [2000, 3000, 5000] })
  })

  test('créer un item dans le groupe via API et le voir dans la page groupe', async ({
    page,
    goto,
  }) => {
    const { editionId } = loadState()
    if (!stockGroupId) throw new Error('stockGroupId manquant')

    const response = await apiPost(
      page,
      `http://localhost:3000/api/editions/${editionId}/stock-groups/${stockGroupId}/items`,
      {
        data: {
          name: 'Rallonge 10m E2E',
          location: 'Tente technique E2E',
          quantity: 5,
        },
      }
    )
    expect(response.ok()).toBe(true)
    const body = await response.json()
    stockItemId = body?.data?.item?.id
    expect(stockItemId).toBeTruthy()

    // Re-navigue jusqu'à ce que l'item fraîchement créé apparaisse.
    // L'item est affiché dans une cellule du tableau (vue « Liste »),
    // pas dans un titre → cibler la cellule.
    await expect(async () => {
      await goto(`/editions/${editionId}/gestion/stock/${stockGroupId}`, { waitUntil: 'hydration' })
      await expect(page.getByRole('cell', { name: /rallonge 10m e2e/i })).toBeVisible({
        timeout: 5000,
      })
      // La quantité ×5 doit s'afficher
      await expect(page.getByText(/×5/).first()).toBeVisible({ timeout: 5000 })
    }).toPass({ timeout: 30000, intervals: [2000, 3000, 5000] })
  })

  test('page item : disponibilité « 5/5 » par défaut (aucune réservation)', async ({
    page,
    goto,
  }) => {
    if (!stockItemId) throw new Error('stockItemId manquant')
    const { editionId } = loadState()
    await goto(`/editions/${editionId}/gestion/stock/items/${stockItemId}`, {
      waitUntil: 'hydration',
    })
    await expect(page.getByText(/5\/5\s*disponible/i).first()).toBeVisible({ timeout: 10000 })
  })

  test('créer une réservation et vérifier la dispo mise à jour', async ({ page, goto }) => {
    const { editionId } = loadState()
    if (!stockItemId) throw new Error('stockItemId manquant')

    // Réservation MAINTENANT → +1h pour qu'elle compte dans la dispo courante
    const now = new Date()
    const inOneHour = new Date(now.getTime() + 3600_000)

    const response = await apiPost(
      page,
      `http://localhost:3000/api/editions/${editionId}/stock-items/${stockItemId}/reservations`,
      {
        data: {
          startsAt: now.toISOString(),
          endsAt: inOneHour.toISOString(),
          usage: 'Test E2E spectacle de feu',
          quantityReserved: 2,
          location: 'Scène E2E',
        },
      }
    )
    expect(response.ok()).toBe(true)
    const body = await response.json()
    stockReservationId = body?.data?.reservation?.id
    expect(stockReservationId).toBeTruthy()

    // Page item devrait maintenant montrer 3/5 disponibles
    await goto(`/editions/${editionId}/gestion/stock/items/${stockItemId}`, {
      waitUntil: 'hydration',
    })
    await expect(page.getByText(/3\/5\s*disponible/i).first()).toBeVisible({ timeout: 10000 })
    // Le fil de réservations affiche l'usage
    await expect(page.getByText(/test e2e spectacle de feu/i)).toBeVisible({ timeout: 5000 })
  })

  test('refuse 409 une réservation qui dépasse la dispo restante', async ({ page }) => {
    const { editionId } = loadState()
    if (!stockItemId) throw new Error('stockItemId manquant')

    const now = new Date()
    const inOneHour = new Date(now.getTime() + 3600_000)

    // Il reste 3 disponibles, on demande 5 → doit refuser 409
    const response = await apiPost(
      page,
      `http://localhost:3000/api/editions/${editionId}/stock-items/${stockItemId}/reservations`,
      {
        data: {
          startsAt: now.toISOString(),
          endsAt: inOneHour.toISOString(),
          usage: 'Trop demandé',
          quantityReserved: 5,
          location: 'Scène E2E',
        },
      }
    )
    expect(response.status()).toBe(409)
  })

  /**
   * Les deux pages transverses du module se RENDENT.
   *
   * Elles ne sont pas couvertes ailleurs, et ce sont celles qui ont le plus bougé : filtres,
   * colonnes, tri, export. « Ce qui manque » a été cassée par une zone morte temporelle — un
   * `watch` déclaré au-dessus des références qu'il surveille, qui les lisait avant leur
   * initialisation et faisait échouer le `setup` entier.
   *
   * Aucun de nos contrôles habituels ne voit cette classe d'erreur. Une requête HTTP surtout :
   * ces pages sont rendues CÔTÉ CLIENT derrière `auth-protected`, si bien qu'un `curl` reçoit la
   * coquille de l'application — huit kilo-octets, titre vide — et un franc 200. Seul un
   * navigateur authentifié exécute le composant.
   */
  for (const page_ of ['missing', 'loans']) {
    test(`la page stock « ${page_} » se rend sans exception`, async ({ page, goto }) => {
      const { editionId } = loadState()

      const exceptions: string[] = []
      page.on('pageerror', (erreur) => exceptions.push(String(erreur)))

      await goto(`/editions/${editionId}/gestion/stock/${page_}`, { waitUntil: 'hydration' })

      // Un élément du CONTENU, pas seulement le gabarit : c'est ce qui distingue « la page
      // s'affiche » de « la route existe ».
      await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 15000 })

      expect(exceptions, `exceptions : ${exceptions.join(' | ')}`).toEqual([])
    })
  }

  test('availability via API : 3 disponibles maintenant', async ({ page }) => {
    const { editionId } = loadState()
    if (!stockItemId) throw new Error('stockItemId manquant')

    const response = await page.request.get(
      `http://localhost:3000/api/editions/${editionId}/stock-items/${stockItemId}/availability`
    )
    expect(response.ok()).toBe(true)
    const body = await response.json()
    expect(body?.data?.quantity).toBe(5)
    expect(body?.data?.reserved).toBe(2)
    expect(body?.data?.available).toBe(3)
  })

  test('supprimer la réservation libère la dispo', async ({ page, goto }) => {
    if (!stockReservationId) throw new Error('stockReservationId manquant')
    const { editionId } = loadState()

    const del = await apiDelete(
      page,
      `http://localhost:3000/api/editions/${editionId}/stock-reservations/${stockReservationId}`
    )
    expect(del.ok()).toBe(true)
    stockReservationId = null

    await goto(`/editions/${editionId}/gestion/stock/items/${stockItemId}`, {
      waitUntil: 'hydration',
    })
    await expect(page.getByText(/5\/5\s*disponible/i).first()).toBeVisible({ timeout: 10000 })
  })

  /**
   * Un groupe SANS réservations ne doit jamais appeler l'endpoint de planning.
   *
   * Constaté en production : 424 réponses 403 en quatre jours, sur onze groupes, toutes émises
   * par cette page. `refreshPlanning` est déclenché par cinq actions sans rapport avec la vue
   * planning — sauvegarde d'un objet, d'un groupe, modification par lot, réservation groupée —
   * et appelait le planning sans vérifier le réglage du groupe.
   *
   * L'endpoint a raison de refuser : il porte le réglage, pas seulement l'écran. C'est l'appel
   * côté client qui n'avait pas lieu d'être.
   */
  test('un groupe sans réservations n’appelle jamais le planning', async ({ page, goto }) => {
    const { editionId } = loadState()

    const creation = await apiPost(
      page,
      `http://localhost:3000/api/editions/${editionId}/stock-groups`,
      { data: { name: 'Sans réservation E2E', reservationsEnabled: false } }
    )
    expect(creation.ok(), `création du groupe : ${await creation.text()}`).toBe(true)
    const groupeSansReservation = (await creation.json())?.data?.group?.id
    expect(groupeSansReservation).toBeTruthy()

    // Toute requête vers le planning est relevée, quelle qu'en soit l'issue.
    const appelsAuPlanning: string[] = []
    page.on('request', (requete) => {
      if (requete.url().includes(`/stock-groups/${groupeSansReservation}/planning`)) {
        appelsAuPlanning.push(requete.url())
      }
    })

    await goto(`/editions/${editionId}/gestion/stock/${groupeSansReservation}`, {
      waitUntil: 'hydration',
    })

    /**
     * L'objet est créé DEPUIS L'INTERFACE, et c'est tout l'intérêt.
     *
     * Créé par l'API, aucun des cinq gestionnaires de sauvegarde de la page ne se déclenche — et
     * le test passait alors aussi bien avec le correctif que sans lui. Vérifié : c'est
     * `handleItemSaved`, branché sur la modale, qui appelle `refreshPlanning` et produisait le 403.
     */
    await page
      .getByRole('button', { name: /nouvel objet/i })
      .first()
      .click()
    await page.getByLabel(/nom de l’objet|nom de l'objet/i).fill('Objet sans réservation')
    await page.getByRole('button', { name: /^enregistrer$/i }).click()

    await expect(page.getByText(/objet sans réservation/i).first()).toBeVisible({ timeout: 15000 })

    expect(appelsAuPlanning, 'la page ne doit pas interroger le planning de ce groupe').toEqual([])

    await apiDelete(
      page,
      `http://localhost:3000/api/editions/${editionId}/stock-groups/${groupeSansReservation}`
    )
  })

  test('nettoyage : supprimer le groupe et désactiver le module', async ({ page }) => {
    const { editionId } = loadState()
    if (stockGroupId) {
      const del = await apiDelete(
        page,
        `http://localhost:3000/api/editions/${editionId}/stock-groups/${stockGroupId}`
      )
      expect(del.ok()).toBe(true)
    }
    await updateEdition(page, String(editionId), { stockEnabled: false })
  })
})
