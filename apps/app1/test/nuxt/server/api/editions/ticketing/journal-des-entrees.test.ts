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

  /**
   * Les lignes sont relues APRÈS la mise à jour et reconnues à l'horodatage exact de l'appel.
   * Les mocks doivent donc le récupérer au vol : c'est le handler qui le fabrique, et c'est
   * précisément ce que ces tests vérifient.
   */
  const interceptant = (modele: string, lignes: (t: Date) => any[]) => {
    let horodatage: Date
    prismaMock[modele].updateMany.mockImplementation((args: any) => {
      horodatage = args.data.entryValidatedAt
      return Promise.resolve({
        count: lignes(horodatage).filter((l) => l.entryValidatedAt === horodatage).length,
      })
    })
    prismaMock[modele].findMany.mockImplementation((args: any) =>
      Promise.resolve(args?.where?.OR ? [] : lignes(horodatage))
    )
  }

  describe('validation', () => {
    it('consigne les bénévoles que CET appel a fait passer, et eux seuls', async () => {
      global.readBody = vi.fn().mockResolvedValue({ participantIds: [1, 2, 3], type: 'volunteer' })
      // Le 2 avait été validé par quelqu'un d'autre : ni le même auteur, ni le même instant.
      // Il n'a donc pas bougé, et n'a rien à faire au journal.
      interceptant('editionVolunteerApplication', (t) => [
        { id: 1, entryValidated: true, entryValidatedAt: t, entryValidatedBy: 42 },
        {
          id: 2,
          entryValidated: true,
          entryValidatedAt: new Date('2026-08-01T09:00:00Z'),
          entryValidatedBy: 99,
        },
        { id: 3, entryValidated: true, entryValidatedAt: t, entryValidatedBy: 42 },
      ])
      prismaMock.editionVolunteerApplication.findUnique.mockResolvedValue(null)
      prismaMock.user.findMany.mockResolvedValue([{ id: 99, prenom: 'Grace', nom: 'Hopper' }])

      await validateHandler(evenement as any)

      expect(prismaMock.entryValidationLog.createMany).toHaveBeenCalledTimes(1)
      expect(
        prismaMock.entryValidationLog.createMany.mock.calls[0][0].data.map(
          (l: any) => l.participantId
        )
      ).toEqual([1, 3])
    })

    it('reconnaît les lignes à son propre horodatage, pas au seul auteur', async () => {
      global.readBody = vi.fn().mockResolvedValue({ participantIds: [5, 6], type: 'artist' })
      // Même agent, scan précédent : le 6 porte bien `actorId` 42, mais un autre instant. Un
      // départage fondé sur le seul auteur le recompterait à chaque nouveau scan.
      interceptant('editionArtist', (t) => [
        { id: 5, entryValidated: true, entryValidatedAt: t, entryValidatedBy: 42 },
        {
          id: 6,
          entryValidated: true,
          entryValidatedAt: new Date('2026-08-01T09:00:00Z'),
          entryValidatedBy: 42,
        },
      ])
      prismaMock.user.findMany.mockResolvedValue([{ id: 42, prenom: 'Ada', nom: 'Lovelace' }])

      await validateHandler(evenement as any)

      expect(
        prismaMock.entryValidationLog.createMany.mock.calls[0][0].data.map(
          (l: any) => l.participantId
        )
      ).toEqual([5])
    })

    it("n'écrit rien quand tout était déjà validé", async () => {
      global.readBody = vi.fn().mockResolvedValue({ participantIds: [9], type: 'organizer' })
      interceptant('editionOrganizer', () => [
        {
          id: 9,
          entryValidated: true,
          entryValidatedAt: new Date('2026-08-01T09:00:00Z'),
          entryValidatedBy: 99,
        },
      ])
      prismaMock.user.findMany.mockResolvedValue([{ id: 99, prenom: 'Grace', nom: 'Hopper' }])

      await validateHandler(evenement as any)

      expect(prismaMock.entryValidationLog.createMany).not.toHaveBeenCalled()
    })

    it('consigne un billet sous le genre TICKET', async () => {
      global.readBody = vi.fn().mockResolvedValue({ participantIds: [11], type: 'ticket' })
      // La branche billet interroge d'abord les remboursements, avec le MÊME `findMany` :
      // `interceptant` distingue les deux appels sur la présence d'un `OR` dans le critère.
      interceptant('ticketingOrderItem', (t) => [
        { id: 11, entryValidated: true, entryValidatedAt: t, entryValidatedBy: 42 },
      ])
      prismaMock.ticketingOrderItem.findFirst.mockResolvedValue(null)

      await validateHandler(evenement as any)

      expect(prismaMock.entryValidationLog.createMany.mock.calls[0][0].data[0]).toMatchObject({
        participantKind: 'TICKET',
        movement: 'VALIDATED',
      })
    })

    it('laisse la condition qui rend le double scan atomique dans la mise à jour', async () => {
      global.readBody = vi.fn().mockResolvedValue({ participantIds: [5], type: 'artist' })
      interceptant('editionArtist', (t) => [
        { id: 5, entryValidated: true, entryValidatedAt: t, entryValidatedBy: 42 },
      ])

      await validateHandler(evenement as any)

      // Sans elle, deux scanners simultanés valideraient deux fois la même personne — et le
      // départage qui suit n'y pourrait rien, il ne fait que rendre compte.
      expect(prismaMock.editionArtist.updateMany.mock.calls[0][0].where.entryValidated).toBe(false)
      // La relecture, elle, ne la porte pas : elle doit VOIR les lignes déjà validées.
      const relecture = prismaMock.editionArtist.findMany.mock.calls.at(-1)![0]
      expect(relecture.where.entryValidated).toBeUndefined()
    })
  })

  describe('billet annulé', () => {
    it("refuse un billet annulé, que l'ancienne garde laissait passer", async () => {
      global.readBody = vi.fn().mockResolvedValue({ participantIds: [11], type: 'ticket' })
      // Le premier `findMany` de la branche billet est la garde : elle porte un `OR`.
      prismaMock.ticketingOrderItem.findMany.mockImplementation((args: any) =>
        Promise.resolve(args?.where?.OR ? [{ id: 11 }] : [])
      )

      await expect(validateHandler(evenement as any)).rejects.toThrow()
      // Rien ne doit avoir bougé : ni l'entrée, ni le journal.
      expect(prismaMock.ticketingOrderItem.updateMany).not.toHaveBeenCalled()
      expect(prismaMock.entryValidationLog.createMany).not.toHaveBeenCalled()
    })

    it("cherche l'état d'annulation réellement écrit en base, pas seulement « Refunded »", async () => {
      global.readBody = vi.fn().mockResolvedValue({ participantIds: [11], type: 'ticket' })
      interceptant('ticketingOrderItem', (t) => [
        { id: 11, entryValidated: true, entryValidatedAt: t, entryValidatedBy: 42 },
      ])
      prismaMock.ticketingOrderItem.findFirst.mockResolvedValue(null)

      await validateHandler(evenement as any)

      const garde = prismaMock.ticketingOrderItem.findMany.mock.calls.find(
        (appel: any) => appel[0]?.where?.OR
      )!
      // C'est la valeur que la garde d'origine ignorait — et la seule que les 12 lignes annulées
      // de la production portent réellement. `Refunded`, lui, n'apparaît sur aucune.
      expect(garde[0].where.OR[0].state.in).toContain('Canceled')
      expect(garde[0].where.OR[1].order.status).toBe('Refunded')
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

      expect(reponse.data).toMatchObject({ validated: 2, type: 'volunteer', alreadyValidated: [] })
      // La pluralisation appartient au client, qui seul connaît la langue du lecteur.
      expect(reponse.message).toBeUndefined()
    })

    it('dit QUI avait déjà validé, et QUAND, quand un collègue a devancé', async () => {
      global.readBody = vi.fn().mockResolvedValue({ participantIds: [7], type: 'artist' })
      const avant = new Date('2026-08-01T09:00:00Z')
      interceptant('editionArtist', () => [
        { id: 7, entryValidated: true, entryValidatedAt: avant, entryValidatedBy: 99 },
      ])
      prismaMock.user.findMany.mockResolvedValue([{ id: 99, prenom: 'Grace', nom: 'Hopper' }])

      const reponse: any = await validateHandler(evenement as any)

      // Sans cela, le second agent lit « 0 validé » dans une réponse de succès et croit avoir
      // laissé entrer la personne, alors qu'un collègue l'a fait avant lui.
      expect(reponse.data.validated).toBe(0)
      expect(reponse.data.alreadyValidated).toEqual([
        { id: 7, at: avant, by: { firstName: 'Grace', lastName: 'Hopper' } },
      ])
    })

    it('ne prétend pas connaître un auteur que la ligne ne porte pas', async () => {
      global.readBody = vi.fn().mockResolvedValue({ participantIds: [8], type: 'artist' })
      interceptant('editionArtist', () => [
        { id: 8, entryValidated: true, entryValidatedAt: null, entryValidatedBy: null },
      ])

      const reponse: any = await validateHandler(evenement as any)

      expect(reponse.data.alreadyValidated).toEqual([{ id: 8, at: null, by: null }])
      // Aucun auteur à résoudre : pas de requête inutile sur les utilisateurs.
      expect(prismaMock.user.findMany).not.toHaveBeenCalled()
    })
  })
})
