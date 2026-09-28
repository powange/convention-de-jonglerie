import { describe, it, expect, beforeEach, vi } from 'vitest'

import { ensureShowApplicationConversation } from '#server/utils/messenger-helpers'

const prismaMock = (globalThis as any).prisma

/**
 * La conversation d'une candidature artiste, et à qui elle parvient.
 *
 * Elle était créée avec pour seuls participants l'artiste et l'expéditeur. Quand c'était
 * l'artiste qui écrivait le premier, depuis « Mes candidatures », il devenait donc le SEUL
 * participant de sa propre conversation. Or l'envoi d'un message ne notifie que les participants
 * (`messages/index.post.ts`) : personne n'était prévenu, la conversation n'apparaissait dans la
 * messagerie d'aucun organisateur, et le message dormait jusqu'à ce qu'un organisateur ouvre cette
 * fiche par hasard.
 *
 * Le groupe d'un spectacle, lui, inscrivait déjà d'emblée les organisateurs habilités : c'est
 * cette liste-là qui est désormais partagée entre les deux
 * (`organisateursHabilitesSurLesArtistes`).
 */
describe('conversation d’une candidature artiste', () => {
  const ARTISTE = 101
  const EDITION = 7

  /** Créateur 1, auteur de convention 2, organisateur habilité 3, habilité par édition 4. */
  const edition = {
    creatorId: 1,
    convention: { authorId: 2, organizers: [{ userId: 3 }] },
    organizerPermissions: [{ organizer: { userId: 4 } }],
  }

  const participantsCrees = () =>
    prismaMock.conversation.create.mock.calls[0][0].data.participants.create
      .map((p: any) => p.userId)
      .sort((a: number, b: number) => a - b)

  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.showApplication.findUnique.mockResolvedValue({
      id: 42,
      userId: ARTISTE,
      showCall: { edition: { id: EDITION } },
    })
    prismaMock.edition.findUnique.mockResolvedValue(edition)
    prismaMock.conversation.findUnique.mockResolvedValue(null)
    prismaMock.conversation.create.mockResolvedValue({ id: 'conv-1' })
  })

  describe('à la création', () => {
    it('inscrit les organisateurs habilités quand c’est l’artiste qui écrit le premier', async () => {
      // Le cas du constat, et celui que l'utilisateur a rencontré à l'usage.
      const id = await ensureShowApplicationConversation(42, ARTISTE)

      expect(id).toBe('conv-1')
      expect(participantsCrees()).toEqual([1, 2, 3, 4, ARTISTE])
    })

    it('marque la conversation comme celle de cette candidature', async () => {
      await ensureShowApplicationConversation(42, ARTISTE)

      expect(prismaMock.conversation.create.mock.calls[0][0].data).toMatchObject({
        editionId: EDITION,
        showApplicationId: 42,
        type: 'ARTIST_APPLICATION',
      })
    })

    it('n’oublie pas l’artiste quand c’est un organisateur qui écrit le premier', async () => {
      await ensureShowApplicationConversation(42, 3)

      expect(participantsCrees()).toEqual([1, 2, 3, 4, ARTISTE])
    })

    it('ne compte qu’une fois l’expéditeur qui est aussi organisateur', async () => {
      // Sans dédoublonnage, deux lignes pour le même couple heurteraient l'unicité
      // (conversationId, userId).
      await ensureShowApplicationConversation(42, 1)

      const ids = participantsCrees()
      expect(ids).toEqual([1, 2, 3, 4, ARTISTE])
      expect(new Set(ids).size).toBe(ids.length)
    })

    it('garde un expéditeur qui n’est pas organisateur, par exemple un admin en mode admin', async () => {
      await ensureShowApplicationConversation(42, 900)

      expect(participantsCrees()).toEqual([1, 2, 3, 4, ARTISTE, 900])
    })

    it('refuse une candidature introuvable', async () => {
      prismaMock.showApplication.findUnique.mockResolvedValue(null)

      await expect(ensureShowApplicationConversation(42, ARTISTE)).rejects.toThrow(
        'Candidature introuvable'
      )
      expect(prismaMock.conversation.create).not.toHaveBeenCalled()
    })
  })

  describe('sur une conversation existante', () => {
    it('rattrape les organisateurs qui n’y sont pas', async () => {
      // La conversation d'avant la correction : l'artiste, tout seul.
      prismaMock.conversation.findUnique.mockResolvedValue({
        id: 'conv-1',
        participants: [{ id: 1, userId: ARTISTE, leftAt: null }],
      })

      const id = await ensureShowApplicationConversation(42, ARTISTE)

      expect(id).toBe('conv-1')
      expect(prismaMock.conversation.create).not.toHaveBeenCalled()
      expect(
        prismaMock.conversationParticipant.create.mock.calls
          .map((c: any[]) => c[0].data.userId)
          .sort((a: number, b: number) => a - b)
      ).toEqual([1, 2, 3, 4])
    })

    it('ne touche à rien quand tout le monde est déjà là', async () => {
      prismaMock.conversation.findUnique.mockResolvedValue({
        id: 'conv-1',
        participants: [ARTISTE, 1, 2, 3, 4].map((userId, i) => ({ id: i, userId, leftAt: null })),
      })

      await ensureShowApplicationConversation(42, ARTISTE)

      expect(prismaMock.conversationParticipant.create).not.toHaveBeenCalled()
      expect(prismaMock.conversationParticipant.update).not.toHaveBeenCalled()
    })

    it('réactive un organisateur qui avait été marqué comme parti', async () => {
      // `leftAt` n'est jamais posé par un geste de l'utilisateur dans ce module, seulement par la
      // perte d'une habilitation : celui qui la retrouve revient.
      prismaMock.conversation.findUnique.mockResolvedValue({
        id: 'conv-1',
        participants: [
          { id: 1, userId: ARTISTE, leftAt: null },
          { id: 2, userId: 1, leftAt: null },
          { id: 3, userId: 2, leftAt: null },
          { id: 4, userId: 3, leftAt: new Date('2026-01-01') },
          { id: 5, userId: 4, leftAt: null },
        ],
      })

      await ensureShowApplicationConversation(42, ARTISTE)

      expect(prismaMock.conversationParticipant.update).toHaveBeenCalledWith({
        where: { conversationId_userId: { conversationId: 'conv-1', userId: 3 } },
        data: { leftAt: null },
      })
    })

    it('n’expulse pas l’artiste, qui n’est pas dans la liste des organisateurs', async () => {
      // Le groupe d'un spectacle fait sortir « qui n'est pas dans la liste » ; sa liste contient
      // les artistes. Ici elle ne contient que les organisateurs : transposer la règle mettrait
      // l'artiste dehors de sa propre conversation.
      prismaMock.conversation.findUnique.mockResolvedValue({
        id: 'conv-1',
        participants: [ARTISTE, 1, 2, 3, 4].map((userId, i) => ({ id: i, userId, leftAt: null })),
      })

      await ensureShowApplicationConversation(42, 3)

      expect(prismaMock.conversationParticipant.update).not.toHaveBeenCalledWith(
        expect.objectContaining({ data: { leftAt: expect.any(Date) } })
      )
    })
  })
})
