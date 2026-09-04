import { expect, test, type Browser, type Page } from '@nuxt/test-utils/playwright'

import { loadState } from '../helpers'

const BASE = 'http://localhost:3000'
const AUTH = new URL('../../../../test-results/.auth/user.json', import.meta.url).pathname

/** Seuil communément retenu pour une cible tactile confortable. */
const CIBLE_MINIMALE = 44

/**
 * Sur mobile, le panneau de gestion s'ouvre en tiroir et ses entrées faisaient 36 px de haut —
 * sous le seuil confortable, et deux fois moins que celles du menu des onglets d'une édition,
 * mesurées côte à côte à 56 px. Elles reprennent désormais les mêmes valeurs.
 *
 * Le test mesure des hauteurs réelles plutôt que de chercher une classe : c'est la taille rendue
 * qui gêne le doigt, et elle dépend du thème de Nuxt UI autant que de nos réglages.
 */
test.describe('Panneau de gestion — cibles tactiles', () => {
  async function contexte(browser: Browser, largeur: number) {
    const { editionId } = loadState()
    const ctx = await browser.newContext({
      storageState: AUTH,
      viewport: { width: largeur, height: 844 },
      locale: 'fr-FR',
    })
    const page = await ctx.newPage()
    await page.goto(`${BASE}/editions/${editionId}/gestion`, { waitUntil: 'domcontentloaded' })
    // En développement, le dock des devtools Vite recouvre le bouton du panneau.
    await page.addStyleTag({ content: 'vite-devtools-dock-embedded{display:none!important}' })
    return { page, ctx }
  }

  const hauteurs = (page: Page, selecteur: string) =>
    page.$$eval(selecteur, (els) =>
      els.map((el) => Math.round(el.getBoundingClientRect().height)).filter((h) => h > 0)
    )

  test('mobile : les entrées du tiroir sont assez hautes pour le doigt', async ({ browser }) => {
    const { page, ctx } = await contexte(browser, 390)

    await page.getByRole('button', { name: 'Open sidebar' }).click({ timeout: 40000 })
    const entrees = page.locator('[role=dialog] nav a')
    await expect(entrees.first()).toBeVisible()

    const mesures = await hauteurs(page, '[role=dialog] nav a')
    expect(mesures.length).toBeGreaterThan(2)
    expect(
      Math.min(...mesures),
      `entrées trop basses : ${mesures.join(', ')} px`
    ).toBeGreaterThanOrEqual(CIBLE_MINIMALE)

    await ctx.close()
  })

  test('grand écran : la colonne permanente reste compacte', async ({ browser }) => {
    const { page, ctx } = await contexte(browser, 1280)

    const entrees = page.locator('nav a')
    await expect(entrees.first()).toBeVisible({ timeout: 40000 })

    // Une entrée sur une seule ligne doit rester dense : la place ne manque pas, mais la liste
    // est longue. On regarde la plus courte, les libellés longs passant sur deux lignes.
    const mesures = await hauteurs(page, 'nav a')
    expect(
      Math.min(...mesures),
      `colonne devenue trop aérée : ${mesures.join(', ')} px`
    ).toBeLessThan(CIBLE_MINIMALE)

    await ctx.close()
  })
})
