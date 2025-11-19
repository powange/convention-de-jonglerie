import { describe, it, expect, vi, beforeEach } from 'vitest'

import handler from '../../../../../../../server/api/editions/[id]/volunteers/applications/status.get'

// Utiliser le mock global de Prisma défini dans test/setup-common.ts
const prismaMock = (globalThis as any).prisma

describe('/api/editions/[id]/volunteers/applications/status GET', () => {
  const mockUser = {
    id: 1,
    email: 'user@example.com',
    pseudo: 'testuser',
    nom: 'Test',
    prenom: 'User',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    global.getRouterParam = vi.fn().mockReturnValue('1')
  })

  describe('Statuts de candidature', () => {
    it('devrait retourner ACCEPTED pour un bénévole accepté', async () => {
      prismaMock.editionVolunteerApplication.findUnique.mockResolvedValue({
        status: 'ACCEPTED',
      } as any)

      const mockEvent = { context: { user: mockUser } }
      const result = await handler(mockEvent as any)

      expect(result).toEqual({ status: 'ACCEPTED' })
      expect(prismaMock.editionVolunteerApplication.findUnique).toHaveBeenCalledWith({
        where: {
          editionId_userId: {
            editionId: 1,
            userId: mockUser.id,
          },
        },
        select: {
          status: true,
        },
      })
    })

    it('devrait retourner PENDING pour une candidature en attente', async () => {
      prismaMock.editionVolunteerApplication.findUnique.mockResolvedValue({
        status: 'PENDING',
      } as any)

      const mockEvent = { context: { user: mockUser } }
      const result = await handler(mockEvent as any)

      expect(result).toEqual({ status: 'PENDING' })
    })

    it('devrait retourner REJECTED pour une candidature refusée', async () => {
      prismaMock.editionVolunteerApplication.findUnique.mockResolvedValue({
        status: 'REJECTED',
      } as any)

      const mockEvent = { context: { user: mockUser } }
      const result = await handler(mockEvent as any)

      expect(result).toEqual({ status: 'REJECTED' })
    })

    it('devrait retourner null si aucune candidature existe', async () => {
      prismaMock.editionVolunteerApplication.findUnique.mockResolvedValue(null)

      const mockEvent = { context: { user: mockUser } }
      const result = await handler(mockEvent as any)

      expect(result).toEqual({ status: null })
    })
  })

  describe('Authentification et sécurité', () => {
    it('devrait échouer si utilisateur non authentifié', async () => {
      const mockEvent = { context: {} }

      await expect(handler(mockEvent as any)).rejects.toThrow()
    })

    it('devrait retourner uniquement le statut de la candidature du user connecté', async () => {
      const otherUser = { id: 2, email: 'other@example.com' }

      prismaMock.editionVolunteerApplication.findUnique.mockResolvedValue({
        status: 'ACCEPTED',
      } as any)

      const mockEvent = { context: { user: mockUser } }
      await handler(mockEvent as any)

      // Vérifier que la requête utilise bien l'ID de l'utilisateur connecté
      expect(prismaMock.editionVolunteerApplication.findUnique).toHaveBeenCalledWith({
        where: {
          editionId_userId: {
            editionId: 1,
            userId: mockUser.id, // Pas otherUser.id
          },
        },
        select: {
          status: true,
        },
      })
    })

    it('ne devrait exposer aucune donnée sensible', async () => {
      // Simuler une candidature avec des données sensibles
      prismaMock.editionVolunteerApplication.findUnique.mockResolvedValue({
        status: 'ACCEPTED',
        motivation: 'Ma motivation privée',
        allergies: 'Allergie au lactose',
        emergencyContactPhone: '+33123456789',
        userId: mockUser.id,
      } as any)

      const mockEvent = { context: { user: mockUser } }
      const result = await handler(mockEvent as any)

      // Seul le statut doit être retourné
      expect(result).toEqual({ status: 'ACCEPTED' })
      expect(result).not.toHaveProperty('motivation')
      expect(result).not.toHaveProperty('allergies')
      expect(result).not.toHaveProperty('emergencyContactPhone')
      expect(result).not.toHaveProperty('userId')
    })
  })

  describe('Validation des paramètres', () => {
    it("devrait échouer si l'ID de l'édition est invalide", async () => {
      global.getRouterParam = vi.fn().mockReturnValue('invalid-id')

      const mockEvent = { context: { user: mockUser } }

      await expect(handler(mockEvent as any)).rejects.toThrow("ID d'édition invalide")
    })

    it("devrait échouer si l'ID de l'édition est 0", async () => {
      global.getRouterParam = vi.fn().mockReturnValue('0')

      const mockEvent = { context: { user: mockUser } }

      await expect(handler(mockEvent as any)).rejects.toThrow("ID d'édition invalide")
    })

    it("devrait échouer si l'ID de l'édition est manquant", async () => {
      global.getRouterParam = vi.fn().mockReturnValue(undefined)

      const mockEvent = { context: { user: mockUser } }

      await expect(handler(mockEvent as any)).rejects.toThrow("ID d'édition invalide")
    })

    it("devrait accepter un ID d'édition valide sous forme de string", async () => {
      global.getRouterParam = vi.fn().mockReturnValue('42')
      prismaMock.editionVolunteerApplication.findUnique.mockResolvedValue({
        status: 'ACCEPTED',
      } as any)

      const mockEvent = { context: { user: mockUser } }
      const result = await handler(mockEvent as any)

      expect(result).toEqual({ status: 'ACCEPTED' })
      expect(prismaMock.editionVolunteerApplication.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            editionId_userId: {
              editionId: 42,
              userId: mockUser.id,
            },
          },
        })
      )
    })
  })

  describe('Performance et optimisation', () => {
    it('devrait utiliser select pour ne récupérer que le statut', async () => {
      prismaMock.editionVolunteerApplication.findUnique.mockResolvedValue({
        status: 'ACCEPTED',
      } as any)

      const mockEvent = { context: { user: mockUser } }
      await handler(mockEvent as any)

      expect(prismaMock.editionVolunteerApplication.findUnique).toHaveBeenCalledWith({
        where: {
          editionId_userId: {
            editionId: 1,
            userId: mockUser.id,
          },
        },
        select: {
          status: true,
        },
      })
    })

    it('devrait faire une seule requête à la base de données', async () => {
      prismaMock.editionVolunteerApplication.findUnique.mockResolvedValue({
        status: 'ACCEPTED',
      } as any)

      const mockEvent = { context: { user: mockUser } }
      await handler(mockEvent as any)

      expect(prismaMock.editionVolunteerApplication.findUnique).toHaveBeenCalledTimes(1)
    })
  })

  describe('Gestion des erreurs', () => {
    it('devrait gérer les erreurs de base de données', async () => {
      prismaMock.editionVolunteerApplication.findUnique.mockRejectedValue(
        new Error('Database connection failed')
      )

      const mockEvent = { context: { user: mockUser } }

      await expect(handler(mockEvent as any)).rejects.toThrow('Erreur serveur interne')
    })

    it('devrait gérer les timeouts de base de données', async () => {
      prismaMock.editionVolunteerApplication.findUnique.mockRejectedValue(
        new Error('Query timeout')
      )

      const mockEvent = { context: { user: mockUser } }

      await expect(handler(mockEvent as any)).rejects.toThrow('Erreur serveur interne')
    })
  })

  describe("Cas d'usage réels", () => {
    it("devrait permettre de vérifier l'accès à l'onglet bénévoles", async () => {
      // Cas d'usage: Header.vue vérifie si l'utilisateur peut voir l'onglet bénévoles
      prismaMock.editionVolunteerApplication.findUnique.mockResolvedValue({
        status: 'ACCEPTED',
      } as any)

      const mockEvent = { context: { user: mockUser } }
      const result = await handler(mockEvent as any)

      // L'onglet bénévoles devrait être visible
      const shouldShowVolunteersTab = result.status === 'ACCEPTED'
      expect(shouldShowVolunteersTab).toBe(true)
    })

    it("ne devrait pas montrer l'onglet bénévoles pour une candidature en attente", async () => {
      prismaMock.editionVolunteerApplication.findUnique.mockResolvedValue({
        status: 'PENDING',
      } as any)

      const mockEvent = { context: { user: mockUser } }
      const result = await handler(mockEvent as any)

      const shouldShowVolunteersTab = result.status === 'ACCEPTED'
      expect(shouldShowVolunteersTab).toBe(false)
    })

    it("ne devrait pas montrer l'onglet bénévoles pour un utilisateur sans candidature", async () => {
      prismaMock.editionVolunteerApplication.findUnique.mockResolvedValue(null)

      const mockEvent = { context: { user: mockUser } }
      const result = await handler(mockEvent as any)

      const shouldShowVolunteersTab = result.status === 'ACCEPTED'
      expect(shouldShowVolunteersTab).toBe(false)
    })

    it('devrait fonctionner pour plusieurs éditions différentes', async () => {
      // Edition 1: ACCEPTED
      global.getRouterParam = vi.fn().mockReturnValue('1')
      prismaMock.editionVolunteerApplication.findUnique.mockResolvedValue({
        status: 'ACCEPTED',
      } as any)

      const mockEvent = { context: { user: mockUser } }
      let result = await handler(mockEvent as any)
      expect(result.status).toBe('ACCEPTED')

      // Edition 2: PENDING
      global.getRouterParam = vi.fn().mockReturnValue('2')
      prismaMock.editionVolunteerApplication.findUnique.mockResolvedValue({
        status: 'PENDING',
      } as any)

      result = await handler(mockEvent as any)
      expect(result.status).toBe('PENDING')

      // Edition 3: pas de candidature
      global.getRouterParam = vi.fn().mockReturnValue('3')
      prismaMock.editionVolunteerApplication.findUnique.mockResolvedValue(null)

      result = await handler(mockEvent as any)
      expect(result.status).toBeNull()
    })
  })
})
