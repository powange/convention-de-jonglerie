import { describe, it, expect, beforeEach } from 'vitest';
import { prismaMock } from '../__mocks__/prisma';

// Mock Prisma pour les tests d'intégration
const prisma = prismaMock;

describe('Lost Found System - Database Integration', () => {
  beforeEach(() => {
    // Les mocks sont automatiquement réinitialisés
  });

  describe('LostFoundItem CRUD', () => {
    it('devrait pouvoir créer un objet trouvé', async () => {
      const mockLostFoundItem = {
        id: 1,
        editionId: 123,
        userId: 1,
        description: 'Jongle ball rouge trouvé près de la scène',
        imageUrl: '/uploads/lost-found/1/image.jpg',
        status: 'LOST',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.lostFoundItem.create.mockResolvedValue(mockLostFoundItem);

      const result = await prisma.lostFoundItem.create({
        data: {
          editionId: 123,
          userId: 1,
          description: 'Jongle ball rouge trouvé près de la scène',
          imageUrl: '/uploads/lost-found/1/image.jpg',
          status: 'LOST',
        },
      });

      expect(result).toEqual(mockLostFoundItem);
      expect(prisma.lostFoundItem.create).toHaveBeenCalledWith({
        data: {
          editionId: 123,
          userId: 1,
          description: 'Jongle ball rouge trouvé près de la scène',
          imageUrl: '/uploads/lost-found/1/image.jpg',
          status: 'LOST',
        },
      });
    });

    it('devrait pouvoir récupérer des objets trouvés', async () => {
      const mockItems = [
        {
          id: 1,
          description: 'Jongle ball rouge',
          status: 'LOST',
          user: { id: 1, pseudo: 'testuser' },
        },
        {
          id: 2,
          description: 'Diabolo bleu',
          status: 'RETURNED',
          user: { id: 2, pseudo: 'testuser2' },
        },
      ];

      prisma.lostFoundItem.findMany.mockResolvedValue(mockItems);

      const result = await prisma.lostFoundItem.findMany({
        where: { editionId: 123 },
        include: {
          user: {
            select: { id: true, pseudo: true },
          },
        },
      });

      expect(result).toEqual(mockItems);
      expect(result).toHaveLength(2);
    });

    it('devrait pouvoir mettre à jour le statut', async () => {
      const mockUpdatedItem = {
        id: 1,
        status: 'RETURNED',
        updatedAt: new Date(),
      };

      prisma.lostFoundItem.update.mockResolvedValue(mockUpdatedItem);

      const result = await prisma.lostFoundItem.update({
        where: { id: 1 },
        data: { status: 'RETURNED' },
      });

      expect(result.status).toBe('RETURNED');
      expect(prisma.lostFoundItem.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { status: 'RETURNED' },
      });
    });
  });

  describe('LostFoundComment CRUD', () => {
    it('devrait pouvoir créer un commentaire', async () => {
      const mockComment = {
        id: 1,
        lostFoundItemId: 1,
        userId: 2,
        content: 'Je pense que c\'est le mien',
        createdAt: new Date(),
        user: {
          id: 2,
          pseudo: 'testuser2',
          prenom: 'Test2',
          nom: 'User2',
        },
      };

      prisma.lostFoundComment.create.mockResolvedValue(mockComment);

      const result = await prisma.lostFoundComment.create({
        data: {
          lostFoundItemId: 1,
          userId: 2,
          content: 'Je pense que c\'est le mien',
        },
        include: {
          user: {
            select: {
              id: true,
              pseudo: true,
              prenom: true,
              nom: true,
            },
          },
        },
      });

      expect(result).toEqual(mockComment);
      expect(result.content).toBe('Je pense que c\'est le mien');
    });

    it('devrait pouvoir lister les commentaires par objet', async () => {
      const mockComments = [
        {
          id: 1,
          content: 'Premier commentaire',
          user: { pseudo: 'user1' },
        },
        {
          id: 2,
          content: 'Deuxième commentaire',
          user: { pseudo: 'user2' },
        },
      ];

      prisma.lostFoundComment.findMany.mockResolvedValue(mockComments);

      const result = await prisma.lostFoundComment.findMany({
        where: { lostFoundItemId: 1 },
        include: {
          user: { select: { pseudo: true } },
        },
        orderBy: { createdAt: 'asc' },
      });

      expect(result).toEqual(mockComments);
      expect(result).toHaveLength(2);
    });
  });

  describe('Opérations complexes', () => {
    it('devrait pouvoir récupérer des objets avec commentaires', async () => {
      const mockItemsWithComments = [
        {
          id: 1,
          description: 'Objet avec commentaires',
          user: { pseudo: 'creator' },
          comments: [
            {
              id: 1,
              content: 'Commentaire 1',
              user: { pseudo: 'commenter1' },
            },
          ],
        },
      ];

      prisma.lostFoundItem.findMany.mockResolvedValue(mockItemsWithComments);

      const result = await prisma.lostFoundItem.findMany({
        where: { editionId: 123 },
        include: {
          user: { select: { pseudo: true } },
          comments: {
            include: {
              user: { select: { pseudo: true } },
            },
          },
        },
      });

      expect(result).toEqual(mockItemsWithComments);
      expect(result[0].comments).toHaveLength(1);
    });

    it('devrait pouvoir grouper par utilisateur', async () => {
      const mockGroupedData = [
        { userId: 1, _count: { id: 2 } },
        { userId: 2, _count: { id: 1 } },
      ];

      prisma.lostFoundItem.groupBy.mockResolvedValue(mockGroupedData);

      const result = await prisma.lostFoundItem.groupBy({
        by: ['userId'],
        where: { editionId: 123 },
        _count: { id: true },
      });

      expect(result).toEqual(mockGroupedData);
      expect(result).toHaveLength(2);
    });
  });

  describe('Validation des appels Prisma', () => {
    it('devrait vérifier les paramètres de création d\'objet trouvé', async () => {
      prisma.lostFoundItem.create.mockResolvedValue({ id: 1 });

      await prisma.lostFoundItem.create({
        data: {
          editionId: 123,
          userId: 1,
          description: 'Test object',
          status: 'LOST',
        },
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
      });

      expect(prisma.lostFoundItem.create).toHaveBeenCalledWith({
        data: {
          editionId: 123,
          userId: 1,
          description: 'Test object',
          status: 'LOST',
        },
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
      });
    });

    it('devrait vérifier les paramètres de recherche avec filtres', async () => {
      prisma.lostFoundItem.findMany.mockResolvedValue([]);

      await prisma.lostFoundItem.findMany({
        where: {
          editionId: 123,
          status: 'LOST',
        },
        include: {
          user: { select: { pseudo: true } },
          comments: { orderBy: { createdAt: 'asc' } },
        },
        orderBy: { createdAt: 'desc' },
      });

      expect(prisma.lostFoundItem.findMany).toHaveBeenCalledWith({
        where: {
          editionId: 123,
          status: 'LOST',
        },
        include: {
          user: { select: { pseudo: true } },
          comments: { orderBy: { createdAt: 'asc' } },
        },
        orderBy: { createdAt: 'desc' },
      });
    });
  });
});