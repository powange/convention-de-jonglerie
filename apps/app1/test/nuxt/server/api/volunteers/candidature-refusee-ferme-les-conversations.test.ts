import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockCanManage = vi.hoisted(() => vi.fn(async () => true))
const retirerDesEquipes = vi.hoisted(() => vi.fn())
const retirerDesOrganisateurs = vi.hoisted(() => vi.fn())

vi.mock('#server/utils/auth-utils', () => ({
  requireAuth: vi.fn((event) => event.context.user),
}))

vi.mock('#server/volunteers/ports/registry', () => ({
  useVolunteerPorts: () => ({
    organizers: { canManage: mockCanManage },
    notifications: { notify: vi.fn() },
    meals: {
      deleteVolunteerMealSelections: vi.fn(),
      createVolunteerMealSelections: vi.fn(),
    },
    messenger: {
      removeFromTeamConversations: retirerDesEquipes,
      removeFromOrganizersConversation: retirerDesOrganisateurs,
      ensureTeamConversation: vi.fn(),
    },
  }),
}))

import modifier from '../../../../../../../layers/volunteers/server/api/editions/[id]/volunteers/applications/[applicationId].patch'
import supprimer from '../../../../../../../layers/volunteers/server/api/editions/[id]/volunteers/applications/[applicationId].delete'
import lireLesMessages from '../../../../../server/api/messenger/conversations/[conversationId]/messages/index.get'
import { global } from '../../../globales-nitro'

const prismaMock = (globalThis as any).prisma

/**
 * Une candidature refusée ferme les conversations qu'elle avait ouvertes.
 *
 * Le défaut : le refus vidait `teamAssignments` sans rien dire à la messagerie. Le bénévole
 * quittait ses équipes et gardait l'accès à leurs fils — et à celui des organisateurs, où se
 * discutait précisément la candidature qu'on venait de refuser. Il pouvait y lire et y écrire.
 *
 * Rien ne le signalait : aucune erreur, aucune trace. Les écrans de gestion montraient une
 * candidature refusée, et la messagerie du bénévole montrait les conversations intactes.
 *
 * La chaîne se prouve en deux moitiés, et ce fichier porte les deux :
 *
 * 1. le refus POSE `leftAt` — vérifié ici par les appels aux ports de messagerie ;
 * 2. `leftAt` FERME l'accès — vérifié sur le point d'API des messages, dont la requête exige
 *    `leftAt: null`.
 *
 * ⚠️ Le second point ne peut pas se déduire du premier. C'est exactement ce genre de moitié
 * manquante qui laisse un test au vert au-dessus d'un défaut.
 */

const BENEVOLE = 7
const ORGANISATEUR = 9
const EDITION = 17

const candidature = {
  id: 129,
  eventId: EDITION,
  userId: BENEVOLE,
  status: 'PENDING',
  userSnapshotPhone: null,
  setupAvailability: false,
  teardownAvailability: false,
  eventAvailability: true,
  arrivalDateTime: null,
  departureDateTime: null,
  teamPreferences: [],
  timePreferences: [],
  companionName: null,
  avoidList: null,
  dietaryPreference: 'NONE',
  allergies: null,
  allergySeverity: null,
  emergencyContactName: null,
  emergencyContactPhone: null,
  hasPets: false,
  petsDetails: null,
  hasMinors: false,
  minorsDetails: null,
  hasVehicle: false,
  vehicleDetails: null,
  skills: null,
  hasExperience: false,
  experienceDetails: null,
  motivation: null,
  source: 'MANUAL',
  user: { id: BENEVOLE, pseudo: 'benevole' },
  event: { name: 'Édition de test' },
  teamAssignments: [{ teamId: 'equipe-bar' }, { teamId: 'equipe-accueil' }],
}

const evenement = {
  context: { user: { id: ORGANISATEUR }, params: { id: String(EDITION), applicationId: '129' } },
}

/**
 * Change le statut, en partant d'un statut DIFFÉRENT.
 *
 * Le handler refuse un changement nul (« Statut identique »), et une candidature de départ mal
 * choisie ferait donc échouer le test sur autre chose que ce qu'il éprouve.
 */
const changerLeStatut = async (statut: string, depuis = 'PENDING') => {
  prismaMock.editionVolunteerApplication.findUnique.mockResolvedValue({
    ...candidature,
    status: depuis,
  })
  global.readBody = vi.fn().mockResolvedValue({ status: statut })
  return modifier(evenement as any)
}

