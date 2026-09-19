import { describe, it, expect, vi, beforeEach } from 'vitest'

// wrapApiHandler et validateEditionId sont auto-importés (Nitro) dans les handlers : on fournit
// des équivalents globaux avant leur chargement (vi.hoisted s'exécute avant les imports).
vi.hoisted(() => {
  if (!(globalThis as any).wrapApiHandler) {
    ;(globalThis as any).wrapApiHandler = (handler: any) => handler
  }
  if (!(globalThis as any).validateEditionId) {
    ;(globalThis as any).validateEditionId = (event: any) =>
      parseInt(event?.context?.params?.id, 10)
  }
})

const mockCanAccessEditionData = vi.hoisted(() => vi.fn())
vi.mock('#server/utils/permissions/edition-permissions', () => ({
  canAccessEditionDataOrAccessControl: mockCanAccessEditionData,
}))

vi.mock('#server/utils/auth-utils', () => ({
  requireAuth: vi.fn((event) => event.context.user),
}))

// Les notifications aux responsables d'équipe ne sont pas le sujet ici, et tirent tout le service
// de notification derrière elles.
vi.mock('#server/utils/notification-service', () => ({
  NotificationHelpers: { volunteerEntryValidated: vi.fn() },
  safeNotify: vi.fn(),
}))
vi.mock('#server/utils/editions/volunteers/responsables-equipe', () => ({
  utilisateursResponsablesDeLEquipe: vi.fn().mockResolvedValue([]),
}))
vi.mock('#server/utils/editions/ticketing/user-info-update', () => ({
  updateUserInfo: vi.fn(),
}))

import invalidateHandler from '../../../../../../server/api/editions/[id]/ticketing/invalidate-entry.post'
import validateHandler from '../../../../../../server/api/editions/[id]/ticketing/validate-entry.post'
import { global } from '../../../../globales-nitro'

const prismaMock = (globalThis as any).prisma

/**
 * Ce que ces tests assurent, c'est la REQUÊTE envoyée à Prisma, jamais ce que le mock a bien voulu
 * rendre. Un journal se juge à ce qu'il écrit : une assertion sur la réponse passerait au vert
 * même si `createMany` n'était jamais appelé.
 */
