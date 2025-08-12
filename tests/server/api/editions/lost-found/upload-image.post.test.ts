import { describe, it, expect, beforeEach, vi } from 'vitest';
import handler from '../../../../../server/api/editions/[id]/lost-found/upload-image.post';

// Mock des utilitaires
vi.mock('../../../../../server/utils/permissions', () => ({
  hasEditionEditPermission: vi.fn(),
}));

vi.mock('../../../../../server/utils/image-upload', () => ({
  handleImageUpload: vi.fn(),
}));

vi.mock('jsonwebtoken', () => ({
  default: {
    verify: vi.fn(),
  },
}));

const mockEvent = {};

// Import des mocks après la déclaration
import { hasEditionEditPermission } from '../../../../../server/utils/permissions';
import { handleImageUpload } from '../../../../../server/utils/image-upload';
import jwt from 'jsonwebtoken';

const mockHasPermission = hasEditionEditPermission as ReturnType<typeof vi.fn>;
const mockHandleImageUpload = handleImageUpload as ReturnType<typeof vi.fn>;
const mockJwtVerify = jwt.verify as ReturnType<typeof vi.fn>;

describe('/api/editions/[id]/lost-found/upload-image POST', () => {
  beforeEach(() => {
    mockHasPermission.mockReset();
    mockHandleImageUpload.mockReset();
    mockJwtVerify.mockReset();
    global.getRouterParam = vi.fn().mockReturnValue('1');
    global.getCookie = vi.fn().mockReturnValue('valid-token');
    global.getHeader = vi.fn();
    global.useRuntimeConfig = vi.fn().mockReturnValue({
      jwtSecret: 'test-secret',
    });
  });

  it('devrait uploader une image pour objet trouvé avec succès', async () => {
    const mockUploadResult = {
      success: true,
      imageUrl: '/uploads/lost-found/1/lost-found-123456.jpg',
      filename: 'lost-found-123456.jpg',
    };

    mockJwtVerify.mockReturnValue({ userId: 1 });
    mockHasPermission.mockResolvedValue(true);
    mockHandleImageUpload.mockResolvedValue(mockUploadResult);

    const result = await handler(mockEvent as any);

    expect(result).toEqual({
      imageUrl: mockUploadResult.imageUrl,
    });

    expect(mockHasPermission).toHaveBeenCalledWith(1, 1);
    expect(mockHandleImageUpload).toHaveBeenCalledWith(
      mockEvent,
      expect.objectContaining({
        prefix: 'lost-found',
        destinationFolder: 'lost-found',
        entityId: 1,
        fieldName: 'image',
        allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
        maxSize: 5 * 1024 * 1024,
        copyToOutput: true,
      })
    );
  });

  it('devrait rejeter si ID d\'édition invalide', async () => {
    global.getRouterParam.mockReturnValue('invalid');

    await expect(handler(mockEvent as any)).rejects.toThrow('ID d\'édition invalide');
  });

  it('devrait rejeter si ID d\'édition est NaN', async () => {
    global.getRouterParam.mockReturnValue('abc');

    await expect(handler(mockEvent as any)).rejects.toThrow('ID d\'édition invalide');
  });

  it('devrait rejeter si pas de token d\'authentification', async () => {
    global.getCookie.mockReturnValue(null);
    global.getHeader.mockReturnValue(null);

    await expect(handler(mockEvent as any)).rejects.toThrow('Token d\'authentification requis');
  });

  it('devrait accepter un token dans les headers', async () => {
    global.getCookie.mockReturnValue(null);
    global.getHeader.mockReturnValue('Bearer valid-token');
    mockJwtVerify.mockReturnValue({ userId: 1 });
    mockHasPermission.mockResolvedValue(true);
    mockHandleImageUpload.mockResolvedValue({
      success: true,
      imageUrl: '/test.jpg',
    });

    await handler(mockEvent as any);

    expect(mockJwtVerify).toHaveBeenCalledWith('valid-token', 'test-secret');
  });

  it('devrait rejeter si token invalide', async () => {
    mockJwtVerify.mockImplementation(() => {
      throw new Error('Invalid token');
    });

    await expect(handler(mockEvent as any)).rejects.toThrow('Token invalide');
  });

  it('devrait rejeter si userId manquant dans le token', async () => {
    mockJwtVerify.mockReturnValue({});

    await expect(handler(mockEvent as any)).rejects.toThrow('Token invalide');
  });

  it('devrait rejeter si utilisateur n\'est pas collaborateur', async () => {
    mockJwtVerify.mockReturnValue({ userId: 1 });
    mockHasPermission.mockResolvedValue(false);

    await expect(handler(mockEvent as any)).rejects.toThrow(
      'Vous devez être collaborateur pour uploader une image'
    );
  });

  it('devrait gérer les erreurs d\'upload', async () => {
    mockJwtVerify.mockReturnValue({ userId: 1 });
    mockHasPermission.mockResolvedValue(true);
    mockHandleImageUpload.mockRejectedValue(new Error('Upload failed'));

    await expect(handler(mockEvent as any)).rejects.toThrow('Erreur lors de l\'upload de l\'image');
  });

  it('devrait gérer les échecs d\'upload', async () => {
    const failedUploadResult = {
      success: false,
      error: 'File too large',
    };

    mockJwtVerify.mockReturnValue({ userId: 1 });
    mockHasPermission.mockResolvedValue(true);
    mockHandleImageUpload.mockResolvedValue(failedUploadResult);

    await expect(handler(mockEvent as any)).rejects.toThrow('Erreur lors de l\'upload de l\'image');
  });

  it('devrait relancer les erreurs HTTP', async () => {
    const httpError = new Error('Fichier trop volumineux');
    httpError.statusCode = 413;

    mockJwtVerify.mockReturnValue({ userId: 1 });
    mockHasPermission.mockResolvedValue(true);
    mockHandleImageUpload.mockRejectedValue(httpError);

    await expect(handler(mockEvent as any)).rejects.toThrow('Fichier trop volumineux');
  });

  it('devrait supporter plusieurs formats d\'image', async () => {
    mockJwtVerify.mockReturnValue({ userId: 1 });
    mockHasPermission.mockResolvedValue(true);
    mockHandleImageUpload.mockResolvedValue({
      success: true,
      imageUrl: '/test.gif',
    });

    await handler(mockEvent as any);

    expect(mockHandleImageUpload).toHaveBeenCalledWith(
      mockEvent,
      expect.objectContaining({
        allowedTypes: expect.arrayContaining([
          'image/jpeg',
          'image/jpg',
          'image/png',
          'image/gif',
          'image/webp',
        ]),
      })
    );
  });

  it('devrait avoir une limite de taille de 5MB', async () => {
    mockJwtVerify.mockReturnValue({ userId: 1 });
    mockHasPermission.mockResolvedValue(true);
    mockHandleImageUpload.mockResolvedValue({
      success: true,
      imageUrl: '/test.jpg',
    });

    await handler(mockEvent as any);

    expect(mockHandleImageUpload).toHaveBeenCalledWith(
      mockEvent,
      expect.objectContaining({
        maxSize: 5 * 1024 * 1024,
      })
    );
  });

  it('devrait copier l\'image vers output', async () => {
    mockJwtVerify.mockReturnValue({ userId: 1 });
    mockHasPermission.mockResolvedValue(true);
    mockHandleImageUpload.mockResolvedValue({
      success: true,
      imageUrl: '/test.jpg',
    });

    await handler(mockEvent as any);

    expect(mockHandleImageUpload).toHaveBeenCalledWith(
      mockEvent,
      expect.objectContaining({
        copyToOutput: true,
      })
    );
  });

  it('devrait traiter correctement l\'ID numérique', async () => {
    global.getRouterParam.mockReturnValue('456');

    mockJwtVerify.mockReturnValue({ userId: 1 });
    mockHasPermission.mockResolvedValue(true);
    mockHandleImageUpload.mockResolvedValue({
      success: true,
      imageUrl: '/test.jpg',
    });

    await handler(mockEvent as any);

    expect(mockHasPermission).toHaveBeenCalledWith(1, 456);
    expect(mockHandleImageUpload).toHaveBeenCalledWith(
      mockEvent,
      expect.objectContaining({
        entityId: 456,
      })
    );
  });
});