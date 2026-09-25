import { expect, test } from '@nuxt/test-utils/playwright'

import { loadState } from '../helpers'

const BASE = 'http://localhost:3000'
const AUTH = new URL('../../../../test-results/.auth/user.json', import.meta.url).pathname

/** Le corps de `UDashboardPanel` : le véritable élément défilant de la zone de gestion. */
const ZONE = '.zone-defilante-gestion'

/**
 * On arrivait sur une page de gestion déjà défilée, au niveau laissé sur la page précédente.
 *
 * La cause tenait à un déplacement du défilement lui-même : la fenêtre ne défile pas dans la zone
 * de gestion — son `scrollHeight` y vaut exactement sa hauteur visible — c'est le corps du panneau
 * qui défile. La remise à zéro de Nuxt, qui agit sur la fenêtre, s'exécutait donc sans effet.
 *
 * ⚠️ Ces tests mesurent le `scrollTop` du CONTENEUR, jamais celui de la fenêtre. Une vérification
 * portée sur la fenêtre serait verte en toutes circonstances, y compris avec le défaut : c'est
 * exactement ce qui est arrivé à la première sonde écrite pour ce constat.
 */
test.describe('Défilement du panneau de gestion', () => {
  async function ouvrirAccueilDefile(browser: import('@playwright/test').Browser) {
    const { editionId } = loadState()
    const context = await browser.newContext({
      storageState: AUTH,
      // Un grand écran : sous `md`, l'accueil n'affiche plus les cartes mais le sommaire des
      // catégories, et il n'y aurait aucun lien à suivre.
      viewport: { width: 1280, height: 700 },
      locale: 'fr-FR',
    })
    const page = await context.newPage()

    await page.goto(`${BASE}/editions/${editionId}/gestion`, { waitUntil: 'domcontentloaded' })
    await expect(page.locator('[data-carte-gestion]').first()).toBeVisible({ timeout: 40000 })

    await page.evaluate((s) => {
      const el = document.querySelector(s) as HTMLElement
      el.scrollTop = el.scrollHeight
    }, ZONE)

    const depart = await page.evaluate(
      (s) => (document.querySelector(s) as HTMLElement).scrollTop,
      ZONE
    )
    // Sans quoi le test ne prouverait rien : on ne peut hériter d'un défilement qu'il n'y a pas.
    expect(depart, 'l’accueil de gestion doit pouvoir défiler').toBeGreaterThan(100)

    return { page, context, editionId }
  }

  const defilement = (page: import('@playwright/test').Page) =>
    page.evaluate((s) => (document.querySelector(s) as HTMLElement | null)?.scrollTop ?? -1, ZONE)

  test('on arrive en haut d’une page atteinte depuis un accueil défilé', async ({ browser }) => {
    const { page, context } = await ouvrirAccueilDefile(browser)

    await page.locator('[data-carte-gestion][href$="/gestion/general-info"]').first().click()
    await expect(page.locator('[data-entete-page]').first()).toBeVisible({ timeout: 30000 })

    await expect.poll(() => defilement(page), { timeout: 10000 }).toBe(0)

    await context.close()
  })

  test('un changement de paramètre d’URL ne renvoie pas en haut', async ({ browser }) => {
    const { page, context, editionId } = await ouvrirAccueilDefile(browser)

    // Les colonnes visibles d'un tableau, la catégorie ouverte de l'accueil mobile et les filtres
    // vivent tous dans l'URL. Les modifier n'est pas changer de page, et ne doit pas déplacer le
    // lecteur — ce serait remplacer un défaut par son symétrique.
    await page.evaluate((s) => {
      ;(document.querySelector(s) as HTMLElement).scrollTop = 400
    }, ZONE)
    await expect.poll(() => defilement(page), { timeout: 5000 }).toBe(400)

    // Une vraie navigation du routeur, et non un `pushState` : ce dernier ne déclenche aucun des
    // crochets du routeur, et le test serait vert sans rien avoir éprouvé.
    await page.evaluate(() => {
      const racine = document.querySelector('#__nuxt') as
        | (HTMLElement & { __vue_app__?: { config: { globalProperties: { $router?: unknown } } } })
        | null
      const routeur = racine?.__vue_app__?.config.globalProperties.$router as
        | { push: (cible: unknown) => Promise<unknown> }
        | undefined
      if (!routeur) throw new Error('routeur introuvable : le test ne peut pas conclure')
      return routeur.push({ query: { essai: '1' } })
    })

    await expect(page).toHaveURL(new RegExp(`/editions/${editionId}/gestion\\?essai=1$`))
    await page.waitForTimeout(1200)

    expect(await defilement(page)).toBe(400)

    await context.close()
  })
})
