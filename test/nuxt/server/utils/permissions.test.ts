import { describe, it, expect, vi, beforeEach } from 'vitest'

import {
  hasEditionEditPermission,
  hasEditionDeletePermission,
} from '../../../../server/utils/permissions/permissions'

// Utiliser le mock global de Prisma défini dans test/setup-common.ts
const mockPrisma = (globalThis as any).prisma

describe('Permissions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('hasEditionEditPermission', () => {
    const userId = 1
    const editionId = 100

    it("devrait retourner true si l'utilisateur est admin global", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        isGlobalAdmin: true,
      })

      const result = await hasEditionEditPermission(userId, editionId)

      expect(result).toBe(true)
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: userId },
        select: { isGlobalAdmin: true },
      })
      // Ne devrait pas vérifier l'édition si admin global
      expect(mockPrisma.edition.findUnique).not.toHaveBeenCalled()
    })

    it("devrait retourner true si l'utilisateur est le créateur de l'édition", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        isGlobalAdmin: false,
      })

      mockPrisma.edition.findUnique.mockResolvedValue({
        id: editionId,
        creatorId: userId, // L'utilisateur est le créateur
        convention: {
          authorId: 999,
          organizers: [],
        },
      })

      const result = await hasEditionEditPermission(userId, editionId)

      expect(result).toBe(true)
      expect(mockPrisma.edition.findUnique).toHaveBeenCalledWith({
        where: { id: editionId },
        include: {
          convention: {
            include: {
              organizers: true,
            },
          },
        },
      })
    })

    it("devrait retourner true si l'utilisateur est l'auteur de la convention", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        isGlobalAdmin: false,
      })

      mockPrisma.edition.findUnique.mockResolvedValue({
        id: editionId,
        creatorId: 999,
        convention: {
          authorId: userId, // L'utilisateur est l'auteur de la convention
          organizers: [],
        },
      })

      const result = await hasEditionEditPermission(userId, editionId)

      expect(result).toBe(true)
    })

    it("devrait retourner true si l'utilisateur est un organisateur", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        isGlobalAdmin: false,
      })

      mockPrisma.edition.findUnique.mockResolvedValue({
        id: editionId,
        creatorId: 999,
        convention: {
          authorId: 888,
          organizers: [
            { userId: 777, role: 'MODERATOR' },
            { userId: userId, role: 'ADMINISTRATOR' }, // L'utilisateur est organisateur
            { userId: 666, role: 'MODERATOR' },
          ],
        },
      })

      const result = await hasEditionEditPermission(userId, editionId)

      expect(result).toBe(true)
    })

    it("devrait retourner false si l'utilisateur n'a aucune permission", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        isGlobalAdmin: false,
      })

      mockPrisma.edition.findUnique.mockResolvedValue({
        id: editionId,
        creatorId: 999,
        convention: {
          authorId: 888,
          organizers: [
            { userId: 777, role: 'MODERATOR' },
            { userId: 666, role: 'ADMINISTRATOR' },
          ],
        },
      })

      const result = await hasEditionEditPermission(userId, editionId)

      expect(result).toBe(false)
    })

    it("devrait retourner false si l'édition n'existe pas", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        isGlobalAdmin: false,
      })

      mockPrisma.edition.findUnique.mockResolvedValue(null)

      const result = await hasEditionEditPermission(userId, editionId)

      expect(result).toBe(false)
    })

    it("devrait continuer à vérifier les permissions même si l'utilisateur n'existe pas", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null)

      // Si l'utilisateur n'existe pas mais qu'il est créateur de l'édition, la fonction retourne true
      // (ce qui peut être un cas limite dans les données)
      mockPrisma.edition.findUnique.mockResolvedValue({
        id: editionId,
        creatorId: userId,
        convention: {
          authorId: 888,
          organizers: [],
        },
      })

      const result = await hasEditionEditPermission(userId, editionId)

      expect(result).toBe(true) // Car creatorId === userId
    })

    it('devrait gérer les cas avec des organisateurs vides', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        isGlobalAdmin: false,
      })

      mockPrisma.edition.findUnique.mockResolvedValue({
        id: editionId,
        creatorId: 999,
        convention: {
          authorId: 888,
          organizers: [], // Pas de organisateurs
        },
      })

      const result = await hasEditionEditPermission(userId, editionId)

      expect(result).toBe(false)
    })

    it("devrait vérifier toutes les conditions dans l'ordre", async () => {
      const testUser = 2

      mockPrisma.user.findUnique.mockResolvedValue({
        isGlobalAdmin: false,
      })

      mockPrisma.edition.findUnique.mockResolvedValue({
        id: editionId,
        creatorId: testUser, // L'utilisateur est créateur
        convention: {
          authorId: testUser, // ET auteur
          organizers: [
            { userId: testUser, role: 'ADMINISTRATOR' }, // ET organisateur
          ],
        },
      })

      const result = await hasEditionEditPermission(testUser, editionId)

      // Devrait retourner true dès la première condition remplie (créateur)
      expect(result).toBe(true)
    })

    it('devrait gérer les erreurs de base de données', async () => {
      mockPrisma.user.findUnique.mockRejectedValue(new Error('DB Error'))

      await expect(hasEditionEditPermission(userId, editionId)).rejects.toThrow('DB Error')
    })
  })

  describe('hasEditionDeletePermission', () => {
    it('devrait utiliser les mêmes permissions que hasEditionEditPermission', async () => {
      const userId = 1
      const editionId = 100

      // Test avec admin global
      mockPrisma.user.findUnique.mockResolvedValue({
        isGlobalAdmin: true,
      })

      const deleteResult = await hasEditionDeletePermission(userId, editionId)
      const editResult = await hasEditionEditPermission(userId, editionId)

      expect(deleteResult).toBe(editResult)
      expect(deleteResult).toBe(true)
    })

    it('devrait retourner false pour un utilisateur sans permissions', async () => {
      const userId = 1
      const editionId = 100

      mockPrisma.user.findUnique.mockResolvedValue({
        isGlobalAdmin: false,
      })

      mockPrisma.edition.findUnique.mockResolvedValue({
        id: editionId,
        creatorId: 999,
        convention: {
          authorId: 888,
          organizers: [],
        },
      })

      const result = await hasEditionDeletePermission(userId, editionId)

      expect(result).toBe(false)
    })

    it("devrait retourner true pour le créateur de l'édition", async () => {
      const userId = 1
      const editionId = 100

      mockPrisma.user.findUnique.mockResolvedValue({
        isGlobalAdmin: false,
      })

      mockPrisma.edition.findUnique.mockResolvedValue({
        id: editionId,
        creatorId: userId,
        convention: {
          authorId: 999,
          organizers: [],
        },
      })

      const result = await hasEditionDeletePermission(userId, editionId)

      expect(result).toBe(true)
    })
  })

  describe('Intégration des permissions', () => {
    it('devrait vérifier correctement les permissions multiples', async () => {
      const scenarios = [
        {
          name: 'Admin global',
          user: { isGlobalAdmin: true },
          edition: null,
          expected: true,
        },
        {
          name: "Créateur de l'édition",
          user: { isGlobalAdmin: false },
          edition: {
            creatorId: 1,
            convention: { authorId: 999, organizers: [] },
          },
          expected: true,
        },
        {
          name: 'Auteur de la convention',
          user: { isGlobalAdmin: false },
          edition: {
            creatorId: 999,
            convention: { authorId: 1, organizers: [] },
          },
          expected: true,
        },
        {
          name: 'Organisateur',
          user: { isGlobalAdmin: false },
          edition: {
            creatorId: 999,
            convention: {
              authorId: 888,
              organizers: [{ userId: 1, role: 'MODERATOR' }],
            },
          },
          expected: true,
        },
        {
          name: 'Sans permissions',
          user: { isGlobalAdmin: false },
          edition: {
            creatorId: 999,
            convention: { authorId: 888, organizers: [] },
          },
          expected: false,
        },
      ]

      for (const scenario of scenarios) {
        mockPrisma.user.findUnique.mockResolvedValue(scenario.user)
        mockPrisma.edition.findUnique.mockResolvedValue(scenario.edition)

        const result = await hasEditionEditPermission(1, 100)
        expect(result).toBe(scenario.expected)
      }
    })
  })
})