describe('une candidature refusée ferme ses conversations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCanManage.mockResolvedValue(true)
    prismaMock.editionVolunteerApplication.findUnique.mockResolvedValue(candidature)
    prismaMock.editionVolunteerApplication.update.mockResolvedValue({
      ...candidature,
      status: 'REJECTED',
      teamAssignments: [],
    })
    prismaMock.editionVolunteerApplication.delete.mockResolvedValue({})
    prismaMock.volunteerAssignment.deleteMany.mockResolvedValue({ count: 0 })
    prismaMock.applicationTeamAssignment.findMany.mockResolvedValue([
      { teamId: 'equipe-bar' },
      { teamId: 'equipe-accueil' },
    ])
    prismaMock.applicationTeamAssignment.deleteMany.mockResolvedValue({ count: 2 })
    prismaMock.$transaction.mockImplementation(async (travail: any) =>
      typeof travail === 'function' ? travail(prismaMock) : travail
    )
  })

  it('retire le bénévole de CHACUNE de ses équipes', async () => {
    await changerLeStatut('REJECTED')

    // Deux équipes, deux retraits : boucler sur la liste et non appeler une fois « pour la
    // candidature » est ce qui distingue un nettoyage complet d'un nettoyage partiel.
    expect(retirerDesEquipes).toHaveBeenCalledTimes(2)
    expect(retirerDesEquipes).toHaveBeenCalledWith(
      expect.objectContaining({ teamId: 'equipe-bar', userId: BENEVOLE, eventId: EDITION })
    )
    expect(retirerDesEquipes).toHaveBeenCalledWith(
      expect.objectContaining({ teamId: 'equipe-accueil', userId: BENEVOLE, eventId: EDITION })
    )
  })

  it('ferme aussi le fil avec les organisateurs', async () => {
    await changerLeStatut('REJECTED')

    // Ce fil existe dès la candidature, sans aucune affectation : il se ferme donc même quand la
    // personne n'était dans aucune équipe, et l'oublier laissait le cas le plus fréquent ouvert.
    expect(retirerDesOrganisateurs).toHaveBeenCalledWith(
      expect.objectContaining({ userId: BENEVOLE, eventId: EDITION })
    )
  })

  it('fait de même quand la candidature repasse en attente', async () => {
    // « En attente » n'est pas « refusé », mais la personne n'est plus dans l'équipe pour autant.
    await changerLeStatut('PENDING', 'ACCEPTED')

    expect(retirerDesEquipes).toHaveBeenCalledTimes(2)
    expect(retirerDesOrganisateurs).toHaveBeenCalled()
  })

  it('ne ferme rien quand on ACCEPTE', async () => {
    await changerLeStatut('ACCEPTED')

    expect(retirerDesEquipes).not.toHaveBeenCalled()
    expect(retirerDesOrganisateurs).not.toHaveBeenCalled()
  })

  it('ferme les conversations AVANT de supprimer la candidature', async () => {
    await supprimer(evenement as any)

    // L'ordre n'est pas cosmétique : après la suppression, les affectations n'existent plus et
    // l'on ne saurait plus de quelles équipes retirer la personne.
    expect(retirerDesEquipes).toHaveBeenCalledTimes(2)
    expect(retirerDesOrganisateurs).toHaveBeenCalled()
    expect(prismaMock.editionVolunteerApplication.delete).toHaveBeenCalled()

    const rangDuRetrait = retirerDesOrganisateurs.mock.invocationCallOrder[0]!
    const rangDeLaSuppression =
      prismaMock.editionVolunteerApplication.delete.mock.invocationCallOrder[0]!
    expect(rangDuRetrait).toBeLessThan(rangDeLaSuppression)
  })
})

/**
 * L'autre moitié de la chaîne : `leftAt` ferme bien l'accès.
 *
 * Sans ce test, on prouverait qu'une date est posée sans jamais prouver qu'elle sert à quelque
 * chose. La requête du point d'API est le contrat : elle ne retient un participant que si sa date
 * de départ est nulle.
 */
describe('un participant marqué parti ne lit plus les messages', () => {
  const lecteur = {
    context: { user: { id: BENEVOLE }, params: { conversationId: 'conv-1' } },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    global.getRouterParam = vi.fn(() => 'conv-1')
    prismaMock.conversationParticipant.findFirst.mockResolvedValue(null)
    prismaMock.conversation.findUnique.mockResolvedValue(null)
  })

  it('exige une date de départ NULLE pour reconnaître un participant', async () => {
    await lireLesMessages(lecteur as any).catch(() => undefined)

    expect(prismaMock.conversationParticipant.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: BENEVOLE, leftAt: null }),
      })
    )
  })

  it('refuse celui qui n’est plus participant', async () => {
    await expect(lireLesMessages(lecteur as any)).rejects.toMatchObject({ statusCode: 403 })
  })
})
