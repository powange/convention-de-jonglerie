import { describe, it, expect, beforeEach, vi } from 'vitest';
import handler from '../../../../../server/api/editions/[id]/lost-found/index.post';
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

const mockEvent = {
  context: {
    params: { id: '1' },
  },
};

const mockUser = {
  id: 1,
  pseudo: 'testuser',
  email: 'test@example.com',
};

const mockEdition = {
  id: 1,
  name: 'Convention Test 2024',
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-01-03'), // Édition terminée
  convention: {
    id: 1,
    collaborators: [],
  },
};

const mockLostFoundItem = {
  id: 1,
  editionId: 1,
  userId: 1,
  description: 'Gants noirs trouvés près de la scène',
  imageUrl: '/uploads/lost-found/item-123.jpg',
  status: 'LOST',
  user: {
    id: 1,
    pseudo: 'testuser',
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

describe('/api/editions/[id]/lost-found POST', () => {
  beforeEach(() => {
    mockHasPermission.mockReset();
    mockJwtVerify.mockReset();
    prismaMock.edition.findUnique.mockReset();
    prismaMock.lostFoundItem.create.mockReset();
    global.readBody = vi.fn();
    global.getRouterParam = vi.fn().mockReturnValue('1');
    global.getCookie = vi.fn().mockReturnValue('valid-token');
    global.getHeader = vi.fn();
    global.useRuntimeConfig = vi.fn().mockReturnValue({
      jwtSecret: 'test-secret',
    });
  });

  it('devrait créer un objet trouvé avec succès', async () => {
    const requestBody = {
      description: 'Gants noirs trouvés près de la scène',
      imageUrl: '/uploads/lost-found/item-123.jpg',
    };

    global.readBody.mockResolvedValue(requestBody);
    mockJwtVerify.mockReturnValue({ userId: 1 });
    prismaMock.edition.findUnique.mockResolvedValue(mockEdition);
    mockHasPermission.mockResolvedValue(true);
    prismaMock.lostFoundItem.create.mockResolvedValue(mockLostFoundItem);

    const result = await handler(mockEvent as any);

    expect(result).toEqual(mockLostFoundItem);
    expect(prismaMock.lostFoundItem.create).toHaveBeenCalledWith({
      data: {
        editionId: 1,
        userId: 1,
        description: 'Gants noirs trouvés près de la scène',
        imageUrl: '/uploads/lost-found/item-123.jpg',
        status: 'LOST',
      },
      include: expect.objectContaining({
        user: expect.any(Object),
        comments: expect.any(Object),
      }),
    });
  });

  it('devrait créer un objet trouvé sans image', async () => {
    const requestBody = {
      description: 'Clés trouvées dans les toilettes',
    };

    global.readBody.mockResolvedValue(requestBody);
    mockJwtVerify.mockReturnValue({ userId: 1 });
    prismaMock.edition.findUnique.mockResolvedValue(mockEdition);
    mockHasPermission.mockResolvedValue(true);
    prismaMock.lostFoundItem.create.mockResolvedValue({
      ...mockLostFoundItem,
      description: 'Clés trouvées dans les toilettes',
      imageUrl: null,
    });

    const result = await handler(mockEvent as any);

    expect(prismaMock.lostFoundItem.create).toHaveBeenCalledWith({
      data: {
        editionId: 1,
        userId: 1,
        description: 'Clés trouvées dans les toilettes',
        imageUrl: null,
        status: 'LOST',
      },
      include: expect.any(Object),
    });
  });

  it('devrait rejeter si ID d\'édition invalide', async () => {
    global.getRouterParam.mockReturnValue('invalid');

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
    prismaMock.edition.findUnique.mockResolvedValue(mockEdition);
    mockHasPermission.mockResolvedValue(true);
    prismaMock.lostFoundItem.create.mockResolvedValue(mockLostFoundItem);
    global.readBody.mockResolvedValue({ description: 'Test item' });

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

  it('devrait rejeter si édition non trouvée', async () => {
    mockJwtVerify.mockReturnValue({ userId: 1 });
    prismaMock.edition.findUnique.mockResolvedValue(null);

    await expect(handler(mockEvent as any)).rejects.toThrow('Édition non trouvée');
  });

  it('devrait rejeter si édition pas encore terminée', async () => {
    const ongoingEdition = {
      ...mockEdition,
      endDate: new Date(Date.now() + 86400000), // Demain
    };

    mockJwtVerify.mockReturnValue({ userId: 1 });
    prismaMock.edition.findUnique.mockResolvedValue(ongoingEdition);

    await expect(handler(mockEvent as any)).rejects.toThrow(
      'Les objets trouvés ne peuvent être ajoutés qu\'après la fin de l\'édition'
    );
  });

  it('devrait rejeter si utilisateur n\'est pas collaborateur', async () => {
    mockJwtVerify.mockReturnValue({ userId: 1 });
    prismaMock.edition.findUnique.mockResolvedValue(mockEdition);
    mockHasPermission.mockResolvedValue(false);

    await expect(handler(mockEvent as any)).rejects.toThrow(
      'Vous devez être collaborateur pour ajouter un objet trouvé'
    );
  });

  it('devrait rejeter si description manquante', async () => {
    const requestBody = {
      imageUrl: '/uploads/test.jpg',
    };

    global.readBody.mockResolvedValue(requestBody);
    mockJwtVerify.mockReturnValue({ userId: 1 });
    prismaMock.edition.findUnique.mockResolvedValue(mockEdition);
    mockHasPermission.mockResolvedValue(true);

    await expect(handler(mockEvent as any)).rejects.toThrow('La description est requise');
  });

  it('devrait rejeter si description vide', async () => {
    const requestBody = {
      description: '   ',
    };

    global.readBody.mockResolvedValue(requestBody);
    mockJwtVerify.mockReturnValue({ userId: 1 });
    prismaMock.edition.findUnique.mockResolvedValue(mockEdition);
    mockHasPermission.mockResolvedValue(true);

    await expect(handler(mockEvent as any)).rejects.toThrow('La description est requise');
  });

  it('devrait rejeter si description n\'est pas une string', async () => {
    const requestBody = {
      description: 123,
    };

    global.readBody.mockResolvedValue(requestBody);
    mockJwtVerify.mockReturnValue({ userId: 1 });
    prismaMock.edition.findUnique.mockResolvedValue(mockEdition);
    mockHasPermission.mockResolvedValue(true);

    await expect(handler(mockEvent as any)).rejects.toThrow('La description est requise');
  });

  it('devrait trimmer la description', async () => {
    const requestBody = {
      description: '  Objet avec espaces  ',
    };

    global.readBody.mockResolvedValue(requestBody);
    mockJwtVerify.mockReturnValue({ userId: 1 });
    prismaMock.edition.findUnique.mockResolvedValue(mockEdition);
    mockHasPermission.mockResolvedValue(true);
    prismaMock.lostFoundItem.create.mockResolvedValue(mockLostFoundItem);

    await handler(mockEvent as any);

    expect(prismaMock.lostFoundItem.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        description: 'Objet avec espaces',
      }),
      include: expect.any(Object),
    });
  });

  it('devrait gérer les erreurs de base de données', async () => {
    global.readBody.mockResolvedValue({ description: 'Test item' });
    mockJwtVerify.mockReturnValue({ userId: 1 });
    prismaMock.edition.findUnique.mockResolvedValue(mockEdition);
    mockHasPermission.mockResolvedValue(true);
    prismaMock.lostFoundItem.create.mockRejectedValue(new Error('DB Error'));

    await expect(handler(mockEvent as any)).rejects.toThrow('Erreur interne du serveur');
  });

  it('devrait relancer les erreurs HTTP', async () => {
    const httpError = {
      statusCode: 403,
      message: 'Permission denied',
    };

    mockJwtVerify.mockReturnValue({ userId: 1 });
    prismaMock.edition.findUnique.mockResolvedValue(mockEdition);
    mockHasPermission.mockRejectedValue(httpError);

    await expect(handler(mockEvent as any)).rejects.toEqual(httpError);
  });
});