import type { Page } from '@playwright/test'

import { expect, test } from '@nuxt/test-utils/playwright'

import {
  apiDelete,
  apiPatch,
  apiPost,
  enableVolunteers,
  getVolunteerSettings,
  loadState,
  setEditionStatus,
} from '../helpers'

const BASE = 'http://localhost:3000'

/** Les affectations d'un créneau. L'endpoint rend une liste nue, sans enveloppe. */
const affectationsDuCreneau = async (page: Page, editionId: string, creneauId: string) => {
  const reponse = await page.request.get(
    `${BASE}/api/editions/${editionId}/volunteer-time-slots/${creneauId}/assignments`
  )
  expect(reponse.ok(), `lecture des affectations : ${await reponse.text()}`).toBe(true)
  const corps = await reponse.json()
  return (Array.isArray(corps) ? corps : (corps.data ?? [])) as {
    id: string
    userId?: number
    user?: { id: number }
  }[]
}

/**
 * Le parcours complet de l'assignation automatique : aperçu, application, annulation, historique.
 *
 * Chaque morceau a ses tests unitaires, et ils passent tous. Ce qui manquait est ce qui ne se
 * teste qu'ensemble : l'aperçu est conservé côté serveur, son identifiant revient au navigateur,
 * qui le renvoie pour appliquer exactement ce plan-là ; l'application consigne de quoi se défaire,
 * et l'annulation vérifie que le planning n'a pas bougé entre-temps. Cinq contrats implicites
 * entre quatre endpoints — précisément la catégorie de défaut qui a produit tous les correctifs
 * de ce module.
 *
 * Volontairement par l'API et non par l'écran : ce sont ces contrats qu'on éprouve, et un parcours
 * cliqué les traverserait au prix d'une fragilité qui n'apprendrait rien de plus.
 *
 * ⚠️ Édition dédiée, créée ici. Ce test écrit et efface des affectations : le faire sur l'édition
 * partagée du harnais détruirait le planning que les autres tests supposent en place.
 */
