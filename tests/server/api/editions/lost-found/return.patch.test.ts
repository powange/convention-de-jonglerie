import { describe, it, expect, beforeEach, vi } from 'vitest';
import handler from '../../../../../server/api/editions/[id]/lost-found/[itemId]/return.patch';
import { prismaMock } from '../../../../__mocks__/prisma';

// Mock des utilitaires
vi.mock('../../../../../server/utils/permissions', () => ({
  hasEditionEditPermission: vi.fn(),
}));

vi.mock('jsonwebtoken', () => ({
  default: {
    verify: vi.fn(),
  },
}));

const mockEvent = {};

const mockLostFoundItem = {
  id: 1,
  editionId: 1,
  userId: 2,
  description: 'Gants noirs trouvés',
  status: 'LOST',
  createdAt: new Date('2024-01-04T10:00:00Z'),
  updatedAt: new Date('2024-01-04T10:00:00Z'),
};

const mockUpdatedItem = {
  ...mockLostFoundItem,
  status: 'RETURNED',
  updatedAt: new Date('2024-01-04T12:00:00Z'),
  user: {
    id: 2,
    pseudo: 'finder',
    prenom: 'John',
    nom: 'Doe',
    profilePicture: null,
  },
  comments: [],
};

// Import des mocks après la déclaration
import { hasEditionEditPermission } from '../../../../../server/utils/permissions';
import jwt from 'jsonwebtoken';

const mockHasPermission = hasEditionEditPermission as ReturnType<typeof vi.fn>;
const mockJwtVerify = jwt.verify as ReturnType<typeof vi.fn>;

