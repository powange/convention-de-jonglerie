import { expect, test } from '@nuxt/test-utils/playwright'

import { apiPost, apiPut, loadState } from '../helpers'

const BASE = 'http://localhost:3000'
const AUTH = new URL('../../../../test-results/.auth/user.json', import.meta.url).pathname

/**
 * La barre d'en-tête des pages de gestion d'une édition, sur écran étroit.
 *
 * Deux demandes de l'utilisateur, le 1er octobre 2026 :
 *  • retirer la vignette (affiche de l'édition, ou logo de la convention à défaut) en version
 *    mobile — sur un écran étroit, elle prend de la largeur au seul contenu qui en a besoin, le
 *    nom de l'édition et ses dates ;
 *  • placer l'icône de messagerie à GAUCHE de celle des notifications, comme dans l'en-tête du
 *    site, pour qu'un organisateur retrouve ses deux icônes à la même place en passant de l'un à
 *    l'autre.
 *
 * ⚠️ LES DEUX ICÔNES SONT VISÉES PAR LEUR IDENTITÉ et non par leur position : `i-heroicons-bell`
 * et `i-heroicons-chat-bubble-left-right`, tels que Nuxt Icon les inscrit dans les classes. C'est
 * la technique de `entete-de-page-modules.spec.ts`, et la règle de ce dépôt — un `.nth()` sur une
 * barre d'icônes désigne autre chose dès qu'on en ajoute une.
 */
