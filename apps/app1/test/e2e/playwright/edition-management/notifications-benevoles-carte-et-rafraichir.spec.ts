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
const MESSAGE = `Briefing bénévoles à 9 h — message de test ${Date.now()}`

/**
 * Les notifications aux bénévoles : ouvrir le détail d'un envoi, et rafraîchir les lectures.
 *
 * Mêmes deux gestes que du côté artistes, sur des fichiers distincts — ce n'est pas un composant
 * partagé, et les deux écrans auraient donc pu diverger. Ils portent désormais le même
 * comportement.
 *
 * ⚠️ Édition DÉDIÉE. Ce spec crée une candidature bénévole et une notification ; sur l'édition du
 * harnais, ces traces déborderaient sur les autres specs du même lot.
 *
 * ⚠️ Hors du lot de `volunteers.spec.ts` : candidater renseigne le prénom du compte partagé quand il
 * est vide, et cette cohabitation a déjà valu une CI rouge.
 */
test.describe.serial('Notifications aux bénévoles — carte et rafraîchissement', () => {
  let editionId = ''

  test('préparer une édition avec un bénévole accepté et une notification', async ({ page }) => {
    const { conventionId } = loadState()

    const edition = await apiPost(page, `${BASE}/api/editions`, {
      data: {
        conventionId: Number(conventionId),
        startDate: new Date(Date.now() + 86400000).toISOString(),
        endDate: new Date(Date.now() + 3 * 86400000).toISOString(),
        addressLine1: '1 rue des Bénévoles',
        postalCode: '75001',
        city: 'Paris',
        country: 'France',
      },
    })
    expect(edition.ok(), `création d'édition : ${await edition.text()}`).toBe(true)
    editionId = String((await edition.json()).data?.id)

    await enableVolunteers(page, editionId)
    await updateVolunteerSettings(page, editionId, { open: true, pagePublic: true })
    await setEditionStatus(page, editionId, 'PUBLISHED')

    // Un bénévole ACCEPTÉ : sans destinataire, l'envoi n'aurait personne à notifier.
    const jour = (d: number) => new Date(Date.now() + d * 86400000).toISOString().split('T')[0]
    const candidature = await apiPost(
      page,
      `${BASE}/api/editions/${editionId}/volunteers/applications`,
      {
        data: {
          prenom: 'E2E-Notif',
          nom: 'E2E-Benevole',
          phone: '+33612345678',
          eventAvailability: true,
          motivation: 'Candidature de test pour les notifications',
          arrivalDateTime: `${jour(1)}_morning`,
          departureDateTime: `${jour(3)}_afternoon`,
        },
      }
    )
    expect(candidature.ok(), `candidature : ${await candidature.text()}`).toBe(true)
    const corps = await candidature.json()
    const candidatureId = String((corps.data?.application ?? corps.data ?? corps).id)

    const acceptation = await apiPatch(
      page,
      `${BASE}/api/editions/${editionId}/volunteers/applications/${candidatureId}`,
      { data: { status: 'ACCEPTED' } }
    )
    expect(acceptation.ok(), await acceptation.text()).toBe(true)

    const envoi = await apiPost(
      page,
      `${BASE}/api/editions/${editionId}/volunteers/notifications`,
      { data: { targetType: 'all', message: MESSAGE } }
    )
    expect(envoi.ok(), `envoi de la notification : ${await envoi.text()}`).toBe(true)
  })

  const ouvrirHistorique = async (
    page: import('@playwright/test').Page,
    goto: (u: string, o?: object) => Promise<unknown>
  ) => {
    await goto(`/editions/${editionId}/gestion/volunteers/notifications`, {
      waitUntil: 'hydration',
    })
    await expect(page.getByText(MESSAGE)).toBeVisible({ timeout: 40000 })
  }

  test('toute la carte ouvre le détail, et elle est atteignable au clavier', async ({
    page,
    goto,
  }) => {
    await ouvrirHistorique(page, goto)

    // Un `button`, et non un `div` cliquable : c'est la différence qui rend la carte atteignable au
    // clavier. Vérifier seulement que le clic fonctionne laisserait passer l'autre version.
    const carte = page.locator('button').filter({ hasText: MESSAGE }).first()
    await expect(carte).toBeVisible()

    // Le bouton « Voir les détails » a disparu : la carte le remplace, et un bouton dans un bouton
    // n'est pas du HTML valide.
    await expect(carte.getByRole('button', { name: /détails/i })).toHaveCount(0)

    await carte.click()
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 10000 })
  })

  test('la modale porte un bouton qui recharge la liste sur place', async ({ page, goto }) => {
    await ouvrirHistorique(page, goto)
    await page.locator('button').filter({ hasText: MESSAGE }).first().click()

    const modale = page.getByRole('dialog')
    await expect(modale).toBeVisible({ timeout: 10000 })

    const rafraichir = modale.getByRole('button', { name: /rafraîchir/i })
    await expect(rafraichir, 'le bouton de rafraîchissement, en haut de la modale').toBeVisible()

    // Le rechargement se prouve par l'APPEL : rien ne change à l'écran quand personne n'a confirmé
    // entre-temps, et un test qui n'observerait que le rendu serait vert même si le bouton ne
    // faisait rien.
    const appels: string[] = []
    page.on('request', (r) => {
      if (r.url().includes('/confirmations')) appels.push(r.url())
    })

    await rafraichir.click()
    await expect.poll(() => appels.length, { timeout: 10000 }).toBeGreaterThan(0)

    // Rafraîchir ne doit pas faire perdre sa place au lecteur.
    await expect(modale).toBeVisible()
  })

  test('nettoyage : supprimer l’édition dédiée', async ({ page }) => {
    if (editionId) {
      const suppression = await apiDelete(page, `${BASE}/api/editions/${editionId}`)
      expect(suppression.ok(), await suppression.text()).toBe(true)
    }
  })
})
