import { expect, test } from '@nuxt/test-utils/playwright'

import { apiDelete, apiPost, enableVolunteers, loadState, setEditionStatus } from '../helpers'

const BASE = 'http://localhost:3000'
const AUTH = new URL('../../../../test-results/.auth/user.json', import.meta.url).pathname
const TITRE_CRENEAU = `Contrôle infobulle ${Date.now()}`

/** L'infobulle d'un créneau : un bloc construit à la main, posé à la racine de la page. */
const INFOBULLE = '.slot-tooltip'

/**
 * L'infobulle d'un créneau ne doit pas s'ouvrir au doigt.
 *
 * Elle s'ouvrait. Un appui tactile déclenche les événements de souris EN PLUS du clic —
 * `mouseenter` puis `click` — si bien que l'infobulle apparaissait, la modale du créneau s'ouvrait
 * par-dessus, et comme le doigt ne « sort » de rien, `mouseleave` ne se déclenchait jamais :
 * l'infobulle restait suspendue au-dessus de la modale.
 *
 * Rien ne se perd au tactile : l'appui ouvre la modale, qui porte la même liste complète.
 *
 * ⚠️ Les deux gestes sont mesurés sur le MÊME écran. Un test qui ne vérifierait que l'absence au
 * doigt serait vert si l'infobulle avait disparu pour tout le monde — c'est-à-dire si le correctif
 * avait emporté la fonctionnalité avec le défaut.
 */
test.describe.serial('Planning — l’infobulle d’un créneau', () => {
  let editionId = ''

  test('préparer une édition avec une équipe et un créneau', async ({ page }) => {
    const { conventionId } = loadState()

    const edition = await apiPost(page, `${BASE}/api/editions`, {
      data: {
        conventionId: Number(conventionId),
        startDate: new Date(Date.now() - 86400000).toISOString(),
        endDate: new Date(Date.now() + 86400000).toISOString(),
        addressLine1: '1 rue de l’Infobulle',
        postalCode: '75001',
        city: 'Paris',
        country: 'France',
      },
    })
    expect(edition.ok(), `création d'édition : ${await edition.text()}`).toBe(true)
    editionId = String((await edition.json()).data?.id)

    await enableVolunteers(page, editionId)
    await setEditionStatus(page, editionId, 'PUBLISHED')

    const equipe = await apiPost(page, `${BASE}/api/editions/${editionId}/volunteer-teams`, {
      data: { name: `Équipe infobulle ${Date.now()}`, color: '#3b82f6' },
    })
    expect(equipe.ok(), `création d'équipe : ${await equipe.text()}`).toBe(true)
    const corpsEquipe = await equipe.json()
    const equipeId = corpsEquipe.data?.id ?? corpsEquipe.id

    // Un créneau qui encadre l'instant présent : la vue du jour l'affiche quelle que soit l'heure.
    const maintenant = Date.now()
    const creneau = await apiPost(page, `${BASE}/api/editions/${editionId}/volunteer-time-slots`, {
      data: {
        title: TITRE_CRENEAU,
        teamId: equipeId,
        startDateTime: new Date(maintenant - 30 * 60 * 1000).toISOString(),
        endDateTime: new Date(maintenant + 30 * 60 * 1000).toISOString(),
        maxVolunteers: 3,
      },
    })
    expect(creneau.ok(), `création de créneau : ${await creneau.text()}`).toBe(true)
  })

  /** Ouvre le planning de gestion et rend le premier créneau du calendrier. */
  const ouvrirPlanning = async (browser: import('@playwright/test').Browser, tactile: boolean) => {
    const context = await browser.newContext({
      storageState: AUTH,
      viewport: tactile ? { width: 390, height: 844 } : { width: 1400, height: 900 },
      locale: 'fr-FR',
      hasTouch: tactile,
      // `isMobile` et non seulement `hasTouch` : c'est lui qui fait émettre à Chromium les
      // événements de souris de COMPATIBILITÉ après un appui — précisément ceux qui ouvraient
      // l'infobulle. Sans lui, le test ne reproduit pas le défaut et reste vert même sans correctif,
      // ce qui a été constaté.
      isMobile: tactile,
    })
    const page = await context.newPage()
    await page.goto(`${BASE}/editions/${editionId}/gestion/volunteers/planning`, {
      waitUntil: 'domcontentloaded',
    })
    const creneau = page.locator('.fc-event').filter({ hasText: TITRE_CRENEAU }).first()
    await expect(creneau).toBeVisible({ timeout: 40000 })
    return { page, context, creneau }
  }

  test('à la souris, elle s’ouvre', async ({ browser }) => {
    const { page, context, creneau } = await ouvrirPlanning(browser, false)

    await creneau.hover()
    // Sur la visibilité, non sur la présence : l'élément vit en permanence à la racine de la page,
    // masqué par `display: none`. Un `toHaveCount` serait vert dans les deux cas.
    await expect(page.locator(INFOBULLE)).toBeVisible({ timeout: 5000 })
    await expect(page.locator(INFOBULLE)).toContainText(TITRE_CRENEAU)

    await context.close()
  })

  test('au doigt, elle reste fermée — et la modale s’ouvre seule', async ({ browser }) => {
    const { page, context, creneau } = await ouvrirPlanning(browser, true)

    /*
     * L'ÉVÉNEMENT DE COMPATIBILITÉ, émis à la main.
     *
     * Un `tap()` de Playwright ne suffit pas : le harnais n'émet pas les événements de souris que
     * les vrais navigateurs mobiles produisent après un appui, et un test qui s'en contentait
     * restait vert même sans le correctif — constaté, y compris avec `isMobile`.
     *
     * On envoie donc précisément ce que le navigateur envoie, et qui ouvrait l'infobulle : un
     * `mouseenter` sans pointeur, puis un `pointerenter` de type tactile. Avec l'ancien code, le
     * premier suffisait à l'afficher.
     */
    await creneau.dispatchEvent('mouseenter')
    await creneau.dispatchEvent('pointerenter', { pointerType: 'touch' })
    await page.waitForTimeout(300)
    await expect(page.locator(INFOBULLE), 'ouverte par l’événement de compatibilité').toBeHidden()

    // Et le geste complet : l'appui ouvre la modale, qui porte l'information au tactile.
    await creneau.tap()
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 15000 })

    // Mesuré APRÈS l'ouverture de la modale : c'est là qu'elle se voyait, et un contrôle fait
    // avant l'aurait manquée.
    await expect(page.locator(INFOBULLE)).toBeHidden()

    await context.close()
  })

  test('nettoyage : supprimer l’édition dédiée', async ({ page }) => {
    if (editionId) {
      const suppression = await apiDelete(page, `${BASE}/api/editions/${editionId}`)
      expect(suppression.ok(), await suppression.text()).toBe(true)
    }
  })
})