test.describe.serial('En-tête de gestion, version mobile', () => {
  /** Le navigateur du lot, relevé au premier test : les aides ci-dessous en ont besoin. */
  let browser_: import('@playwright/test').Browser
  const MOBILE = { width: 390, height: 844 }
  const BUREAU = { width: 1280, height: 900 }

  const ouvrir = async (
    browser: import('@playwright/test').Browser,
    viewport: { width: number; height: number }
  ) => {
    const context = await browser.newContext({ storageState: AUTH, viewport, locale: 'fr-FR' })
    return { page: await context.newPage(), context }
  }

  /**
   * La barre de gestion, une fois l'édition chargée.
   *
   * 📍 On attend `[data-entete-gestion]` et non un `<header>` : `UDashboardNavbar` n'en pose pas,
   * et ma première version attendait quarante secondes un élément qui n'existe pas. Ce marqueur
   * est posé exprès dans la mise en page, comme `data-carte-gestion` l'est sur l'accueil.
   */
  const allerSurLaGestion = async (page: import('@playwright/test').Page, editionId: string) => {
    await page.goto(`${BASE}/editions/${editionId}/gestion`, { waitUntil: 'domcontentloaded' })
    // La page est rendue côté client : attendre un élément de la barre, pas le code HTTP.
    await expect(page.locator('[data-entete-gestion]')).toBeVisible({ timeout: 40000 })
  }

  /**
   * ⚠️⚠️ L'ÉDITION DE TEST N'A AUCUNE IMAGE, et mes deux premières versions l'ont payé.
   *
   * Sans affiche ni logo de convention, aucun `[data-vignette-edition]` n'est rendu : le cas
   * mobile était VACUEMENT vert — il comptait zéro élément, ce qui serait arrivé même sans le
   * correctif —, et le cas « écran large » échouait en cherchant un élément qui ne pouvait pas
   * exister. On pose donc une affiche, et on la retire à la fin.
   *
   * 📍 `hidden` LAISSE L'ÉLÉMENT DANS LE DOM : compter les éléments ne dit donc rien. C'est la
   * propriété `display` CALCULÉE qu'il faut lire — et elle est de surcroît immune au fait que
   * l'image elle-même ne se charge pas (le nom de fichier posé ici ne désigne rien sur le disque,
   * ce qui réduirait sa boîte à zéro et ferait échouer un `toBeVisible`).
   */
  const AFFICHE = 'e2e-entete-vignette.jpg'

  const displayDeLaVignette = async (viewport: { width: number; height: number }) => {
    const { editionId } = loadState()
    const { page, context } = await ouvrir(browser_, viewport)
    try {
      await allerSurLaGestion(page, editionId)
      const vignette = page.locator('[data-vignette-edition]')
      await expect(vignette).toHaveCount(1, { timeout: 20000 })
      return await vignette.evaluate((el) => getComputedStyle(el).display)
    } finally {
      await context.close()
    }
  }

  test('poser une affiche sur l’édition de test', async ({ page, browser }) => {
    browser_ = browser
    const { editionId } = loadState()
    const reponse = await apiPut(page, `${BASE}/api/editions/${editionId}`, {
      data: { imageUrl: AFFICHE },
    })
    expect(reponse.ok(), `pose de l'affiche : ${await reponse.text()}`).toBe(true)
  })

  test('🔬 la vignette est MASQUÉE sous `sm`', async () => {
    expect(await displayDeLaVignette(MOBILE)).toBe('none')
  })

  test('🔬 et VISIBLE au-delà', async () => {
    /*
     * Le pendant nécessaire : la demande portait sur la version MOBILE. Sans ce cas, retirer la
     * vignette partout passerait pour un succès, et personne ne le verrait avant de rouvrir la
     * page sur un ordinateur.
     */
    expect(await displayDeLaVignette(BUREAU)).not.toBe('none')
  })

  test('ce qui doit rester dans la barre y est', async ({ browser }) => {
    // Sans cette assertion, une barre entièrement vide passerait pour un succès sur mobile : le
    // nom de l'édition, et ses dates (d'où le chiffre).
    const { editionId } = loadState()
    const { page, context } = await ouvrir(browser, MOBILE)
    try {
      await allerSurLaGestion(page, editionId)
      await expect(page.locator('[data-entete-gestion]')).toContainText(/\d/)
    } finally {
      await context.close()
    }
  })

  test('🔬 le nom de l’édition est en GRAS sur mobile, et pas au-delà', async ({ browser }) => {
    /*
     * Sur mobile, le nom de la convention au-dessus est masqué : le nom de l'édition devient LE
     * titre de la barre, et doit se lire comme tel. Au-delà de `sm`, la convention reprend ce
     * rôle et l'édition redevient son sous-titre — d'où les deux mesures, qui tiennent la
     * hiérarchie des deux côtés.
     *
     * 📍 On lit la graisse CALCULÉE et non la classe : `font-semibold sm:font-normal` ne dit rien
     * de ce que le navigateur applique réellement au seuil choisi.
     */
    const { editionId } = loadState()

    const graisse = async (viewport: { width: number; height: number }) => {
      const { page, context } = await ouvrir(browser, viewport)
      try {
        await allerSurLaGestion(page, editionId)
        return await page
          .locator('[data-nom-edition]')
          .evaluate((el) => getComputedStyle(el).fontWeight)
      } finally {
        await context.close()
      }
    }

    expect(Number(await graisse(MOBILE))).toBeGreaterThanOrEqual(600)
    expect(Number(await graisse(BUREAU))).toBeLessThan(600)
  })

  /*
   * 📍 L'ORDRE DES DEUX ICÔNES N'EST PAS ÉPROUVÉ ICI, et c'est un choix assumé.
   *
   * `MessengerHeaderButton` ne s'affiche que si le compte a AU MOINS UNE CONVERSATION
   * (`hasConversations`, dans le composant) — règle qui lui est propre et qui vaut aussi dans
   * l'en-tête du site. Sans conversation, un test d'ordre serait VACUEMENT vert : l'icône serait
   * absente et l'ordre trivialement « respecté ».
   *
   * Et en donner une au compte de test coûte plus que l'assertion ne vaut : le groupe des
   * organisateurs exige une ligne `EditionOrganizer` que le créateur d'une convention n'a pas
   * (403 constaté), et passer le compte bénévole de l'édition partagée remplit son prénom — une
   * cohabitation qui a déjà valu une CI rouge à `volunteers.spec.ts`.
   *
   * L'ordre est donc tenu par `test/unit/components/entete-gestion-icones.test.ts`, qui lit la
   * mise en page. Il prouve moins — la source, pas le rendu —, mais il le prouve vraiment.
   */

  /**
   * Nettoyage en `afterAll` : l'édition est PARTAGÉE par les autres lots, et une affiche laissée
   * derrière changerait l'allure de leurs en-têtes. Un échec en cours de route saute les tests
   * suivants, donc le nettoyage ne peut pas être un dernier `test()`.
   */
  test.afterAll(async ({ browser }) => {
    const { editionId } = loadState()
    const context = await browser.newContext({ storageState: AUTH })
    const page = await context.newPage()
    try {
      const reponse = await apiPut(page, `${BASE}/api/editions/${editionId}`, {
        data: { imageUrl: null },
      })
      if (!reponse.ok()) console.warn('[nettoyage] affiche non retirée :', await reponse.text())
    } finally {
      await context.close()
    }
  })
})
