import bcrypt from 'bcryptjs'
import { describe, it, expect, beforeEach } from 'vitest'

import { prismaTest } from '../setup-db'

// Ce fichier ne s'exécute que si TEST_WITH_DB=true
describe.skipIf(!process.env.TEST_WITH_DB)("Tests d'intégration Conventions avec DB", () => {
  let testUser: { id: number; email: string; pseudo: string }
  let adminUser: { id: number; email: string; pseudo: string }

  // Le nettoyage est géré globalement par setup-db.ts

  beforeEach(async () => {
    const timestamp = Date.now()

    // Créer des utilisateurs de test avec IDs uniques
    testUser = await prismaTest.user.create({
      data: {
        email: `test-creator-${timestamp}@example.com`,
        password: await bcrypt.hash('Password123!', 10),
        pseudo: `testcreator-${timestamp}`,
        nom: 'Test',
        prenom: 'Creator',
        isEmailVerified: true,
      },
    })

    adminUser = await prismaTest.user.create({
      data: {
        email: `admin-${timestamp}@example.com`,
        password: await bcrypt.hash('Password123!', 10),
        pseudo: `admin-${timestamp}`,
        nom: 'Admin',
        prenom: 'User',
        isEmailVerified: true,
      },
    })
  })

  describe('Création de convention', () => {
    it("devrait créer une convention et ajouter l'auteur comme administrateur", async () => {
      // Créer une convention
      const convention = await prismaTest.convention.create({
        data: {
          name: 'Convention de Test DB',
          description: "Une convention créée dans les tests d'intégration",
          authorId: testUser.id,
        },
      })

      expect(convention).toBeDefined()
      expect(convention.name).toBe('Convention de Test DB')
      expect(convention.authorId).toBe(testUser.id)

      // Ajouter le créateur comme collaborateur administrateur
      const collaborator = await prismaTest.conventionCollaborator.create({
        data: {
          conventionId: convention.id,
          userId: testUser.id,
          // Plus d'attribut role: on simule un administrateur via booléens
          canEditConvention: true,
          canDeleteConvention: true,
          canManageCollaborators: true,
          canAddEdition: true,
          canEditAllEditions: true,
          canDeleteAllEditions: true,
          addedById: testUser.id,
        },
      })

      expect(collaborator.canManageCollaborators).toBe(true)
      expect(collaborator.canDeleteConvention).toBe(true)
      expect(collaborator.userId).toBe(testUser.id)
    })

    it('devrait permettre plusieurs conventions avec des noms différents', async () => {
      // Créer plusieurs conventions pour le même auteur
      const convention1 = await prismaTest.convention.create({
        data: {
          name: 'Convention Première',
          description: 'Première convention',
          authorId: testUser.id,
        },
      })

      const convention2 = await prismaTest.convention.create({
        data: {
          name: 'Convention Seconde',
          description: 'Seconde convention',
          authorId: testUser.id,
        },
      })

      expect(convention1.name).toBe('Convention Première')
      expect(convention2.name).toBe('Convention Seconde')
      expect(convention1.authorId).toBe(testUser.id)
      expect(convention2.authorId).toBe(testUser.id)
    })

    it('devrait permettre le même nom pour des auteurs différents', async () => {
      // Convention pour le premier utilisateur
      const convention1 = await prismaTest.convention.create({
        data: {
          name: 'Convention Partagée',
          description: 'Convention du premier utilisateur',
          authorId: testUser.id,
        },
      })

      // Convention avec le même nom pour le second utilisateur
      const convention2 = await prismaTest.convention.create({
        data: {
          name: 'Convention Partagée',
          description: 'Convention du second utilisateur',
          authorId: adminUser.id,
        },
      })

      expect(convention1.name).toBe(convention2.name)
      expect(convention1.authorId).not.toBe(convention2.authorId)
    })
  })

  describe('Gestion des collaborateurs', () => {
    let testConvention: { id: number; name: string }

    beforeEach(async () => {
      testConvention = await prismaTest.convention.create({
        data: {
          name: 'Convention Collaborateurs',
          description: 'Pour tester les collaborateurs',
          authorId: testUser.id,
        },
      })

      // Ajouter l'auteur comme administrateur
      await prismaTest.conventionCollaborator.create({
        data: {
          conventionId: testConvention.id,
          userId: testUser.id,
          canEditConvention: true,
          canDeleteConvention: true,
          canManageCollaborators: true,
          canAddEdition: true,
          canEditAllEditions: true,
          canDeleteAllEditions: true,
          addedById: testUser.id,
        },
      })
    })

    it('devrait ajouter un collaborateur avec différents rôles', async () => {
      // Ajouter un collaborateur MODERATOR
      const moderator = await prismaTest.conventionCollaborator.create({
        data: {
          conventionId: testConvention.id,
          userId: adminUser.id,
          canAddEdition: true,
          canEditAllEditions: true,
          addedById: testUser.id,
        },
      })

      expect(moderator.canAddEdition).toBe(true)
      expect(moderator.canEditAllEditions).toBe(true)
      expect(moderator.userId).toBe(adminUser.id)
      expect(moderator.addedById).toBe(testUser.id)

      // Vérifier que les collaborateurs sont bien enregistrés
      const collaborators = await prismaTest.conventionCollaborator.findMany({
        where: { conventionId: testConvention.id },
        include: {
          user: {
            select: {
              id: true,
              pseudo: true,
              email: true,
            },
          },
        },
      })

      expect(collaborators).toHaveLength(2) // Auteur + collaborateur
      expect(collaborators.some((c) => c.role === 'ADMINISTRATOR')).toBeTruthy()
      expect(collaborators.some((c) => c.role === 'MODERATOR')).toBeTruthy()
    })

    it('devrait empêcher les collaborateurs en double', async () => {
      // Ajouter le collaborateur une première fois
      await prismaTest.conventionCollaborator.create({
        data: {
          conventionId: testConvention.id,
          userId: adminUser.id,
          canAddEdition: true,
          canEditAllEditions: true,
          addedById: testUser.id,
        },
      })

      // Tenter de l'ajouter à nouveau
      await expect(
        prismaTest.conventionCollaborator.create({
          data: {
            conventionId: testConvention.id,
            userId: adminUser.id,
            role: 'ADMINISTRATOR',
            addedById: testUser.id,
          },
        })
      ).rejects.toThrow()
    })

    it("devrait mettre à jour le rôle d'un collaborateur", async () => {
      // Ajouter un collaborateur MODERATOR
      const collaborator = await prismaTest.conventionCollaborator.create({
        data: {
          conventionId: testConvention.id,
          userId: adminUser.id,
          canAddEdition: true,
          canEditAllEditions: true,
          addedById: testUser.id,
        },
      })

      // "Promotion" = activer tous les droits restants
      const updatedCollaborator = await prismaTest.conventionCollaborator.update({
        where: { id: collaborator.id },
        data: {
          canEditConvention: true,
          canDeleteConvention: true,
          canManageCollaborators: true,
          canDeleteAllEditions: true,
        },
      })

      expect(updatedCollaborator.canManageCollaborators).toBe(true)
      expect(updatedCollaborator.canDeleteConvention).toBe(true)
      expect(updatedCollaborator.userId).toBe(adminUser.id)
    })
  })

  describe('Requêtes complexes', () => {
    it('devrait récupérer une convention avec tous ses collaborateurs', async () => {
      // Créer une convention
      const convention = await prismaTest.convention.create({
        data: {
          name: 'Convention Complète',
          description: 'Convention avec collaborateurs',
          authorId: testUser.id,
        },
      })

      // Ajouter plusieurs collaborateurs
      await prismaTest.conventionCollaborator.createMany({
        data: [
          {
            conventionId: convention.id,
            userId: testUser.id,
            canEditConvention: true,
            canDeleteConvention: true,
            canManageCollaborators: true,
            canAddEdition: true,
            canEditAllEditions: true,
            canDeleteAllEditions: true,
            addedById: testUser.id,
          },
          {
            conventionId: convention.id,
            userId: adminUser.id,
            canAddEdition: true,
            canEditAllEditions: true,
            addedById: testUser.id,
          },
        ],
      })

      // Récupérer la convention avec toutes ses relations
      const fullConvention = await prismaTest.convention.findUnique({
        where: { id: convention.id },
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
                  email: true,
                },
              },
              addedBy: {
                select: {
                  id: true,
                  pseudo: true,
                },
              },
            },
          },
        },
      })

      expect(fullConvention).toBeDefined()
      expect(fullConvention!.author.pseudo).toContain('testcreator')
      expect(fullConvention!.collaborators).toHaveLength(2)
      // Vérifier un collaborateur "admin" (tous les droits)
      expect(
        fullConvention!.collaborators.some(
          (c) =>
            c.canManageCollaborators &&
            c.canDeleteConvention &&
            c.canEditConvention &&
            c.canAddEdition &&
            c.canEditAllEditions &&
            c.canDeleteAllEditions
        )
      ).toBeTruthy()
      // Vérifier un collaborateur "modérateur" (droits partiels)
      expect(
        fullConvention!.collaborators.some(
          (c) => c.canAddEdition && c.canEditAllEditions && !c.canManageCollaborators
        )
      ).toBeTruthy()
    })

    it('devrait compter les conventions par utilisateur', async () => {
      // Créer plusieurs conventions pour testUser
      await prismaTest.convention.createMany({
        data: [
          {
            name: 'Convention 1',
            description: 'Première convention',
            authorId: testUser.id,
          },
          {
            name: 'Convention 2',
            description: 'Deuxième convention',
            authorId: testUser.id,
          },
        ],
      })

      // Créer une convention pour adminUser
      await prismaTest.convention.create({
        data: {
          name: 'Convention Admin',
          description: "Convention de l'admin",
          authorId: adminUser.id,
        },
      })

      // Compter les conventions par auteur
      const testUserConventions = await prismaTest.convention.count({
        where: { authorId: testUser.id },
      })

      const adminUserConventions = await prismaTest.convention.count({
        where: { authorId: adminUser.id },
      })

      expect(testUserConventions).toBe(2)
      expect(adminUserConventions).toBe(1)
    })
  })

  describe('Suppression en cascade', () => {
    it("devrait supprimer les collaborateurs lors de la suppression d'une convention", async () => {
      // Créer une convention avec collaborateur
      const convention = await prismaTest.convention.create({
        data: {
          name: 'Convention à Supprimer',
          description: 'Pour tester la suppression',
          authorId: testUser.id,
        },
      })

      await prismaTest.conventionCollaborator.create({
        data: {
          conventionId: convention.id,
          userId: adminUser.id,
          canAddEdition: true,
          canEditAllEditions: true,
          addedById: testUser.id,
        },
      })

      // Vérifier que le collaborateur existe
      const collaboratorsBefore = await prismaTest.conventionCollaborator.count({
        where: { conventionId: convention.id },
      })
      expect(collaboratorsBefore).toBe(1)

      // Supprimer la convention
      await prismaTest.convention.delete({
        where: { id: convention.id },
      })

      // Vérifier que les collaborateurs ont été supprimés automatiquement
      const collaboratorsAfter = await prismaTest.conventionCollaborator.count({
        where: { conventionId: convention.id },
      })
      expect(collaboratorsAfter).toBe(0)
    })
  })
})
