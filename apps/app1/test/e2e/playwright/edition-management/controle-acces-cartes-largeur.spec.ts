import { expect, test } from '@nuxt/test-utils/playwright'

import { loadState, updateEdition } from '../helpers'

const BASE = 'http://localhost:3000'
const AUTH = new URL('../../../../test-results/.auth/user.json', import.meta.url).pathname

/**
 * Les cartes de statistiques d'entrée, à toutes les largeurs.
 *
 * ⚠️ CE QUI N'ALLAIT PAS. La grille était figée à `grid-cols-1 md:grid-cols-2 lg:grid-cols-5` alors
 * que le NOMBRE DE CARTES VARIE de deux à cinq — bénévoles, artistes et organisateurs ne
 * s'affichent que si l'édition en compte. Cinq colonnes imposées laissaient des colonnes vides sur
 * une petite édition, et serraient cinq cartes sur deux colonnes entre 768 et 1024 px : une fenêtre
 * de portable à demi réduite, ou une tablette. Le défaut n'était donc pas « mobile », il était à
 * toutes les largeurs intermédiaires.
 *
 * 🔬 CE QUE CE SPEC MESURE, et pourquoi pas les classes CSS. Vérifier `auto-fit` dans l'attribut
 * `class` ne dirait rien du rendu : c'est la PAGE qui ne doit pas déborder, et les cartes qui
 * doivent rester lisibles. On mesure donc le débordement horizontal réel du document, à quatre
 * largeurs, et la visibilité du bloc.
 */
test.describe('Contrôle d’accès — les cartes de statistiques suivent la largeur', () => {
  let etaitActive = false

  test.beforeAll(async ({ browser }) => {
    const { editionId } = loadState()
    const context = await browser.newContext({ storageState: AUTH })
    const page = await context.newPage()

    const reponse = await page.request.get(`${BASE}/api/editions/${editionId}`)
    const corps = reponse.ok() ? await reponse.json() : {}
    etaitActive = Boolean((corps.data ?? corps)?.ticketingEnabled)

    await updateEdition(page, String(editionId), { ticketingEnabled: true })
    await context.close()
  })

  test.afterAll(async ({ browser }) => {
    if (etaitActive) return
    const { editionId } = loadState()
    const context = await browser.newContext({ storageState: AUTH })
    const page = await context.newPage()
    await updateEdition(page, String(editionId), { ticketingEnabled: false })
    await context.close()
  })

  test('ne déborde à aucune largeur, du téléphone au grand écran', async ({ page, goto }) => {
    const { editionId } = loadState()
    await goto(`/editions/${editionId}/gestion/ticketing/access-control`, {
      waitUntil: 'hydration',
    })

    const titre = page.getByRole('heading', { name: /statistiques d.entrée/i })
    await expect(titre).toBeVisible()

    /*
     * Les quatre largeurs ne sont pas des points de rupture : ce sont des cas réels. 390 px, un
     * téléphone ; 834 px, une tablette — exactement la plage où cinq cartes tombaient sur deux
     * colonnes ; 1024 px, une fenêtre à demi réduite ; 1600 px, un écran de bureau, où une grille
     * figée laissait des colonnes vides.
     */
    for (const width of [390, 834, 1024, 1600]) {
      await page.setViewportSize({ width, height: 900 })
      await expect(titre).toBeVisible()

      const deborde = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
      )
      expect(deborde, `la page déborde horizontalement à ${width} px`).toBe(false)
    }
  })
})