describe('/api/editions/[id]/lost-found/[itemId]/return PATCH', () => {
  beforeEach(() => {
    mockHasPermission.mockReset();
    mockJwtVerify.mockReset();
    prismaMock.lostFoundItem.findFirst.mockReset();
    prismaMock.lostFoundItem.update.mockReset();
    global.getRouterParam = vi.fn()
      .mockReturnValueOnce('1') // editionId
      .mockReturnValueOnce('1'); // itemId
    global.getCookie = vi.fn().mockReturnValue('valid-token');
    global.getHeader = vi.fn();
    global.useRuntimeConfig = vi.fn().mockReturnValue({
      jwtSecret: 'test-secret',
    });
  });

  it('devrait marquer un objet comme rendu', async () => {
    mockJwtVerify.mockReturnValue({ userId: 1 });
    prismaMock.lostFoundItem.findFirst.mockResolvedValue(mockLostFoundItem);
    mockHasPermission.mockResolvedValue(true);
    prismaMock.lostFoundItem.update.mockResolvedValue(mockUpdatedItem);

    const result = await handler(mockEvent as any);

    expect(result).toEqual(mockUpdatedItem);
    expect(prismaMock.lostFoundItem.findFirst).toHaveBeenCalledWith({
      where: {
        id: 1,
        editionId: 1,
      },
    });
    expect(prismaMock.lostFoundItem.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        status: 'RETURNED',
        updatedAt: expect.any(Date),
      },
      include: expect.objectContaining({
        user: expect.any(Object),
        comments: expect.any(Object),
      }),
    });
  });

  it('devrait basculer le statut de RETURNED vers LOST', async () => {
    const returnedItem = { ...mockLostFoundItem, status: 'RETURNED' };
    const toggledItem = { ...mockUpdatedItem, status: 'LOST' };

    mockJwtVerify.mockReturnValue({ userId: 1 });
    prismaMock.lostFoundItem.findFirst.mockResolvedValue(returnedItem);
    mockHasPermission.mockResolvedValue(true);
    prismaMock.lostFoundItem.update.mockResolvedValue(toggledItem);

    const result = await handler(mockEvent as any);

    expect(prismaMock.lostFoundItem.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        status: 'LOST',
        updatedAt: expect.any(Date),
      },
      include: expect.any(Object),
    });
  });

  it('devrait rejeter si ID d\'édition invalide', async () => {
    global.getRouterParam = vi.fn()
      .mockReturnValueOnce('invalid')
      .mockReturnValueOnce('1');

    await expect(handler(mockEvent as any)).rejects.toThrow('ID invalide');
  });

  it('devrait rejeter si ID d\'objet invalide', async () => {
    global.getRouterParam = vi.fn()
      .mockReturnValueOnce('1')
      .mockReturnValueOnce('invalid');

    await expect(handler(mockEvent as any)).rejects.toThrow('ID invalide');
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
    prismaMock.lostFoundItem.findFirst.mockResolvedValue(mockLostFoundItem);
    mockHasPermission.mockResolvedValue(true);
    prismaMock.lostFoundItem.update.mockResolvedValue(mockUpdatedItem);

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

  it('devrait rejeter si objet trouvé non trouvé', async () => {
    mockJwtVerify.mockReturnValue({ userId: 1 });
    prismaMock.lostFoundItem.findFirst.mockResolvedValue(null);

    await expect(handler(mockEvent as any)).rejects.toThrow('Objet trouvé non trouvé');
  });

  it('devrait vérifier que l\'objet appartient à l\'édition', async () => {
    global.getRouterParam = vi.fn()
      .mockReturnValueOnce('2') // editionId différent
      .mockReturnValueOnce('1'); // itemId

    mockJwtVerify.mockReturnValue({ userId: 1 });
    prismaMock.lostFoundItem.findFirst.mockResolvedValue(null); // Pas trouvé car mauvaise édition

    await expect(handler(mockEvent as any)).rejects.toThrow('Objet trouvé non trouvé');

    expect(prismaMock.lostFoundItem.findFirst).toHaveBeenCalledWith({
      where: {
        id: 1,
        editionId: 2,
      },
    });
  });

  it('devrait rejeter si utilisateur n\'est pas collaborateur', async () => {
    mockJwtVerify.mockReturnValue({ userId: 1 });
    prismaMock.lostFoundItem.findFirst.mockResolvedValue(mockLostFoundItem);
    mockHasPermission.mockResolvedValue(false);

    await expect(handler(mockEvent as any)).rejects.toThrow(
      'Vous devez être collaborateur pour modifier le statut d\'un objet trouvé'
    );
  });

  it('devrait inclure les détails utilisateur et commentaires', async () => {
    mockJwtVerify.mockReturnValue({ userId: 1 });
    prismaMock.lostFoundItem.findFirst.mockResolvedValue(mockLostFoundItem);
    mockHasPermission.mockResolvedValue(true);
    prismaMock.lostFoundItem.update.mockResolvedValue(mockUpdatedItem);

    const result = await handler(mockEvent as any);

    expect(prismaMock.lostFoundItem.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: expect.any(Object),
      include: {
        user: {
          select: {
            id: true,
            pseudo: true,
            prenom: true,
            nom: true,
            profilePicture: true,
          },
        },
        comments: {
          include: {
            user: {
              select: {
                id: true,
                pseudo: true,
                prenom: true,
                nom: true,
                profilePicture: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  });

  it('devrait mettre à jour la date de modification', async () => {
    const originalDate = new Date('2024-01-04T10:00:00Z');
    const testItem = { ...mockLostFoundItem, updatedAt: originalDate };

    mockJwtVerify.mockReturnValue({ userId: 1 });
    prismaMock.lostFoundItem.findFirst.mockResolvedValue(testItem);
    mockHasPermission.mockResolvedValue(true);
    prismaMock.lostFoundItem.update.mockResolvedValue(mockUpdatedItem);

    await handler(mockEvent as any);

    expect(prismaMock.lostFoundItem.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        status: 'RETURNED',
        updatedAt: expect.any(Date),
      },
      include: expect.any(Object),
    });

    // Vérifier que la nouvelle date est différente de l'originale
    const updateCall = prismaMock.lostFoundItem.update.mock.calls[0][0];
    expect(updateCall.data.updatedAt).not.toEqual(originalDate);
  });

  it('devrait gérer les erreurs de base de données', async () => {
    mockJwtVerify.mockReturnValue({ userId: 1 });
    prismaMock.lostFoundItem.findFirst.mockResolvedValue(mockLostFoundItem);
    mockHasPermission.mockResolvedValue(true);
    prismaMock.lostFoundItem.update.mockRejectedValue(new Error('DB Error'));

    await expect(handler(mockEvent as any)).rejects.toThrow('Erreur interne du serveur');
  });

  it('devrait relancer les erreurs HTTP', async () => {
    const httpError = {
      statusCode: 403,
      statusMessage: 'Access denied',
    };

    mockJwtVerify.mockReturnValue({ userId: 1 });
    prismaMock.lostFoundItem.findFirst.mockResolvedValue(mockLostFoundItem);
    mockHasPermission.mockRejectedValue(httpError);

    await expect(handler(mockEvent as any)).rejects.toEqual(httpError);
  });

  it('devrait traiter correctement les IDs numériques', async () => {
    global.getRouterParam = vi.fn()
      .mockReturnValueOnce('123')
      .mockReturnValueOnce('456');

    mockJwtVerify.mockReturnValue({ userId: 1 });
    prismaMock.lostFoundItem.findFirst.mockResolvedValue({ ...mockLostFoundItem, id: 456, editionId: 123 });
    mockHasPermission.mockResolvedValue(true);
    prismaMock.lostFoundItem.update.mockResolvedValue(mockUpdatedItem);

    await handler(mockEvent as any);

    expect(prismaMock.lostFoundItem.findFirst).toHaveBeenCalledWith({
      where: {
        id: 456,
        editionId: 123,
      },
    });
    expect(mockHasPermission).toHaveBeenCalledWith(1, 123);
    expect(prismaMock.lostFoundItem.update).toHaveBeenCalledWith({
      where: { id: 456 },
      data: expect.any(Object),
      include: expect.any(Object),
    });
  });
});