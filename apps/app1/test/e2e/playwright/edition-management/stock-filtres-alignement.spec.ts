import { expect, test } from '@nuxt/test-utils/playwright'

import { apiDelete, apiPost, loadState, updateEdition } from '../helpers'

/**
 * Les quatre filtres de la liste d'un groupe restent sur une seule ligne, saisies alignées.
 *
 * ⚠️ POURQUOI CE TEST EXISTE. Deux des quatre champs portent désormais un texte d'aide, qui pend
 * sous la saisie et les rend PLUS HAUTS que les deux autres. La rangée était alignée par le bas
 * (`items-end`) : les deux champs aidés y remontaient donc leur saisie au-dessus de celle des deux
 * autres — quatre contrôles sur une ligne, dont deux décalés.
 *
 * Rien n'aurait signalé ce décalage : ni le typage, ni les tests de composant, ni un code 200. Il
 * ne se voit qu'en mesurant, ou en regardant l'écran.
 *
 * C'est une mesure de POSITION, pas une capture d'écran : on compare l'ordonnée des quatre saisies.
 * Une capture aurait à être relue à chaque changement de thème.
 */
test.describe.serial('Filtres du stock : les quatre saisies sur une ligne', () => {
  let groupId: number | null = null

  test.beforeAll(async () => {
    const { editionId } = loadState()
    if (!editionId) throw new Error('editionId manquant dans state.json (setup global non joué)')
  })

  test('préparer un groupe avec un objet', async ({ page }) => {
    const { editionId } = loadState()
    await updateEdition(page, String(editionId), { stockEnabled: true })

    const groupe = await apiPost(
      page,
      `http://localhost:3000/api/editions/${editionId}/stock-groups`,
      { data: { name: 'Alignement E2E', description: 'Groupe pour la mesure' } }
    )
    expect(groupe.ok()).toBe(true)
    groupId = (await groupe.json())?.data?.group?.id
    expect(groupId).toBeTruthy()

    // La barre de filtres n'est rendue que si le groupe contient au moins un objet.
    const objet = await apiPost(
      page,
      `http://localhost:3000/api/editions/${editionId}/stock-groups/${groupId}/items`,
      { data: { name: 'Projecteur alignement', quantity: 2 } }
    )
    expect(objet.ok()).toBe(true)
  })

  test('les quatre saisies sont à la même hauteur', async ({ page, goto }) => {
    const { editionId } = loadState()
    if (!groupId) throw new Error('groupId manquant')

    // Large, sinon les filtres passent dans la modale (`hidden lg:flex`) et il n'y a plus de
    // rangée à mesurer.
    await page.setViewportSize({ width: 1400, height: 900 })

    await expect(async () => {
      await goto(`/editions/${editionId}/gestion/stock/${groupId}`, { waitUntil: 'hydration' })
      await expect(page.getByText('Projecteur alignement')).toBeVisible({ timeout: 5000 })
    }).toPass({ timeout: 30000, intervals: [2000, 3000, 5000] })

    const barre = page
      .locator('.lg\\:flex')
      .filter({ has: page.locator('input') })
      .first()
    const saisies = barre.locator('input:visible')
    const nombre = await saisies.count()
    expect(nombre).toBeGreaterThanOrEqual(2)

    const ordonnees: number[] = []
    for (let i = 0; i < nombre; i++) {
      const boite = await saisies.nth(i).boundingBox()
      if (boite) ordonnees.push(boite.y)
    }
    expect(ordonnees.length).toBe(nombre)

    // Un écart de plus de deux pixels veut dire qu'un champ n'est plus sur la ligne des autres.
    const ecart = Math.max(...ordonnees) - Math.min(...ordonnees)
    expect(ecart, `ordonnées des saisies : ${ordonnees.join(', ')}`).toBeLessThanOrEqual(2)
  })

  test('nettoyage : supprimer le groupe', async ({ page }) => {
    const { editionId } = loadState()
    if (!groupId) return
    await apiDelete(page, `http://localhost:3000/api/editions/${editionId}/stock-groups/${groupId}`)
  })
})
