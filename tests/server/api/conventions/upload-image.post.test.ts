import { describe, it, expect, beforeEach, vi } from 'vitest';
import handler from '../../../../server/api/conventions/[id]/upload-image.post';
import { prismaMock } from '../../../__mocks__/prisma';

// Mock des utilitaires d'upload
vi.mock('../../../../server/utils/image-upload', () => ({
  handleImageUpload: vi.fn(),
  checkConventionUploadPermission: vi.fn(),
  updateEntityWithImage: vi.fn(),
  deleteOldImage: vi.fn(),
}));

// Mock du rate limiter
vi.mock('../../../../server/utils/api-rate-limiter', () => ({
  uploadRateLimiter: vi.fn(),
}));

const mockEvent = {
  context: {
    user: {
      id: 1,
      email: 'user@test.com',
      pseudo: 'testuser',
    },
  },
};

// Import des mocks après la déclaration
import { 
  handleImageUpload, 
  checkConventionUploadPermission, 
  updateEntityWithImage,
  deleteOldImage 
} from '../../../../server/utils/image-upload';
import { uploadRateLimiter } from '../../../../server/utils/api-rate-limiter';

const mockHandleImageUpload = handleImageUpload as ReturnType<typeof vi.fn>;
const mockCheckPermission = checkConventionUploadPermission as ReturnType<typeof vi.fn>;
const mockUpdateEntity = updateEntityWithImage as ReturnType<typeof vi.fn>;
const mockDeleteOldImage = deleteOldImage as ReturnType<typeof vi.fn>;
const mockUploadRateLimiter = uploadRateLimiter as ReturnType<typeof vi.fn>;

describe('/api/conventions/[id]/upload-image POST', () => {
  beforeEach(() => {
    mockHandleImageUpload.mockReset();
    mockCheckPermission.mockReset();
    mockUpdateEntity.mockReset();
    mockDeleteOldImage.mockReset();
    mockUploadRateLimiter.mockReset();
    global.getRouterParam = vi.fn().mockReturnValue('1');
  });

  it('devrait uploader une image avec succès', async () => {
    const mockConvention = {
      id: 1,
      name: 'Convention Test',
      logo: null,
    };

    const mockUploadResult = {
      imageUrl: '/uploads/conventions/1/logo-123456.jpg',
      filename: 'logo-123456.jpg',
    };

    const mockUpdatedConvention = {
      ...mockConvention,
      logo: mockUploadResult.imageUrl,
    };

    mockCheckPermission.mockResolvedValue(mockConvention);
    mockHandleImageUpload.mockResolvedValue(mockUploadResult);
    mockUpdateEntity.mockResolvedValue(mockUpdatedConvention);

    const result = await handler(mockEvent as any);

    expect(result).toEqual({
      success: true,
      imageUrl: mockUploadResult.imageUrl,
      convention: mockUpdatedConvention,
    });

    expect(mockCheckPermission).toHaveBeenCalledWith(1, 1);
    expect(mockHandleImageUpload).toHaveBeenCalledWith(
      mockEvent,
      expect.objectContaining({
        allowedTypes: ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'],
        maxSize: 5 * 1024 * 1024,
        prefix: 'logo',
        destinationFolder: 'conventions',
        entityId: 1,
        fieldName: 'image',
        copyToOutput: true,
      })
    );
    expect(mockUpdateEntity).toHaveBeenCalledWith(
      'convention',
      1,
      mockUploadResult.imageUrl,
      'logo'
    );
  });

  it('devrait remplacer une image existante', async () => {
    const mockConvention = {
      id: 1,
      name: 'Convention Test',
      logo: '/uploads/conventions/1/logo-old.jpg',
    };

    const mockUploadResult = {
      imageUrl: '/uploads/conventions/1/logo-new.jpg',
      filename: 'logo-new.jpg',
    };

    mockCheckPermission.mockResolvedValue(mockConvention);
    mockHandleImageUpload.mockResolvedValue(mockUploadResult);
    mockUpdateEntity.mockResolvedValue({
      ...mockConvention,
      logo: mockUploadResult.imageUrl,
    });

    await handler(mockEvent as any);

    expect(mockDeleteOldImage).toHaveBeenCalledWith(
      mockConvention.logo,
      'public/uploads/conventions/1',
      'logo-'
    );
    expect(mockHandleImageUpload).toHaveBeenCalled();
    expect(mockUpdateEntity).toHaveBeenCalled();
  });

  it('devrait rejeter si utilisateur non authentifié', async () => {
    const eventWithoutUser = {
      ...mockEvent,
      context: { user: null },
    };

    await expect(handler(eventWithoutUser as any)).rejects.toThrow('Non authentifié');
  });

  it('devrait rejeter si ID de convention invalide', async () => {
    global.getRouterParam.mockReturnValue('invalid');

    await expect(handler(mockEvent as any)).rejects.toThrow('ID de convention invalide');
  });

  it('devrait vérifier les permissions avant upload', async () => {
    const permissionError = new Error('Permission refusée');
    permissionError.statusCode = 403;
    
    mockCheckPermission.mockRejectedValue(permissionError);

    await expect(handler(mockEvent as any)).rejects.toThrow('Permission refusée');
    expect(mockCheckPermission).toHaveBeenCalledWith(1, 1);
    expect(mockHandleImageUpload).not.toHaveBeenCalled();
  });

  it('devrait appliquer le rate limiting', async () => {
    mockCheckPermission.mockResolvedValue({ id: 1, logo: null });
    mockHandleImageUpload.mockResolvedValue({ imageUrl: '/test.jpg' });
    mockUpdateEntity.mockResolvedValue({});

    await handler(mockEvent as any);

    expect(mockUploadRateLimiter).toHaveBeenCalledWith(mockEvent);
  });

  it('devrait gérer les erreurs d\'upload', async () => {
    mockCheckPermission.mockResolvedValue({ id: 1, logo: null });
    mockHandleImageUpload.mockRejectedValue(new Error('Upload failed'));

    await expect(handler(mockEvent as any)).rejects.toThrow('Erreur serveur lors de l\'upload de l\'image');
  });

  it('devrait gérer les erreurs de mise à jour', async () => {
    mockCheckPermission.mockResolvedValue({ id: 1, logo: null });
    mockHandleImageUpload.mockResolvedValue({ imageUrl: '/test.jpg' });
    mockUpdateEntity.mockRejectedValue(new Error('Update failed'));

    await expect(handler(mockEvent as any)).rejects.toThrow('Erreur serveur lors de l\'upload de l\'image');
  });

  it('devrait relancer les erreurs HTTP', async () => {
    const httpError = new Error('Fichier trop volumineux');
    httpError.statusCode = 413;

    mockCheckPermission.mockRejectedValue(httpError);

    await expect(handler(mockEvent as any)).rejects.toThrow('Fichier trop volumineux');
  });

  it('devrait traiter correctement l\'ID numérique', async () => {
    global.getRouterParam.mockReturnValue('123');

    mockCheckPermission.mockResolvedValue({ id: 123, logo: null });
    mockHandleImageUpload.mockResolvedValue({ imageUrl: '/test.jpg' });
    mockUpdateEntity.mockResolvedValue({});

    await handler(mockEvent as any);

    expect(mockCheckPermission).toHaveBeenCalledWith(123, 1);
    expect(mockHandleImageUpload).toHaveBeenCalledWith(
      mockEvent,
      expect.objectContaining({
        entityId: 123,
      })
    );
  });
});