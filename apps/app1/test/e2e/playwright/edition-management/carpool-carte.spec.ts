import { expect, test } from '@nuxt/test-utils/playwright'

import { apiDelete, apiPost, loadState } from '../helpers'

const BASE = 'http://localhost:3000'

/**
 * La carte du covoiturage : les épingles, le regroupement, et ce qui n'a pas de position.
 *
 * ⚠️ POURQUOI UNE SPEC ET PAS SEULEMENT DES TESTS UNITAIRES. Le regroupement est déjà couvert par
 * `points-du-covoiturage.test.ts`, qui est pur. Ce qu'il ne peut pas voir, c'est tout ce qui fait
 * échouer une carte EN SILENCE : Leaflet qui ne s'initialise pas, un conteneur sans hauteur, un
 * `divIcon` construit avant que `window.L` existe, un onglet dont le panneau reste démonté. Aucune
 * de ces pannes ne lève — on obtient un rectangle vide.
 *
 * 📍 Deux specs du dépôt exercent déjà Leaflet (`offline.spec.ts`, `map-selects-modales.spec.ts`) :
 * le CDN est donc joignable depuis la CI, ce qui n'allait pas de soi.
 */
test.describe.serial('Covoiturage : la vue carte', () => {
  const creees: number[] = []
  let sansPointId: number | null = null

  test('préparer deux villes et une annonce sans position', async ({ page }) => {
    const { editionId } = loadState()
    const dans7jours = new Date(Date.now() + 7 * 86400000).toISOString()

    // Deux offres DEPUIS LA MÊME VILLE : c'est le regroupement qui se vérifie plus bas. Sans lui,
    // deux épingles se superposeraient exactement et l'une serait invisible.
    for (const n of [1, 2]) {
      const r = await apiPost(page, `${BASE}/api/editions/${editionId}/carpool-offers`, {
        data: {
          locationCity: 'Lyon',
          locationAddress: `Place Bellecour ${n}`,
          latitude: 45.7578,
          longitude: 4.832,
          tripDate: dans7jours,
          availableSeats: 2,
          direction: 'TO_EVENT',
        },
      })
      expect(r.ok()).toBe(true)
      creees.push((await r.json())?.data?.id)
    }

    // Une autre ville, pour avoir une seconde épingle.
    const autre = await apiPost(page, `${BASE}/api/editions/${editionId}/carpool-offers`, {
      data: {
        locationCity: 'Toulouse',
        locationAddress: 'Place du Capitole',
        latitude: 43.6045,
        longitude: 1.4442,
        tripDate: dans7jours,
        availableSeats: 1,
        direction: 'TO_EVENT',
      },
    })
    expect(autre.ok()).toBe(true)
    creees.push((await autre.json())?.data?.id)

    /*
     * Et une annonce SANS position. `latitude: null` explicite : le serveur ne géocode alors pas —
     * voir `coordonnees-annonce.ts` — ce qui évite d'appeler Nominatim depuis la CI tout en
     * produisant exactement le cas que l'écran doit savoir nommer.
     */
    const muette = await apiPost(page, `${BASE}/api/editions/${editionId}/carpool-offers`, {
      data: {
        locationCity: 'ZzzVilleIntrouvable',
        locationAddress: 'Au bout du chemin',
        latitude: null,
        longitude: null,
        tripDate: dans7jours,
        availableSeats: 1,
        direction: 'TO_EVENT',
      },
    })
    expect(muette.ok()).toBe(true)
    sansPointId = (await muette.json())?.data?.id
    creees.push(sansPointId as number)
    expect(sansPointId).toBeTruthy()
  })

  test('l’onglet Carte pose une épingle par ville, et nomme ce qui n’en a pas', async ({
    page,
    goto,
  }) => {
    const { editionId } = loadState()

    await page.setViewportSize({ width: 1280, height: 900 })
    await expect(async () => {
      await goto(`/editions/${editionId}/carpool`, { waitUntil: 'hydration' })
      await expect(page.getByRole('tab', { name: /Carte/i })).toBeVisible({ timeout: 5000 })
    }).toPass({ timeout: 30000, intervals: [2000, 3000, 5000] })

    // Avant le clic, Leaflet ne doit PAS être chargé : `UTabs` démonte les panneaux inactifs, et
    // c'est ce qui évite d'imposer la carte à tout visiteur.
    await expect(page.locator('.leaflet-container')).toHaveCount(0)

    await page.getByRole('tab', { name: /Carte/i }).click()

    const carte = page.locator('.leaflet-container')
    await expect(carte).toBeVisible({ timeout: 30000 })

    /*
     * Les épingles. Deux villes + le lieu de la convention = 3. On vise `>= 2` plutôt que `=== 3` :
     * l'édition E2E n'a pas forcément été géocodée à sa création, et son marqueur manquerait sans
     * que la carte soit fautive. Le regroupement, lui, se vérifie exactement juste après.
     */
    const epingles = page.locator('.leaflet-marker-icon')
    await expect.poll(() => epingles.count(), { timeout: 20000 }).toBeGreaterThanOrEqual(2)

    // ⚠️ LE REGROUPEMENT, mesuré : l'épingle de Lyon porte « 2 », pas deux épingles « 1 ».
    await expect(epingles.filter({ hasText: /^2$/ })).toHaveCount(1)

    // Le clic ouvre une popup qui nomme la ville.
    await epingles.filter({ hasText: /^2$/ }).click()
    await expect(page.locator('.leaflet-popup-content')).toContainText('Lyon')

    // Et l'annonce sans position est NOMMÉE sous la carte, pas perdue.
    await expect(page.getByText('ZzzVilleIntrouvable')).toBeVisible()
  })

  test('un trait par ville, et PAS UN DE PLUS après un redessin', async ({ page, goto }) => {
    const { editionId } = loadState()

    /*
     * ⚠️ IGNORÉ PLUTÔT QUE VACUEMENT VERT, et ce filet a une histoire. Les traits exigent les
     * coordonnées de l'édition, qui sont NULLABLES. Une première version acceptait « 0 ou 2
     * traits » pour couvrir ce cas : elle comptait 0, vérifiait que 0 reste 0, et passait au vert
     * en masquant un vrai défaut — aucun trait n'était dessiné du tout, faute de `toRaw`.
     *
     * 📍 En pratique, `data.setup.ts` crée une édition dont l'adresse se géocode (mesuré :
     * 48.8704, 2.3146), donc ce test s'exécute. Le `skip` ne couvre que le jour où ce géocodage
     * échouerait : mieux vaut un test ignoré, qui se voit, qu'un test vert qui ne prouve rien.
     */
    const edition = await (await page.request.get(`${BASE}/api/editions/${editionId}`)).json()
    test.skip(
      typeof edition?.latitude !== 'number',
      'édition E2E sans coordonnées : aucun trait à compter, le test serait vacue'
    )

    await page.setViewportSize({ width: 1280, height: 900 })
    await expect(async () => {
      await goto(`/editions/${editionId}/carpool`, { waitUntil: 'hydration' })
      await expect(page.getByRole('tab', { name: /Carte/i })).toBeVisible({ timeout: 5000 })
    }).toPass({ timeout: 30000, intervals: [2000, 3000, 5000] })

    await page.getByRole('tab', { name: /Carte/i }).click()
    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 30000 })

    // Deux villes placées, donc exactement deux traits.
    const traits = page.locator('.leaflet-overlay-pane path')
    await expect.poll(() => traits.count(), { timeout: 15000 }).toBe(2)
    const avant = await traits.count()

    /*
     * ⚠️ LE POINT QUI COMPTE. `useLeafletMap` ne connaît que les marqueurs : rien n'efface les
     * traits. Sans le ménage explicite, chaque redessin en EMPILERAIT de nouveaux sur les
     * précédents — et comme ils se superposent exactement, on ne verrait rien jusqu'à ce que la
     * carte rame. On force deux redessins en basculant les archives.
     */
    for (const libelle of ['Afficher tout', 'Actifs seulement']) {
      const bouton = page.getByRole('button', { name: libelle })
      if (await bouton.count()) {
        await bouton.click()
        await page.waitForTimeout(1500)
      }
    }

    await expect.poll(() => traits.count(), { timeout: 15000 }).toBe(avant)
  })

  test('nettoyage : supprimer les annonces créées', async ({ page }) => {
    for (const id of creees.filter(Boolean)) {
      // Par identité, jamais par position : ce sont de vraies données de la base de développement.
      await apiDelete(page, `${BASE}/api/carpool-offers/${id}`)
    }
  })
})
