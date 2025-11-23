import { describe, it, expect, vi, beforeEach } from 'vitest'
import messagesPostHandler from '../../../../../../server/api/messenger/conversations/[conversationId]/messages/index.post'

// Utiliser le mock global de Prisma défini dans test/setup-common.ts
const prismaMock = (globalThis as any).prisma

// Mock des utilitaires
vi.mock('../../../../../../server/utils/auth-utils', () => ({
  requireAuth: vi.fn(() => ({ id: 1, pseudo: 'TestUser' })),
}))

vi.mock('../../../../../../server/utils/push-notification-service', () => ({
  pushNotificationService: {
    sendToUser: vi.fn(),
  },
}))

describe('API POST /messenger/conversations/[conversationId]/messages', () => {
  const mockConversation = {
    id: 'conv-1',
    type: 'TEAM_GROUP',
    teamId: 'team-1',
    editionId: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    team: {
      name: 'Équipe Test',
    },
    edition: {
      id: 1,
      name: 'Édition Test 2025',
      convention: {
        name: 'Convention Test',
      },
    },
    participants: [
      {
        userId: 2,
      },
      {
        userId: 3,
      },
    ],
  }

  const mockParticipant = {
    id: 'participant-1',
    userId: 1,
    conversationId: 'conv-1',
    conversation: mockConversation,
  }

  const mockMessage = {
    id: 'msg-1',
    conversationId: 'conv-1',
    participantId: 'participant-1',
    content: 'Test message',
    replyToId: null,
    createdAt: new Date(),
    editedAt: null,
    deletedAt: null,
    participant: {
      id: 'participant-1',
      user: {
        id: 1,
        pseudo: 'TestUser',
        profilePicture: null,
        emailHash: 'hash123',
      },
    },
    replyTo: null,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    global.getRouterParam = vi.fn(() => 'conv-1')
    global.readBody = vi.fn()
  })

  it('devrait créer un message sans réponse', async () => {
    prismaMock.conversationParticipant.findFirst.mockResolvedValueOnce(mockParticipant)
    prismaMock.message.create.mockResolvedValueOnce(mockMessage)
    prismaMock.conversation.update.mockResolvedValueOnce({})
    prismaMock.conversationParticipant.findMany.mockResolvedValueOnce([])
    prismaMock.message.findMany.mockResolvedValueOnce([{ id: 'msg-1', createdAt: new Date() }])

    global.readBody.mockResolvedValue({
      content: 'Test message',
    })

    const mockEvent = {}
    const result = await messagesPostHandler(mockEvent)

    expect(result.success).toBe(true)
    expect(result.data).toEqual(
      expect.objectContaining({
        content: 'Test message',
        replyToId: null,
      })
    )
    expect(result.data).not.toHaveProperty('participantId')

    expect(prismaMock.message.create).toHaveBeenCalledWith({
      data: {
        conversationId: 'conv-1',
        participantId: 'participant-1',
        content: 'Test message',
        replyToId: undefined,
      },
      include: expect.any(Object),
    })
  })

  it('devrait créer un message avec une réponse', async () => {
    const mockReplyToMessage = {
      id: 'msg-original',
      conversationId: 'conv-1',
      content: 'Message original',
    }

    const mockMessageWithReply = {
      ...mockMessage,
      id: 'msg-2',
      content: 'Message en réponse',
      replyToId: 'msg-original',
      replyTo: {
        id: 'msg-original',
        content: 'Message original',
        createdAt: new Date(),
        deletedAt: null,
        participant: {
          user: {
            id: 2,
            pseudo: 'OtherUser',
          },
        },
      },
    }

    prismaMock.conversationParticipant.findFirst.mockResolvedValueOnce(mockParticipant)
    prismaMock.message.findFirst.mockResolvedValueOnce(mockReplyToMessage)
    prismaMock.message.create.mockResolvedValueOnce(mockMessageWithReply)
    prismaMock.conversation.update.mockResolvedValueOnce({})
    prismaMock.conversationParticipant.findMany.mockResolvedValueOnce([])
    prismaMock.message.findMany.mockResolvedValueOnce([
      { id: 'msg-2', createdAt: new Date() },
      { id: 'msg-original', createdAt: new Date(Date.now() - 10000) },
    ])

    global.readBody.mockResolvedValue({
      content: 'Message en réponse',
      replyToId: 'msg-original',
    })

    const mockEvent = {}
    const result = await messagesPostHandler(mockEvent)

    expect(result.success).toBe(true)
    expect(result.data.replyToId).toBe('msg-original')
    expect(result.data.replyTo).toEqual(
      expect.objectContaining({
        id: 'msg-original',
        content: 'Message original',
      })
    )

    expect(prismaMock.message.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'msg-original',
        conversationId: 'conv-1',
      },
    })
  })

  it("devrait rejeter si le message de réponse n'existe pas", async () => {
    prismaMock.conversationParticipant.findFirst.mockResolvedValueOnce(mockParticipant)
    prismaMock.message.findFirst.mockResolvedValueOnce(null)

    global.readBody.mockResolvedValue({
      content: 'Message en réponse',
      replyToId: 'msg-inexistant',
    })

    const mockEvent = {}

    await expect(messagesPostHandler(mockEvent)).rejects.toThrow(
      "Le message auquel vous tentez de répondre n'existe pas dans cette conversation"
    )
  })

  it("devrait rejeter si l'utilisateur n'est pas participant", async () => {
    prismaMock.conversationParticipant.findFirst.mockResolvedValueOnce(null)

    global.readBody.mockResolvedValue({
      content: 'Test message',
    })

    const mockEvent = {}

    await expect(messagesPostHandler(mockEvent)).rejects.toThrow(
      "Vous n'avez pas accès à cette conversation"
    )
  })

  it("devrait valider que le contenu n'est pas vide", async () => {
    global.readBody.mockResolvedValue({
      content: '',
    })

    const mockEvent = {}

    await expect(messagesPostHandler(mockEvent)).rejects.toThrow()
  })

  it('devrait valider que le contenu ne dépasse pas 10000 caractères', async () => {
    global.readBody.mockResolvedValue({
      content: 'a'.repeat(10001),
    })

    const mockEvent = {}

    await expect(messagesPostHandler(mockEvent)).rejects.toThrow()
  })

  it('devrait mettre à jour la conversation updatedAt', async () => {
    prismaMock.conversationParticipant.findFirst.mockResolvedValueOnce(mockParticipant)
    prismaMock.message.create.mockResolvedValueOnce(mockMessage)
    prismaMock.conversation.update.mockResolvedValueOnce({})
    prismaMock.conversationParticipant.findMany.mockResolvedValueOnce([])
    prismaMock.message.findMany.mockResolvedValueOnce([{ id: 'msg-1', createdAt: new Date() }])

    global.readBody.mockResolvedValue({
      content: 'Test message',
    })

    const mockEvent = {}
    await messagesPostHandler(mockEvent)

    expect(prismaMock.conversation.update).toHaveBeenCalledWith({
      where: { id: 'conv-1' },
      data: { updatedAt: expect.any(Date) },
    })
  })
})
