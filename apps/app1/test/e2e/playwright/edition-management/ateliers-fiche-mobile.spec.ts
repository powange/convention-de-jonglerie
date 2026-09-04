import { expect, test, type Browser } from '@nuxt/test-utils/playwright'

import { apiDelete, apiPost, loadState, setEditionStatus, updateEdition } from '../helpers'

const BASE = 'http://localhost:3000'
const AUTH = new URL('../../../../test-results/.auth/user.json', import.meta.url).pathname
const TITRE = 'Portés acrobatiques E2E'

/**
 * Deux défauts signalés sur la page publique des ateliers, capture à l'appui.
 *
 * 1. Sur un téléphone, la fiche débordait : les trois informations (horaire, lieu, places) se
 *    serraient sur une seule ligne et cassaient en plein milieu, et les boutons d'action, qui
 *    portaient leur libellé en toutes lettres, sortaient de l'écran.
 * 2. Le jour n'existait que dans l'en-tête de groupe. Dès qu'on faisait défiler — ou dans
 *    l'onglet des favoris — une fiche n'annonçait plus que son horaire.
 *
 * On mesure donc des largeurs rendues et la présence du jour SUR la fiche, pas des classes.
 */
test.describe.serial('Ateliers — la fiche sur un téléphone', () => {
  let atelierId: number | null = null

  test.beforeAll(async ({ browser }) => {
    const { editionId } = loadState()
    const context = await browser.newContext({ storageState: AUTH })
    const page = await context.newPage()
    await setEditionStatus(page, String(editionId), 'PUBLISHED')
    await updateEdition(page, String(editionId), { workshopsEnabled: true })

    const debut = new Date(Date.now() + 7.5 * 24 * 3600_000)
    const reponse = await apiPost(page, `${BASE}/api/editions/${editionId}/workshops`, {
      data: {
        title: TITRE,
        description: 'Atelier de test',
        startDateTime: debut.toISOString(),
        endDateTime: new Date(debut.getTime() + 3600_000).toISOString(),
        maxParticipants: 15,
      },
    })
    if (!reponse.ok()) throw new Error(`création impossible : ${await reponse.text()}`)
    atelierId = ((await reponse.json())?.data ?? {})?.id ?? null
    await context.close()
  })

  // L'édition est partagée : ce qu'on y ajoute, on le retire, et le module revient à son état.
  test.afterAll(async ({ browser }) => {
    const { editionId } = loadState()
    const context = await browser.newContext({ storageState: AUTH })
    const page = await context.newPage()
    if (atelierId) {
      const r = await apiDelete(page, `${BASE}/api/editions/${editionId}/workshops/${atelierId}`)
      if (!r.ok()) console.error('[nettoyage] atelier non supprimé', await r.text())
    }
    await updateEdition(page, String(editionId), { workshopsEnabled: false })
    await context.close()
  })

  async function ouvrir(browser: Browser, largeur: number) {
    const { editionId } = loadState()
    const context = await browser.newContext({
      storageState: AUTH,
      viewport: { width: largeur, height: 900 },
      locale: 'fr-FR',
    })
    const page = await context.newPage()
    await page.goto(`${BASE}/editions/${editionId}/workshops`, { waitUntil: 'domcontentloaded' })
    const carte = page.locator('div').filter({ hasText: TITRE }).last()
    await expect(page.getByText(TITRE).first()).toBeVisible({ timeout: 30000 })
    return { page, context, carte }
  }

  test('mobile : la fiche ne déborde pas de l’écran', async ({ browser }) => {
    const { page, context } = await ouvrir(browser, 390)

    // Rien ne doit dépasser la largeur du téléphone : c'était le bouton « Modifier le workshop ».
    const debordements = await page.evaluate(() => {
      const trouves: string[] = []
      for (const el of document.querySelectorAll('main *')) {
        const r = el.getBoundingClientRect()
        if (r.width > 0 && r.right > window.innerWidth + 1) {
          trouves.push(`${el.tagName}.${(el as HTMLElement).className}`.slice(0, 70))
        }
      }
      return trouves.slice(0, 5)
    })
    expect(debordements, `éléments hors de l’écran : ${debordements.join(' | ')}`).toEqual([])

    await context.close()
  })

  test('la fiche porte le jour, pas seulement l’horaire', async ({ browser }) => {
    const { page, context } = await ouvrir(browser, 390)

    // Le jour doit se lire sur la fiche elle-même : l'en-tête de groupe disparaît au défilement.
    const fiche = page.locator('[class*="card"], div').filter({ hasText: TITRE }).last()
    await expect(
      fiche.getByText(/\b(lun|mar|mer|jeu|ven|sam|dim)\.? \d{2}\/\d{2}/),
      'la fiche devrait annoncer son jour'
    ).toBeVisible()

    await context.close()
  })

  test('grand écran : les libellés des actions restent affichés', async ({ browser }) => {
    const { page, context } = await ouvrir(browser, 1280)

    // Le repli ne doit pas priver le bureau de ses libellés, où la place ne manque pas.
    await expect(page.getByRole('button', { name: /modifier le workshop/i }).first()).toBeVisible()

    await context.close()
  })
})
