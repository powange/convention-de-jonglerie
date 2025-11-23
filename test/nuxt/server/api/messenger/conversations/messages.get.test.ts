import { describe, it, expect, vi, beforeEach } from 'vitest'
import messagesGetHandler from '../../../../../../server/api/messenger/conversations/[conversationId]/messages/index.get'

// Utiliser le mock global de Prisma défini dans test/setup-common.ts
const prismaMock = (globalThis as any).prisma

// Mock des utilitaires
vi.mock('../../../../../../server/utils/auth-utils', () => ({
  requireAuth: vi.fn(() => ({ id: 1, pseudo: 'TestUser' })),
}))

describe('API GET /messenger/conversations/[conversationId]/messages', () => {
  const mockParticipant = {
    id: 'participant-1',
    userId: 1,
    conversationId: 'conv-1',
  }

  const mockMessages = [
    {
      id: 'msg-1',
      conversationId: 'conv-1',
      participantId: 'participant-1',
      content: 'Premier message',
      replyToId: null,
      createdAt: new Date('2025-01-01T10:00:00Z'),
      editedAt: null,
      deletedAt: null,
      participant: {
        user: {
          id: 1,
          pseudo: 'User1',
          profilePicture: null,
          emailHash: 'hash1',
        },
      },
      replyTo: null,
    },
    {
      id: 'msg-2',
      conversationId: 'conv-1',
      participantId: 'participant-2',
      content: 'Message en réponse',
      replyToId: 'msg-1',
      createdAt: new Date('2025-01-01T11:00:00Z'),
      editedAt: null,
      deletedAt: null,
      participant: {
        user: {
          id: 2,
          pseudo: 'User2',
          profilePicture: null,
          emailHash: 'hash2',
        },
      },
      replyTo: {
        id: 'msg-1',
        content: 'Premier message',
        createdAt: new Date('2025-01-01T10:00:00Z'),
        deletedAt: null,
        participant: {
          user: {
            id: 1,
            pseudo: 'User1',
          },
        },
      },
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    global.getRouterParam = vi.fn(() => 'conv-1')
    global.getQuery = vi.fn(() => ({ page: '1', limit: '50' }))
  })

  it('devrait récupérer les messages avec pagination', async () => {
    prismaMock.conversationParticipant.findFirst.mockResolvedValueOnce(mockParticipant)
    prismaMock.message.count.mockResolvedValueOnce(2)
    prismaMock.message.findMany.mockResolvedValueOnce(mockMessages)

    const mockEvent = {}
    const result = await messagesGetHandler(mockEvent)

    expect(result.success).toBe(true)
    expect(result.data).toHaveLength(2)
    expect(result.pagination).toEqual({
      totalCount: 2,
      page: 1,
      limit: 50,
      totalPages: 1,
      hasNextPage: false,
      hasPrevPage: false,
    })

    expect(prismaMock.message.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          conversationId: 'conv-1',
        },
        take: 50,
        skip: 0,
      })
    )
  })

  it('devrait inclure les informations de réponse (replyTo)', async () => {
    prismaMock.conversationParticipant.findFirst.mockResolvedValueOnce(mockParticipant)
    prismaMock.message.count.mockResolvedValueOnce(2)
    prismaMock.message.findMany.mockResolvedValueOnce(mockMessages)

    const mockEvent = {}
    const result = await messagesGetHandler(mockEvent)

    const messageWithReply = result.data.find((m: any) => m.id === 'msg-2')
    expect(messageWithReply.replyTo).toEqual(
      expect.objectContaining({
        id: 'msg-1',
        content: 'Premier message',
        participant: expect.objectContaining({
          user: expect.objectContaining({
            pseudo: 'User1',
          }),
        }),
      })
    )
  })

  it('devrait masquer le contenu des messages supprimés', async () => {
    const messagesWithDeleted = [
      {
        ...mockMessages[0],
        deletedAt: new Date(),
      },
    ]

    prismaMock.conversationParticipant.findFirst.mockResolvedValueOnce(mockParticipant)
    prismaMock.message.count.mockResolvedValueOnce(1)
    prismaMock.message.findMany.mockResolvedValueOnce(messagesWithDeleted)

    const mockEvent = {}
    const result = await messagesGetHandler(mockEvent)

    expect(result.data[0].content).toBe('Message supprimé')
  })

  it("devrait masquer le contenu du message replyTo s'il est supprimé", async () => {
    const messagesWithDeletedReply = [
      {
        ...mockMessages[1],
        replyTo: {
          ...mockMessages[1].replyTo,
          deletedAt: new Date(),
        },
      },
    ]

    prismaMock.conversationParticipant.findFirst.mockResolvedValueOnce(mockParticipant)
    prismaMock.message.count.mockResolvedValueOnce(1)
    prismaMock.message.findMany.mockResolvedValueOnce(messagesWithDeletedReply)

    const mockEvent = {}
    const result = await messagesGetHandler(mockEvent)

    expect(result.data[0].replyTo.content).toBe('Message supprimé')
  })

  it("devrait rejeter si l'utilisateur n'est pas participant", async () => {
    prismaMock.conversationParticipant.findFirst.mockResolvedValueOnce(null)

    const mockEvent = {}

    await expect(messagesGetHandler(mockEvent)).rejects.toThrow(
      "Vous n'avez pas accès à cette conversation"
    )
  })

  it('devrait gérer la pagination correctement', async () => {
    global.getQuery = vi.fn(() => ({ page: '2', limit: '10' }))

    prismaMock.conversationParticipant.findFirst.mockResolvedValueOnce(mockParticipant)
    prismaMock.message.count.mockResolvedValueOnce(25)
    prismaMock.message.findMany.mockResolvedValueOnce([])

    const mockEvent = {}
    const result = await messagesGetHandler(mockEvent)

    expect(result.pagination.totalCount).toBe(25)
    expect(result.pagination.limit).toBe(10)
    expect(result.pagination.totalPages).toBe(3)

    // Vérifier que take est bien 10
    const findManyCall = prismaMock.message.findMany.mock.calls[0][0]
    expect(findManyCall.take).toBe(10)
  })

  it('devrait utiliser les valeurs par défaut de pagination', async () => {
    global.getQuery = vi.fn(() => ({}))

    prismaMock.conversationParticipant.findFirst.mockResolvedValueOnce(mockParticipant)
    prismaMock.message.count.mockResolvedValueOnce(0)
    prismaMock.message.findMany.mockResolvedValueOnce([])

    const mockEvent = {}
    const result = await messagesGetHandler(mockEvent)

    expect(result.pagination.page).toBe(1)
    expect(result.pagination.limit).toBe(50)
  })

  it('devrait trier les messages par date décroissante', async () => {
    prismaMock.conversationParticipant.findFirst.mockResolvedValueOnce(mockParticipant)
    prismaMock.message.count.mockResolvedValueOnce(2)
    prismaMock.message.findMany.mockResolvedValueOnce(mockMessages)

    const mockEvent = {}
    await messagesGetHandler(mockEvent)

    expect(prismaMock.message.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: {
          createdAt: 'desc',
        },
      })
    )
  })

  it('ne devrait pas exposer participantId dans les résultats', async () => {
    prismaMock.conversationParticipant.findFirst.mockResolvedValueOnce(mockParticipant)
    prismaMock.message.count.mockResolvedValueOnce(2)
    prismaMock.message.findMany.mockResolvedValueOnce(mockMessages)

    const mockEvent = {}
    const result = await messagesGetHandler(mockEvent)

    result.data.forEach((message: any) => {
      expect(message).not.toHaveProperty('participantId')
    })
  })
})
