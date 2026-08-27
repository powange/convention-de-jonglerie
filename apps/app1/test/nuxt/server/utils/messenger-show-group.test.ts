import { describe, it, expect, beforeEach, vi } from 'vitest'

import {
  ensureShowGroupConversation,
  syncShowGroupParticipants,
} from '#server/utils/messenger-helpers'

const prismaMock = (globalThis as any).prisma

/** Un spectacle dont la distribution compte deux artistes. */
const spectacle = {
  editionId: 7,
  artists: [{ artist: { userId: 101 } }, { artist: { userId: 102 } }],
}

/**
 * Une édition dont le créateur, l'auteur de la convention et un organisateur habilité
 * doivent se retrouver dans le groupe.
 */
const edition = {
  creatorId: 1,
  convention: { authorId: 2, organizers: [{ userId: 3 }] },
  organizerPermissions: [{ organizer: { userId: 4 } }],
}

describe('groupe de messagerie d’un spectacle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.show.findUnique.mockResolvedValue(spectacle)
    prismaMock.edition.findUnique.mockResolvedValue(edition)
  })

  describe('ensureShowGroupConversation', () => {
    it('réunit la distribution et les organisateurs habilités', async () => {
      prismaMock.conversation.findUnique.mockResolvedValue(null)
      prismaMock.conversation.create.mockResolvedValue({ id: 'conv-1' })

      const id = await ensureShowGroupConversation(42)

      expect(id).toBe('conv-1')
      const data = prismaMock.conversation.create.mock.calls[0][0].data
      expect(data).toMatchObject({ editionId: 7, showId: 42, type: 'SHOW_GROUP' })
      expect(
        data.participants.create.map((p: any) => p.userId).sort((a: number, b: number) => a - b)
      ).toEqual([1, 2, 3, 4, 101, 102])
    })

    it('ne compte qu’une fois un organisateur qui est aussi artiste', async () => {
      prismaMock.show.findUnique.mockResolvedValue({
        editionId: 7,
        // Le créateur de l'édition joue aussi dans le spectacle
        artists: [{ artist: { userId: 1 } }, { artist: { userId: 101 } }],
      })
      prismaMock.conversation.findUnique.mockResolvedValue(null)
      prismaMock.conversation.create.mockResolvedValue({ id: 'conv-1' })

      await ensureShowGroupConversation(42)

      const participants = prismaMock.conversation.create.mock.calls[0][0].data.participants.create
      expect(participants.map((p: any) => p.userId).sort((a: number, b: number) => a - b)).toEqual([
        1, 2, 3, 4, 101,
      ])
    })

    it('retrouve le groupe existant plutôt que d’en créer un second', async () => {
      prismaMock.conversation.findUnique.mockResolvedValue({
        id: 'conv-1',
        participants: [1, 2, 3, 4, 101, 102].map((userId, i) => ({
          id: i,
          userId,
          leftAt: null,
        })),
      })

      const id = await ensureShowGroupConversation(42)

      expect(id).toBe('conv-1')
      expect(prismaMock.conversation.create).not.toHaveBeenCalled()
      expect(prismaMock.conversationParticipant.create).not.toHaveBeenCalled()
      expect(prismaMock.conversationParticipant.update).not.toHaveBeenCalled()
    })

    it('ajoute un artiste entré dans la distribution', async () => {
      prismaMock.conversation.findUnique.mockResolvedValue({
        id: 'conv-1',
        // 102 vient d'être ajouté au spectacle et n'est pas encore dans le groupe
        participants: [1, 2, 3, 4, 101].map((userId, i) => ({ id: i, userId, leftAt: null })),
      })

      await ensureShowGroupConversation(42)

      expect(prismaMock.conversationParticipant.create).toHaveBeenCalledWith({
        data: { conversationId: 'conv-1', userId: 102 },
      })
    })

    it('fait sortir un artiste retiré de la distribution, sans effacer son passage', async () => {
      prismaMock.conversation.findUnique.mockResolvedValue({
        id: 'conv-1',
        participants: [
          ...[1, 2, 3, 4, 101, 102].map((userId, i) => ({ id: i, userId, leftAt: null })),
          // 999 ne fait plus partie du spectacle
          { id: 99, userId: 999, leftAt: null },
        ],
      })

      await ensureShowGroupConversation(42)

      expect(prismaMock.conversationParticipant.update).toHaveBeenCalledWith({
        where: { id: 99 },
        data: { leftAt: expect.any(Date) },
      })
      // Marqué comme parti, pas supprimé : il garde l'accès aux échanges auxquels il a pris part
      expect(prismaMock.conversationParticipant.delete).not.toHaveBeenCalled()
    })

    it('réintègre un participant revenu dans la distribution', async () => {
      prismaMock.conversation.findUnique.mockResolvedValue({
        id: 'conv-1',
        participants: [
          ...[1, 2, 3, 4, 101].map((userId, i) => ({ id: i, userId, leftAt: null })),
          { id: 50, userId: 102, leftAt: new Date('2026-01-01') },
        ],
      })

      await ensureShowGroupConversation(42)

      expect(prismaMock.conversationParticipant.update).toHaveBeenCalledWith({
        where: { id: 50 },
        data: { leftAt: null },
      })
    })

    it('refuse un spectacle introuvable', async () => {
      prismaMock.show.findUnique.mockResolvedValue(null)

      await expect(ensureShowGroupConversation(42)).rejects.toThrow('Spectacle introuvable')
    })
  })

  describe('syncShowGroupParticipants', () => {
    it('ne crée rien tant que personne n’a ouvert le groupe', async () => {
      prismaMock.conversation.findUnique.mockResolvedValue(null)

      await syncShowGroupParticipants(42)

      expect(prismaMock.conversation.create).not.toHaveBeenCalled()
      // Inutile même d'aller chercher la distribution : il n'y a rien à synchroniser
      expect(prismaMock.show.findUnique).not.toHaveBeenCalled()
    })

    it('aligne les participants quand le groupe existe', async () => {
      prismaMock.conversation.findUnique
        .mockResolvedValueOnce({ id: 'conv-1' })
        .mockResolvedValueOnce({
          id: 'conv-1',
          participants: [1, 2, 3, 4, 101].map((userId, i) => ({ id: i, userId, leftAt: null })),
        })

      await syncShowGroupParticipants(42)

      expect(prismaMock.conversationParticipant.create).toHaveBeenCalledWith({
        data: { conversationId: 'conv-1', userId: 102 },
      })
    })
  })
})