test.describe.serial('Assignation automatique des bénévoles', () => {
  const ts = Date.now()
  const NOM_EQUIPE = `Bar ${ts}`

  let editionId = ''
  let equipeId = ''
  const creneaux: string[] = []
  const benevoles: number[] = []
  let planId = ''
  let journalId = ''

  test('préparer une édition, une équipe, deux créneaux et trois bénévoles', async ({ page }) => {
    const { conventionId } = loadState()
    const debut = new Date(Date.now() + 24 * 60 * 60 * 1000)
    const fin = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)

    const edition = await apiPost(page, `${BASE}/api/editions`, {
      data: {
        conventionId: Number(conventionId),
        startDate: debut.toISOString(),
        endDate: fin.toISOString(),
        addressLine1: '1 rue de l’Assignation',
        postalCode: '75002',
        city: 'Paris',
        country: 'France',
      },
    })
    expect(edition.ok(), `création d'édition : ${await edition.text()}`).toBe(true)
    const corpsEdition = await edition.json()
    editionId = String(corpsEdition.data?.id ?? corpsEdition.id)

    await setEditionStatus(page, editionId, 'PUBLISHED')
    await enableVolunteers(page, editionId)

    const equipe = await apiPost(page, `${BASE}/api/editions/${editionId}/volunteer-teams`, {
      data: { name: NOM_EQUIPE, color: '#f59e0b' },
    })
    expect(equipe.ok(), `création d'équipe : ${await equipe.text()}`).toBe(true)
    equipeId = (await equipe.json()).data?.id ?? (await equipe.json()).id
    expect(equipeId).toBeTruthy()

    // Deux créneaux qui ne se chevauchent pas : un bénévole peut donc tenir les deux, et le
    // calcul a de quoi remplir sans buter sur une contrainte dure.
    for (const [rang, decalage] of [0, 4].entries()) {
      const depart = new Date(debut.getTime() + (24 + decalage) * 60 * 60 * 1000)
      const creneau = await apiPost(
        page,
        `${BASE}/api/editions/${editionId}/volunteer-time-slots`,
        {
          data: {
            title: `Service ${rang + 1}`,
            teamId: equipeId,
            startDateTime: depart.toISOString(),
            endDateTime: new Date(depart.getTime() + 2 * 60 * 60 * 1000).toISOString(),
            maxVolunteers: 2,
          },
        }
      )
      expect(creneau.ok(), `création de créneau : ${await creneau.text()}`).toBe(true)
      const corps = await creneau.json()
      const id = (corps.data?.timeSlots ?? corps.timeSlots ?? [])[0]?.id
      expect(id, `identifiant de créneau absent : ${JSON.stringify(corps)}`).toBeTruthy()
      creneaux.push(id)
    }

    for (let rang = 0; rang < 3; rang++) {
      const creation = await apiPost(
        page,
        `${BASE}/api/editions/${editionId}/volunteers/create-user-and-add`,
        {
          data: {
            email: `e2e-assignation-${ts}-${rang}@example.com`,
            prenom: `Benevole${rang}`,
            nom: 'Assignation',
          },
        }
      )
      expect(creation.ok(), `create-user-and-add : ${await creation.text()}`).toBe(true)
      const cree = (await creation.json()).data
      benevoles.push(cree.user.id)

      /**
       * Déclarer sa présence, comme le ferait un vrai candidat.
       *
       * Un bénévole ajouté à la main par un organisateur arrive sans aucune disponibilité :
       * `eventAvailability` vaut `null`, et le planificateur le refuse alors pour « indisponible »
       * — c'est le comportement voulu, pas un défaut. Sans cette étape, le calcul ne proposerait
       * rien et ce fichier testerait un aperçu vide.
       */
      const jour = (decalage: number) =>
        new Date(debut.getTime() + decalage * 86400000).toISOString().split('T')[0]

      const disponibilite = await apiPatch(
        page,
        `${BASE}/api/editions/${editionId}/volunteers/applications/${cree.application.id}`,
        {
          data: {
            eventAvailability: true,
            arrivalDateTime: `${jour(0)}_morning`,
            departureDateTime: `${jour(2)}_evening`,
          },
        }
      )
      expect(disponibilite.ok(), `disponibilité : ${await disponibilite.text()}`).toBe(true)
    }
  })

  test('un aperçu propose un plan sans rien écrire', async ({ page }) => {
    const reponse = await apiPost(
      page,
      `${BASE}/api/editions/${editionId}/volunteers/auto-assign`,
      {
        data: { constraints: { minHoursPerVolunteer: 0, existingAssignmentsMode: 'keep-manual' } },
      }
    )
    expect(reponse.ok(), `aperçu : ${await reponse.text()}`).toBe(true)

    const corps = (await reponse.json()).data
    expect(corps.preview).toBe(true)
    // Le motif de refus, s'il y en a un : sans lui, un aperçu vide n'apprend rien et se
    // diagnostique à l'aveugle. L'endpoint le calcule déjà, autant le lire.
    expect(
      corps.result.assignments.length,
      `aucune affectation proposée — refus : ${JSON.stringify(corps.result.refus)}`
    ).toBeGreaterThan(0)

    // L'identifiant de l'aperçu : c'est lui qui permet d'appliquer exactement ce plan-ci.
    planId = corps.planId
    expect(planId, 'un aperçu doit être conservé côté serveur').toBeTruthy()

    // Et rien n'a été écrit : le journal est encore vide.
    const historique = await page.request.get(
      `${BASE}/api/editions/${editionId}/volunteers/auto-assign/history`
    )
    expect((await historique.json()).data).toHaveLength(0)
  })

  test('les réglages employés deviennent ceux de l’édition', async ({ page }) => {
    // Ils vivaient dans le navigateur : changer de poste les faisait repartir aux valeurs par
    // défaut sans prévenir, y compris le mode qui décide de ce qui sera détruit.
    const reglages = await getVolunteerSettings(page, editionId)

    expect(reglages.autoAssignConstraints).toMatchObject({
      minHoursPerVolunteer: 0,
      existingAssignmentsMode: 'keep-manual',
    })
  })

  test('appliquer écrit le plan de l’aperçu et consigne de quoi le défaire', async ({ page }) => {
    const reponse = await apiPost(
      page,
      `${BASE}/api/editions/${editionId}/volunteers/auto-assign`,
      {
        data: {
          applyAssignments: true,
          planId,
          constraints: { minHoursPerVolunteer: 0, existingAssignmentsMode: 'keep-manual' },
        },
      }
    )
    expect(reponse.ok(), `application : ${await reponse.text()}`).toBe(true)

    const corps = (await reponse.json()).data
    expect(corps.preview).toBe(false)
    expect(corps.creees).toBeGreaterThan(0)

    journalId = corps.journalId
    expect(journalId, 'une application doit être consignée').toBeTruthy()

    // Les affectations sont bien en base.
    expect((await affectationsDuCreneau(page, editionId, creneaux[0]!)).length).toBeGreaterThan(0)
  })

  test('le même aperçu ne s’applique pas deux fois', async ({ page }) => {
    // Sans quoi un double-clic, ou un retour en arrière du navigateur, réécrirait le plan par
    // dessus un planning que l'organisateur a peut-être déjà retouché.
    const reponse = await apiPost(
      page,
      `${BASE}/api/editions/${editionId}/volunteers/auto-assign`,
      {
        data: { applyAssignments: true, planId, constraints: {} },
      }
    )

    expect(reponse.status()).toBe(409)
  })

  test('l’historique montre le calcul, et dit lequel peut être annulé', async ({ page }) => {
    const reponse = await page.request.get(
      `${BASE}/api/editions/${editionId}/volunteers/auto-assign/history`
    )
    expect(reponse.ok(), `historique : ${await reponse.text()}`).toBe(true)

    const corps = await reponse.json()
    expect(corps.data).toHaveLength(1)
    expect(corps.data[0].id).toBe(journalId)
    expect(corps.data[0].createdCount).toBeGreaterThan(0)
    expect(corps.data[0].undoneAt).toBeNull()
    expect(corps.annulableId).toBe(journalId)
  })

  test('annuler remet le planning tel qu’il était', async ({ page }) => {
    const reponse = await apiPost(
      page,
      `${BASE}/api/editions/${editionId}/volunteers/auto-assign/undo`,
      { data: { journalId } }
    )
    expect(reponse.ok(), `annulation : ${await reponse.text()}`).toBe(true)
    expect((await reponse.json()).data.retirees).toBeGreaterThan(0)

    expect(await affectationsDuCreneau(page, editionId, creneaux[0]!)).toHaveLength(0)
  })

  test('un calcul annulé ne l’est pas deux fois, et l’historique le dit', async ({ page }) => {
    const seconde = await apiPost(
      page,
      `${BASE}/api/editions/${editionId}/volunteers/auto-assign/undo`,
      { data: { journalId } }
    )
    // 404 : il n'y a plus aucun calcul non annulé à défaire sur cette édition.
    expect(seconde.status()).toBe(404)

    const historique = await (
      await page.request.get(`${BASE}/api/editions/${editionId}/volunteers/auto-assign/history`)
    ).json()
    expect(historique.data[0].undoneAt).not.toBeNull()
    expect(historique.annulableId).toBeNull()
  })

  /**
   * Le garde-fou ajouté avec l'empreinte d'après-calcul : la vérification du `journalId` n'attrape
   * qu'un autre CALCUL appliqué depuis, jamais le travail fait à la main entre-temps.
   */
  test('annuler est refusé quand le planning a été retouché à la main', async ({ page }) => {
    const applique = await apiPost(
      page,
      `${BASE}/api/editions/${editionId}/volunteers/auto-assign`,
      {
        data: {
          applyAssignments: true,
          constraints: { minHoursPerVolunteer: 0, existingAssignmentsMode: 'keep-manual' },
        },
      }
    )
    expect(applique.ok(), `seconde application : ${await applique.text()}`).toBe(true)
    const secondJournal = (await applique.json()).data.journalId

    /**
     * Une main humaine passe par là : l'organisateur retire quelqu'un que le calcul avait placé.
     *
     * Retirer plutôt qu'ajouter, et c'est le cas qui compte : annuler recréerait l'affectation
     * qu'il vient d'effacer, donc défairait précisément la correction qu'il venait d'apporter.
     */
    const avantRetouche = await affectationsDuCreneau(page, editionId, creneaux[1]!)
    expect(avantRetouche.length, 'le calcul devrait avoir pourvu ce créneau').toBeGreaterThan(0)
    const retiree = avantRetouche[0]!

    const retrait = await apiDelete(
      page,
      `${BASE}/api/editions/${editionId}/volunteer-time-slots/${creneaux[1]}/assignments/${retiree.id}`
    )
    expect(retrait.ok(), `retrait manuel : ${await retrait.text()}`).toBe(true)

    const annulation = await apiPost(
      page,
      `${BASE}/api/editions/${editionId}/volunteers/auto-assign/undo`,
      { data: { journalId: secondJournal } }
    )
    expect(annulation.status(), 'annuler effacerait le travail fait entre-temps').toBe(409)

    // Et surtout : rien n'a bougé. Le bénévole retiré n'a pas été remis.
    const affectations = await affectationsDuCreneau(page, editionId, creneaux[1]!)
    expect(affectations.map((a) => a.id)).not.toContain(retiree.id)
  })
})
