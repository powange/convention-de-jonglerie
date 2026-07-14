import { expect, test } from '@nuxt/test-utils/playwright'

import { apiDelete, apiPost, apiPut, loadCredentials, loadState } from '../helpers'

const BASE_URL = 'http://localhost:3000'

/**
 * Couvre le remboursement des consommables (matériel consommé pendant la prestation),
 * enveloppe distincte du défraiement trajet.
 *
 * Flow couvert :
 *   1. Création d'un artiste avec un plafond de consommables
 *   2. Relecture via la liste de gestion (round-trip Decimal)
 *   3. Renseignement du réel + marquage remboursé via PUT
 *   4. Garde-fou : réel > max rejeté en 400
 *   5. Garde-fou : suppression du max impossible tant qu'un réel existe
 *   6. Indépendance vis-à-vis du défraiement trajet
 */
test.describe.serial('Remboursement des consommables des artistes', () => {
  const timestamp = Date.now()
  const ARTIST_EMAIL = `e2e-consumables-${timestamp}@example.com`

  let editionId: string
  let artistId: number
  let selfArtistId: number

  const getArtist = async (page: any) => {
    const res = await page.request.get(`${BASE_URL}/api/editions/${editionId}/artists`)
    expect(res.ok(), `GET /artists a échoué: ${await res.text()}`).toBe(true)
    const body = await res.json()
    const artists = body.data?.artists || body.artists || []
    return artists.find((a: any) => a.user.email === ARTIST_EMAIL)
  }

  test('création d’un artiste avec un plafond de consommables', async ({ page }) => {
    editionId = loadState().editionId

    const response = await apiPost(page, `${BASE_URL}/api/editions/${editionId}/artists`, {
      data: {
        email: ARTIST_EMAIL,
        prenom: 'Conso',
        nom: 'Test',
        payment: 400,
        reimbursementMax: 150,
        consumablesMax: 80,
      },
    })
    expect(response.ok(), `POST /artists a échoué: ${await response.text()}`).toBe(true)

    const artist = await getArtist(page)
    expect(artist, `Artiste ${ARTIST_EMAIL} non trouvé`).toBeDefined()
    artistId = artist.id

    // Le plafond est bien persisté, et les enveloppes ne se mélangent pas
    expect(Number(artist.consumablesMax)).toBe(80)
    expect(artist.consumablesActual).toBeNull()
    expect(artist.consumablesActualPaid).toBe(false)
    expect(Number(artist.reimbursementMax)).toBe(150)
  })

  test('renseignement du réel puis marquage comme remboursé', async ({ page }) => {
    const response = await apiPut(
      page,
      `${BASE_URL}/api/editions/${editionId}/artists/${artistId}`,
      { data: { consumablesActual: 62.5, consumablesActualPaid: true } }
    )
    expect(response.ok(), `PUT a échoué: ${await response.text()}`).toBe(true)

    const artist = await getArtist(page)
    expect(Number(artist.consumablesActual)).toBe(62.5)
    expect(artist.consumablesActualPaid).toBe(true)
    // Le défraiement trajet n'a pas bougé
    expect(artist.reimbursementActualPaid).toBe(false)
  })

  test('un réel supérieur au plafond est rejeté', async ({ page }) => {
    const response = await apiPut(
      page,
      `${BASE_URL}/api/editions/${editionId}/artists/${artistId}`,
      { data: { consumablesActual: 500 } }
    )
    expect(response.status()).toBe(400)

    // La valeur en base n'a pas été modifiée
    const artist = await getArtist(page)
    expect(Number(artist.consumablesActual)).toBe(62.5)
  })

  test('le plafond ne peut pas être supprimé tant qu’un réel existe', async ({ page }) => {
    const response = await apiPut(
      page,
      `${BASE_URL}/api/editions/${editionId}/artists/${artistId}`,
      { data: { consumablesMax: null } }
    )
    expect(response.status()).toBe(400)

    const artist = await getArtist(page)
    expect(Number(artist.consumablesMax)).toBe(80)
  })

  test('les consommables sont visibles dans le tableau de gestion', async ({ page, goto }) => {
    await goto(`/editions/${editionId}/gestion/artists`, { waitUntil: 'hydration' })

    // Cible la ligne par l'email : le libellé d'en-tête « Consommables » contient
    // sinon le prénom de l'artiste de test.
    const row = page.locator('tr', { hasText: ARTIST_EMAIL }).first()
    await expect(row).toContainText('80')
    await expect(row).toContainText('62.5')
  })

  test('l’artiste voit ses consommables dans son espace artiste', async ({ page, goto }) => {
    // Le compte E2E est déjà authentifié : on l'inscrit lui-même comme artiste
    // pour pouvoir visiter /artist-space avec sa propre session.
    const { email } = loadCredentials()

    const created = await apiPost(page, `${BASE_URL}/api/editions/${editionId}/artists`, {
      data: { email, prenom: 'Self', nom: 'Artist', consumablesMax: 90, consumablesActual: 45 },
    })
    expect(created.ok(), `POST /artists (self) a échoué: ${await created.text()}`).toBe(true)

    const res = await page.request.get(`${BASE_URL}/api/editions/${editionId}/artists`)
    const body = await res.json()
    const artists = body.data?.artists || body.artists || []
    selfArtistId = artists.find((a: any) => a.user.email === email)?.id

    await goto(`/editions/${editionId}/artist-space`, { waitUntil: 'hydration' })

    // Le bloc consommables s'affiche avec plafond, réel et statut en attente
    await expect(page.getByText('Consommables maximum')).toBeVisible()
    await expect(page.getByText('90 €')).toBeVisible()
    await expect(page.getByText('Consommables réels')).toBeVisible()
    await expect(page.getByText('45 €')).toBeVisible()
    await expect(page.getByText('Consommables en attente')).toBeVisible()
  })

  // Le compte E2E est partagé par tous les specs : le laisser inscrit comme artiste
  // ferait apparaître l'espace artiste dans sa navigation et casserait un rerun.
  test('nettoyage : supprimer les artistes créés', async ({ page }) => {
    for (const id of [artistId, selfArtistId]) {
      if (!id) continue
      const del = await apiDelete(page, `${BASE_URL}/api/editions/${editionId}/artists/${id}`)
      expect(del.ok(), `DELETE artiste ${id} a échoué: ${await del.text()}`).toBe(true)
    }
  })
})
