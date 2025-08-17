import { describe, it, expect, beforeEach, vi } from 'vitest';
import handler from '../../../../server/api/editions/[id]/upload-image.post';

// Mock des utilitaires d'upload
vi.mock('../../../../server/utils/image-upload', () => ({
  handleImageUpload: vi.fn(),
  checkEditionUploadPermission: vi.fn(),
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
  checkEditionUploadPermission, 
  updateEntityWithImage,
  deleteOldImage 
} from '../../../../../server/utils/image-upload';
import { uploadRateLimiter } from '../../../../../server/utils/api-rate-limiter';

const mockHandleImageUpload = handleImageUpload as ReturnType<typeof vi.fn>;
const mockCheckPermission = checkEditionUploadPermission as ReturnType<typeof vi.fn>;
const mockUpdateEntity = updateEntityWithImage as ReturnType<typeof vi.fn>;
const mockDeleteOldImage = deleteOldImage as ReturnType<typeof vi.fn>;
const mockUploadRateLimiter = uploadRateLimiter as ReturnType<typeof vi.fn>;

describe('/api/editions/[id]/upload-image POST', () => {
  beforeEach(() => {
    mockHandleImageUpload.mockReset();
    mockCheckPermission.mockReset();
    mockUpdateEntity.mockReset();
    mockDeleteOldImage.mockReset();
    mockUploadRateLimiter.mockReset();
    global.getRouterParam = vi.fn().mockReturnValue('1');
  });

  it('devrait uploader une image d\'édition avec succès', async () => {
    const mockEdition = {
      id: 1,
      name: 'Édition Test 2024',
      imageUrl: null,
    };

    const mockUploadResult = {
      imageUrl: '/uploads/conventions/1/edition-123456.jpg',
      filename: 'edition-123456.jpg',
    };

    const mockUpdatedEdition = {
      ...mockEdition,
      imageUrl: mockUploadResult.imageUrl,
    };

    mockCheckPermission.mockResolvedValue(mockEdition);
    mockHandleImageUpload.mockResolvedValue(mockUploadResult);
    mockUpdateEntity.mockResolvedValue(mockUpdatedEdition);

    const result = await handler(mockEvent as any);

    expect(result).toEqual({
      success: true,
      edition: mockUpdatedEdition,
    });

    expect(mockCheckPermission).toHaveBeenCalledWith(1, 1);
    expect(mockHandleImageUpload).toHaveBeenCalledWith(
      mockEvent,
      expect.objectContaining({
        allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
        maxSize: 10 * 1024 * 1024, // 10MB pour les éditions
        prefix: 'edition',
        destinationFolder: 'conventions',
        entityId: 1,
        fieldName: 'image',
        copyToOutput: false,
      })
    );
    expect(mockUpdateEntity).toHaveBeenCalledWith(
      'edition',
      1,
      mockUploadResult.imageUrl,
      'imageUrl'
    );
  });

  it('devrait remplacer une image existante', async () => {
    const mockEdition = {
      id: 1,
      name: 'Édition Test 2024',
      imageUrl: '/uploads/conventions/1/edition-old.jpg',
    };

    const mockUploadResult = {
      imageUrl: '/uploads/conventions/1/edition-new.jpg',
      filename: 'edition-new.jpg',
    };

    mockCheckPermission.mockResolvedValue(mockEdition);
    mockHandleImageUpload.mockResolvedValue(mockUploadResult);
    mockUpdateEntity.mockResolvedValue({
      ...mockEdition,
      imageUrl: mockUploadResult.imageUrl,
    });

    await handler(mockEvent as any);

    expect(mockDeleteOldImage).toHaveBeenCalledWith(
      mockEdition.imageUrl,
      'public/uploads/conventions/1',
      'edition-'
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

  it('devrait rejeter si ID d\'édition invalide', async () => {
    global.getRouterParam.mockReturnValue('');

    await expect(handler(mockEvent as any)).rejects.toThrow('ID d\'édition invalide');
  });

  it('devrait rejeter si ID d\'édition est NaN', async () => {
    global.getRouterParam.mockReturnValue('invalid');

    await expect(handler(mockEvent as any)).rejects.toThrow('ID d\'édition invalide');
  });

  it('devrait vérifier les permissions avant upload', async () => {
    const permissionError = new Error('Permission refusée pour cette édition');
    permissionError.statusCode = 403;
    
    mockCheckPermission.mockRejectedValue(permissionError);

    await expect(handler(mockEvent as any)).rejects.toThrow('Permission refusée pour cette édition');
    expect(mockCheckPermission).toHaveBeenCalledWith(1, 1);
    expect(mockHandleImageUpload).not.toHaveBeenCalled();
  });

  it('devrait appliquer le rate limiting', async () => {
    mockCheckPermission.mockResolvedValue({ id: 1, imageUrl: null });
    mockHandleImageUpload.mockResolvedValue({ imageUrl: '/test.jpg' });
    mockUpdateEntity.mockResolvedValue({});

    await handler(mockEvent as any);

    expect(mockUploadRateLimiter).toHaveBeenCalledWith(mockEvent);
  });

  it('devrait gérer les erreurs d\'upload', async () => {
    mockCheckPermission.mockResolvedValue({ id: 1, imageUrl: null });
    mockHandleImageUpload.mockRejectedValue(new Error('Upload failed'));

    await expect(handler(mockEvent as any)).rejects.toThrow('Erreur lors de l\'upload de l\'image');
  });

  it('devrait gérer les erreurs de mise à jour', async () => {
    mockCheckPermission.mockResolvedValue({ id: 1, imageUrl: null });
    mockHandleImageUpload.mockResolvedValue({ imageUrl: '/test.jpg' });
    mockUpdateEntity.mockRejectedValue(new Error('Update failed'));

    await expect(handler(mockEvent as any)).rejects.toThrow('Erreur lors de l\'upload de l\'image');
  });

  it('devrait relancer les erreurs HTTP', async () => {
    const httpError = new Error('Fichier trop volumineux');
    httpError.statusCode = 413;

    mockCheckPermission.mockRejectedValue(httpError);

    await expect(handler(mockEvent as any)).rejects.toThrow('Fichier trop volumineux');
  });

  it('devrait supporter les formats d\'image étendus', async () => {
    mockCheckPermission.mockResolvedValue({ id: 1, imageUrl: null });
    mockHandleImageUpload.mockResolvedValue({ imageUrl: '/test.gif' });
    mockUpdateEntity.mockResolvedValue({});

    await handler(mockEvent as any);

    expect(mockHandleImageUpload).toHaveBeenCalledWith(
      mockEvent,
      expect.objectContaining({
        allowedTypes: expect.arrayContaining(['image/gif']),
      })
    );
  });

  it('devrait avoir une limite de taille plus élevée que les conventions', async () => {
    mockCheckPermission.mockResolvedValue({ id: 1, imageUrl: null });
    mockHandleImageUpload.mockResolvedValue({ imageUrl: '/test.jpg' });
    mockUpdateEntity.mockResolvedValue({});

    await handler(mockEvent as any);

    expect(mockHandleImageUpload).toHaveBeenCalledWith(
      mockEvent,
      expect.objectContaining({
        maxSize: 10 * 1024 * 1024, // 10MB
      })
    );
  });

  it('devrait traiter correctement l\'ID numérique', async () => {
    global.getRouterParam.mockReturnValue('456');

    mockCheckPermission.mockResolvedValue({ id: 456, imageUrl: null });
    mockHandleImageUpload.mockResolvedValue({ imageUrl: '/test.jpg' });
    mockUpdateEntity.mockResolvedValue({});

    await handler(mockEvent as any);

    expect(mockCheckPermission).toHaveBeenCalledWith(456, 1);
    expect(mockHandleImageUpload).toHaveBeenCalledWith(
      mockEvent,
      expect.objectContaining({
        entityId: 456,
      })
    );
  });
});