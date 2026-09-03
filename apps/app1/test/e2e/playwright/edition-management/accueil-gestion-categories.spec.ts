import { expect, test, type Browser } from '@nuxt/test-utils/playwright'

import { enableVolunteers, loadState, updateVolunteerSettings } from '../helpers'

const BASE = 'http://localhost:3000'
const AUTH = new URL('../../../../test-results/.auth/user.json', import.meta.url).pathname

/**
 * Sur mobile, l'accueil de gestion tenait sur une page très longue : une quinzaine de blocs,
 * chacun dépliant tous ses liens. Il n'affiche désormais que les catégories, et ouvrir l'une
 * d'elles ne montre qu'elle — sans quitter la page.
 *
 * Le seuil est porté par Tailwind (`md`), pas par une mesure de largeur en JavaScript : c'est
 * pourquoi ces tests changent la taille de la fenêtre plutôt que de simuler un appareil.
 */
test.describe('Accueil de gestion — repli par catégories sur mobile', () => {
  async function ouvrirAccueil(browser: Browser, largeur: number, requete = '') {
    const { editionId } = loadState()
    const context = await browser.newContext({
      storageState: AUTH,
      viewport: { width: largeur, height: 844 },
      locale: 'fr-FR',
    })
    const page = await context.newPage()

    // Le bloc bénévoles n'apparaît qu'avec le bénévolat activé, en mode interne.
    await enableVolunteers(page, editionId)
    await updateVolunteerSettings(page, editionId, { mode: 'INTERNAL' })

    await page.goto(`${BASE}/editions/${editionId}/gestion${requete}`, {
      waitUntil: 'domcontentloaded',
    })
    return { page, context, editionId }
  }

  const sommaire = (page: import('@playwright/test').Page) =>
    page.getByRole('button', { name: 'Gestion des bénévoles', exact: true })
  const titreSection = (page: import('@playwright/test').Page) =>
    page.getByRole('heading', { name: 'Gestion des bénévoles', exact: true })

  test('mobile : le sommaire d’abord, puis la seule catégorie ouverte', async ({ browser }) => {
    const { page, context, editionId } = await ouvrirAccueil(browser, 390)

    await expect(sommaire(page)).toBeVisible({ timeout: 40000 })
    // Les sections elles-mêmes sont repliées : c'est tout l'objet du changement.
    await expect(titreSection(page)).toBeHidden()

    await sommaire(page).click()

    // La catégorie ouverte vit dans l'URL, ce qui rend l'écran partageable et rechargeable.
    await expect(page).toHaveURL(`${BASE}/editions/${editionId}/gestion?section=benevoles`)
    await expect(titreSection(page)).toBeVisible()
    await expect(sommaire(page)).toBeHidden()

    // Les autres catégories, elles, restent hors de vue.
    await expect(page.getByRole('heading', { name: 'Objets trouvés', exact: true })).toBeHidden()

    await context.close()
  })

  test('mobile : le bouton de retour et celui du téléphone ramènent au sommaire', async ({
    browser,
  }) => {
    const { page, context } = await ouvrirAccueil(browser, 390)

    await expect(sommaire(page)).toBeVisible({ timeout: 40000 })
    await sommaire(page).click()
    await expect(titreSection(page)).toBeVisible()

    await page.getByRole('button', { name: 'Toutes les catégories' }).click()
    await expect(sommaire(page)).toBeVisible()
    await expect(titreSection(page)).toBeHidden()

    // Le geste « retour » du téléphone doit faire la même chose, et non quitter la page.
    await sommaire(page).click()
    await expect(titreSection(page)).toBeVisible()
    await page.goBack()
    await expect(sommaire(page)).toBeVisible()

    await context.close()
  })

  test('mobile : une URL de catégorie s’ouvre directement dessus', async ({ browser }) => {
    const { page, context } = await ouvrirAccueil(browser, 390, '?section=benevoles')

    await expect(titreSection(page)).toBeVisible({ timeout: 40000 })
    await expect(sommaire(page)).toBeHidden()

    await context.close()
  })

  test('grand écran : rien ne change, tout reste déplié', async ({ browser }) => {
    const { page, context } = await ouvrirAccueil(browser, 1280)

    await expect(titreSection(page)).toBeVisible({ timeout: 40000 })
    // Plusieurs catégories à la fois, et aucun sommaire.
    await expect(page.getByRole('heading', { name: 'Objets trouvés', exact: true })).toBeVisible()
    await expect(sommaire(page)).toBeHidden()

    await context.close()
  })
})
