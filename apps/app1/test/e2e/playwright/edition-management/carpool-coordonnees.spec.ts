import { expect, test } from '@nuxt/test-utils/playwright'

import { apiDelete, apiPost, apiPut, loadState } from '../helpers'

const BASE = 'http://localhost:3000'

/**
 * La coordonnée d'une annonce traverse vraiment zod, le point d'API et Prisma.
 *
 * ⚠️ POURQUOI CETTE SPEC EXISTE. Les règles de choix sont couvertes par un test unitaire mocké
 * (`coordonnees-annonce.test.ts`), mais il ne peut pas voir ce qui casse le plus souvent ici :
 * **zod retire les clés qu'il ne déclare pas.** Le formulaire enverrait les coordonnées, elles
 * disparaîtraient sans erreur, et l'annonce naîtrait sans point. C'est exactement ce qui est arrivé
 * aux trois préférences du trajet, et le schéma en porte encore le commentaire.
 *
 * 📍 Le géocodage de repli est VOLONTAIREMENT hors de cette spec : appeler Nominatim depuis la CI
 * serait instable et impoli. Il est couvert par le test unitaire, et le service a été éprouvé le
 * 05/10/2026 sur 31 villes avec la requête exacte de `geocodeVille`.
 */
test.describe.serial('Covoiturage : la coordonnée de la ville', () => {
  let offerId: number | null = null

  test('une offre créée avec sa coordonnée la conserve', async ({ page }) => {
    const { editionId } = loadState()

    const creation = await apiPost(page, `${BASE}/api/editions/${editionId}/carpool-offers`, {
      data: {
        locationCity: 'Vienne',
        locationAddress: 'Gare de Vienne',
        // Vienne en ISÈRE, celle que la personne a retenue dans les suggestions. Interrogé sur le
        // seul nom, Nominatim rend Vienne en Autriche — à 800 km. C'est tout l'intérêt de
        // transmettre le choix plutôt que de le laisser deviner.
        latitude: 45.5252,
        longitude: 4.8748,
        tripDate: new Date(Date.now() + 7 * 86400000).toISOString(),
        availableSeats: 3,
        direction: 'TO_EVENT',
      },
    })
    expect(creation.ok()).toBe(true)
    // `createSuccessResponse` enveloppe : `{ success, data }`. La liste, elle, rend un tableau nu —
    // les deux formes coexistent dans ce module, et supposer la mauvaise fait échouer sur un
    // `toBeTruthy` muet plutôt que sur ce qu'on voulait éprouver.
    offerId = (await creation.json())?.data?.id
    expect(offerId).toBeTruthy()

    // On relit par l'API, pas la réponse de création : ce qui compte est ce qui est EN BASE.
    const liste = await page.request.get(`${BASE}/api/editions/${editionId}/carpool-offers`)
    expect(liste.ok()).toBe(true)
    const notre = (await liste.json()).find((o: { id: number }) => o.id === offerId)

    expect(notre).toBeTruthy()
    expect(notre.latitude).toBeCloseTo(45.5252, 3)
    expect(notre.longitude).toBeCloseTo(4.8748, 3)
  })

  test('changer la ville ET la coordonnée déplace bien le point', async ({ page }) => {
    const { editionId } = loadState()
    if (!offerId) throw new Error('offerId manquant')

    const maj = await apiPut(page, `${BASE}/api/carpool-offers/${offerId}`, {
      data: { locationCity: 'Toulouse', latitude: 43.6045, longitude: 1.4442 },
    })
    expect(maj.ok()).toBe(true)

    const liste = await page.request.get(`${BASE}/api/editions/${editionId}/carpool-offers`)
    const notre = (await liste.json()).find((o: { id: number }) => o.id === offerId)

    expect(notre.locationCity).toBe('Toulouse')
    // ⚠️ L'ancien point ne doit PAS survivre : il désignerait Vienne, à 400 km de Toulouse.
    expect(notre.latitude).toBeCloseTo(43.6045, 3)
    expect(notre.longitude).toBeCloseTo(1.4442, 3)
  })

  test('nettoyage : supprimer l’offre', async ({ page }) => {
    if (!offerId) return
    const suppression = await apiDelete(page, `${BASE}/api/carpool-offers/${offerId}`)
    expect(suppression.ok()).toBe(true)
  })
})
