import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'

import type { H3Event } from 'h3'

// Import du middleware (depuis la racine du projet)
// Assurer un mock local de #imports avant d'importer le middleware
vi.mock('#imports', async () => {
  const actual = await vi.importActual<any>('#imports')
  return {
    ...actual,
    useRuntimeConfig: vi.fn(() => ({})),
    getUserSession: vi.fn(async () => ({ user: { id: 1 } })),
    requireUserSession: vi.fn(async () => ({ user: { id: 1 } })),
  }
})

import authMiddleware from '../../../../server/middleware/auth'
// Référence dynamique vers le mock pour pouvoir le reconfigurer
let mockGetUserSession: ReturnType<typeof vi.fn>

// Les fonctions sont mockées globalement dans test/setup.ts, on les récupère depuis global
const mockCreateError = global.createError as ReturnType<typeof vi.fn>
const mockDefineEventHandler = global.defineEventHandler as ReturnType<typeof vi.fn>
const mockUseRuntimeConfig = global.useRuntimeConfig as ReturnType<typeof vi.fn>

describe("Middleware d'authentification", () => {
  const mockUser = {
    id: 1,
    email: 'user@test.com',
    pseudo: 'testuser',
    nom: 'Test',
    prenom: 'User',
    isGlobalAdmin: false,
  }

  const createMockEvent = (path: string, method: string = 'GET'): Partial<H3Event> => {
    return {
      path,
      node: {
        req: {
          method,
          headers: {},
        },
      } as any,
      context: {} as any,
    }
  }

  // Initialiser mockGetUserSession une seule fois avant tous les tests
  beforeAll(async () => {
    const importsMod: any = await import('#imports')
    if (typeof importsMod.getUserSession !== 'function') {
      importsMod.getUserSession = vi.fn(async () => ({ user: { id: 1 } }))
    }
    mockGetUserSession = importsMod.getUserSession as ReturnType<typeof vi.fn>
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockDefineEventHandler.mockImplementation((fn) => fn)
    mockUseRuntimeConfig.mockReturnValue({})
    mockCreateError.mockImplementation(({ statusCode, statusMessage }) => {
      const error = new Error(statusMessage)
      ;(error as any).statusCode = statusCode
      throw error
    })

    // Reset le mock sans refaire l'import
    mockGetUserSession.mockResolvedValue({ user: mockUser })
  })

  describe('Routes publiques', () => {
    describe("Routes d'icônes Nuxt", () => {
      it("devrait autoriser les routes d'icônes NuxtUI", async () => {
        const event = createMockEvent('/api/_nuxt_icon/heroicons-outline:user')

        await expect(authMiddleware(event as H3Event)).resolves.toBeUndefined()
        expect(mockCreateError).not.toHaveBeenCalled()
      })
    })

    describe("Routes d'authentification", () => {
      const authRoutes = [
        '/api/auth/register',
        '/api/auth/login',
        '/api/auth/verify-email',
        '/api/auth/resend-verification',
        '/api/auth/request-password-reset',
        '/api/auth/reset-password',
      ]

      authRoutes.forEach((route) => {
        it(`devrait autoriser POST ${route}`, async () => {
          const event = createMockEvent(route, 'POST')

          await expect(authMiddleware(event as H3Event)).resolves.toBeUndefined()
          expect(mockCreateError).not.toHaveBeenCalled()
        })

        it(`devrait protéger GET ${route}`, async () => {
          const event = createMockEvent(route, 'GET')
          // Forcer aucune session pour vérifier la protection
          mockGetUserSession.mockResolvedValueOnce(null)
          await expect(authMiddleware(event as H3Event)).rejects.toThrow('Unauthorized')
        })
      })

      it('devrait autoriser GET /api/auth/verify-reset-token', async () => {
        const event = createMockEvent('/api/auth/verify-reset-token', 'GET')

        await expect(authMiddleware(event as H3Event)).resolves.toBeUndefined()
        expect(mockCreateError).not.toHaveBeenCalled()
      })
    })

    describe('Route de feedback', () => {
      it('devrait autoriser POST /api/feedback sans session (feedback anonyme)', async () => {
        const event = createMockEvent('/api/feedback', 'POST')
        mockGetUserSession.mockResolvedValueOnce(null)

        await expect(authMiddleware(event as H3Event)).resolves.toBeUndefined()
        expect(event.context.user).toBeNull()
        expect(mockCreateError).not.toHaveBeenCalled()
      })

      it("devrait autoriser POST /api/feedback avec session et hydrater l'utilisateur", async () => {
        const event = createMockEvent('/api/feedback', 'POST')
        mockGetUserSession.mockResolvedValueOnce({ user: mockUser })

        await authMiddleware(event as H3Event)

        expect(event.context.user).toEqual(mockUser)
        expect(mockCreateError).not.toHaveBeenCalled()
      })

      it('devrait protéger GET /api/feedback', async () => {
        const event = createMockEvent('/api/feedback', 'GET')
        mockGetUserSession.mockResolvedValue(null)

        await expect(authMiddleware(event as H3Event)).rejects.toThrow('Unauthorized')
      })
    })

    describe('Routes publiques GET', () => {
      const publicGetRoutes = ['/api/conventions', '/api/editions', '/api/countries']

      publicGetRoutes.forEach((route) => {
        it(`devrait autoriser GET ${route}`, async () => {
          const event = createMockEvent(route, 'GET')

          await expect(authMiddleware(event as H3Event)).resolves.toBeUndefined()
          expect(mockCreateError).not.toHaveBeenCalled()
        })

        it(`devrait protéger POST ${route}`, async () => {
          const event = createMockEvent(route, 'POST')
          mockGetUserSession.mockResolvedValue(null)
          await expect(authMiddleware(event as H3Event)).rejects.toThrow('Unauthorized')
        })
      })
    })

    describe('Routes de détail publiques', () => {
      it('devrait autoriser GET /api/conventions/[id]', async () => {
        const event = createMockEvent('/api/conventions/123', 'GET')

        await expect(authMiddleware(event as H3Event)).resolves.toBeUndefined()
        expect(mockCreateError).not.toHaveBeenCalled()
      })

      it('devrait autoriser GET /api/editions/[id]', async () => {
        const event = createMockEvent('/api/editions/456', 'GET')

        await expect(authMiddleware(event as H3Event)).resolves.toBeUndefined()
        expect(mockCreateError).not.toHaveBeenCalled()
      })

      it('devrait protéger PUT /api/conventions/[id]', async () => {
        const event = createMockEvent('/api/conventions/123', 'PUT')
        mockGetUserSession.mockResolvedValue(null)
        await expect(authMiddleware(event as H3Event)).rejects.toThrow('Unauthorized')
      })
    })

    describe('Routes de fichiers statiques', () => {
      it('devrait autoriser GET /api/uploads/*', async () => {
        const event = createMockEvent('/api/uploads/images/test.jpg', 'GET')

        await expect(authMiddleware(event as H3Event)).resolves.toBeUndefined()
        expect(mockCreateError).not.toHaveBeenCalled()
      })

      it('devrait protéger POST /api/uploads/*', async () => {
        const event = createMockEvent('/api/uploads/images/test.jpg', 'POST')
        mockGetUserSession.mockResolvedValue(null)
        await expect(authMiddleware(event as H3Event)).rejects.toThrow('Unauthorized')
      })
    })

    describe('Routes de covoiturage publiques', () => {
      const publicCarpoolRoutes = [
        '/api/editions/123/carpool-offers',
        '/api/editions/456/carpool-requests',
        '/api/carpool-offers/789/comments',
        '/api/carpool-requests/101/comments',
        '/api/editions/202/posts',
      ]

      publicCarpoolRoutes.forEach((route) => {
        it(`devrait autoriser GET ${route}`, async () => {
          const event = createMockEvent(route, 'GET')

          await expect(authMiddleware(event as H3Event)).resolves.toBeUndefined()
          expect(mockCreateError).not.toHaveBeenCalled()
        })

        it(`devrait protéger POST ${route}`, async () => {
          const event = createMockEvent(route, 'POST')
          mockGetUserSession.mockResolvedValue(null)

          await expect(authMiddleware(event as H3Event)).rejects.toThrow('Unauthorized')
        })
      })
    })
  })

  describe('Routes protégées', () => {
    describe('Sans session', () => {
      it('devrait rejeter les requêtes API sans session', async () => {
        const event = createMockEvent('/api/protected-route', 'GET')
        mockGetUserSession.mockResolvedValue(null)
        await expect(authMiddleware(event as H3Event)).rejects.toThrow('Unauthorized')
      })
    })

    describe('Avec session valide', () => {
      it("devrait autoriser les requêtes avec session valide et hydrater l'utilisateur", async () => {
        const event = createMockEvent('/api/protected-route', 'GET')
        mockGetUserSession.mockResolvedValue({ user: mockUser })

        await authMiddleware(event as H3Event)

        expect(event.context.user).toEqual(mockUser)
        expect(mockCreateError).not.toHaveBeenCalled()
      })

      it('devrait inclure toutes les propriétés utilisateur nécessaires', async () => {
        const event = createMockEvent('/api/protected-route', 'GET')
        const adminUser = { ...mockUser, isGlobalAdmin: true }
        mockGetUserSession.mockResolvedValue({ user: adminUser })

        await authMiddleware(event as H3Event)

        expect(event.context.user).toEqual(adminUser)
        expect((event as any).context.user.isGlobalAdmin).toBe(true)
      })
    })
  })

  describe('Routes non-API', () => {
    it('devrait ignorer les routes de pages (non /api/)', async () => {
      const event = createMockEvent('/profile', 'GET')

      await expect(authMiddleware(event as H3Event)).resolves.toBeUndefined()
      expect(mockCreateError).not.toHaveBeenCalled()
    })

    it('devrait ignorer les routes statiques', async () => {
      const event = createMockEvent('/assets/logo.png', 'GET')

      await expect(authMiddleware(event as H3Event)).resolves.toBeUndefined()
      expect(mockCreateError).not.toHaveBeenCalled()
    })

    it('devrait ignorer la route racine', async () => {
      const event = createMockEvent('/', 'GET')

      await expect(authMiddleware(event as H3Event)).resolves.toBeUndefined()
      expect(mockCreateError).not.toHaveBeenCalled()
    })
  })

  describe('Gestion des paramètres de requête', () => {
    it("devrait ignorer les paramètres de requête dans l'URL", async () => {
      const event = createMockEvent('/api/conventions?page=1&limit=10', 'GET')

      await expect(authMiddleware(event as H3Event)).resolves.toBeUndefined()
      expect(mockCreateError).not.toHaveBeenCalled()
    })

    it('devrait protéger les routes avec paramètres si elles ne sont pas publiques', async () => {
      const event = createMockEvent('/api/user/profile?tab=settings', 'GET')
      mockGetUserSession.mockResolvedValueOnce(null)
      await expect(authMiddleware(event as H3Event)).rejects.toThrow('Unauthorized')
    })
  })

  describe('Cas limites', () => {
    it('hydrate correctement un user avec id numérique', async () => {
      const event = createMockEvent('/api/protected-route', 'GET')
      const userWithId42 = { ...mockUser, id: 42 }
      mockGetUserSession.mockResolvedValue({ user: userWithId42 })
      await authMiddleware(event as H3Event)
      expect(event.context.user.id).toBe(42)
    })
  })
})
