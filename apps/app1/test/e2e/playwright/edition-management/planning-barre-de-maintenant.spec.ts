import { expect, test } from '@nuxt/test-utils/playwright'

import {
  apiDelete,
  apiPatch,
  apiPost,
  enableVolunteers,
  loadState,
  setEditionStatus,
  updateVolunteerSettings,
} from '../helpers'

const BASE = 'http://localhost:3000'

/** Les éléments que FullCalendar rend pour l'instant présent, en vue timeline. */
const LIGNE = '.fc-timeline-now-indicator-line'
const FLECHE = '.fc-timeline-now-indicator-arrow'

/**
 * Une barre verticale rouge marque l'instant présent sur le planning des bénévoles.
 *
 * Elle manquait, et un planning sans elle oblige à chercher où l'on en est — sur un écran qui sert
 * précisément à savoir qui fait quoi maintenant.
 *
 * Les DEUX surfaces la portent d'une seule ligne de configuration : la page de gestion et la page
 * publique d'un bénévole emploient la même carte, qui passe par `useVolunteerSchedule`. Ces tests
 * vérifient les deux, parce que « les deux pages emploient le même composant » est une lecture du
 * code, pas une mesure — et parce que la page publique a ses propres conditions d'affichage.
 *
 * ⚠️ Édition DÉDIÉE, et qui encadre l'instant présent. Celle du harnais se tient dans une semaine :
 * la barre n'y aurait rien à désigner, et le test serait vert sans rien prouver.
 *
 * ⚠️ Ce spec ne doit PAS cohabiter avec `volunteers.spec.ts`. Candidater renseigne le prénom et le
 * nom du compte quand ils sont vides, et le compte est partagé : celui-là chercherait ensuite ses
 * propres valeurs, un accent près, et ne les trouverait pas. Le défaut a déjà coûté une CI rouge.
 */
test.describe.serial('Planning — la barre de l’instant présent', () => {
  let editionId = ''
  let candidatureId = ''

  test('préparer une édition qui encadre maintenant, et un bénévole accepté', async ({ page }) => {
    const { conventionId } = loadState()

    const debut = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const fin = new Date(Date.now() + 24 * 60 * 60 * 1000)
    const edition = await apiPost(page, `${BASE}/api/editions`, {
      data: {
        conventionId: Number(conventionId),
        startDate: debut.toISOString(),
        endDate: fin.toISOString(),
        addressLine1: '1 rue du Présent',
        postalCode: '75001',
        city: 'Paris',
        country: 'France',
      },
    })
    expect(edition.ok(), `création d'édition : ${await edition.text()}`).toBe(true)
    editionId = String((await edition.json()).data?.id)

    await enableVolunteers(page, editionId)
    // `planningPublished` : sans lui, la page publique ne rend aucun calendrier — le planning reste
    // masqué aux bénévoles tant que l'organisation ne l'a pas publié.
    await updateVolunteerSettings(page, editionId, {
      open: true,
      pagePublic: true,
      planningPublished: true,
    })
    await setEditionStatus(page, editionId, 'PUBLISHED')

    // La carte de planning publique est réservée aux bénévoles ACCEPTÉS : sans ce parcours, il n'y
    // aurait rien à mesurer sur la seconde surface.
    const jour = (decalage: number) =>
      new Date(Date.now() + decalage * 86400000).toISOString().split('T')[0]
    const candidature = await apiPost(
      page,
      `${BASE}/api/editions/${editionId}/volunteers/applications`,
      {
        data: {
          prenom: 'E2E-Barre',
          nom: 'E2E-Maintenant',
          phone: '+33612345678',
          eventAvailability: true,
          motivation: 'Candidature de test pour la barre de l’instant présent',
          arrivalDateTime: `${jour(0)}_morning`,
          departureDateTime: `${jour(1)}_afternoon`,
        },
      }
    )
    expect(candidature.ok(), `candidature : ${await candidature.text()}`).toBe(true)
    const corps = await candidature.json()
    candidatureId = String((corps.data?.application ?? corps.data ?? corps).id)

    const acceptation = await apiPatch(
      page,
      `${BASE}/api/editions/${editionId}/volunteers/applications/${candidatureId}`,
      { data: { status: 'ACCEPTED' } }
    )
    expect(acceptation.ok(), await acceptation.text()).toBe(true)
  })

  /**
   * Mesure la barre sur une page, ou rend `null` si le calendrier n'y est pas.
   *
   * La couleur est lue CALCULÉE et non par nom de classe : une variante que Tailwind n'aurait pas
   * générée, ou une règle du thème qui écraserait celle de FullCalendar, laisseraient la classe en
   * place et la barre invisible.
   */
  const mesurer = async (page: import('@playwright/test').Page) =>
    page.evaluate(
      ({ ligne, fleche }) => {
        const el = document.querySelector(ligne) as HTMLElement | null
        if (!el) return null
        const s = getComputedStyle(el)
        const r = el.getBoundingClientRect()
        return {
          couleur: s.borderLeftColor,
          largeur: s.borderLeftWidth,
          hauteur: Math.round(r.height),
          gauche: Math.round(r.left),
          fleche: Boolean(document.querySelector(fleche)),
        }
      },
      { ligne: LIGNE, fleche: FLECHE }
    )

  test('elle s’affiche sur le planning de la gestion', async ({ page, goto }) => {
    await goto(`/editions/${editionId}/gestion/volunteers/planning`, { waitUntil: 'hydration' })
    await expect(page.locator('.fc').first()).toBeVisible({ timeout: 40000 })

    await expect.poll(async () => Boolean(await mesurer(page)), { timeout: 20000 }).toBe(true)
    const barre = (await mesurer(page))!

    expect(barre.couleur, 'la barre doit être rouge').toBe('rgb(255, 0, 0)')
    expect(barre.hauteur, 'une barre sans hauteur ne se voit pas').toBeGreaterThan(0)
    expect(barre.fleche, 'la flèche marque l’heure dans l’en-tête').toBe(true)
  })

  test('elle s’affiche aussi sur la page publique du bénévole', async ({ page, goto }) => {
    await goto(`/editions/${editionId}/volunteers`, { waitUntil: 'hydration' })
    await expect(page.locator('.fc').first()).toBeVisible({ timeout: 40000 })

    await expect.poll(async () => Boolean(await mesurer(page)), { timeout: 20000 }).toBe(true)
    const barre = (await mesurer(page))!

    expect(barre.couleur).toBe('rgb(255, 0, 0)')
    expect(barre.hauteur).toBeGreaterThan(0)
  })

  test('nettoyage : supprimer l’édition dédiée', async ({ page }) => {
    // Une seule suppression : la candidature et les réglages dépendent de l'édition.
    if (editionId) {
      const suppression = await apiDelete(page, `${BASE}/api/editions/${editionId}`)
      expect(suppression.ok(), await suppression.text()).toBe(true)
    }
  })
})
