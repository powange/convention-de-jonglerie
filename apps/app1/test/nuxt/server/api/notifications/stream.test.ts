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
import { global } from '../../../globales-nitro'

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

  /**
   * Ce que le flux RÉPOND au gestionnaire — constat A2, côté point d'API.
   *
   * ## ⚠️ LE DÉFAUT
   *
   * `push` attrapait l'erreur d'`enqueue`, posait son drapeau de fermeture et retournait sans rien
   * dire. Le gestionnaire ne voyait donc jamais d'échec, et tout ce qui en dépendait — retrait de
   * la connexion, `lastPing`, `cleanupStaleConnections` — était inatteignable.
   *
   * ## ⚠️⚠️ CE QUI REND CES CAS NON CREUX
   *
   * Le gabarit passé au gestionnaire est RÉCUPÉRÉ depuis le bouchon d'`addConnection` : on
   * l'interroge comme le ferait le gestionnaire. Un test qui n'observerait que « la connexion a été
   * ajoutée » — ce que font les cas ci-dessus — serait vert avant comme après.
   */
  describe('ce que le flux répond au gestionnaire', () => {
    /** Le gabarit que le point d'API a confié au gestionnaire. */
    const gabarit = () => mockStreamManager.addConnection.mock.calls.at(-1)![1]

    it('⚠️ DIT « NON » QUAND LE FLUX EST FERMÉ', async () => {
      const mockEvent = createMockEvent()
      await handler(mockEvent as any)
      await new Promise((resolve) => setTimeout(resolve, 10))

      const flux = gabarit()
      // La fermeture passe par le `cleanup` de la requête, comme un client qui s'en va.
      mockReqEvents['close']?.[0]?.()

      expect(flux.push({ event: 'ping', data: '{}' })).toBe(false)
    })

    it('dit « oui » tant qu’il accepte', async () => {
      /*
       * LE TÉMOIN. Sans lui, un `push` qui rendrait toujours `false` satisferait le cas ci-dessus —
       * et le gestionnaire retirerait la connexion dès le message de bienvenue, donc tout le monde
       * serait coupé immédiatement.
       */
      const mockEvent = createMockEvent()
      await handler(mockEvent as any)
      await new Promise((resolve) => setTimeout(resolve, 10))

      expect(gabarit().push({ event: 'ping', data: '{}' })).toBe(true)
    })

    it('⚠️ EXPOSE UNE FERMETURE AU GESTIONNAIRE', async () => {
      /*
       * `removeConnection` retirait la connexion de ses Maps et laissait le contrôleur ouvert : le
       * client gardait une connexion que plus rien n'alimentait. Le gestionnaire a maintenant de
       * quoi la fermer — et il ne peut le faire que si le gabarit la lui donne.
       */
      const mockEvent = createMockEvent()
      await handler(mockEvent as any)
      await new Promise((resolve) => setTimeout(resolve, 10))

      const flux = gabarit()
      expect(typeof flux.close).toBe('function')
      flux.close()

      expect(flux.push({ event: 'ping', data: '{}' })).toBe(false)
    })
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
