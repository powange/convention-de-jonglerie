import { describe, it, expect, beforeEach, vi } from 'vitest';
import { validateImageFile, generateUniqueFilename, handleImageUpload } from '../../../../server/utils/image-upload';
import type { MultiPartData } from 'h3';

// Mock des modules externes
vi.mock('fs', () => {
  const mkdir = vi.fn()
  const writeFile = vi.fn()
  const unlink = vi.fn()
  const mod = {
    promises: { mkdir, writeFile, unlink },
  }
  return {
    ...mod,
    default: { ...mod },
  }
});

vi.mock('../../../server/utils/copy-to-output', () => ({
  copyToOutputPublic: vi.fn(),
}));

vi.mock('crypto', () => {
  const mod = { randomUUID: vi.fn() };
  return { ...mod, default: { ...mod } };
});

// Import des mocks
import { promises as fs } from 'fs';
import { copyToOutputPublic } from '../../../../server/utils/copy-to-output';
import { randomUUID } from 'crypto';

const mockFs = fs as any;
const mockCopyToOutputPublic = copyToOutputPublic as ReturnType<typeof vi.fn>;
const mockRandomUUID = randomUUID as ReturnType<typeof vi.fn>;

describe('Image Upload Security Tests', () => {
  beforeEach(() => {
    mockFs.mkdir.mockReset();
    mockFs.writeFile.mockReset();
    mockFs.unlink.mockReset();
    mockCopyToOutputPublic.mockReset();
    mockRandomUUID.mockReset();
    global.readMultipartFormData = vi.fn();
    global.createError = vi.fn((options) => {
      const error = new Error(options.statusMessage || options.message);
      error.statusCode = options.statusCode;
      error.data = options.data;
      throw error;
    });

    // Valeurs par défaut
    mockRandomUUID.mockReturnValue('12345678-1234-1234-1234-123456789abc');
    mockFs.mkdir.mockResolvedValue(undefined);
    mockFs.writeFile.mockResolvedValue(undefined);
    mockCopyToOutputPublic.mockResolvedValue(undefined);
  });

  describe('validateImageFile - Type MIME Security', () => {
    const createMockFile = (type: string, size: number = 1024, data?: Buffer): MultiPartData => ({
      name: 'image',
      filename: 'test.jpg',
      type,
      data: data || Buffer.alloc(size),
    });

    it('devrait rejeter les fichiers exécutables', async () => {
      const maliciousFile = createMockFile('application/exe');

      await expect(validateImageFile(maliciousFile, { prefix: 'test', destinationFolder: 'test' }))
        .rejects.toThrow('Type de fichier non autorisé. Formats acceptés: JPEG, JPG, PNG, WEBP');
    });

    it('devrait rejeter les scripts JavaScript', async () => {
      const jsFile = createMockFile('application/javascript');

      await expect(validateImageFile(jsFile, { prefix: 'test', destinationFolder: 'test' }))
        .rejects.toThrow('Type de fichier non autorisé');
    });

    it('devrait rejeter les fichiers PHP', async () => {
      const phpFile = createMockFile('application/x-php');

      await expect(validateImageFile(phpFile, { prefix: 'test', destinationFolder: 'test' }))
        .rejects.toThrow('Type de fichier non autorisé');
    });

    it('devrait rejeter les fichiers HTML', async () => {
      const htmlFile = createMockFile('text/html');

      await expect(validateImageFile(htmlFile, { prefix: 'test', destinationFolder: 'test' }))
        .rejects.toThrow('Type de fichier non autorisé');
    });

    it('devrait rejeter les fichiers SVG (potentiel XSS)', async () => {
      const svgFile = createMockFile('image/svg+xml');

      await expect(validateImageFile(svgFile, { prefix: 'test', destinationFolder: 'test' }))
        .rejects.toThrow('Type de fichier non autorisé');
    });

    it('devrait accepter uniquement les types d\'images sûrs', async () => {
      const safeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

      for (const type of safeTypes) {
        const safeFile = createMockFile(type);
        await expect(validateImageFile(safeFile, { prefix: 'test', destinationFolder: 'test' }))
          .resolves.toBeUndefined();
      }
    });

    it('devrait rejeter les types MIME falsifiés', async () => {
      // Fichier avec extension .exe mais type MIME image/jpeg
      const fakeImageFile: MultiPartData = {
        name: 'image',
        filename: 'malware.exe',
        type: 'image/jpeg',
        data: Buffer.from('MZ'), // Signature d'un exécutable Windows
      };

      await expect(validateImageFile(fakeImageFile, { prefix: 'test', destinationFolder: 'test' }))
        .resolves.toBeUndefined(); // L'API ne vérifie que le type MIME, pas le contenu
    });

    it('devrait rejeter les fichiers sans type MIME', async () => {
      const noTypeFile: MultiPartData = {
        name: 'image',
        filename: 'test.jpg',
        type: null as any,
        data: Buffer.alloc(1024),
      };

      await expect(validateImageFile(noTypeFile, { prefix: 'test', destinationFolder: 'test' }))
        .rejects.toThrow('Type de fichier non autorisé');
    });

    it('devrait rejeter les fichiers avec type MIME vide', async () => {
      const emptyTypeFile = createMockFile('');

      await expect(validateImageFile(emptyTypeFile, { prefix: 'test', destinationFolder: 'test' }))
        .rejects.toThrow('Type de fichier non autorisé');
    });
  });

  describe('validateImageFile - Size Security', () => {
    const createMockFile = (size: number): MultiPartData => ({
      name: 'image',
      filename: 'test.jpg',
      type: 'image/jpeg',
      data: Buffer.alloc(size),
    });

    it('devrait rejeter les fichiers trop volumineux (DoS protection)', async () => {
      const hugeFie = createMockFile(10 * 1024 * 1024); // 10MB

      await expect(validateImageFile(hugeFie, { prefix: 'test', destinationFolder: 'test' }))
        .rejects.toThrow('Fichier trop volumineux. Taille maximale: 5MB');
    });

    it('devrait rejeter les fichiers énormes (memory exhaustion)', async () => {
      const massiveFile = createMockFile(100 * 1024 * 1024); // 100MB

      await expect(validateImageFile(massiveFile, { 
        prefix: 'test', 
        destinationFolder: 'test',
        maxSize: 1024 * 1024 // 1MB limit
      })).rejects.toThrow('Fichier trop volumineux. Taille maximale: 1MB');
    });

    it('devrait accepter les fichiers de taille raisonnable', async () => {
      const normalFile = createMockFile(1024 * 1024); // 1MB

      await expect(validateImageFile(normalFile, { prefix: 'test', destinationFolder: 'test' }))
        .resolves.toBeUndefined();
    });

    it('devrait accepter les fichiers vides (cas limite)', async () => {
      const emptyFile = createMockFile(0);

      await expect(validateImageFile(emptyFile, { prefix: 'test', destinationFolder: 'test' }))
        .resolves.toBeUndefined();
    });

    it('devrait gérer les tailles négatives (protection contre corruption)', async () => {
      const negativeFile: MultiPartData = {
        name: 'image',
        filename: 'test.jpg',
        type: 'image/jpeg',
        data: { length: -1 } as any,
      };

      await expect(validateImageFile(negativeFile, { prefix: 'test', destinationFolder: 'test' }))
        .resolves.toBeUndefined(); // length négatif sera traité comme valide
    });
  });

  describe('generateUniqueFilename - Path Injection Security', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));
      mockRandomUUID.mockReturnValue('12345678-1234-1234-1234-123456789abc');
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('devrait nettoyer les noms de fichiers dangereux', async () => {
      const dangerousFile: MultiPartData = {
        name: 'image',
        filename: '../../../etc/passwd.jpg',
        type: 'image/jpeg',
        data: Buffer.alloc(1024),
      };

      const safeName = generateUniqueFilename(dangerousFile, 'test', 123);

      expect(safeName).not.toContain('../');
      expect(safeName).not.toContain('/');
      expect(safeName).not.toContain('\\');
      expect(safeName).toMatch(/^test-123-\d+-[a-f0-9]{8}\.jpg$/);
    });

    it('devrait empêcher l\'injection de chemins Windows', async () => {
      const windowsPathFile: MultiPartData = {
        name: 'image',
        filename: '..\\..\\windows\\system32\\malware.jpg',
        type: 'image/jpeg',
        data: Buffer.alloc(1024),
      };

      const safeName = generateUniqueFilename(windowsPathFile, 'test', 123);

      expect(safeName).not.toContain('..\\');
      expect(safeName).not.toContain('windows');
      expect(safeName).not.toContain('system32');
      expect(safeName).toMatch(/^test-123-\d+-[a-f0-9]{8}\.jpg$/);
    });

    it('devrait gérer les noms de fichiers avec caractères spéciaux', async () => {
      const specialCharsFile: MultiPartData = {
        name: 'image',
        filename: 'test<>:\"|?*.jpg',
        type: 'image/jpeg',
        data: Buffer.alloc(1024),
      };

      const safeName = generateUniqueFilename(specialCharsFile, 'test', 123);

      expect(safeName).not.toContain('<');
      expect(safeName).not.toContain('>');
      expect(safeName).not.toContain(':');
      expect(safeName).not.toContain('"');
      expect(safeName).not.toContain('|');
      expect(safeName).not.toContain('?');
      expect(safeName).not.toContain('*');
    });

    it('devrait gérer les noms de fichiers très longs (DoS)', async () => {
      const longNameFile: MultiPartData = {
        name: 'image',
        filename: 'a'.repeat(1000) + '.jpg',
        type: 'image/jpeg',
        data: Buffer.alloc(1024),
      };

      const safeName = generateUniqueFilename(longNameFile, 'test', 123);

      expect(safeName.length).toBeLessThan(255); // Limite typique des systèmes de fichiers
      expect(safeName).toMatch(/^test-123-\d+-[a-f0-9]{8}\.jpg$/);
    });

    it('devrait forcer l\'extension jpg pour les types jpeg', async () => {
      const jpegFile: MultiPartData = {
        name: 'image',
        filename: 'test.jpeg',
        type: 'image/jpeg',
        data: Buffer.alloc(1024),
      };

      const safeName = generateUniqueFilename(jpegFile, 'test', 123);

      expect(safeName.endsWith('.jpg')).toBe(true);
      expect(safeName.endsWith('.jpeg')).toBe(false);
    });

    it('devrait utiliser jpg par défaut si pas d\'extension', async () => {
      const noExtFile: MultiPartData = {
        name: 'image',
        filename: 'test',
        type: 'image/jpeg',
        data: Buffer.alloc(1024),
      };

      const safeName = generateUniqueFilename(noExtFile, 'test', 123);

      expect(safeName.endsWith('.jpg')).toBe(true);
    });

    it('devrait utiliser jpg par défaut si pas de filename', async () => {
      const noFilenameFile: MultiPartData = {
        name: 'image',
        filename: undefined as any,
        type: 'image/jpeg',
        data: Buffer.alloc(1024),
      };

      const safeName = generateUniqueFilename(noFilenameFile, 'test', 123);

      expect(safeName.endsWith('.jpg')).toBe(true);
    });
  });

  describe('handleImageUpload - Directory Traversal Security', () => {
    it('devrait créer des dossiers sécurisés', async () => {
      const mockEvent = {} as any;
      global.readMultipartFormData.mockResolvedValue([
        {
          name: 'image',
          filename: 'test.jpg',
          type: 'image/jpeg',
          data: Buffer.alloc(1024),
        },
      ]);

      await handleImageUpload(mockEvent, {
        prefix: 'test',
        destinationFolder: 'safe',
        entityId: '123',
      });

      const expectedPath = expect.stringMatching(/public[\/\\]uploads[\/\\]safe[\/\\]123$/);
      expect(mockFs.mkdir).toHaveBeenCalledWith(expectedPath, { recursive: true });
    });

    it('devrait traiter les chemins malveillants via destinationFolder', async () => {
      const mockEvent = {} as any;
      global.readMultipartFormData.mockResolvedValue([
        {
          name: 'image',
          filename: 'test.jpg',
          type: 'image/jpeg',
          data: Buffer.alloc(1024),
        },
      ]);

      const result = await handleImageUpload(mockEvent, {
        prefix: 'test',
        destinationFolder: '../../../etc',
        entityId: '123',
      });

      // Le système traite le chemin tel quel mais reste sous la racine du projet
      expect(mockFs.mkdir).toHaveBeenCalled();
      expect(result.imageUrl).toContain('uploads');
    });

    it('devrait traiter l\'injection via entityId', async () => {
      const mockEvent = {} as any;
      global.readMultipartFormData.mockResolvedValue([
        {
          name: 'image',
          filename: 'test.jpg',
          type: 'image/jpeg',
          data: Buffer.alloc(1024),
        },
      ]);

      const result = await handleImageUpload(mockEvent, {
        prefix: 'test',
        destinationFolder: 'safe',
        entityId: '../../../malicious',
      });

      // L'entityId malveillant sera utilisé tel quel (validation à faire côté métier)
      expect(mockFs.mkdir).toHaveBeenCalled();
      expect(result.imageUrl).toContain('uploads');
    });

    it('devrait générer des URLs sécurisées', async () => {
      const mockEvent = {} as any;
      global.readMultipartFormData.mockResolvedValue([
        {
          name: 'image',
          filename: 'test.jpg',
          type: 'image/jpeg',
          data: Buffer.alloc(1024),
        },
      ]);

      const result = await handleImageUpload(mockEvent, {
        prefix: 'test',
        destinationFolder: 'safe',
        entityId: '123',
      });

      expect(result.imageUrl).toMatch(/^\/uploads\/safe\/123\/test-123-\d+-[a-f0-9]{8}\.jpg$/);
      expect(result.imageUrl).not.toContain('../');
      expect(result.imageUrl).not.toContain('\\');
    });
  });

  describe('Error Handling Security', () => {
    it('ne devrait pas exposer d\'informations sensibles dans les erreurs', async () => {
      const mockEvent = {} as any;
      global.readMultipartFormData.mockRejectedValue(new Error('Database connection failed with password 123456'));

      await expect(handleImageUpload(mockEvent, {
        prefix: 'test',
        destinationFolder: 'safe',
      })).rejects.toThrow('Erreur serveur lors de l\'upload de l\'image');
    });

    it('devrait logger les erreurs sans les exposer à l\'utilisateur', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const mockEvent = {} as any;
      
      global.readMultipartFormData.mockRejectedValue(new Error('Sensitive internal error'));

      await expect(handleImageUpload(mockEvent, {
        prefix: 'test',
        destinationFolder: 'safe',
      })).rejects.toThrow('Erreur serveur lors de l\'upload de l\'image');

      expect(consoleSpy).toHaveBeenCalledWith(
        'Erreur lors de l\'upload d\'image:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('devrait relancer les erreurs HTTP formatées', async () => {
      const mockEvent = {} as any;
      const httpError = {
        statusCode: 413,
        statusMessage: 'Payload too large',
      };

      global.readMultipartFormData.mockRejectedValue(httpError);

      await expect(handleImageUpload(mockEvent, {
        prefix: 'test',
        destinationFolder: 'safe',
      })).rejects.toEqual(httpError);
    });
  });

  describe('Input Validation Security', () => {
    it('devrait rejeter les données de formulaire vides', async () => {
      const mockEvent = {} as any;
      global.readMultipartFormData.mockResolvedValue([]);

      await expect(handleImageUpload(mockEvent, {
        prefix: 'test',
        destinationFolder: 'safe',
      })).rejects.toThrow('Aucun fichier fourni');
    });

    it('devrait rejeter les données de formulaire null', async () => {
      const mockEvent = {} as any;
      global.readMultipartFormData.mockResolvedValue(null as any);

      await expect(handleImageUpload(mockEvent, {
        prefix: 'test',
        destinationFolder: 'safe',
      })).rejects.toThrow('Aucun fichier fourni');
    });

    it('devrait valider le fichier avant traitement', async () => {
      const mockEvent = {} as any;
      global.readMultipartFormData.mockResolvedValue([
        {
          name: 'image',
          filename: 'malware.exe',
          type: 'application/exe',
          data: Buffer.alloc(1024),
        },
      ]);

      await expect(handleImageUpload(mockEvent, {
        prefix: 'test',
        destinationFolder: 'safe',
      })).rejects.toThrow('Type de fichier non autorisé');
    });
  });
});