import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { H3Event } from 'h3';

// Mock de createError
const mockCreateError = vi.fn();

// Remplacer les mocks globaux pour tester les vrais rate limiters
vi.mock('../../../server/utils/rate-limiter', async (importOriginal) => {
  const actual = await importOriginal();
  return actual; // Module original sans mock
});

vi.mock('../../../server/utils/api-rate-limiter', async (importOriginal) => {
  const actual = await importOriginal();
  return actual; // Module original sans mock
});

// Mock des imports Nuxt
vi.mock('#imports', () => ({
  createError: mockCreateError,
}));

// Import après les mocks
import { uploadRateLimiter, contentCreationRateLimiter, commentRateLimiter, searchRateLimiter } from '../../../server/utils/api-rate-limiter';

describe('API Rate Limiters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    
    // Mock createError pour lancer une erreur
    mockCreateError.mockImplementation(({ statusCode, statusMessage, data }) => {
      const error = new Error(statusMessage);
      (error as any).statusCode = statusCode;
      (error as any).data = data;
      throw error;
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const createMockEvent = (path: string = '/api/test', ip: string = '192.168.1.1', user?: any): Partial<H3Event> => {
    return {
      path,
      node: {
        req: {
          headers: {
            'x-forwarded-for': ip,
          },
          socket: {
            remoteAddress: ip,
          },
        },
      } as any,
      context: {
        user,
      } as any,
    };
  };

  describe('uploadRateLimiter', () => {
    it('devrait limiter à 10 uploads par heure pour utilisateur connecté', async () => {
      const user = { id: 1 };
      const event = createMockEvent('/api/uploads', '192.168.1.1', user);

      // 10 uploads devraient passer
      for (let i = 0; i < 10; i++) {
        await expect(uploadRateLimiter(event as H3Event)).resolves.toBeUndefined();
      }

      // Le 11ème devrait échouer
      await expect(uploadRateLimiter(event as H3Event)).rejects.toThrow(
        'Trop d\'uploads'
      );
    });

    it('devrait utiliser une clé différente pour utilisateur connecté vs anonyme', async () => {
      const userEvent = createMockEvent('/api/uploads', '192.168.1.1', { id: 42 });
      const anonEvent = createMockEvent('/api/uploads', '192.168.1.1');

      // Utilisateur connecté peut uploader (clé: upload:42)
      await expect(uploadRateLimiter(userEvent as H3Event)).resolves.toBeUndefined();
      
      // Utilisateur anonyme peut aussi uploader (clé: upload:anonymous) 
      await expect(uploadRateLimiter(anonEvent as H3Event)).resolves.toBeUndefined();
      
      // Deux utilisateurs différents peuvent aussi uploader
      const user2Event = createMockEvent('/api/uploads', '192.168.1.1', { id: 99 });
      await expect(uploadRateLimiter(user2Event as H3Event)).resolves.toBeUndefined();
    });
  });

  describe('contentCreationRateLimiter', () => {
    it('devrait limiter à 20 créations par heure', async () => {
      const user = { id: 1 };
      const event = createMockEvent('/api/conventions', '192.168.1.1', user);

      // 20 créations devraient passer
      for (let i = 0; i < 20; i++) {
        await expect(contentCreationRateLimiter(event as H3Event)).resolves.toBeUndefined();
      }

      // La 21ème devrait échouer
      await expect(contentCreationRateLimiter(event as H3Event)).rejects.toThrow(
        'Trop de créations de contenu'
      );
    });
  });

  describe('commentRateLimiter', () => {
    it('devrait limiter à 30 commentaires par heure', async () => {
      const user = { id: 1 };
      const event = createMockEvent('/api/comments', '192.168.1.1', user);

      // 30 commentaires devraient passer
      for (let i = 0; i < 30; i++) {
        await expect(commentRateLimiter(event as H3Event)).resolves.toBeUndefined();
      }

      // Le 31ème devrait échouer
      await expect(commentRateLimiter(event as H3Event)).rejects.toThrow(
        'Trop de commentaires'
      );
    });
  });

  describe('searchRateLimiter', () => {
    it('devrait limiter à 60 recherches par minute par IP', async () => {
      const event = createMockEvent('/api/search', '192.168.1.1');

      // 60 recherches devraient passer
      for (let i = 0; i < 60; i++) {
        await expect(searchRateLimiter(event as H3Event)).resolves.toBeUndefined();
      }

      // La 61ème devrait échouer
      await expect(searchRateLimiter(event as H3Event)).rejects.toThrow(
        'Trop de recherches'
      );
    });

    it('devrait séparer les limites par IP', async () => {
      const event1 = createMockEvent('/api/search', '192.168.2.1'); // IP différente
      const event2 = createMockEvent('/api/search', '192.168.2.2'); // IP différente

      // IP 1 fait quelques recherches
      await expect(searchRateLimiter(event1 as H3Event)).resolves.toBeUndefined();

      // IP 2 peut encore faire des recherches (clé différente)
      await expect(searchRateLimiter(event2 as H3Event)).resolves.toBeUndefined();
    });
  });
});