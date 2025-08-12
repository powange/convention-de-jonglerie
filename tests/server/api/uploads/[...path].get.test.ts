import { describe, it, expect, beforeEach, vi } from 'vitest';
import handler from '../../../../server/api/uploads/[...path].get';

// Mock des modules Node.js
vi.mock('fs', () => ({
  createReadStream: vi.fn(),
}));

vi.mock('fs/promises', () => ({
  stat: vi.fn(),
}));

vi.mock('h3', () => ({
  sendStream: vi.fn(),
  setHeader: vi.fn(),
}));

const mockEvent = {
  node: {
    res: {
      setHeader: vi.fn(),
    },
  },
};

// Import des mocks après la déclaration
import { createReadStream } from 'fs';
import { stat } from 'fs/promises';
import { sendStream, setHeader } from 'h3';

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
    global.getRouterParam = vi.fn();
    global.createError = vi.fn((options) => {
      const error = new Error(options.message || options.statusMessage);
      error.statusCode = options.statusCode;
      throw error;
    });
  });

  describe('Path Traversal Security - Les vulnérabilités critiques', () => {
    it('devrait rejeter les tentatives de path traversal avec ../', async () => {
      global.getRouterParam.mockReturnValue('../../../etc/passwd');

      await expect(handler(mockEvent as any)).rejects.toThrow('Access denied');
    });

    it('devrait rejeter les tentatives de path traversal avec ..\\', async () => {
      global.getRouterParam.mockReturnValue('..\\..\\..\\windows\\system32\\config');

      await expect(handler(mockEvent as any)).rejects.toThrow('Access denied');
    });

    it('devrait rejeter les tentatives sophistiquées de path traversal', async () => {
      global.getRouterParam.mockReturnValue('uploads/../../../etc/passwd');

      await expect(handler(mockEvent as any)).rejects.toThrow('Access denied');
    });

    it('devrait rejeter les tentatives complexes de path traversal', async () => {
      global.getRouterParam.mockReturnValue('conventions/123/../../../sensitive/file.txt');

      await expect(handler(mockEvent as any)).rejects.toThrow('Access denied');
    });
  });

  describe('Input Validation Security', () => {
    it('devrait rejeter les chemins vides', async () => {
      global.getRouterParam.mockReturnValue('');

      await expect(handler(mockEvent as any)).rejects.toThrow('Invalid path');
    });

    it('devrait rejeter les chemins null', async () => {
      global.getRouterParam.mockReturnValue(null);

      await expect(handler(mockEvent as any)).rejects.toThrow('Invalid path');
    });

    it('devrait rejeter les chemins undefined', async () => {
      global.getRouterParam.mockReturnValue(undefined);

      await expect(handler(mockEvent as any)).rejects.toThrow('Invalid path');
    });
  });

  describe('File Access Security', () => {
    it('devrait rejeter les fichiers inexistants', async () => {
      global.getRouterParam.mockReturnValue('conventions/999/nonexistent.jpg');
      mockStat.mockRejectedValue(new Error('ENOENT: no such file'));

      await expect(handler(mockEvent as any)).rejects.toThrow('File not found');
    });

    it('devrait rejeter les répertoires', async () => {
      global.getRouterParam.mockReturnValue('conventions/123');
      mockStat.mockResolvedValue({
        isFile: () => false,
      });

      await expect(handler(mockEvent as any)).rejects.toThrow('File not found');
    });

    it('devrait gérer les erreurs de permissions de fichier', async () => {
      global.getRouterParam.mockReturnValue('conventions/123/protected.jpg');
      mockStat.mockRejectedValue(new Error('EACCES: permission denied'));

      await expect(handler(mockEvent as any)).rejects.toThrow('File not found');
    });
  });

  describe('Error Handling Security', () => {
    it('ne devrait pas exposer les chemins système dans les erreurs', async () => {
      global.getRouterParam.mockReturnValue('conventions/123/image.jpg');
      mockStat.mockRejectedValue(new Error('ENOENT: no such file or directory, stat \'/home/user/secret/file.jpg\''));

      await expect(handler(mockEvent as any)).rejects.toThrow('File not found');
    });

    it('devrait masquer les erreurs de permission', async () => {
      global.getRouterParam.mockReturnValue('conventions/123/image.jpg');
      mockStat.mockRejectedValue(new Error('EACCES: permission denied, access \'/restricted/file.jpg\''));

      await expect(handler(mockEvent as any)).rejects.toThrow('File not found');
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
        global.getRouterParam.mockReturnValue(attack);
        await expect(handler(mockEvent as any)).rejects.toThrow('Access denied');
      }
    });

    it('vérifie que les chemins invalides sont correctement rejetés', async () => {
      const invalidPaths = ['', null, undefined];

      for (const invalidPath of invalidPaths) {
        global.getRouterParam.mockReturnValue(invalidPath);
        await expect(handler(mockEvent as any)).rejects.toThrow('Invalid path');
      }
    });

    it('vérifie que les erreurs système ne divulguent pas d\'informations', async () => {
      global.getRouterParam.mockReturnValue('conventions/123/test.jpg');
      
      // Erreurs avec informations sensibles qui ne doivent pas être exposées
      const sensitiveErrors = [
        new Error('ENOENT: no such file or directory, stat \'/home/admin/secret/file.jpg\''),
        new Error('EACCES: permission denied, access \'/root/.ssh/id_rsa\''),
        new Error('EPERM: operation not permitted, open \'/etc/shadow\'')
      ];

      for (const error of sensitiveErrors) {
        mockStat.mockRejectedValue(error);
        await expect(handler(mockEvent as any)).rejects.toThrow('File not found');
      }
    });
  });
});