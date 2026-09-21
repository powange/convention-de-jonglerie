import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('../../../../../server/utils/permissions/volunteer-permissions', () => ({
  requireVolunteerPlanningAccess: vi.fn(),
  isAcceptedVolunteer: vi.fn(async () => true),
}))

import candidats from '../../../../../../../layers/volunteers/server/api/editions/[id]/volunteers/swaps/candidates.get'
import { global } from '../../../globales-nitro'

const prismaMock = (globalThis as any).prisma

const evenement = { context: { params: { id: '1' }, user: { id: 10 } } }

const volante = { isFloatingTeam: true }
const ordinaire = { isFloatingTeam: false }

/**
 * `applicationTeamAssignment.findMany` est appelé TROIS fois de suite, et dans cet ordre :
 *  1. la garde, pour savoir si la personne connectée peut échanger ;
 *  2. ses équipes, qui bornent la recherche des créneaux ;
 *  3. les équipes des titulaires trouvés, pour en écarter les volants.
 *
 * Les confondre fait passer un test au vert sans rien vérifier — c'est arrivé en l'écrivant.
 */
const enchainer = (...reponses: unknown[][]) => {
  const appel = prismaMock.applicationTeamAssignment.findMany
  reponses.forEach((reponse) => appel.mockResolvedValueOnce(reponse))
}

/**
 * Les bénévoles volants sont TRANSPARENTS vis-à-vis des échanges de créneaux.
 *
 * Dans les deux sens : ils ne proposent pas les créneaux qu'on leur a confiés en renfort, et
 * personne ne peut les leur demander. L'échange est un mécanisme entre gens qui se doivent un
 * volume de travail — un volant n'en doit aucun.
 *
 * ⚠️ Ces tests portent sur le SERVEUR. Masquer un bouton n'empêche personne d'appeler l'API, et
 * ce module a déjà connu un réglage qui ne cachait qu'à l'affichage.
 *
 * Ils couvrent le PREMIER sens — le volant qui demande. Le second — ses créneaux qu'on ne propose
 * pas aux autres — est éprouvé sur `affectationsEchangeables`, en unitaire : reproduire ici toute
 * la chaîne de requêtes donnait un test long à écrire et facile à rendre vert par accident.
 */
describe('les échanges et les bénévoles volants', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.eventVolunteerSettings.findUnique.mockResolvedValue({
      swapsEnabled: true,
      planningPublished: true,
    })
    global.getRouterParam = vi.fn((_e: any, nom: string) => (nom === 'id' ? '1' : '7'))
    global.getQuery = vi.fn(() => ({ assignmentId: 'a1' }))
    prismaMock.volunteerAssignment.findFirst.mockResolvedValue({
      id: 'a1',
      userId: 10,
      timeSlot: {
        id: 's1',
        teamId: 'cuisine',
        startDateTime: new Date('2030-08-01T10:00:00Z'),
        endDateTime: new Date('2030-08-01T12:00:00Z'),
        eventId: 1,
      },
    })
    prismaMock.volunteerAssignment.findMany.mockResolvedValue([])
  })

  it('refuse la demande d’un bénévole volant', async () => {
    // Il n'a aucune charge à céder : le refus vient du serveur, pas d'un bouton masqué.
    enchainer([{ team: volante }])

    await expect(candidats(evenement as any)).rejects.toMatchObject({ statusCode: 403 })
    expect(prismaMock.volunteerAssignment.findMany).not.toHaveBeenCalled()
  })

  it('laisse passer un bénévole ordinaire', async () => {
    enchainer([{ team: ordinaire }], [{ teamId: 'cuisine' }], [])

    await expect(candidats(evenement as any)).resolves.toBeDefined()
  })

  it('laisse passer celui qui est volant ET dans une équipe ordinaire', async () => {
    // Il doit ses heures de cuisine : il a bien quelque chose à échanger.
    enchainer([{ team: volante }, { team: ordinaire }], [{ teamId: 'cuisine' }], [])

    await expect(candidats(evenement as any)).resolves.toBeDefined()
  })
})

