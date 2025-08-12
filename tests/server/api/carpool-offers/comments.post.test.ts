import { describe, it, expect, beforeEach } from 'vitest';
import handler from '../../../../server/api/carpool-offers/[id]/comments.post';
import { prismaMock } from '../../../__mocks__/prisma';

// Mock des modules Nuxt
const mockEvent = {
  context: {
    params: { id: '1' },
    user: {
      id: 1,
      email: 'user@test.com',
      pseudo: 'testuser',
    },
  },
};

describe('/api/carpool-offers/[id]/comments POST', () => {
  beforeEach(() => {
    // Reset tous les mocks avant chaque test
    prismaMock.carpoolOffer.findUnique.mockReset();
    prismaMock.carpoolComment.create.mockReset();
    global.readBody = vi.fn();
  });

  it('devrait créer un commentaire avec succès', async () => {
    const requestBody = {
      content: 'Salut ! Ça m\'intéresse, peux-tu me contacter ?',
    };

    const mockCarpoolOffer = {
      id: 1,
      editionId: 1,
      userId: 2,
      departureDate: new Date('2024-07-15'),
      departureCity: 'Paris',
    };

    const mockComment = {
      id: 1,
      carpoolOfferId: 1,
      userId: 1,
      content: requestBody.content,
      createdAt: new Date(),
      user: {
        id: 1,
        pseudo: 'testuser',
      },
    };

    global.readBody.mockResolvedValue(requestBody);
    prismaMock.carpoolOffer.findUnique.mockResolvedValue(mockCarpoolOffer);
    prismaMock.carpoolComment.create.mockResolvedValue(mockComment);

    const result = await handler(mockEvent as any);

    expect(result).toEqual(mockComment);
    expect(prismaMock.carpoolOffer.findUnique).toHaveBeenCalledWith({
      where: { id: 1 },
    });
    expect(prismaMock.carpoolComment.create).toHaveBeenCalledWith({
      data: {
        carpoolOfferId: 1,
        userId: 1,
        content: requestBody.content,
      },
      include: {
        user: {
          select: {
            id: true,
            pseudo: true,
          },
        },
      },
    });
  });

  it('devrait rejeter si utilisateur non authentifié', async () => {
    const eventWithoutUser = {
      ...mockEvent,
      context: { ...mockEvent.context, user: null },
    };

    await expect(handler(eventWithoutUser as any)).rejects.toThrow('Non authentifié');
  });

  it('devrait rejeter un ID d\'offre de covoiturage invalide', async () => {
    const eventWithBadId = {
      ...mockEvent,
      context: { ...mockEvent.context, params: { id: 'invalid' } },
    };

    global.readBody.mockResolvedValue({ content: 'Test' });

    await expect(handler(eventWithBadId as any)).rejects.toThrow('Carpool Offer ID invalide');
  });

  it('devrait valider que le contenu n\'est pas vide', async () => {
    const emptyBody = {
      content: '',
    };

    global.readBody.mockResolvedValue(emptyBody);

    await expect(handler(mockEvent as any)).rejects.toThrow('Le commentaire ne peut pas être vide');
  });

  it('devrait valider que le contenu n\'est pas seulement des espaces', async () => {
    const whitespaceBody = {
      content: '   ',
    };

    global.readBody.mockResolvedValue(whitespaceBody);

    await expect(handler(mockEvent as any)).rejects.toThrow('Le commentaire ne peut pas être vide');
  });

  it('devrait valider que le contenu existe', async () => {
    const noContentBody = {};

    global.readBody.mockResolvedValue(noContentBody);

    await expect(handler(mockEvent as any)).rejects.toThrow('Le commentaire ne peut pas être vide');
  });

  it('devrait rejeter si offre de covoiturage non trouvée', async () => {
    const requestBody = {
      content: 'Commentaire de test',
    };

    global.readBody.mockResolvedValue(requestBody);
    prismaMock.carpoolOffer.findUnique.mockResolvedValue(null);

    await expect(handler(mockEvent as any)).rejects.toThrow('Erreur serveur');
  });

  it('devrait gérer les erreurs de base de données', async () => {
    const requestBody = {
      content: 'Commentaire de test',
    };

    global.readBody.mockResolvedValue(requestBody);
    prismaMock.carpoolOffer.findUnique.mockRejectedValue(new Error('Database error'));

    await expect(handler(mockEvent as any)).rejects.toThrow('Erreur serveur');
  });

  it('devrait gérer les erreurs lors de la création du commentaire', async () => {
    const requestBody = {
      content: 'Commentaire de test',
    };

    const mockCarpoolOffer = {
      id: 1,
      editionId: 1,
      userId: 2,
    };

    global.readBody.mockResolvedValue(requestBody);
    prismaMock.carpoolOffer.findUnique.mockResolvedValue(mockCarpoolOffer);
    prismaMock.carpoolComment.create.mockRejectedValue(new Error('Creation error'));

    await expect(handler(mockEvent as any)).rejects.toThrow('Erreur serveur');
  });

  it('devrait accepter un commentaire long', async () => {
    const longContent = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(20);
    const requestBody = {
      content: longContent,
    };

    const mockCarpoolOffer = { id: 1, editionId: 1, userId: 2 };
    const mockComment = {
      id: 1,
      carpoolOfferId: 1,
      userId: 1,
      content: longContent,
      user: { id: 1, pseudo: 'testuser' },
    };

    global.readBody.mockResolvedValue(requestBody);
    prismaMock.carpoolOffer.findUnique.mockResolvedValue(mockCarpoolOffer);
    prismaMock.carpoolComment.create.mockResolvedValue(mockComment);

    const result = await handler(mockEvent as any);

    expect(result.content).toBe(longContent);
    expect(prismaMock.carpoolComment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          content: longContent,
        }),
      })
    );
  });

  it('devrait permettre à l\'auteur de l\'offre de commenter sa propre offre', async () => {
    const requestBody = {
      content: 'Mise à jour : encore 1 place disponible !',
    };

    // L'utilisateur connecté est aussi l'auteur de l'offre
    const mockCarpoolOffer = {
      id: 1,
      editionId: 1,
      userId: 1, // Même ID que l'utilisateur connecté
    };

    const mockComment = {
      id: 1,
      carpoolOfferId: 1,
      userId: 1,
      content: requestBody.content,
      user: { id: 1, pseudo: 'testuser' },
    };

    global.readBody.mockResolvedValue(requestBody);
    prismaMock.carpoolOffer.findUnique.mockResolvedValue(mockCarpoolOffer);
    prismaMock.carpoolComment.create.mockResolvedValue(mockComment);

    const result = await handler(mockEvent as any);

    expect(result).toEqual(mockComment);
  });
});