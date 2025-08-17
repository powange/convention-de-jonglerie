import type { H3Event } from 'h3'
import { createReadStream } from 'fs';
import { stat } from 'fs/promises';
import { sendStream, setHeader } from 'h3';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import handler from '../../../../../server/api/uploads/[...path].get';

// Mock des modules Node.js
vi.mock('fs', () => {
  const createReadStream = vi.fn()
  const mod = { createReadStream }
  return { ...mod, default: { ...mod } }
});

vi.mock('fs/promises', () => {
  const mod = { stat: vi.fn() };
  return { ...mod, default: { ...mod } };
});

vi.mock('h3', () => {
  const g = global as unknown as { createError?: (...args: unknown[]) => unknown }
  return {
    sendStream: vi.fn(),
    setHeader: vi.fn(),
    // exposer createError pour les modules qui l'importent
    createError: (...args: unknown[]) => g.createError?.(...args),
  }
});

const mockEvent = {
  node: {
    res: {
      setHeader: vi.fn(),
    },
  },
};

// Alias typé pour accéder aux mocks globaux
const g = global as unknown as {
  getRouterParam: ReturnType<typeof vi.fn>
}

const mockCreateReadStream = createReadStream as ReturnType<typeof vi.fn>;
const mockStat = stat as ReturnType<typeof vi.fn>;
const mockSendStream = sendStream as ReturnType<typeof vi.fn>;
const mockSetHeader = setHeader as ReturnType<typeof vi.fn>;

describe('/api/uploads/[...path] GET - Security Tests', () => {
  beforeEach(() => {
    mockCreateReadStream.mockReset();
    mockStat.mockReset();
    mockSendStream.mockReset();
    mockSetHeader.mockReset();
    g.getRouterParam = vi.fn();
    global.createError = vi.fn((options: { message?: string; statusMessage?: string; statusCode?: number }) => {
      const error = new Error(options.message || options.statusMessage) as Error & { statusCode?: number };
      error.statusCode = options.statusCode;
      throw error;
    });
  });

  describe('Path Traversal Security - Les vulnérabilités critiques', () => {
    it('devrait rejeter les tentatives de path traversal avec ../', async () => {
  g.getRouterParam.mockReturnValue('../../../etc/passwd');

  await expect(handler(mockEvent as unknown as H3Event)).rejects.toThrow('Access denied');
    });

    it('devrait rejeter les tentatives de path traversal avec ..\\', async () => {
  g.getRouterParam.mockReturnValue('..\\..\\..\\windows\\system32\\config');

  await expect(handler(mockEvent as unknown as H3Event)).rejects.toThrow('Access denied');
    });

    it('devrait rejeter les tentatives sophistiquées de path traversal', async () => {
  g.getRouterParam.mockReturnValue('uploads/../../../etc/passwd');

  await expect(handler(mockEvent as unknown as H3Event)).rejects.toThrow('Access denied');
    });

    it('devrait rejeter les tentatives complexes de path traversal', async () => {
  g.getRouterParam.mockReturnValue('conventions/123/../../../sensitive/file.txt');

  await expect(handler(mockEvent as unknown as H3Event)).rejects.toThrow('Access denied');
    });
  });

  describe('Input Validation Security', () => {
    it('devrait rejeter les chemins vides', async () => {
  g.getRouterParam.mockReturnValue('');

  await expect(handler(mockEvent as unknown as H3Event)).rejects.toThrow('Invalid path');
    });

    it('devrait rejeter les chemins null', async () => {
  g.getRouterParam.mockReturnValue(null as unknown as string);

  await expect(handler(mockEvent as unknown as H3Event)).rejects.toThrow('Invalid path');
    });

    it('devrait rejeter les chemins undefined', async () => {
  g.getRouterParam.mockReturnValue(undefined as unknown as string);

  await expect(handler(mockEvent as unknown as H3Event)).rejects.toThrow('Invalid path');
    });
  });

  describe('File Access Security', () => {
    it('devrait rejeter les fichiers inexistants', async () => {
  g.getRouterParam.mockReturnValue('conventions/999/nonexistent.jpg');
      mockStat.mockRejectedValue(new Error('ENOENT: no such file'));

  await expect(handler(mockEvent as unknown as H3Event)).rejects.toThrow('File not found');
    });

    it('devrait rejeter les répertoires', async () => {
  g.getRouterParam.mockReturnValue('conventions/123');
      mockStat.mockResolvedValue({
        isFile: () => false,
      });

  await expect(handler(mockEvent as unknown as H3Event)).rejects.toThrow('File not found');
    });

    it('devrait gérer les erreurs de permissions de fichier', async () => {
  g.getRouterParam.mockReturnValue('conventions/123/protected.jpg');
      mockStat.mockRejectedValue(new Error('EACCES: permission denied'));

  await expect(handler(mockEvent as unknown as H3Event)).rejects.toThrow('File not found');
    });
  });

  describe('Error Handling Security', () => {
    it('ne devrait pas exposer les chemins système dans les erreurs', async () => {
      g.getRouterParam.mockReturnValue('conventions/123/image.jpg');
      mockStat.mockRejectedValue(new Error('ENOENT: no such file or directory, stat \'/home/user/secret/file.jpg\''));

  await expect(handler(mockEvent as unknown as H3Event)).rejects.toThrow('File not found');
    });

    it('devrait masquer les erreurs de permission', async () => {
      g.getRouterParam.mockReturnValue('conventions/123/image.jpg');
      mockStat.mockRejectedValue(new Error('EACCES: permission denied, access \'/restricted/file.jpg\''));

  await expect(handler(mockEvent as unknown as H3Event)).rejects.toThrow('File not found');
    });
  });

  describe('Critical Security Features Tested', () => {
    it('vérifie que la protection path traversal fonctionne correctement', async () => {
      // Test plusieurs vecteurs d'attaque path traversal
      const attacks = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32',
        'uploads/../../../sensitive',
        'conventions/../../../etc/hosts',
        '../../../../var/log/auth.log'
      ];

      for (const attack of attacks) {
  g.getRouterParam.mockReturnValue(attack);
  await expect(handler(mockEvent as unknown as H3Event)).rejects.toThrow('Access denied');
      }
    });

    it('vérifie que les chemins invalides sont correctement rejetés', async () => {
  const invalidPaths: Array<string | null | undefined> = ['', null, undefined];

      for (const invalidPath of invalidPaths) {
  g.getRouterParam.mockReturnValue(invalidPath as unknown as string);
  await expect(handler(mockEvent as unknown as H3Event)).rejects.toThrow('Invalid path');
      }
    });

    it('vérifie que les erreurs système ne divulguent pas d\'informations', async () => {
  g.getRouterParam.mockReturnValue('conventions/123/test.jpg');
      
      // Erreurs avec informations sensibles qui ne doivent pas être exposées
      const sensitiveErrors = [
        new Error('ENOENT: no such file or directory, stat \'/home/admin/secret/file.jpg\''),
        new Error('EACCES: permission denied, access \'/root/.ssh/id_rsa\''),
        new Error('EPERM: operation not permitted, open \'/etc/shadow\'')
      ];

      for (const error of sensitiveErrors) {
        mockStat.mockRejectedValue(error);
  await expect(handler(mockEvent as unknown as H3Event)).rejects.toThrow('File not found');
      }
    });
  });
});