/**
 * Le périmètre de recherche : ses équipes ET celle du créneau qu'il offre.
 *
 * On peut tenir un créneau d'une équipe sans y être rattaché — quelqu'un posé à la main sur un
 * créneau de cuisine sans être inscrit en cuisine. L'ancien périmètre ne regardait que SES
 * équipes : cette personne recevait une liste vide, sans refus ni message.
 *
 * Ces tests portent sur le `where` envoyé à Prisma, et non sur la réponse : c'est là que le
 * défaut vivait, et une réponse vide se serait laissée confondre avec « personne n'est
 * disponible ».
 */
describe('le périmètre de recherche des candidats', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    /**
     * ⚠️ `clearAllMocks` efface les APPELS, pas les valeurs posées par `mockResolvedValueOnce`.
     *
     * Or le troisième appel n'a lieu que si des titulaires ont été trouvés : les tests qui n'en
     * trouvent aucun laissent leur troisième valeur dans la file, où elle est servie au test
     * suivant. Le décalage se lit alors comme un défaut du code — c'est ce qui est arrivé en
     * écrivant ces tests-ci.
     */
    prismaMock.applicationTeamAssignment.findMany.mockReset()
    prismaMock.eventVolunteerSettings.findUnique.mockResolvedValue({
      swapsEnabled: true,
      planningPublished: true,
    })
    global.getRouterParam = vi.fn((_e: any, nom: string) => (nom === 'id' ? '1' : '7'))
    global.getQuery = vi.fn(() => ({ assignmentId: 'a1' }))
    prismaMock.volunteerAssignment.findMany.mockResolvedValue([])
  })

  /** Le créneau offert appartient à `equipeDuCreneau` ; la personne, elle, est ailleurs. */
  const offreUnCreneauDe = (equipeDuCreneau: string | null) =>
    prismaMock.volunteerAssignment.findFirst.mockResolvedValue({
      id: 'a1',
      userId: 10,
      timeSlot: {
        id: 's1',
        teamId: equipeDuCreneau,
        startDateTime: new Date('2030-08-01T10:00:00Z'),
        endDateTime: new Date('2030-08-01T12:00:00Z'),
        eventId: 1,
      },
    })

  const equipesCherchees = () =>
    prismaMock.volunteerAssignment.findMany.mock.calls[0][0].where.timeSlot.teamId.in

  it('AJOUTE l’équipe du créneau offert quand la personne n’en fait pas partie', async () => {
    offreUnCreneauDe('cuisine')
    enchainer([{ team: ordinaire }], [{ teamId: 'accueil' }], [])

    await candidats(evenement as any)

    expect(equipesCherchees()).toEqual(['accueil', 'cuisine'])
  })

  it('cherche quand même pour qui n’a AUCUNE équipe mais tient un créneau', async () => {
    // Le cas qui rendait une liste vide avant d'avoir rien cherché.
    offreUnCreneauDe('cuisine')
    enchainer([], [], [])

    await candidats(evenement as any)

    expect(equipesCherchees()).toEqual(['cuisine'])
  })

  it('ne dédouble pas l’équipe quand elle est déjà sienne', async () => {
    offreUnCreneauDe('cuisine')
    enchainer([{ team: ordinaire }], [{ teamId: 'cuisine' }, { teamId: 'accueil' }], [])

    await candidats(evenement as any)

    expect(equipesCherchees()).toEqual(['cuisine', 'accueil'])
  })

  it('ne cherche rien pour un créneau sans équipe et une personne sans équipe', async () => {
    offreUnCreneauDe(null)
    enchainer([], [], [])

    const reponse: any = await candidats(evenement as any)

    expect(prismaMock.volunteerAssignment.findMany).not.toHaveBeenCalled()
    expect(reponse.data.candidates).toEqual([])
  })
})
