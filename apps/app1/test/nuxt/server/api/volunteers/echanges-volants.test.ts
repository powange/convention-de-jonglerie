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
