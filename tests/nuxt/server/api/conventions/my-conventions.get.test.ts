import { describe, it, expect, beforeEach } from 'vitest';
import handler from '../../../../../server/api/conventions/my-conventions.get';
import { prismaMock } from '../../../../__mocks__/prisma';

// Import du mock après la déclaration
import { getEmailHash } from '../../../../../server/utils/email-hash';

// Mock du module getEmailHash
vi.mock('../../../../server/utils/email-hash', () => ({
  getEmailHash: vi.fn(),
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
const mockGetEmailHash = getEmailHash as ReturnType<typeof vi.fn>;

describe('/api/conventions/my-conventions GET', () => {
  beforeEach(() => {
    prismaMock.convention.findMany.mockReset();
    mockGetEmailHash.mockReset();
  });

  it('devrait retourner les conventions de l\'utilisateur en tant qu\'auteur', async () => {
    const mockConventions = [
      {
        id: 1,
        name: 'Ma Convention',
        description: 'Description test',
        authorId: 1,
        createdAt: new Date('2024-01-01'),
        author: {
          id: 1,
          pseudo: 'testuser',
          email: 'user@test.com',
        },
        collaborators: [],
        editions: [
          {
            id: 1,
            name: 'Edition 2024',
            startDate: new Date('2024-07-01'),
            endDate: new Date('2024-07-03'),
            city: 'Paris',
            country: 'France',
            imageUrl: 'image.jpg',
            isOnline: false,
          },
        ],
      },
    ];

    mockGetEmailHash.mockReturnValue('user-hash');
    prismaMock.convention.findMany.mockResolvedValue(mockConventions);

    const result = await handler(mockEvent as any);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: 1,
      name: 'Ma Convention',
      description: 'Description test',
      authorId: 1,
      createdAt: new Date('2024-01-01'),
      author: {
        id: 1,
        pseudo: 'testuser',
        emailHash: 'user-hash',
        email: undefined,
      },
      collaborators: [],
      editions: [
        {
          id: 1,
          name: 'Edition 2024',
          startDate: new Date('2024-07-01'),
          endDate: new Date('2024-07-03'),
          city: 'Paris',
          country: 'France',
          imageUrl: 'image.jpg',
          isOnline: false,
        },
      ],
    });

    expect(prismaMock.convention.findMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { authorId: 1 },
          {
            collaborators: {
              some: {
                userId: 1,
              },
            },
          },
        ],
      },
      include: {
        author: {
          select: {
            id: true,
            pseudo: true,
            email: true,
          },
        },
        collaborators: {
          include: {
            user: {
              select: {
                id: true,
                pseudo: true,
                profilePicture: true,
                email: true,
              },
            },
          },
          orderBy: {
            addedAt: 'asc',
          },
        },
        editions: {
          select: {
            id: true,
            name: true,
            startDate: true,
            endDate: true,
            city: true,
            country: true,
            imageUrl: true,
            isOnline: true,
          },
          orderBy: {
            startDate: 'asc',
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  });

  it('devrait retourner les conventions où l\'utilisateur est collaborateur', async () => {
    const mockConventions = [
      {
        id: 1,
        name: 'Convention Collaborative',
        authorId: 2,
        author: {
          id: 2,
          pseudo: 'author',
          email: 'author@test.com',
        },
        collaborators: [
          {
            id: 1,
            userId: 1,
            role: 'MODERATOR',
            addedAt: new Date('2024-01-02'),
            user: {
              id: 1,
              pseudo: 'testuser',
              profilePicture: null,
              email: 'user@test.com',
            },
          },
        ],
        editions: [],
      },
    ];

    mockGetEmailHash
      .mockReturnValueOnce('author-hash')
      .mockReturnValueOnce('user-hash');

    prismaMock.convention.findMany.mockResolvedValue(mockConventions);

    const result = await handler(mockEvent as any);

    expect(result).toHaveLength(1);
    expect(result[0].collaborators).toHaveLength(1);
    expect(result[0].collaborators[0].user.emailHash).toBe('user-hash');
    expect(result[0].author.emailHash).toBe('author-hash');
  });

  it('devrait masquer tous les emails avec getEmailHash', async () => {
    const mockConventions = [
      {
        id: 1,
        name: 'Convention Test',
        authorId: 1,
        author: {
          id: 1,
          pseudo: 'author',
          email: 'author@test.com',
        },
        collaborators: [
          {
            id: 1,
            user: {
              id: 2,
              pseudo: 'collab1',
              email: 'collab1@test.com',
              profilePicture: 'avatar1.jpg',
            },
          },
          {
            id: 2,
            user: {
              id: 3,
              pseudo: 'collab2',
              email: 'collab2@test.com',
              profilePicture: null,
            },
          },
        ],
        editions: [],
      },
    ];

    mockGetEmailHash
      .mockReturnValueOnce('author-hash')
      .mockReturnValueOnce('collab1-hash')
      .mockReturnValueOnce('collab2-hash');

    prismaMock.convention.findMany.mockResolvedValue(mockConventions);

    const result = await handler(mockEvent as any);

    expect(mockGetEmailHash).toHaveBeenCalledTimes(3);
    expect(mockGetEmailHash).toHaveBeenNthCalledWith(1, 'author@test.com');
    expect(mockGetEmailHash).toHaveBeenNthCalledWith(2, 'collab1@test.com');
    expect(mockGetEmailHash).toHaveBeenNthCalledWith(3, 'collab2@test.com');

    expect(result[0].author.emailHash).toBe('author-hash');
    expect(result[0].collaborators[0].user.emailHash).toBe('collab1-hash');
    expect(result[0].collaborators[1].user.emailHash).toBe('collab2-hash');

    // Vérifier que les emails originaux ne sont pas exposés
    expect(result[0].author.email).toBeUndefined();
    expect(result[0].collaborators[0].user.email).toBeUndefined();
    expect(result[0].collaborators[1].user.email).toBeUndefined();
  });

  it('devrait rejeter si utilisateur non authentifié', async () => {
    const eventWithoutUser = {
      context: { user: null },
    };

    await expect(handler(eventWithoutUser as any)).rejects.toThrow('Non authentifié');
  });

  it('devrait retourner un tableau vide si aucune convention', async () => {
    prismaMock.convention.findMany.mockResolvedValue([]);

    const result = await handler(mockEvent as any);

    expect(result).toEqual([]);
  });

  it('devrait ordonner les conventions par date de création décroissante', async () => {
    const mockConventions = [
      {
        id: 2,
        name: 'Convention Récente',
        createdAt: new Date('2024-02-01'),
        author: { id: 1, pseudo: 'user', email: 'user@test.com' },
        collaborators: [],
        editions: [],
      },
      {
        id: 1,
        name: 'Convention Ancienne',
        createdAt: new Date('2024-01-01'),
        author: { id: 1, pseudo: 'user', email: 'user@test.com' },
        collaborators: [],
        editions: [],
      },
    ];

    mockGetEmailHash.mockReturnValue('hash');
    prismaMock.convention.findMany.mockResolvedValue(mockConventions);

    const result = await handler(mockEvent as any);

    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('Convention Récente');
    expect(result[1].name).toBe('Convention Ancienne');
  });

  it('devrait ordonner les éditions par date de début croissante', async () => {
    const mockConventions = [
      {
        id: 1,
        name: 'Convention Test',
        author: { id: 1, pseudo: 'user', email: 'user@test.com' },
        collaborators: [],
        editions: [
          {
            id: 2,
            name: 'Edition 2025',
            startDate: new Date('2025-07-01'),
          },
          {
            id: 1,
            name: 'Edition 2024',
            startDate: new Date('2024-07-01'),
          },
        ],
      },
    ];

    mockGetEmailHash.mockReturnValue('hash');
    prismaMock.convention.findMany.mockResolvedValue(mockConventions);

    const result = await handler(mockEvent as any);

    expect(result[0].editions).toHaveLength(2);
    expect(result[0].editions[0].name).toBe('Edition 2025');
    expect(result[0].editions[1].name).toBe('Edition 2024');
  });

  it('devrait ordonner les collaborateurs par date d\'ajout croissante', async () => {
    const mockConventions = [
      {
        id: 1,
        name: 'Convention Test',
        author: { id: 1, pseudo: 'user', email: 'user@test.com' },
        collaborators: [
          {
            id: 2,
            addedAt: new Date('2024-01-02'),
            user: { id: 3, pseudo: 'collab2', email: 'collab2@test.com' },
          },
          {
            id: 1,
            addedAt: new Date('2024-01-01'),
            user: { id: 2, pseudo: 'collab1', email: 'collab1@test.com' },
          },
        ],
        editions: [],
      },
    ];

    mockGetEmailHash.mockReturnValue('hash');
    prismaMock.convention.findMany.mockResolvedValue(mockConventions);

    await handler(mockEvent as any);

    expect(prismaMock.convention.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          collaborators: expect.objectContaining({
            orderBy: { addedAt: 'asc' },
          }),
        }),
      })
    );
  });

  it('devrait gérer les erreurs de base de données', async () => {
    prismaMock.convention.findMany.mockRejectedValue(new Error('Database error'));

    await expect(handler(mockEvent as any)).rejects.toThrow('Erreur serveur');
  });

  it('devrait gérer les collaborateurs sans profilePicture', async () => {
    const mockConventions = [
      {
        id: 1,
        name: 'Convention Test',
        author: { id: 1, pseudo: 'user', email: 'user@test.com' },
        collaborators: [
          {
            id: 1,
            user: {
              id: 2,
              pseudo: 'collab',
              email: 'collab@test.com',
              profilePicture: null,
            },
          },
        ],
        editions: [],
      },
    ];

    mockGetEmailHash.mockReturnValue('hash');
    prismaMock.convention.findMany.mockResolvedValue(mockConventions);

    const result = await handler(mockEvent as any);

    expect(result[0].collaborators[0].user.profilePicture).toBeNull();
  });
});