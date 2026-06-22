import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock du notification stream manager
vi.mock('../../../../../server/utils/notification-stream-manager', () => ({
  notificationStreamManager: {
    addConnection: vi.fn().mockReturnValue('connection-123'),
    removeConnection: vi.fn(),
  },
}))

import handler from '../../../../../server/api/notifications/stream.get'
import { notificationStreamManager } from '../../../../../server/utils/notification-stream-manager'

const mockStreamManager = notificationStreamManager as {
  addConnection: ReturnType<typeof vi.fn>
  removeConnection: ReturnType<typeof vi.fn>
}

describe('/api/notifications/stream GET (SSE)', () => {
  const mockUser = {
    id: 1,
    email: 'test@example.com',
    pseudo: 'testuser',
    isGlobalAdmin: false,
  }

  let mockSetHeader: ReturnType<typeof vi.fn>
  let mockReqEvents: Record<string, (() => void)[]>

  beforeEach(() => {
    vi.clearAllMocks()
    mockSetHeader = vi.fn()
    global.setHeader = mockSetHeader
    mockReqEvents = {}
    mockStreamManager.addConnection.mockReturnValue('connection-123')
  })

  const createMockEvent = (user: typeof mockUser | null = mockUser) => {
    mockReqEvents = {}
    return {
      context: user ? { user } : {},
      node: {
        req: {
          on: (event: string, callback: () => void) => {
            if (!mockReqEvents[event]) mockReqEvents[event] = []
            mockReqEvents[event].push(callback)
          },
        },
      },
    }
  }

  it('devrait retourner un ReadableStream', async () => {
    const mockEvent = createMockEvent()

    const result = await handler(mockEvent as any)

    expect(result).toBeInstanceOf(ReadableStream)
  })

  it('devrait configurer les headers SSE', async () => {
    const mockEvent = createMockEvent()

    await handler(mockEvent as any)

    expect(mockSetHeader).toHaveBeenCalledWith(mockEvent, 'Content-Type', 'text/event-stream')
    expect(mockSetHeader).toHaveBeenCalledWith(mockEvent, 'Cache-Control', 'no-cache')
    expect(mockSetHeader).toHaveBeenCalledWith(mockEvent, 'Connection', 'keep-alive')
    expect(mockSetHeader).toHaveBeenCalledWith(mockEvent, 'Access-Control-Allow-Origin', '*')
    expect(mockSetHeader).toHaveBeenCalledWith(
      mockEvent,
      'Access-Control-Allow-Headers',
      'Cache-Control'
    )
  })

  it('devrait ajouter une connexion au stream manager', async () => {
    const mockEvent = createMockEvent()

    await handler(mockEvent as any)

    // Le addConnection est appelé dans le start() du ReadableStream
    // On attend un peu pour que start() soit exécuté
    await new Promise((resolve) => setTimeout(resolve, 10))

    expect(mockStreamManager.addConnection).toHaveBeenCalledWith(
      1, // userId
      expect.objectContaining({
        push: expect.any(Function),
        onClosed: expect.any(Function),
      })
    )
  })

  it('devrait rejeter si utilisateur non authentifié', async () => {
    const mockEvent = createMockEvent(null)

    await expect(handler(mockEvent as any)).rejects.toMatchObject({
      statusCode: 401,
    })
  })

  it('devrait écouter les événements close et aborted', async () => {
    const mockEvent = createMockEvent()

    await handler(mockEvent as any)

    // Attendre que le stream soit configuré
    await new Promise((resolve) => setTimeout(resolve, 10))

    expect(mockReqEvents['close']).toBeDefined()
    expect(mockReqEvents['close'].length).toBeGreaterThan(0)
    expect(mockReqEvents['aborted']).toBeDefined()
    expect(mockReqEvents['aborted'].length).toBeGreaterThan(0)
  })

  it('devrait nettoyer la connexion lors de la fermeture', async () => {
    const mockEvent = createMockEvent()

    await handler(mockEvent as any)

    // Attendre que le stream soit configuré
    await new Promise((resolve) => setTimeout(resolve, 10))

    // Simuler la fermeture de la connexion
    if (mockReqEvents['close'] && mockReqEvents['close'][0]) {
      mockReqEvents['close'][0]()
    }

    expect(mockStreamManager.removeConnection).toHaveBeenCalledWith('connection-123')
  })

  it('devrait utiliser le bon userId pour la connexion', async () => {
    const mockEvent = createMockEvent({
      ...mockUser,
      id: 42,
    })

    await handler(mockEvent as any)

    // Attendre que le stream soit configuré
    await new Promise((resolve) => setTimeout(resolve, 10))

    expect(mockStreamManager.addConnection).toHaveBeenCalledWith(42, expect.any(Object))
  })
})
