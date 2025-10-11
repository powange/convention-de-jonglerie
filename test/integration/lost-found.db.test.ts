import bcrypt from 'bcryptjs'
import { describe, it, expect, beforeEach } from 'vitest'

import { prismaTest } from '../setup-db'

// Ce fichier ne s'exécute que si TEST_WITH_DB=true
describe.skipIf(!process.env.TEST_WITH_DB)(
  "Tests d'intégration Lost & Found avec DB réelle",
  () => {
    let testUser: { id: number; email: string; pseudo: string }
    let testEdition: { id: number; name: string }

    // Le nettoyage est géré globalement par setup-db.ts

    beforeEach(async () => {
      const timestamp = Date.now()

      // Créer un utilisateur de test
      testUser = await prismaTest.user.create({
        data: {
          email: `lostfound-${timestamp}@example.com`,
          password: await bcrypt.hash('Password123!', 10),
          pseudo: `lostfound-${timestamp}`,
          nom: 'Lost',
          prenom: 'Found',
          isEmailVerified: true,
        },
      })

      // Créer une édition de test
      testEdition = await prismaTest.edition.create({
        data: {
          name: `Edition Lost Found ${timestamp}`,
          startDate: new Date('2024-06-01'),
          endDate: new Date('2024-06-03'),
          convention: {
            create: {
              name: `Convention Lost Found ${timestamp}`,
              authorId: testUser.id,
            },
          },
        },
      })
    })

    describe('LostFoundItem CRUD', () => {
      it('devrait créer un objet trouvé dans la DB', async () => {
        const lostItem = await prismaTest.lostFoundItem.create({
          data: {
            editionId: testEdition.id,
            userId: testUser.id,
            description: 'Jongle ball rouge trouvé près de la scène',
            status: 'LOST',
          },
        })

        expect(lostItem.id).toBeDefined()
        expect(lostItem.description).toBe('Jongle ball rouge trouvé près de la scène')
        expect(lostItem.status).toBe('LOST')
        expect(lostItem.editionId).toBe(testEdition.id)
        expect(lostItem.userId).toBe(testUser.id)

        // Vérifier que l'objet existe dans la DB
        const foundItem = await prismaTest.lostFoundItem.findUnique({
          where: { id: lostItem.id },
          include: {
            user: {
              select: {
                id: true,
                pseudo: true,
              },
            },
          },
        })

        expect(foundItem).toBeDefined()
        expect(foundItem?.user.pseudo).toBe(testUser.pseudo)
      })

      it('devrait récupérer des objets trouvés avec leurs relations', async () => {
        // Créer plusieurs objets
        await prismaTest.lostFoundItem.create({
          data: {
            editionId: testEdition.id,
            userId: testUser.id,
            description: 'Jongle ball rouge',
            status: 'LOST',
          },
        })

        await prismaTest.lostFoundItem.create({
          data: {
            editionId: testEdition.id,
            userId: testUser.id,
            description: 'Diabolo bleu',
            status: 'RETURNED',
          },
        })

        const items = await prismaTest.lostFoundItem.findMany({
          where: { editionId: testEdition.id },
          include: {
            user: {
              select: { id: true, pseudo: true },
            },
          },
        })

        expect(items).toHaveLength(2)
        expect(items[0].user.pseudo).toBe(testUser.pseudo)
        expect(items.some((item) => item.status === 'LOST')).toBe(true)
        expect(items.some((item) => item.status === 'RETURNED')).toBe(true)
      })

      it('devrait mettre à jour le statut dans la DB', async () => {
        const lostItem = await prismaTest.lostFoundItem.create({
          data: {
            editionId: testEdition.id,
            userId: testUser.id,
            description: 'Objet à retourner',
            status: 'LOST',
          },
        })

        expect(lostItem.status).toBe('LOST')

        const updatedItem = await prismaTest.lostFoundItem.update({
          where: { id: lostItem.id },
          data: { status: 'RETURNED' },
        })

        expect(updatedItem.status).toBe('RETURNED')

        // Vérifier dans la DB
        const verifyItem = await prismaTest.lostFoundItem.findUnique({
          where: { id: lostItem.id },
        })

        expect(verifyItem?.status).toBe('RETURNED')
      })
    })

    describe('LostFoundComment CRUD', () => {
      let testLostItem: { id: number }

      beforeEach(async () => {
        testLostItem = await prismaTest.lostFoundItem.create({
          data: {
            editionId: testEdition.id,
            userId: testUser.id,
            description: 'Objet avec commentaires',
            status: 'LOST',
          },
        })
      })

      it('devrait créer un commentaire dans la DB', async () => {
        const comment = await prismaTest.lostFoundComment.create({
          data: {
            lostFoundItemId: testLostItem.id,
            userId: testUser.id,
            content: "Je pense que c'est le mien",
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
        })

        expect(comment.id).toBeDefined()
        expect(comment.content).toBe("Je pense que c'est le mien")
        expect(comment.user.pseudo).toBe(testUser.pseudo)
      })

      it('devrait lister les commentaires par objet', async () => {
        // Créer plusieurs commentaires
        await prismaTest.lostFoundComment.create({
          data: {
            lostFoundItemId: testLostItem.id,
            userId: testUser.id,
            content: 'Premier commentaire',
          },
        })

        await prismaTest.lostFoundComment.create({
          data: {
            lostFoundItemId: testLostItem.id,
            userId: testUser.id,
            content: 'Deuxième commentaire',
          },
        })

        const comments = await prismaTest.lostFoundComment.findMany({
          where: { lostFoundItemId: testLostItem.id },
          include: {
            user: { select: { pseudo: true } },
          },
          orderBy: { createdAt: 'asc' },
        })

        expect(comments).toHaveLength(2)
        expect(comments[0].content).toBe('Premier commentaire')
        expect(comments[1].content).toBe('Deuxième commentaire')
      })
    })

    describe('Opérations complexes avec DB', () => {
      it('devrait récupérer des objets avec commentaires (requête complexe)', async () => {
        const lostItem = await prismaTest.lostFoundItem.create({
          data: {
            editionId: testEdition.id,
            userId: testUser.id,
            description: 'Objet avec commentaires',
            status: 'LOST',
          },
        })

        await prismaTest.lostFoundComment.create({
          data: {
            lostFoundItemId: lostItem.id,
            userId: testUser.id,
            content: 'Commentaire 1',
          },
        })

        const itemsWithComments = await prismaTest.lostFoundItem.findMany({
          where: { editionId: testEdition.id },
          include: {
            user: { select: { pseudo: true } },
            comments: {
              include: {
                user: { select: { pseudo: true } },
              },
            },
          },
        })

        expect(itemsWithComments).toHaveLength(1)
        expect(itemsWithComments[0].comments).toHaveLength(1)
        expect(itemsWithComments[0].comments[0].content).toBe('Commentaire 1')
      })

      it('devrait grouper par utilisateur (agrégation)', async () => {
        // Créer plusieurs objets pour le même utilisateur
        await prismaTest.lostFoundItem.createMany({
          data: [
            {
              editionId: testEdition.id,
              userId: testUser.id,
              description: 'Objet 1',
              status: 'LOST',
            },
            {
              editionId: testEdition.id,
              userId: testUser.id,
              description: 'Objet 2',
              status: 'LOST',
            },
          ],
        })

        const grouped = await prismaTest.lostFoundItem.groupBy({
          by: ['userId'],
          where: { editionId: testEdition.id },
          _count: { id: true },
        })

        expect(grouped).toHaveLength(1)
        expect(grouped[0].userId).toBe(testUser.id)
        expect(grouped[0]._count.id).toBe(2)
      })
    })

    describe('Suppression en cascade', () => {
      it("devrait supprimer les commentaires lors de la suppression de l'objet", async () => {
        const lostItem = await prismaTest.lostFoundItem.create({
          data: {
            editionId: testEdition.id,
            userId: testUser.id,
            description: 'Objet à supprimer',
            status: 'LOST',
          },
        })

        await prismaTest.lostFoundComment.create({
          data: {
            lostFoundItemId: lostItem.id,
            userId: testUser.id,
            content: 'Commentaire à supprimer',
          },
        })

        // Vérifier que le commentaire existe
        const commentsBefore = await prismaTest.lostFoundComment.count({
          where: { lostFoundItemId: lostItem.id },
        })
        expect(commentsBefore).toBe(1)

        // Supprimer l'objet (devrait supprimer les commentaires en cascade)
        await prismaTest.lostFoundItem.delete({
          where: { id: lostItem.id },
        })

        // Vérifier que les commentaires ont été supprimés
        const commentsAfter = await prismaTest.lostFoundComment.count({
          where: { lostFoundItemId: lostItem.id },
        })
        expect(commentsAfter).toBe(0)
      })
    })
  }
)
