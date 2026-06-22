import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useMessenger } from '../../../app/composables/useMessenger'
import type { ConversationMessage } from '../../../app/composables/useMessenger'

// Mock $fetch
const mockFetch = vi.fn()
vi.stubGlobal('$fetch', mockFetch)

// Mock useToast
const mockToast = {
  add: vi.fn(),
}
vi.stubGlobal('useToast', () => mockToast)

describe('useMessenger', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('sendMessage', () => {
    it('devrait envoyer un message sans réponse', async () => {
      const mockMessage: ConversationMessage = {
        id: 'msg-1',
        conversationId: 'conv-1',
        content: 'Test message',
        replyToId: null,
        replyTo: null,
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
      }

      mockFetch.mockResolvedValueOnce({
        success: true,
        data: mockMessage,
      })

      const { sendMessage } = useMessenger()
      const result = await sendMessage('conv-1', 'Test message')

      expect(result).toEqual(mockMessage)
      expect(mockFetch).toHaveBeenCalledWith('/api/messenger/conversations/conv-1/messages', {
        method: 'POST',
        body: {
          content: 'Test message',
          replyToId: undefined,
        },
      })
    })

    it('devrait envoyer un message avec une réponse', async () => {
      const mockMessageWithReply: ConversationMessage = {
        id: 'msg-2',
        conversationId: 'conv-1',
        content: 'Réponse au message',
        replyToId: 'msg-1',
        replyTo: {
          id: 'msg-1',
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
      }

      mockFetch.mockResolvedValueOnce({
        success: true,
        data: mockMessageWithReply,
      })

      const { sendMessage } = useMessenger()
      const result = await sendMessage('conv-1', 'Réponse au message', 'msg-1')

      expect(result).toEqual(mockMessageWithReply)
      expect(result?.replyToId).toBe('msg-1')
      expect(result?.replyTo).toEqual(
        expect.objectContaining({
          id: 'msg-1',
          content: 'Message original',
        })
      )
      expect(mockFetch).toHaveBeenCalledWith('/api/messenger/conversations/conv-1/messages', {
        method: 'POST',
        body: {
          content: 'Réponse au message',
          replyToId: 'msg-1',
        },
      })
    })

    it("devrait retourner null en cas d'erreur", async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const { sendMessage } = useMessenger()
      const result = await sendMessage('conv-1', 'Test message')

      expect(result).toBeNull()
    })

    it('devrait retourner le message même si success est absent', async () => {
      const mockMessage: ConversationMessage = {
        id: 'msg-1',
        conversationId: 'conv-1',
        content: 'Test message',
        replyToId: null,
        replyTo: null,
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
      }

      mockFetch.mockResolvedValueOnce({
        data: mockMessage,
      })

      const { sendMessage } = useMessenger()
      const result = await sendMessage('conv-1', 'Test message')

      expect(result).toEqual(mockMessage)
    })
  })

  describe('fetchMessages', () => {
    it('devrait récupérer les messages avec pagination', async () => {
      const mockMessages: ConversationMessage[] = [
        {
          id: 'msg-1',
          conversationId: 'conv-1',
          content: 'Message 1',
          replyToId: null,
          replyTo: null,
          createdAt: new Date(),
          editedAt: null,
          deletedAt: null,
          participant: {
            id: 'participant-1',
            user: {
              id: 1,
              pseudo: 'User1',
              profilePicture: null,
              emailHash: 'hash1',
            },
          },
        },
      ]

      mockFetch.mockResolvedValueOnce({
        success: true,
        data: mockMessages,
        pagination: {
          total: 1,
          page: 1,
          limit: 50,
          totalPages: 1,
        },
      })

      const { fetchMessages } = useMessenger()
      const result = await fetchMessages('conv-1', { limit: 50, offset: 0 })

      expect(result).toEqual({
        data: mockMessages,
        pagination: {
          total: 1,
          page: 1,
          limit: 50,
          totalPages: 1,
        },
      })
      expect(mockFetch).toHaveBeenCalledWith('/api/messenger/conversations/conv-1/messages', {
        query: {
          limit: 50,
          offset: 0,
        },
      })
    })

    it('devrait récupérer les messages avec replyTo', async () => {
      const mockMessages: ConversationMessage[] = [
        {
          id: 'msg-2',
          conversationId: 'conv-1',
          content: 'Réponse',
          replyToId: 'msg-1',
          replyTo: {
            id: 'msg-1',
            content: 'Message original',
            createdAt: new Date(),
            deletedAt: null,
            participant: {
              user: {
                id: 1,
                pseudo: 'User1',
              },
            },
          },
          createdAt: new Date(),
          editedAt: null,
          deletedAt: null,
          participant: {
            id: 'participant-2',
            user: {
              id: 2,
              pseudo: 'User2',
              profilePicture: null,
              emailHash: 'hash2',
            },
          },
        },
      ]

      mockFetch.mockResolvedValueOnce({
        success: true,
        data: mockMessages,
        pagination: {
          total: 1,
          page: 1,
          limit: 50,
          totalPages: 1,
        },
      })

      const { fetchMessages } = useMessenger()
      const result = await fetchMessages('conv-1')

      expect(result?.data[0].replyTo).toEqual(
        expect.objectContaining({
          id: 'msg-1',
          content: 'Message original',
        })
      )
    })

    it("devrait retourner un objet vide en cas d'erreur", async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const { fetchMessages } = useMessenger()
      const result = await fetchMessages('conv-1')

      expect(result).toEqual({ data: [], pagination: null })
    })
  })

  describe('deleteMessage', () => {
    it('devrait supprimer un message', async () => {
      mockFetch.mockResolvedValueOnce({
        success: true,
      })

      const { deleteMessage } = useMessenger()
      const result = await deleteMessage('conv-1', 'msg-1')

      expect(result).toBe(true)
      expect(mockFetch).toHaveBeenCalledWith('/api/messenger/conversations/conv-1/messages/msg-1', {
        method: 'PATCH',
        body: {
          deleted: true,
        },
      })
    })

    it("devrait retourner false en cas d'erreur", async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const { deleteMessage } = useMessenger()
      const result = await deleteMessage('conv-1', 'msg-1')

      expect(result).toBe(false)
    })
  })
})
