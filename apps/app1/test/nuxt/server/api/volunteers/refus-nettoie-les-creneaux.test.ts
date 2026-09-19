import { describe, it, expect, beforeEach, vi } from 'vitest'

const mockCanManage = vi.hoisted(() => vi.fn())
const mockSupprimerRepas = vi.hoisted(() => vi.fn())
const mockCreerRepas = vi.hoisted(() => vi.fn())
const mockNotifier = vi.hoisted(() => vi.fn())

vi.mock('#server/utils/api-helpers', () => ({
  wrapApiHandler: (handler: any) => handler,
  createSuccessResponse: (data: unknown) => ({ success: true, data }),
}))

vi.mock('#server/utils/validation-helpers', () => ({
  validateEditionId: (event: any) => parseInt(event?.context?.params?.id, 10),
  validateResourceId: (event: any, nom: string) => parseInt(event?.context?.params?.[nom], 10),
}))

vi.mock('#server/utils/auth-utils', () => ({
  requireAuth: (event: any) => event.context.user,
}))

vi.mock('#server/volunteers/ports/registry', () => ({
  useVolunteerPorts: () => ({
    organizers: { canManage: mockCanManage },
    meals: {
      deleteVolunteerMealSelections: mockSupprimerRepas,
      createVolunteerMealSelections: mockCreerRepas,
    },
    notifications: { notify: mockNotifier },
  }),
}))

vi.mock('#server/utils/notification-service', () => ({
  NotificationHelpers: {
    volunteerAccepted: vi.fn(),
    volunteerRejected: vi.fn(),
    volunteerBackToPending: vi.fn(),
  },
  safeNotify: vi.fn(),
}))

import modifier from '../../../../../../../layers/volunteers/server/api/editions/[id]/volunteers/applications/[applicationId].patch'
import { global } from '../../../globales-nitro'

const prismaMock = (globalThis as any).prisma

/**
 * S1 — une candidature refusée conservait ses affectations aux créneaux.
 *
 * Le refus nettoyait les équipes, les repas et la validation d'entrée — trois choses — et
 * laissait les créneaux, qui vivent dans une table distincte. Deux lignes de la production
 * étaient dans ce cas. Le danger n'est pas le planning : c'est qu'un créneau d'une équipe de
 * CONTRÔLE D'ACCÈS ouvre le droit de valider et d'annuler des entrées à la porte.
 *
 * Ces tests assurent la REQUÊTE, jamais la réponse du mock : un nettoyage se juge à ce qu'il
 * demande à la base de supprimer.
 */
describe('le refus d’une candidature nettoie les créneaux', () => {
  const evenement = {
    context: { params: { id: '42', applicationId: '5' }, user: { id: 1 } },
  }

  /**
   * Les transitions sont contraintes : PENDING → ACCEPTED/REJECTED, et ACCEPTED/REJECTED →
   * PENDING. On ne passe donc JAMAIS d'ACCEPTED directement à REJECTED.
   *
   * C'est le chemin par lequel les deux orphelines de la production sont nées : une candidature
   * acceptée, avec ses créneaux, repassée en PENDING — l'étape qui nettoyait tout sauf eux.
   */
  const candidature = (statut: string) =>
    prismaMock.editionVolunteerApplication.findUnique.mockResolvedValue({
      id: 5,
      eventId: 42,
      userId: 77,
      status: statut,
      user: { id: 77, prenom: 'Ada', nom: 'Lovelace', email: 'ada@x.fr' },
      event: { name: 'Convention' },
    })

  beforeEach(() => {
    vi.clearAllMocks()
    mockCanManage.mockResolvedValue(true)
    candidature('PENDING')
    prismaMock.editionVolunteerApplication.update.mockResolvedValue({
      id: 5,
      status: 'REJECTED',
      teamAssignments: [],
    })
    prismaMock.volunteerAssignment.deleteMany.mockResolvedValue({ count: 2 })
  })

  for (const [depuis, cible] of [
    ['PENDING', 'REJECTED'],
    ['ACCEPTED', 'PENDING'],
  ] as const) {
    it(`supprime les affectations aux créneaux quand on passe de ${depuis} à ${cible}`, async () => {
      candidature(depuis)
      global.readBody = vi.fn().mockResolvedValue({ status: cible })

      await modifier(evenement as any)

      expect(prismaMock.volunteerAssignment.deleteMany).toHaveBeenCalledTimes(1)
      // Les affectations sont rattachées à l'UTILISATEUR et au créneau, pas à la candidature :
      // c'est ce décalage de table qui avait fait oublier le nettoyage.
      expect(prismaMock.volunteerAssignment.deleteMany.mock.calls[0][0].where).toEqual({
        userId: 77,
        timeSlot: { eventId: 42 },
      })
    })
  }

  it('ne touche pas aux créneaux des AUTRES éditions', async () => {
    candidature('PENDING')
    global.readBody = vi.fn().mockResolvedValue({ status: 'REJECTED' })

    await modifier(evenement as any)

    // Une même personne est bénévole sur plusieurs conventions : un refus sur l'une ne doit pas
    // vider son planning sur les autres.
    const critere = prismaMock.volunteerAssignment.deleteMany.mock.calls[0][0].where
    expect(critere.timeSlot.eventId).toBe(42)
  })

  it('ne supprime rien quand on ACCEPTE une candidature', async () => {
    candidature('PENDING')
    global.readBody = vi.fn().mockResolvedValue({ status: 'ACCEPTED' })

    await modifier(evenement as any)

    expect(prismaMock.volunteerAssignment.deleteMany).not.toHaveBeenCalled()
  })
})
