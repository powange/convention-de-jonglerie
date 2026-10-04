import { expect, test } from '@nuxt/test-utils/playwright'

import { apiDelete, apiPost, loadState } from '../helpers'

const BASE = 'http://localhost:3000'

/**
 * Smoke fonctionnel du covoiturage (extrait en `layers/carpool`) : création d'une offre via l'API,
 * présence dans la liste, et rendu sur la page publique de covoiturage. Pas de flag d'activation.
 */
test.describe.serial('Module Covoiturage', () => {
  let offerId: number | null = null

  test.beforeAll(async () => {
    const { editionId } = loadState()
    if (!editionId) throw new Error('editionId manquant dans state.json (setup global non joué)')
  })

  test('créer une offre de covoiturage via API et la voir sur la page publique', async ({
    page,
    goto,
  }) => {
    const { editionId } = loadState()
    const tripDate = new Date(Date.now() + 7 * 24 * 3600_000)

    const response = await apiPost(page, `${BASE}/api/editions/${editionId}/carpool-offers`, {
      data: {
        locationCity: 'Lyon',
        locationAddress: '1 Place Bellecour',
        tripDate: tripDate.toISOString(),
        availableSeats: 3,
        direction: 'TO_EVENT',
        description: 'Trajet de test E2E',
      },
    })
    expect(response.ok()).toBe(true)
    const body = await response.json()
    offerId = (body?.data ?? body)?.id
    expect(offerId).toBeTruthy()

    await expect(async () => {
      await goto(`/editions/${editionId}/carpool`, { waitUntil: 'hydration' })
      await expect(page.getByText(/lyon/i).first()).toBeVisible({ timeout: 5000 })
    }).toPass({ timeout: 30000, intervals: [2000, 3000, 5000] })
  })

  test('l’offre apparaît dans GET carpool-offers', async ({ page }) => {
    const { editionId } = loadState()
    if (!offerId) throw new Error('offerId manquant')
    const response = await page.request.get(`${BASE}/api/editions/${editionId}/carpool-offers`)
    expect(response.ok()).toBe(true)
    const body = await response.json()
    const offers = Array.isArray(body) ? body : (body?.data ?? body?.offers ?? [])
    expect(offers.some((o: { id: number }) => o.id === offerId)).toBe(true)
  })

  /**
   * ⚠️ LA VILLE S'EFFAÇAIT DÈS QU'ON QUITTAIT LE CHAMP, ET LA VALIDATION LA RÉCLAMAIT ENSUITE.
   *
   * Signalé à l'usage : on tape « Marseille », on choisit la suggestion, le champ l'affiche — et la
   * soumission répond que la ville n'est pas valide. `UInputMenu` vide son terme de recherche à la
   * sélection (`resetSearchTermOnSelect`) ET au départ du champ (`resetSearchTermOnBlur`), tous
   * deux à `true` par défaut. Or c'est ce terme qui alimente `form.locationCity`.
   *
   * 🔬 POURQUOI CE TEST EST ICI ET NON EN TEST DE COMPOSANT. Essayé : sous `mountSuspended`, un
   * `blur` ne déclenche pas cette remise à zéro — le test passait au vert AVEC ET SANS le
   * correctif. Seul un vrai navigateur la reproduit. Un test vert des deux côtés ne prouve rien,
   * et vaut moins que pas de test du tout, parce qu'il fait croire que c'est gardé.
   *
   * 📍 On ne choisit PAS de suggestion : elles viennent de Nominatim, un service externe dont une
   * panne ferait échouer ce test pour une raison étrangère au défaut. Le départ du champ suffit à
   * éprouver la cause, qui est commune aux deux chemins.
   */
  test('la ville saisie survit au départ du champ', async ({ page, goto }) => {
    const { editionId } = loadState()
    await goto(`/editions/${editionId}/carpool`, { waitUntil: 'hydration' })

    // Libellé relevé dans `fr/components.json` : « Demander un covoiturage ».
    await page
      .getByRole('button', { name: /demander un covoiturage/i })
      .first()
      .click()

    /*
     * Le champ se désigne par son NOM ACCESSIBLE, « Ville de départ* », relevé dans l'instantané
     * de page d'un échec de CI. Le placeholder, lui, n'est pas exposé sur ce combobox — une
     * première version visait `getByPlaceholder` et ne trouvait rien.
     */
    const ville = page.getByRole('combobox', { name: /ville de départ/i })
    await expect(ville).toBeVisible()
    await ville.fill('Marseille')
    await expect(ville).toHaveValue('Marseille')

    // Quitter le champ : c'est le geste qui vidait tout.
    await ville.blur()

    await expect(ville).toHaveValue('Marseille')
  })

  test('nettoyage : supprimer l’offre', async ({ page }) => {
    if (!offerId) return
    const del = await apiDelete(page, `${BASE}/api/carpool-offers/${offerId}`)
    expect(del.ok()).toBe(true)
  })
})
