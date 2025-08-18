import { describe, it, expect, beforeEach, vi } from 'vitest';
import handler from '../../../../../server/api/upload/image.post';
import { prismaMock } from '../../../../__mocks__/prisma';

// Import des mocks après la déclaration
import { handleImageUpload } from '../../../../../server/utils/image-upload';
import { copyToOutputPublic } from '../../../../../server/utils/copy-to-output';

// Mock des modules externes
vi.mock('../../../../server/utils/image-upload', () => ({
  handleImageUpload: vi.fn(),
}));

vi.mock('fs', () => {
  const mkdir = vi.fn()
  const writeFile = vi.fn()
  const unlink = vi.fn()
  const mod = { promises: { mkdir, writeFile, unlink } }
  return { ...mod, default: { ...mod } }
});

vi.mock('../../../../server/utils/copy-to-output', () => ({
  copyToOutputPublic: vi.fn(),
}));

const mockEvent = {
  context: {
    user: { id: 1, email: 'test@example.com' },
  },
};

const mockEventWithoutUser = {
  context: {},
};

const mockHandleImageUpload = handleImageUpload as ReturnType<typeof vi.fn>;
const mockCopyToOutputPublic = copyToOutputPublic as ReturnType<typeof vi.fn>;

describe('/api/upload/image POST', () => {
  beforeEach(() => {
    mockHandleImageUpload.mockReset();
    mockCopyToOutputPublic.mockReset();
    global.readMultipartFormData = vi.fn();
    
    // Valeurs par défaut pour les mocks
    mockHandleImageUpload.mockResolvedValue({
      success: true,
      imageUrl: '/uploads/conventions/123/convention-123-1234567890-abc12345.jpg',
      filename: 'convention-123-1234567890-abc12345.jpg',
    });
    mockCopyToOutputPublic.mockResolvedValue(undefined);
  });

  describe('Authentification', () => {
    it('devrait rejeter si utilisateur non authentifié', async () => {
      await expect(handler(mockEventWithoutUser as any)).rejects.toThrow('Non authentifié');
    });

    it('devrait accepter si utilisateur authentifié', async () => {
      global.readMultipartFormData.mockResolvedValue([
        { name: 'conventionId', data: Buffer.from('123') },
      ]);

      const result = await handler(mockEvent as any);

      expect(result).toEqual({
        success: true,
        imageUrl: '/uploads/conventions/123/convention-123-1234567890-abc12345.jpg',
      });
    });
  });

  describe('Gestion du contexte convention', () => {
    it('devrait configurer l\'upload pour une convention existante', async () => {
      global.readMultipartFormData.mockResolvedValue([
        { name: 'conventionId', data: Buffer.from('123') },
        { 
          name: 'image',
          data: Buffer.from('fake-image-data'),
          type: 'image/jpeg',
          filename: 'test.jpg',
        },
      ]);

      await handler(mockEvent as any);

      expect(mockHandleImageUpload).toHaveBeenCalledWith(
        mockEvent,
        {
          allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
          maxSize: 5 * 1024 * 1024, // 5MB
          prefix: 'convention',
          destinationFolder: 'conventions',
          entityId: '123',
          fieldName: 'image',
          copyToOutput: true,
        }
      );
    });

    it('devrait configurer l\'upload pour une nouvelle convention (temporaire)', async () => {
      global.readMultipartFormData.mockResolvedValue([
        { 
          name: 'image',
          data: Buffer.from('fake-image-data'),
          type: 'image/jpeg',
          filename: 'test.jpg',
        },
      ]);

      await handler(mockEvent as any);

      expect(mockHandleImageUpload).toHaveBeenCalledWith(
        mockEvent,
        {
          allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
          maxSize: 5 * 1024 * 1024, // 5MB
          prefix: 'temp',
          destinationFolder: 'temp',
          fieldName: 'image',
          copyToOutput: true,
        }
      );
    });

    it('devrait gérer conventionId vide ou null', async () => {
      global.readMultipartFormData.mockResolvedValue([
        { name: 'conventionId', data: Buffer.from('') },
        { 
          name: 'image',
          data: Buffer.from('fake-image-data'),
          type: 'image/jpeg',
          filename: 'test.jpg',
        },
      ]);

      await handler(mockEvent as any);

      const uploadOptions = mockHandleImageUpload.mock.calls[0][1];
      expect(uploadOptions.prefix).toBe('temp');
      expect(uploadOptions.destinationFolder).toBe('temp');
      expect(uploadOptions.entityId).toBeUndefined();
    });
  });

  describe('Validation des types de fichiers', () => {
    it('devrait accepter les types d\'images autorisés', async () => {
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

      global.readMultipartFormData.mockResolvedValue([
        { name: 'conventionId', data: Buffer.from('123') },
      ]);

      await handler(mockEvent as any);

      const uploadOptions = mockHandleImageUpload.mock.calls[0][1];
      expect(uploadOptions.allowedTypes).toEqual(allowedTypes);
    });

    it('devrait rejeter les fichiers dangereux via handleImageUpload', async () => {
      mockHandleImageUpload.mockRejectedValue({
        statusCode: 400,
        statusMessage: 'Type de fichier non autorisé. Formats acceptés: JPEG, JPG, PNG, WEBP',
      });

      global.readMultipartFormData.mockResolvedValue([
        { 
          name: 'image',
          data: Buffer.from('fake-executable'),
          type: 'application/exe',
          filename: 'malware.exe',
        },
      ]);

      await expect(handler(mockEvent as any)).rejects.toEqual({
        statusCode: 400,
        statusMessage: 'Type de fichier non autorisé. Formats acceptés: JPEG, JPG, PNG, WEBP',
      });
    });
  });

  describe('Validation de la taille des fichiers', () => {
    it('devrait définir une taille limite de 5MB', async () => {
      global.readMultipartFormData.mockResolvedValue([
        { name: 'conventionId', data: Buffer.from('123') },
      ]);

      await handler(mockEvent as any);

      const uploadOptions = mockHandleImageUpload.mock.calls[0][1];
      expect(uploadOptions.maxSize).toBe(5 * 1024 * 1024); // 5MB
    });

    it('devrait rejeter les fichiers trop volumineux via handleImageUpload', async () => {
      mockHandleImageUpload.mockRejectedValue({
        statusCode: 400,
        statusMessage: 'Fichier trop volumineux. Taille maximale: 5MB',
      });

      global.readMultipartFormData.mockResolvedValue([
        { 
          name: 'image',
          data: Buffer.alloc(6 * 1024 * 1024), // 6MB
          type: 'image/jpeg',
          filename: 'large.jpg',
        },
      ]);

      await expect(handler(mockEvent as any)).rejects.toEqual({
        statusCode: 400,
        statusMessage: 'Fichier trop volumineux. Taille maximale: 5MB',
      });
    });
  });

  describe('Sécurité des noms de fichiers', () => {
    it('devrait utiliser des noms de fichiers sécurisés générés par handleImageUpload', async () => {
      mockHandleImageUpload.mockResolvedValue({
        success: true,
        imageUrl: '/uploads/conventions/123/convention-123-1234567890-abc12345.jpg',
        filename: 'convention-123-1234567890-abc12345.jpg',
      });

      global.readMultipartFormData.mockResolvedValue([
        { name: 'conventionId', data: Buffer.from('123') },
      ]);

      const result = await handler(mockEvent as any);

      expect(result.imageUrl).toMatch(/^\/uploads\/conventions\/123\/convention-123-\d+-[a-f0-9]{8}\.jpg$/);
    });

    it('devrait nettoyer les noms de fichiers dangereux via handleImageUpload', async () => {
      mockHandleImageUpload.mockResolvedValue({
        success: true,
        imageUrl: '/uploads/temp/temp-1234567890-abc12345.jpg',
        filename: 'temp-1234567890-abc12345.jpg',
      });

      global.readMultipartFormData.mockResolvedValue([
        { 
          name: 'image',
          data: Buffer.from('fake-image-data'),
          type: 'image/jpeg',
          filename: '../../../etc/passwd.jpg', // Tentative de path traversal
        },
      ]);

      const result = await handler(mockEvent as any);

      // Le nom de fichier devrait être sécurisé
      expect(result.imageUrl).not.toContain('../');
      expect(result.imageUrl).not.toContain('etc/passwd');
    });
  });

  describe('Gestion des erreurs', () => {
    it('devrait gérer les erreurs de handleImageUpload', async () => {
      mockHandleImageUpload.mockRejectedValue(new Error('Erreur d\'upload'));

      global.readMultipartFormData.mockResolvedValue([
        { name: 'conventionId', data: Buffer.from('123') },
      ]);

      await expect(handler(mockEvent as any)).rejects.toThrow('Erreur lors de l\'upload de l\'image');
    });

    it('devrait relancer les erreurs HTTP existantes', async () => {
      const httpError = {
        statusCode: 403,
        statusMessage: 'Accès interdit',
      };

      mockHandleImageUpload.mockRejectedValue(httpError);

      global.readMultipartFormData.mockResolvedValue([
        { name: 'conventionId', data: Buffer.from('123') },
      ]);

      await expect(handler(mockEvent as any)).rejects.toEqual(httpError);
    });

    it('devrait logger les erreurs en console', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      mockHandleImageUpload.mockRejectedValue(new Error('Erreur inattendue'));

      global.readMultipartFormData.mockResolvedValue([
        { name: 'conventionId', data: Buffer.from('123') },
      ]);

      await expect(handler(mockEvent as any)).rejects.toThrow();

      expect(consoleSpy).toHaveBeenCalledWith(
        'Erreur lors de l\'upload d\'image:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Fonctionnalités avancées', () => {
    it('devrait activer copyToOutput pour les conventions', async () => {
      global.readMultipartFormData.mockResolvedValue([
        { name: 'conventionId', data: Buffer.from('123') },
      ]);

      await handler(mockEvent as any);

      const uploadOptions = mockHandleImageUpload.mock.calls[0][1];
      expect(uploadOptions.copyToOutput).toBe(true);
    });

    it('devrait utiliser le bon prefix selon le contexte', async () => {
      // Test avec convention existante
      global.readMultipartFormData.mockResolvedValue([
        { name: 'conventionId', data: Buffer.from('123') },
      ]);

      await handler(mockEvent as any);
      expect(mockHandleImageUpload.mock.calls[0][1].prefix).toBe('convention');

      // Reset pour test suivant
      mockHandleImageUpload.mockClear();

      // Test avec nouvelle convention
      global.readMultipartFormData.mockResolvedValue([
        { 
          name: 'image',
          data: Buffer.from('fake-image-data'),
          type: 'image/jpeg',
          filename: 'test.jpg',
        },
      ]);

      await handler(mockEvent as any);
      expect(mockHandleImageUpload.mock.calls[0][1].prefix).toBe('temp');
    });

    it('devrait utiliser le bon dossier de destination', async () => {
      // Test avec convention existante
      global.readMultipartFormData.mockResolvedValue([
        { name: 'conventionId', data: Buffer.from('456') },
      ]);

      await handler(mockEvent as any);
      expect(mockHandleImageUpload.mock.calls[0][1].destinationFolder).toBe('conventions');
      expect(mockHandleImageUpload.mock.calls[0][1].entityId).toBe('456');

      // Reset pour test suivant
      mockHandleImageUpload.mockClear();

      // Test avec nouvelle convention
      global.readMultipartFormData.mockResolvedValue([]);

      await handler(mockEvent as any);
      expect(mockHandleImageUpload.mock.calls[0][1].destinationFolder).toBe('temp');
      expect(mockHandleImageUpload.mock.calls[0][1].entityId).toBeUndefined();
    });
  });

  describe('Cas limites', () => {
    it('devrait gérer les données de formulaire vides', async () => {
      global.readMultipartFormData.mockResolvedValue([]);

      await handler(mockEvent as any);

      expect(mockHandleImageUpload).toHaveBeenCalledWith(
        mockEvent,
        expect.objectContaining({
          prefix: 'temp',
          destinationFolder: 'temp',
        })
      );
    });

    it('devrait gérer les erreurs de lecture du formulaire', async () => {
      global.readMultipartFormData.mockRejectedValue(new Error('Erreur de lecture'));

      await expect(handler(mockEvent as any)).rejects.toThrow('Erreur lors de l\'upload de l\'image');
    });

    it('devrait gérer conventionId avec des espaces', async () => {
      global.readMultipartFormData.mockResolvedValue([
        { name: 'conventionId', data: Buffer.from('  789  ') },
      ]);

      await handler(mockEvent as any);

      const uploadOptions = mockHandleImageUpload.mock.calls[0][1];
      expect(uploadOptions.entityId).toBe('  789  '); // La validation du format d'ID est faite ailleurs
    });

    it('devrait retourner la structure de réponse correcte', async () => {
      global.readMultipartFormData.mockResolvedValue([
        { name: 'conventionId', data: Buffer.from('123') },
      ]);

      const result = await handler(mockEvent as any);

      expect(result).toEqual({
        success: true,
        imageUrl: '/uploads/conventions/123/convention-123-1234567890-abc12345.jpg',
      });

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('imageUrl');
      expect(result.success).toBe(true);
      expect(typeof result.imageUrl).toBe('string');
    });
  });
});