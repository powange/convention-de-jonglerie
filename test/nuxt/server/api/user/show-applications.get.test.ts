import { describe, it, expect, vi, beforeEach } from 'vitest'

import handler from '../../../../../server/api/user/show-applications.get'

// Utiliser le mock global de Prisma défini dans test/setup-common.ts
const prismaMock = (globalThis as any).prisma

vi.mock('../../../../../server/utils/auth-utils', () => ({
  requireAuth: vi.fn((event: any) => {
    if (!event.context.user) {
      const error = new Error('Non authentifié')
      ;(error as any).statusCode = 401
      throw error
    }
    return event.context.user
  }),
}))

describe('/api/user/show-applications GET', () => {
  const mockUser = {
    id: 1,
    email: 'artist@example.com',
    pseudo: 'artistuser',
    isGlobalAdmin: false,
  }

  const mockConvention = {
    id: 1,
    name: 'Convention de Jonglerie',
    logo: 'https://example.com/logo.png',
  }

  const mockEdition = {
    id: 1,
    name: 'Édition 2025',
    startDate: new Date('2025-07-01'),
    endDate: new Date('2025-07-05'),
    city: 'Paris',
    country: 'France',
    imageUrl: 'https://example.com/edition.jpg',
    convention: mockConvention,
  }

  const mockShowCall = {
    id: 1,
    name: 'Appel à spectacles principal',
    isOpen: true,
    deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    edition: mockEdition,
  }

  const mockApplication = {
    id: 1,
    status: 'PENDING',
    artistName: 'John Doe',
    showTitle: 'Mon super spectacle',
    showDescription: 'Description du spectacle',
    showDuration: 30,
    showCategory: 'JONGLERIE',
    additionalPerformersCount: 2,
    createdAt: new Date('2025-01-15'),
    updatedAt: new Date('2025-01-15'),
    organizerNotes: null,
    decidedAt: null,
    showCall: mockShowCall,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Authentification', () => {
    it("devrait rejeter avec 401 si l'utilisateur n'est pas authentifié", async () => {
      const mockEvent = { context: {} }

      await expect(handler(mockEvent as any)).rejects.toThrow('Non authentifié')

      expect(prismaMock.showApplication.findMany).not.toHaveBeenCalled()
    })

    it('devrait retourner les candidatures pour un utilisateur authentifié', async () => {
      const mockEvent = { context: { user: mockUser } }

      prismaMock.showApplication.findMany.mockResolvedValue([mockApplication])

      const result = await handler(mockEvent as any)

      expect(result).toHaveLength(1)
    })
  })

  describe('Filtrage par utilisateur', () => {
    it("devrait filtrer les candidatures par l'ID de l'utilisateur", async () => {
      const mockEvent = { context: { user: mockUser } }

      prismaMock.showApplication.findMany.mockResolvedValue([])

      await handler(mockEvent as any)

      expect(prismaMock.showApplication.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: mockUser.id },
        })
      )
    })

    it("devrait retourner uniquement les candidatures de l'utilisateur", async () => {
      const anotherUser = { ...mockUser, id: 2 }
      const mockEvent = { context: { user: anotherUser } }

      prismaMock.showApplication.findMany.mockResolvedValue([])

      await handler(mockEvent as any)

      expect(prismaMock.showApplication.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 2 },
        })
      )
    })
  })

  describe('Données retournées', () => {
    it('devrait retourner les informations de la candidature', async () => {
      const mockEvent = { context: { user: mockUser } }

      prismaMock.showApplication.findMany.mockResolvedValue([mockApplication])

      const result = await handler(mockEvent as any)

      expect(result[0]).toMatchObject({
        id: mockApplication.id,
        status: mockApplication.status,
        artistName: mockApplication.artistName,
        showTitle: mockApplication.showTitle,
        showDescription: mockApplication.showDescription,
        showDuration: mockApplication.showDuration,
        showCategory: mockApplication.showCategory,
        additionalPerformersCount: mockApplication.additionalPerformersCount,
      })
    })

    it("devrait inclure les informations de l'appel à spectacles", async () => {
      const mockEvent = { context: { user: mockUser } }

      prismaMock.showApplication.findMany.mockResolvedValue([mockApplication])

      const result = await handler(mockEvent as any)

      expect(result[0].showCall).toMatchObject({
        id: mockShowCall.id,
        name: mockShowCall.name,
        isOpen: mockShowCall.isOpen,
        deadline: mockShowCall.deadline,
      })
    })

    it("devrait inclure les informations de l'édition", async () => {
      const mockEvent = { context: { user: mockUser } }

      prismaMock.showApplication.findMany.mockResolvedValue([mockApplication])

      const result = await handler(mockEvent as any)

      expect(result[0].showCall.edition).toMatchObject({
        id: mockEdition.id,
        name: mockEdition.name,
        city: mockEdition.city,
        country: mockEdition.country,
      })
    })

    it('devrait inclure les informations de la convention', async () => {
      const mockEvent = { context: { user: mockUser } }

      prismaMock.showApplication.findMany.mockResolvedValue([mockApplication])

      const result = await handler(mockEvent as any)

      expect(result[0].showCall.edition.convention).toMatchObject({
        id: mockConvention.id,
        name: mockConvention.name,
        logo: mockConvention.logo,
      })
    })

    it('devrait inclure les notes organisateur si définies', async () => {
      const applicationWithNotes = {
        ...mockApplication,
        organizerNotes: 'Votre spectacle est intéressant',
        status: 'ACCEPTED',
        decidedAt: new Date('2025-01-20'),
      }
      const mockEvent = { context: { user: mockUser } }

      prismaMock.showApplication.findMany.mockResolvedValue([applicationWithNotes])

      const result = await handler(mockEvent as any)

      expect(result[0].organizerNotes).toBe('Votre spectacle est intéressant')
      expect(result[0].decidedAt).toBeDefined()
    })
  })

  describe('Statuts des candidatures', () => {
    it('devrait retourner les candidatures en attente', async () => {
      const pendingApplication = { ...mockApplication, status: 'PENDING' }
      const mockEvent = { context: { user: mockUser } }

      prismaMock.showApplication.findMany.mockResolvedValue([pendingApplication])

      const result = await handler(mockEvent as any)

      expect(result[0].status).toBe('PENDING')
    })

    it('devrait retourner les candidatures acceptées', async () => {
      const acceptedApplication = {
        ...mockApplication,
        status: 'ACCEPTED',
        decidedAt: new Date('2025-01-20'),
      }
      const mockEvent = { context: { user: mockUser } }

      prismaMock.showApplication.findMany.mockResolvedValue([acceptedApplication])

      const result = await handler(mockEvent as any)

      expect(result[0].status).toBe('ACCEPTED')
    })

    it('devrait retourner les candidatures refusées', async () => {
      const rejectedApplication = {
        ...mockApplication,
        status: 'REJECTED',
        organizerNotes: 'Programme complet',
        decidedAt: new Date('2025-01-20'),
      }
      const mockEvent = { context: { user: mockUser } }

      prismaMock.showApplication.findMany.mockResolvedValue([rejectedApplication])

      const result = await handler(mockEvent as any)

      expect(result[0].status).toBe('REJECTED')
      expect(result[0].organizerNotes).toBe('Programme complet')
    })
  })

  describe('Tri des résultats', () => {
    it('devrait trier par date de création décroissante', async () => {
      const mockEvent = { context: { user: mockUser } }

      prismaMock.showApplication.findMany.mockResolvedValue([])

      await handler(mockEvent as any)

      expect(prismaMock.showApplication.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' },
        })
      )
    })
  })

  describe('Plusieurs candidatures', () => {
    it('devrait retourner plusieurs candidatures', async () => {
      const application2 = {
        ...mockApplication,
        id: 2,
        showTitle: 'Deuxième spectacle',
        showCall: {
          ...mockShowCall,
          id: 2,
          name: 'Autre appel',
        },
      }
      const mockEvent = { context: { user: mockUser } }

      prismaMock.showApplication.findMany.mockResolvedValue([mockApplication, application2])

      const result = await handler(mockEvent as any)

      expect(result).toHaveLength(2)
    })

    it('devrait retourner un tableau vide si aucune candidature', async () => {
      const mockEvent = { context: { user: mockUser } }

      prismaMock.showApplication.findMany.mockResolvedValue([])

      const result = await handler(mockEvent as any)

      expect(result).toHaveLength(0)
    })
  })

  describe('Gestion des erreurs', () => {
    it('devrait gérer les erreurs de base de données', async () => {
      const mockEvent = { context: { user: mockUser } }

      prismaMock.showApplication.findMany.mockRejectedValue(new Error('Database error'))

      await expect(handler(mockEvent as any)).rejects.toThrow()
    })
  })
})
