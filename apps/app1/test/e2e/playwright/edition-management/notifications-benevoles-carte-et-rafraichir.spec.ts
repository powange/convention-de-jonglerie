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
const MESSAGE_EQUIPE = `Briefing d'équipe — message de test ${Date.now()}`

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
  let candidatureId = ''

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
    candidatureId = String((corps.data?.application ?? corps.data ?? corps).id)

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

  test('🔬 le suivi d’une notification ciblant une ÉQUIPE répond, et ne rend pas 500', async ({
    page,
    goto,
  }) => {
    /*
     * ⚠️ RELEVÉ EN PRODUCTION, douze fois en douze minutes, et CE FICHIER NE POUVAIT PAS LE VOIR —
     * deux fois.
     *
     * (1) L'envoi préparé plus haut cible `targetType: 'all'`, donc la branche fautive n'était
     *     JAMAIS exercée : le filtre par équipe portait sur `assignedTeams`, un champ JSON disparu,
     *     et Prisma rejetait la requête entière (`Unknown argument`).
     * (2) Le test de rafraîchissement n'observe que l'APPEL, pas son CODE : un 500 le laissait
     *     vert. Une assertion sur le nombre de requêtes ne dit rien de leur réponse.
     *
     * Ce cas ferme les deux trous : une équipe, un bénévole dedans, une notification qui la cible,
     * et la réponse du suivi mesurée. Un test d'intégration prouve séparément que Prisma refuse le
     * champ mort ; celui-ci prouve que l'écran entier répond.
     */
    const equipe = await apiPost(page, `${BASE}/api/editions/${editionId}/volunteer-teams`, {
      data: { name: `Équipe Notif ${Date.now()}` },
    })
    expect(equipe.ok(), `création d'équipe : ${await equipe.text()}`).toBe(true)
    const equipeCorps = await equipe.json()
    const equipeId = String((equipeCorps.data ?? equipeCorps).id)

    const affectation = await apiPatch(
      page,
      `${BASE}/api/editions/${editionId}/volunteers/applications/${candidatureId}/teams`,
      { data: { teams: [equipeId] } }
    )
    expect(affectation.ok(), `affectation : ${await affectation.text()}`).toBe(true)

    const nomEquipe = String((equipeCorps.data ?? equipeCorps).name)
    const envoiCible = await apiPost(
      page,
      `${BASE}/api/editions/${editionId}/volunteers/notifications`,
      { data: { targetType: 'teams', selectedTeams: [nomEquipe], message: MESSAGE_EQUIPE } }
    )
    expect(envoiCible.ok(), `envoi ciblé : ${await envoiCible.text()}`).toBe(true)
    const envoiCorps = await envoiCible.json()
    const groupeId = String(envoiCorps.data?.notificationGroupId ?? '')
    expect(groupeId, `identifiant du groupe : ${JSON.stringify(envoiCorps)}`).toBeTruthy()
    // L'ENVOI a retenu ce nombre de destinataires avec le filtre d'équipe : on le garde pour le
    // comparer à ce que la relecture retient, plus bas.
    const attendus = Number(envoiCorps.data?.recipientCount ?? 0)
    expect(attendus).toBeGreaterThan(0)

    // On surveille la RÉPONSE, pas seulement la requête : c'est ce qui manquait.
    const reponses: number[] = []
    page.on('response', (r) => {
      if (r.url().includes('/confirmations')) reponses.push(r.status())
    })

    await goto(`/editions/${editionId}/gestion/volunteers/notifications`, {
      waitUntil: 'hydration',
    })
    await expect(page.getByText(MESSAGE_EQUIPE)).toBeVisible({ timeout: 40000 })
    await page.locator('button').filter({ hasText: MESSAGE_EQUIPE }).first().click()

    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 10000 })
    await expect.poll(() => reponses.length, { timeout: 15000 }).toBeGreaterThan(0)

    // L'assertion qui porte le point : avant le correctif, ces réponses étaient des 500.
    expect(
      reponses.every((code) => code < 400),
      `codes observés : ${reponses.join(', ')}`
    ).toBe(true)

    /*
     * ⚠️ ET LE FILTRE DOIT CORRESPONDRE À QUELQU'UN. Un `where` syntaxiquement valide mais qui ne
     * retient personne viderait le suivi SANS RIEN DIRE — un 200 avec zéro destinataire, donc un
     * défaut silencieux là où le précédent criait. L'assertion porte sur la réponse et non sur
     * l'écran : la carte affiche le pseudo du compte, pas le prénom de la candidature, et chercher
     * un libellé aurait fait dépendre ce test de la mise en page.
     */
    const suivi = await page.request.get(
      `${BASE}/api/editions/${editionId}/volunteers/notification/${groupeId}/confirmations`
    )
    expect(suivi.ok(), await suivi.text()).toBe(true)
    const corpsSuivi = await suivi.json()
    const destinataires = [...(corpsSuivi.confirmed ?? []), ...(corpsSuivi.pending ?? [])]
    expect(destinataires.length, 'destinataires retenus par le filtre d’équipe').toBeGreaterThan(0)

    /*
     * 🔬 L'ASSERTION QUI PORTE LE PLUS LOIN : l'envoi et la relecture doivent retenir LE MÊME
     * NOMBRE de destinataires. C'était le cœur du défaut — deux endroits répondaient à « qui est
     * visé ? », avec deux filtres différents. Celui de la relecture plantait, ce qui était voyant ;
     * s'il avait seulement divergé, le taux de confirmation aurait été faux sans que rien ne le
     * dise.
     */
    expect(destinataires.length, 'relecture vs envoi').toBe(attendus)
  })

  test('nettoyage : supprimer l’édition dédiée', async ({ page }) => {
    if (editionId) {
      const suppression = await apiDelete(page, `${BASE}/api/editions/${editionId}`)
      expect(suppression.ok(), await suppression.text()).toBe(true)
    }
  })
})
