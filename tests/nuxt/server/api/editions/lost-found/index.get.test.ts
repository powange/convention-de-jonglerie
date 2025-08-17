import { describe, it, expect, beforeEach, vi } from 'vitest';
import handler from '../../../../../server/api/editions/[id]/lost-found/index.get';
import { prismaMock } from '../../../../../__mocks__/prisma';

const mockEvent = {};

const mockEdition = {
  id: 1,
  endDate: new Date('2024-01-03'),
};

const mockLostFoundItems = [
  {
    id: 1,
    editionId: 1,
    userId: 1,
    description: 'Gants noirs trouvés près de la scène',
    imageUrl: '/uploads/lost-found/item-1.jpg',
    status: 'LOST',
    createdAt: new Date('2024-01-04T10:00:00Z'),
    user: {
      id: 1,
      pseudo: 'finder1',
      prenom: 'John',
      nom: 'Doe',
      profilePicture: null,
    },
    comments: [
      {
        id: 1,
        content: 'Je pense que c\'est à moi',
        createdAt: new Date('2024-01-04T11:00:00Z'),
        user: {
          id: 2,
          pseudo: 'owner1',
          prenom: 'Jane',
          nom: 'Smith',
          profilePicture: null,
        },
      },
    ],
  },
  {
    id: 2,
    editionId: 1,
    userId: 2,
    description: 'Téléphone oublié sur une table',
    imageUrl: null,
    status: 'RETURNED',
    createdAt: new Date('2024-01-04T09:00:00Z'),
    user: {
      id: 2,
      pseudo: 'finder2',
      prenom: 'Alice',
      nom: 'Johnson',
      profilePicture: '/avatars/alice.jpg',
    },
    comments: [],
  },
];

describe('/api/editions/[id]/lost-found GET', () => {
  beforeEach(() => {
    prismaMock.edition.findUnique.mockReset();
    prismaMock.lostFoundItem.findMany.mockReset();
    global.getRouterParam = vi.fn().mockReturnValue('1');
  });

  it('devrait récupérer tous les objets trouvés d\'une édition', async () => {
    prismaMock.edition.findUnique.mockResolvedValue(mockEdition);
    prismaMock.lostFoundItem.findMany.mockResolvedValue(mockLostFoundItems);

    const result = await handler(mockEvent as any);

    expect(result).toEqual(mockLostFoundItems);
    expect(prismaMock.edition.findUnique).toHaveBeenCalledWith({
      where: { id: 1 },
      select: { id: true, endDate: true },
    });
    expect(prismaMock.lostFoundItem.findMany).toHaveBeenCalledWith({
      where: { editionId: 1 },
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
      orderBy: { createdAt: 'desc' },
    });
  });

  it('devrait retourner une liste vide si aucun objet trouvé', async () => {
    prismaMock.edition.findUnique.mockResolvedValue(mockEdition);
    prismaMock.lostFoundItem.findMany.mockResolvedValue([]);

    const result = await handler(mockEvent as any);

    expect(result).toEqual([]);
  });

  it('devrait rejeter si ID d\'édition invalide', async () => {
    global.getRouterParam.mockReturnValue('invalid');

    await expect(handler(mockEvent as any)).rejects.toThrow('ID d\'édition invalide');
  });

  it('devrait rejeter si ID d\'édition est NaN', async () => {
    global.getRouterParam.mockReturnValue('abc');

    await expect(handler(mockEvent as any)).rejects.toThrow('ID d\'édition invalide');
  });

  it('devrait rejeter si ID d\'édition est 0', async () => {
    global.getRouterParam.mockReturnValue('0');

    await expect(handler(mockEvent as any)).rejects.toThrow('ID d\'édition invalide');
  });

  it('devrait rejeter si édition non trouvée', async () => {
    prismaMock.edition.findUnique.mockResolvedValue(null);

    await expect(handler(mockEvent as any)).rejects.toThrow('Édition non trouvée');
  });

  it('devrait inclure tous les détails utilisateur', async () => {
    prismaMock.edition.findUnique.mockResolvedValue(mockEdition);
    prismaMock.lostFoundItem.findMany.mockResolvedValue(mockLostFoundItems);

    const result = await handler(mockEvent as any);

    expect(result[0].user).toHaveProperty('id');
    expect(result[0].user).toHaveProperty('pseudo');
    expect(result[0].user).toHaveProperty('prenom');
    expect(result[0].user).toHaveProperty('nom');
    expect(result[0].user).toHaveProperty('profilePicture');
  });

  it('devrait inclure les commentaires avec les détails utilisateur', async () => {
    prismaMock.edition.findUnique.mockResolvedValue(mockEdition);
    prismaMock.lostFoundItem.findMany.mockResolvedValue(mockLostFoundItems);

    const result = await handler(mockEvent as any);

    expect(result[0].comments).toHaveLength(1);
    expect(result[0].comments[0].user).toHaveProperty('id');
    expect(result[0].comments[0].user).toHaveProperty('pseudo');
    expect(result[0].comments[0].user).toHaveProperty('prenom');
    expect(result[0].comments[0].user).toHaveProperty('nom');
    expect(result[0].comments[0].user).toHaveProperty('profilePicture');
  });

  it('devrait trier les objets par date de création décroissante', async () => {
    prismaMock.edition.findUnique.mockResolvedValue(mockEdition);
    prismaMock.lostFoundItem.findMany.mockResolvedValue(mockLostFoundItems);

    await handler(mockEvent as any);

    expect(prismaMock.lostFoundItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: 'desc' },
      })
    );
  });

  it('devrait trier les commentaires par date de création croissante', async () => {
    prismaMock.edition.findUnique.mockResolvedValue(mockEdition);
    prismaMock.lostFoundItem.findMany.mockResolvedValue(mockLostFoundItems);

    await handler(mockEvent as any);

    expect(prismaMock.lostFoundItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          comments: expect.objectContaining({
            orderBy: { createdAt: 'asc' },
          }),
        }),
      })
    );
  });

  it('devrait gérer les erreurs de base de données', async () => {
    prismaMock.edition.findUnique.mockResolvedValue(mockEdition);
    prismaMock.lostFoundItem.findMany.mockRejectedValue(new Error('DB Error'));

    await expect(handler(mockEvent as any)).rejects.toThrow('Erreur interne du serveur');
  });

  it('devrait relancer les erreurs HTTP', async () => {
    const httpError = {
      statusCode: 403,
      statusMessage: 'Access denied',
    };

    prismaMock.edition.findUnique.mockRejectedValue(httpError);

    await expect(handler(mockEvent as any)).rejects.toEqual(httpError);
  });

  it('devrait traiter correctement l\'ID numérique', async () => {
    global.getRouterParam.mockReturnValue('123');

    prismaMock.edition.findUnique.mockResolvedValue({ id: 123, endDate: new Date() });
    prismaMock.lostFoundItem.findMany.mockResolvedValue([]);

    await handler(mockEvent as any);

    expect(prismaMock.edition.findUnique).toHaveBeenCalledWith({
      where: { id: 123 },
      select: { id: true, endDate: true },
    });
    expect(prismaMock.lostFoundItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { editionId: 123 },
      })
    );
  });
});