describe("journal des mouvements d'entrée", () => {
  const acteur = { id: 42, email: 'agent@example.com', pseudo: 'agent' }
  const evenement = { context: { params: { id: '7' }, user: acteur } }

  beforeEach(() => {
    vi.clearAllMocks()
    mockCanAccessEditionData.mockResolvedValue(true)
    prismaMock.entryValidationLog.createMany.mockResolvedValue({ count: 0 })
  })

  describe('validation', () => {
    it('consigne les bénévoles réellement validés, et eux seuls', async () => {
      global.readBody = vi.fn().mockResolvedValue({ participantIds: [1, 2, 3], type: 'volunteer' })
      // Le 2 était déjà validé : le critère `entryValidated: false` l'écarte, et il ne doit donc
      // pas figurer au journal. C'est toute la raison du relevé fait AVANT la mise à jour.
      prismaMock.editionVolunteerApplication.findMany.mockResolvedValue([{ id: 1 }, { id: 3 }])
      prismaMock.editionVolunteerApplication.updateMany.mockResolvedValue({ count: 2 })
      prismaMock.editionVolunteerApplication.findUnique.mockResolvedValue(null)

      await validateHandler(evenement as any)

      expect(prismaMock.entryValidationLog.createMany).toHaveBeenCalledTimes(1)
      expect(prismaMock.entryValidationLog.createMany.mock.calls[0][0].data).toEqual([
        {
          editionId: 7,
          participantKind: 'VOLUNTEER',
          participantId: 1,
          movement: 'VALIDATED',
          actorId: 42,
        },
        {
          editionId: 7,
          participantKind: 'VOLUNTEER',
          participantId: 3,
          movement: 'VALIDATED',
          actorId: 42,
        },
      ])
    })

    it('relève les lignes à valider avec le MÊME critère que la mise à jour', async () => {
      global.readBody = vi.fn().mockResolvedValue({ participantIds: [5], type: 'artist' })
      prismaMock.editionArtist.findMany.mockResolvedValue([{ id: 5 }])
      prismaMock.editionArtist.updateMany.mockResolvedValue({ count: 1 })

      await validateHandler(evenement as any)

      // Deux critères différents feraient entrer au journal des lignes que la mise à jour a
      // laissées de côté — exactement ce que ce relevé cherche à éviter.
      expect(prismaMock.editionArtist.findMany.mock.calls[0][0].where).toEqual(
        prismaMock.editionArtist.updateMany.mock.calls[0][0].where
      )
      expect(prismaMock.editionArtist.findMany.mock.calls[0][0].where.entryValidated).toBe(false)
    })

    it("n'écrit rien quand tout était déjà validé", async () => {
      global.readBody = vi.fn().mockResolvedValue({ participantIds: [9], type: 'organizer' })
      prismaMock.editionOrganizer.findMany.mockResolvedValue([])
      prismaMock.editionOrganizer.updateMany.mockResolvedValue({ count: 0 })

      await validateHandler(evenement as any)

      expect(prismaMock.entryValidationLog.createMany).not.toHaveBeenCalled()
    })

    it('consigne un billet sous le genre TICKET', async () => {
      global.readBody = vi.fn().mockResolvedValue({ participantIds: [11], type: 'ticket' })
      // La branche billet interroge d'abord les remboursements, avec le MÊME `findMany` : sans
      // distinguer les deux appels, le remboursement fictif ferait échouer la validation.
      prismaMock.ticketingOrderItem.findMany.mockImplementation((args: any) =>
        Promise.resolve(args?.where?.OR ? [] : [{ id: 11 }])
      )
      prismaMock.ticketingOrderItem.updateMany.mockResolvedValue({ count: 1 })
      prismaMock.ticketingOrderItem.findFirst.mockResolvedValue(null)

      await validateHandler(evenement as any)

      expect(prismaMock.entryValidationLog.createMany.mock.calls[0][0].data[0]).toMatchObject({
        participantKind: 'TICKET',
        movement: 'VALIDATED',
      })
    })
  })

  describe('annulation', () => {
    it("consigne l'annulation d'une entrée de bénévole", async () => {
      global.readBody = vi.fn().mockResolvedValue({ participantId: 4, type: 'volunteer' })
      prismaMock.editionVolunteerApplication.findFirst.mockResolvedValue({ id: 4 })
      prismaMock.editionVolunteerApplication.update.mockResolvedValue({ id: 4 })

      await invalidateHandler(evenement as any)

      expect(prismaMock.entryValidationLog.createMany.mock.calls[0][0].data).toEqual([
        {
          editionId: 7,
          participantKind: 'VOLUNTEER',
          participantId: 4,
          movement: 'INVALIDATED',
          actorId: 42,
        },
      ])
    })

    it("efface l'auteur sur le billet, comme sur les trois autres populations", async () => {
      global.readBody = vi.fn().mockResolvedValue({ participantId: 12, type: 'ticket' })
      prismaMock.ticketingOrderItem.findFirst.mockResolvedValue({ id: 12 })
      prismaMock.ticketingOrderItem.update.mockResolvedValue({ id: 12 })

      await invalidateHandler(evenement as any)

      // Le billet gardait le nom de qui l'avait validé, alors que l'entrée était annulée.
      expect(prismaMock.ticketingOrderItem.update.mock.calls[0][0].data).toEqual({
        entryValidated: false,
        entryValidatedAt: null,
        entryValidatedBy: null,
      })
    })

    it("n'interrompt pas la dévalidation si le journal refuse l'écriture", async () => {
      global.readBody = vi.fn().mockResolvedValue({ participantId: 8, type: 'artist' })
      prismaMock.editionArtist.findFirst.mockResolvedValue({ id: 8 })
      prismaMock.editionArtist.update.mockResolvedValue({ id: 8 })
      prismaMock.entryValidationLog.createMany.mockRejectedValue(new Error('table absente'))

      // Une file d'attente à l'entrée ne doit pas s'arrêter parce qu'une ligne de traçabilité
      // n'a pas pu être insérée.
      await expect(invalidateHandler(evenement as any)).resolves.toBeTruthy()
      expect(prismaMock.editionArtist.update).toHaveBeenCalled()
    })
  })

  describe('réponses structurées', () => {
    it('rend un compte et un type, et non une phrase en français', async () => {
      global.readBody = vi.fn().mockResolvedValue({ participantIds: [1, 2], type: 'volunteer' })
      prismaMock.editionVolunteerApplication.findMany.mockResolvedValue([{ id: 1 }, { id: 2 }])
      prismaMock.editionVolunteerApplication.updateMany.mockResolvedValue({ count: 2 })
      prismaMock.editionVolunteerApplication.findUnique.mockResolvedValue(null)

      const reponse: any = await validateHandler(evenement as any)

      expect(reponse.data).toEqual({ validated: 2, type: 'volunteer' })
      // La pluralisation appartient au client, qui seul connaît la langue du lecteur.
      expect(reponse.message).toBeUndefined()
    })
  })
})
