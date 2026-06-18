import { expect, test } from '@nuxt/test-utils/playwright'

import { apiDelete, apiPost, apiPut, loadState, updateEdition } from '../helpers'

const BASE = 'http://localhost:3000'

// Email distinct de manual-artist-claim.spec pour éviter toute collision sur l'édition partagée.
const ARTIST_EMAIL = `artiste-gestion-e2e-${Date.now()}@example.com`

/**
 * Smoke fonctionnel de la gestion des artistes (extraite en `layers/artists`).
 * Complète manual-artist-claim.spec (création + claim) en couvrant : le bloc d'infos artistes
 * (round-trip via le port `setArtistInfo`) et le rendu de la page de gestion.
 */
test.describe.serial('Module Artistes (gestion)', () => {
  let artistId: number | null = null

  test.beforeAll(async () => {
    const { editionId } = loadState()
    if (!editionId) throw new Error('editionId manquant dans state.json (setup global non joué)')
  })

  test("activer les artistes via l'API", async ({ page }) => {
    const { editionId } = loadState()
    await updateEdition(page, String(editionId), { artistsEnabled: true })
  })

  test('bloc infos artistes : PUT écrit via le port et renvoie la valeur', async ({ page }) => {
    const { editionId } = loadState()
    const response = await apiPut(page, `${BASE}/api/editions/${editionId}/artist-info`, {
      data: { artistInfo: 'Infos artistes E2E' },
    })
    expect(response.ok()).toBe(true)
    const body = await response.json()
    expect((body?.data ?? body)?.artistInfo).toBe('Infos artistes E2E')
  })

  test('créer un artiste via API et le voir dans la page de gestion', async ({ page, goto }) => {
    const { editionId } = loadState()
    const response = await apiPost(page, `${BASE}/api/editions/${editionId}/artists`, {
      data: { email: ARTIST_EMAIL, prenom: 'Jonglerie', nom: 'ArtisteE2E' },
    })
    expect(response.ok(), `POST /artists a échoué: ${await response.text()}`).toBe(true)
    const body = await response.json()
    artistId = body?.data?.artist?.id ?? body?.artist?.id
    expect(artistId).toBeTruthy()

    await expect(async () => {
      await goto(`/editions/${editionId}/gestion/artists`, { waitUntil: 'hydration' })
      await expect(page.getByRole('heading', { name: /gestion des artistes/i }).first()).toBeVisible(
        { timeout: 5000 }
      )
      await expect(page.getByText(/artistee2e/i).first()).toBeVisible({ timeout: 5000 })
    }).toPass({ timeout: 30000, intervals: [2000, 3000, 5000] })
  })

  test('l’artiste apparaît dans GET artists', async ({ page }) => {
    const { editionId } = loadState()
    const response = await page.request.get(`${BASE}/api/editions/${editionId}/artists`)
    expect(response.ok()).toBe(true)
    const body = await response.json()
    const artists = body?.data?.artists ?? body?.artists ?? []
    expect(artists.some((a: { user: { email: string } }) => a.user.email === ARTIST_EMAIL)).toBe(true)
  })

  test('nettoyage : supprimer l’artiste, vider les infos et désactiver', async ({ page }) => {
    const { editionId } = loadState()
    if (artistId) {
      const del = await apiDelete(page, `${BASE}/api/editions/${editionId}/artists/${artistId}`)
      expect(del.ok()).toBe(true)
    }
    await apiPut(page, `${BASE}/api/editions/${editionId}/artist-info`, {
      data: { artistInfo: null },
    })
    await updateEdition(page, String(editionId), { artistsEnabled: false })
  })
})
