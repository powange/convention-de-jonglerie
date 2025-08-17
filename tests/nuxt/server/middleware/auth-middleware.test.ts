import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import type { H3Event } from 'h3';

// Mock des imports Nuxt
vi.mock('#imports', () => ({
  createError: vi.fn(),
  defineEventHandler: vi.fn(),
  useRuntimeConfig: vi.fn(),
}));

// Mock de jwt
vi.mock('jsonwebtoken', () => ({
  default: {
    verify: vi.fn(),
  },
}));

// Mock de prisma
vi.mock('../../../server/utils/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

// Import du middleware après les mocks
import authMiddleware from '../server/middleware/auth';
import { prisma } from '../server/utils/prisma';

// Les fonctions sont mockées globalement, on les récupère depuis global
const mockCreateError = global.createError as ReturnType<typeof vi.fn>;
const mockDefineEventHandler = global.defineEventHandler as ReturnType<typeof vi.fn>;
const mockUseRuntimeConfig = global.useRuntimeConfig as ReturnType<typeof vi.fn>;
const mockJwtVerify = jwt.verify as ReturnType<typeof vi.fn>;
const mockPrismaUserFindUnique = prisma.user.findUnique as ReturnType<typeof vi.fn>;

describe('Middleware d\'authentification', () => {
  const mockUser = {
    id: 1,
    email: 'user@test.com',
    pseudo: 'testuser',
    nom: 'Test',
    prenom: 'User',
    isGlobalAdmin: false,
  };

  const createMockEvent = (path: string, method: string = 'GET', token?: string): Partial<H3Event> => {
    const headers: Record<string, string> = {};
    if (token) {
      headers.authorization = `Bearer ${token}`;
    }

    return {
      path,
      node: {
        req: {
          method,
          headers,
        },
      } as any,
      context: {} as any,
    };
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockDefineEventHandler.mockImplementation((fn) => fn);
    mockUseRuntimeConfig.mockReturnValue({
      jwtSecret: 'test-jwt-secret',
    });
    mockCreateError.mockImplementation(({ statusCode, statusMessage }) => {
      const error = new Error(statusMessage);
      (error as any).statusCode = statusCode;
      throw error;
    });
  });

  describe('Routes publiques', () => {
    describe('Routes d\'icônes Nuxt', () => {
      it('devrait autoriser les routes d\'icônes NuxtUI', async () => {
        const event = createMockEvent('/api/_nuxt_icon/heroicons-outline:user');

        await expect(authMiddleware(event as H3Event)).resolves.toBeUndefined();
        expect(mockCreateError).not.toHaveBeenCalled();
      });
    });

    describe('Routes d\'authentification', () => {
      const authRoutes = [
        '/api/auth/register',
        '/api/auth/login', 
        '/api/auth/verify-email',
        '/api/auth/resend-verification',
        '/api/auth/request-password-reset',
        '/api/auth/reset-password',
      ];

      authRoutes.forEach(route => {
        it(`devrait autoriser POST ${route}`, async () => {
          const event = createMockEvent(route, 'POST');

          await expect(authMiddleware(event as H3Event)).resolves.toBeUndefined();
          expect(mockCreateError).not.toHaveBeenCalled();
        });

        it(`devrait protéger GET ${route}`, async () => {
          const event = createMockEvent(route, 'GET');

          await expect(authMiddleware(event as H3Event)).rejects.toThrow('Unauthorized: No token provided');
        });
      });

      it('devrait autoriser GET /api/auth/verify-reset-token', async () => {
        const event = createMockEvent('/api/auth/verify-reset-token', 'GET');

        await expect(authMiddleware(event as H3Event)).resolves.toBeUndefined();
        expect(mockCreateError).not.toHaveBeenCalled();
      });
    });

    describe('Route de feedback', () => {
      it('devrait autoriser POST /api/feedback sans token', async () => {
        const event = createMockEvent('/api/feedback', 'POST');

        await expect(authMiddleware(event as H3Event)).resolves.toBeUndefined();
        expect(mockCreateError).not.toHaveBeenCalled();
      });

      it('devrait autoriser POST /api/feedback avec token valide et récupérer l\'utilisateur', async () => {
        const event = createMockEvent('/api/feedback', 'POST', 'valid-token');
        mockJwtVerify.mockReturnValue({ userId: 1 });
        mockPrismaUserFindUnique.mockResolvedValue(mockUser);

        await authMiddleware(event as H3Event);

        expect(mockJwtVerify).toHaveBeenCalledWith('valid-token', 'test-jwt-secret');
        expect(mockPrismaUserFindUnique).toHaveBeenCalledWith({
          where: { id: 1 },
          select: { id: true, email: true, pseudo: true, nom: true, prenom: true, isGlobalAdmin: true },
        });
        expect(event.context.user).toEqual(mockUser);
      });

      it('devrait autoriser POST /api/feedback avec token invalide (feedback anonyme)', async () => {
        const event = createMockEvent('/api/feedback', 'POST', 'invalid-token');
        mockJwtVerify.mockImplementation(() => {
          throw new Error('Invalid token');
        });

        await authMiddleware(event as H3Event);

        expect(event.context.user).toBeNull();
        expect(mockCreateError).not.toHaveBeenCalled();
      });

      it('devrait protéger GET /api/feedback', async () => {
        const event = createMockEvent('/api/feedback', 'GET');

        await expect(authMiddleware(event as H3Event)).rejects.toThrow('Unauthorized: No token provided');
      });
    });

    describe('Routes publiques GET', () => {
      const publicGetRoutes = [
        '/api/conventions',
        '/api/editions',
        '/api/countries',
      ];

      publicGetRoutes.forEach(route => {
        it(`devrait autoriser GET ${route}`, async () => {
          const event = createMockEvent(route, 'GET');

          await expect(authMiddleware(event as H3Event)).resolves.toBeUndefined();
          expect(mockCreateError).not.toHaveBeenCalled();
        });

        it(`devrait protéger POST ${route}`, async () => {
          const event = createMockEvent(route, 'POST');

          await expect(authMiddleware(event as H3Event)).rejects.toThrow('Unauthorized: No token provided');
        });
      });
    });

    describe('Routes de détail publiques', () => {
      it('devrait autoriser GET /api/conventions/[id]', async () => {
        const event = createMockEvent('/api/conventions/123', 'GET');

        await expect(authMiddleware(event as H3Event)).resolves.toBeUndefined();
        expect(mockCreateError).not.toHaveBeenCalled();
      });

      it('devrait autoriser GET /api/editions/[id]', async () => {
        const event = createMockEvent('/api/editions/456', 'GET');

        await expect(authMiddleware(event as H3Event)).resolves.toBeUndefined();
        expect(mockCreateError).not.toHaveBeenCalled();
      });

      it('devrait protéger PUT /api/conventions/[id]', async () => {
        const event = createMockEvent('/api/conventions/123', 'PUT');

        await expect(authMiddleware(event as H3Event)).rejects.toThrow('Unauthorized: No token provided');
      });
    });

    describe('Routes de fichiers statiques', () => {
      it('devrait autoriser GET /api/uploads/*', async () => {
        const event = createMockEvent('/api/uploads/images/test.jpg', 'GET');

        await expect(authMiddleware(event as H3Event)).resolves.toBeUndefined();
        expect(mockCreateError).not.toHaveBeenCalled();
      });

      it('devrait protéger POST /api/uploads/*', async () => {
        const event = createMockEvent('/api/uploads/images/test.jpg', 'POST');

        await expect(authMiddleware(event as H3Event)).rejects.toThrow('Unauthorized: No token provided');
      });
    });

    describe('Routes de covoiturage publiques', () => {
      const publicCarpoolRoutes = [
        '/api/editions/123/carpool-offers',
        '/api/editions/456/carpool-requests',
        '/api/carpool-offers/789/comments',
        '/api/carpool-requests/101/comments',
        '/api/editions/202/posts',
      ];

      publicCarpoolRoutes.forEach(route => {
        it(`devrait autoriser GET ${route}`, async () => {
          const event = createMockEvent(route, 'GET');

          await expect(authMiddleware(event as H3Event)).resolves.toBeUndefined();
          expect(mockCreateError).not.toHaveBeenCalled();
        });

        it(`devrait protéger POST ${route}`, async () => {
          const event = createMockEvent(route, 'POST');

          await expect(authMiddleware(event as H3Event)).rejects.toThrow('Unauthorized: No token provided');
        });
      });
    });
  });

  describe('Routes protégées', () => {
    describe('Sans token', () => {
      it('devrait rejeter les requêtes API sans token', async () => {
        const event = createMockEvent('/api/protected-route', 'GET');

        await expect(authMiddleware(event as H3Event)).rejects.toThrow('Unauthorized: No token provided');
      });
    });

    describe('Avec token valide', () => {
      it('devrait autoriser les requêtes avec token valide et utilisateur existant', async () => {
        const event = createMockEvent('/api/protected-route', 'GET', 'valid-token');
        mockJwtVerify.mockReturnValue({ userId: 1 });
        mockPrismaUserFindUnique.mockResolvedValue(mockUser);

        await authMiddleware(event as H3Event);

        expect(mockJwtVerify).toHaveBeenCalledWith('valid-token', 'test-jwt-secret');
        expect(mockPrismaUserFindUnique).toHaveBeenCalledWith({
          where: { id: 1 },
          select: { id: true, email: true, pseudo: true, nom: true, prenom: true, isGlobalAdmin: true },
        });
        expect(event.context.user).toEqual(mockUser);
        expect(mockCreateError).not.toHaveBeenCalled();
      });

      it('devrait inclure toutes les propriétés utilisateur nécessaires', async () => {
        const event = createMockEvent('/api/protected-route', 'GET', 'valid-token');
        const adminUser = { ...mockUser, isGlobalAdmin: true };
        mockJwtVerify.mockReturnValue({ userId: 1 });
        mockPrismaUserFindUnique.mockResolvedValue(adminUser);

        await authMiddleware(event as H3Event);

        expect(event.context.user).toEqual(adminUser);
        expect(event.context.user.isGlobalAdmin).toBe(true);
      });
    });

    describe('Avec token invalide', () => {
      it('devrait rejeter les tokens malformés', async () => {
        const event = createMockEvent('/api/protected-route', 'GET', 'invalid-token');
        mockJwtVerify.mockImplementation(() => {
          throw new Error('Invalid token');
        });

        await expect(authMiddleware(event as H3Event)).rejects.toThrow('Unauthorized: Invalid token');
      });

      it('devrait rejeter les tokens expirés', async () => {
        const event = createMockEvent('/api/protected-route', 'GET', 'expired-token');
        mockJwtVerify.mockImplementation(() => {
          throw new Error('Token expired');
        });

        await expect(authMiddleware(event as H3Event)).rejects.toThrow('Unauthorized: Invalid token');
      });

      it('devrait rejeter si l\'utilisateur n\'existe pas', async () => {
        const event = createMockEvent('/api/protected-route', 'GET', 'valid-token');
        mockJwtVerify.mockReturnValue({ userId: 999 });
        mockPrismaUserFindUnique.mockResolvedValue(null);

        // Le middleware envoie "Invalid token" à cause du try-catch global
        await expect(authMiddleware(event as H3Event)).rejects.toThrow('Unauthorized: Invalid token');
      });
    });
  });

  describe('Routes non-API', () => {
    it('devrait ignorer les routes de pages (non /api/)', async () => {
      const event = createMockEvent('/profile', 'GET');

      await expect(authMiddleware(event as H3Event)).resolves.toBeUndefined();
      expect(mockCreateError).not.toHaveBeenCalled();
      expect(mockJwtVerify).not.toHaveBeenCalled();
    });

    it('devrait ignorer les routes statiques', async () => {
      const event = createMockEvent('/assets/logo.png', 'GET');

      await expect(authMiddleware(event as H3Event)).resolves.toBeUndefined();
      expect(mockCreateError).not.toHaveBeenCalled();
    });

    it('devrait ignorer la route racine', async () => {
      const event = createMockEvent('/', 'GET');

      await expect(authMiddleware(event as H3Event)).resolves.toBeUndefined();
      expect(mockCreateError).not.toHaveBeenCalled();
    });
  });

  describe('Gestion des paramètres de requête', () => {
    it('devrait ignorer les paramètres de requête dans l\'URL', async () => {
      const event = createMockEvent('/api/conventions?page=1&limit=10', 'GET');

      await expect(authMiddleware(event as H3Event)).resolves.toBeUndefined();
      expect(mockCreateError).not.toHaveBeenCalled();
    });

    it('devrait protéger les routes avec paramètres si elles ne sont pas publiques', async () => {
      const event = createMockEvent('/api/user/profile?tab=settings', 'GET');

      await expect(authMiddleware(event as H3Event)).rejects.toThrow('Unauthorized: No token provided');
    });
  });

  describe('Gestion des erreurs', () => {
    it('devrait gérer les erreurs de base de données', async () => {
      const event = createMockEvent('/api/protected-route', 'GET', 'valid-token');
      mockJwtVerify.mockReturnValue({ userId: 1 });
      mockPrismaUserFindUnique.mockRejectedValue(new Error('Database error'));

      await expect(authMiddleware(event as H3Event)).rejects.toThrow('Unauthorized: Invalid token');
    });

    it('devrait gérer les payloads JWT invalides', async () => {
      const event = createMockEvent('/api/protected-route', 'GET', 'valid-token');
      mockJwtVerify.mockReturnValue({ invalidField: 'test' }); // Payload sans userId

      await expect(authMiddleware(event as H3Event)).rejects.toThrow('Unauthorized: Invalid token');
    });
  });

  describe('Cas limites', () => {
    it('devrait gérer les headers Authorization sans Bearer', async () => {
      const event = {
        path: '/api/protected-route',
        node: {
          req: {
            method: 'GET',
            headers: {
              authorization: 'invalid-format-token',
            },
          },
        },
        context: {},
      } as Partial<H3Event>;

      await expect(authMiddleware(event as H3Event)).rejects.toThrow('Unauthorized: No token provided');
    });

    it('devrait gérer les headers Authorization vides', async () => {
      const event = {
        path: '/api/protected-route',
        node: {
          req: {
            method: 'GET',
            headers: {
              authorization: 'Bearer ',
            },
          },
        },
        context: {},
      } as Partial<H3Event>;

      await expect(authMiddleware(event as H3Event)).rejects.toThrow('Unauthorized: No token provided');
    });

    it('devrait fonctionner avec des IDs utilisateur numériques', async () => {
      const event = createMockEvent('/api/protected-route', 'GET', 'valid-token');
      mockJwtVerify.mockReturnValue({ userId: 42 });
      const userWithId42 = { ...mockUser, id: 42 };
      mockPrismaUserFindUnique.mockResolvedValue(userWithId42);

      await authMiddleware(event as H3Event);

      expect(event.context.user.id).toBe(42);
      expect(mockPrismaUserFindUnique).toHaveBeenCalledWith({
        where: { id: 42 },
        select: { id: true, email: true, pseudo: true, nom: true, prenom: true, isGlobalAdmin: true },
      });
    });
  });
});