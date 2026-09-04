import { expect, test, type Browser } from '@nuxt/test-utils/playwright'

import { enableVolunteers, loadState, updateVolunteerSettings } from '../helpers'

const BASE = 'http://localhost:3000'
const AUTH = new URL('../../../../test-results/.auth/user.json', import.meta.url).pathname

/**
 * L'en-tête de la gestion des candidatures restait en ligne sur mobile : le bouton « Ajouter un
 * bénévole » gardait sa largeur propre et réduisait le titre et la note à des colonnes de deux
 * ou trois mots. Il s'empile désormais sous le texte, sur toute la largeur.
 *
 * La mesure porte sur la position réelle des éléments : un test de classe CSS passerait alors
 * même que le rendu resterait écrasé.
 */
test.describe('Gestion des candidatures — en-tête', () => {
  async function ouvrir(browser: Browser, largeur: number) {
    const { editionId } = loadState()
    const ctx = await browser.newContext({
      storageState: AUTH,
      viewport: { width: largeur, height: 844 },
      locale: 'fr-FR',
    })
    const page = await ctx.newPage()
    await enableVolunteers(page, editionId)
    await updateVolunteerSettings(page, editionId, { mode: 'INTERNAL' })
    await page.goto(`${BASE}/editions/${editionId}/gestion/volunteers/applications`, {
      waitUntil: 'domcontentloaded',
    })
    const bouton = page.getByRole('button', { name: /ajouter un bénévole/i }).first()
    await expect(bouton).toBeVisible({ timeout: 40000 })
    const titre = page.getByRole('heading', { name: 'Gestion des candidatures' }).last()
    return { page, ctx, bouton, titre }
  }

  test('mobile : le bouton passe sous le texte, sur toute la largeur', async ({ browser }) => {
    const { page, ctx, bouton, titre } = await ouvrir(browser, 390)

    const b = (await bouton.boundingBox())!
    const t = (await titre.boundingBox())!

    expect(b.y, 'le bouton devrait être sous le titre, pas à côté').toBeGreaterThan(t.y + t.height)
    // Le titre dispose alors de toute la largeur de la carte, au lieu d'une colonne étroite.
    expect(t.width).toBeGreaterThan(250)
    expect(b.width).toBeGreaterThan(250)

    await ctx.close()
    void page
  })

  test('grand écran : le bouton reste à droite du titre', async ({ browser }) => {
    const { ctx, bouton, titre } = await ouvrir(browser, 1280)

    const b = (await bouton.boundingBox())!
    const t = (await titre.boundingBox())!

    expect(b.x, 'le bouton devrait rester à droite du titre').toBeGreaterThan(t.x + t.width)
    expect(b.y).toBeLessThan(t.y + t.height)

    await ctx.close()
  })
})
