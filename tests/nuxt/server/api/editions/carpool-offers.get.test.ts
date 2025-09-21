import { describe, it, expect, vi, beforeEach } from 'vitest'

// Import du handler après les mocks
// Import des mocks
import { getEmailHash } from '../../../../../server/utils/email-hash'
import { prisma } from '../../../../../server/utils/prisma'
import handler from '../../../../server/api/editions/[id]/carpool-offers.get'

// Mock des utilitaires
vi.mock('../../../../server/utils/email-hash', () => ({
  getEmailHash: vi.fn(),
}))

vi.mock('../../../../server/utils/prisma', () => ({
  prisma: {
    carpoolOffer: {
      findMany: vi.fn(),
    },
  },
}))

// Mock des fonctions Nuxt
vi.mock('#imports', () => ({
  createError: vi.fn(),
  defineEventHandler: vi.fn(),
}))

// Cast des mocks
const createError = global.createError as ReturnType<typeof vi.fn>
const defineEventHandler = global.defineEventHandler as ReturnType<typeof vi.fn>
const mockGetEmailHash = getEmailHash as ReturnType<typeof vi.fn>
const mockPrisma = prisma as { carpoolOffer: { findMany: ReturnType<typeof vi.fn> } }
const mockCreateError = createError as ReturnType<typeof vi.fn>
const mockDefineEventHandler = defineEventHandler as ReturnType<typeof vi.fn>

describe.skip('GET /api/editions/[id]/carpool-offers', () => {
  const mockEvent = {
    context: {
      params: {
        id: '1',
      },
    },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockDefineEventHandler.mockImplementation((fn) => fn)
    mockGetEmailHash.mockReturnValue('test-hash')
    mockCreateError.mockImplementation(({ statusCode, statusMessage }) => {
      const error = new Error(statusMessage)
      error.statusCode = statusCode
      throw error
    })
  })

  it('devrait récupérer les offres de covoiturage avec succès', async () => {
    const mockOffers = [
      {
        id: 1,
        editionId: 1,
        tripDate: new Date('2024-06-15T10:00:00Z'),
        locationCity: 'Paris',
        locationAddress: '123 rue de la Paix',
        availableSeats: 3,
        description: 'Covoiturage vers convention',
        user: {
          id: 1,
          email: 'user@test.com',
          pseudo: 'testuser',
          profilePicture: null,
          updatedAt: new Date(),
        },
        passengers: [
          {
            id: 1,
            addedAt: new Date(),
            user: {
              id: 2,
              email: 'passenger@test.com',
              pseudo: 'passenger1',
              profilePicture: null,
              updatedAt: new Date(),
            },
          },
        ],
        comments: [
          {
            id: 1,
            content: 'Intéressé !',
            createdAt: new Date(),
            user: {
              id: 3,
              email: 'commenter@test.com',
              pseudo: 'commenter',
              profilePicture: null,
              updatedAt: new Date(),
            },
          },
        ],
      },
    ]

    mockPrisma.carpoolOffer.findMany.mockResolvedValue(mockOffers)

    const result = await handler(mockEvent)

    expect(mockPrisma.carpoolOffer.findMany).toHaveBeenCalledWith({
      where: { editionId: 1 },
      include: {
        user: true,
        passengers: {
          include: { user: true },
          orderBy: { addedAt: 'asc' },
        },
        comments: {
          include: { user: true },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { tripDate: 'asc' },
    })

    expect(result).toHaveLength(1)
    expect(result[0].user.emailHash).toBe('test-hash')
    expect(result[0].user).not.toHaveProperty('email') // Email doit être masqué
    expect(result[0].passengers[0].user.emailHash).toBe('test-hash')
    expect(result[0].comments[0].user.emailHash).toBe('test-hash')
  })

  it("devrait échouer avec ID d'édition invalide", async () => {
    const eventWithInvalidId = {
      context: {
        params: {
          id: 'invalid',
        },
      },
    }

    await expect(handler(eventWithInvalidId)).rejects.toThrow('Edition ID invalide')
  })

  it("devrait échouer sans ID d'édition", async () => {
    const eventWithoutId = {
      context: {
        params: {},
      },
    }

    mockCreateError.mockImplementation(({ statusCode, statusMessage }) => {
      const error = new Error(statusMessage)
      error.statusCode = statusCode
      throw error
    })

    await expect(handler(eventWithoutId)).rejects.toThrow('Edition ID invalide')
  })

  it('devrait gérer les erreurs de base de données', async () => {
    mockPrisma.carpoolOffer.findMany.mockRejectedValue(new Error('DB Error'))

    await expect(handler(mockEvent)).rejects.toThrow('Erreur serveur')
  })

  it('devrait retourner un tableau vide si aucune offre', async () => {
    mockPrisma.carpoolOffer.findMany.mockResolvedValue([])

    const result = await handler(mockEvent)

    expect(result).toEqual([])
  })

  it('devrait trier par date de départ croissante', async () => {
    const mockOffers = [
      {
        id: 1,
        tripDate: new Date('2024-06-20T10:00:00Z'),
        user: { id: 1, email: 'user1@test.com', pseudo: 'user1' },
        passengers: [],
        comments: [],
      },
      {
        id: 2,
        tripDate: new Date('2024-06-15T10:00:00Z'),
        user: { id: 2, email: 'user2@test.com', pseudo: 'user2' },
        passengers: [],
        comments: [],
      },
    ]

    mockPrisma.carpoolOffer.findMany.mockResolvedValue(mockOffers)

    await handler(mockEvent)

    expect(mockPrisma.carpoolOffer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { tripDate: 'asc' },
      })
    )
  })

  it('devrait masquer tous les emails et ajouter les hash', async () => {
    const mockOffers = [
      {
        id: 1,
        user: {
          id: 1,
          email: 'driver@test.com',
          pseudo: 'driver',
          profilePicture: 'avatar.jpg',
          updatedAt: new Date(),
        },
        passengers: [
          {
            id: 1,
            addedAt: new Date(),
            user: {
              id: 2,
              email: 'passenger@test.com',
              pseudo: 'passenger',
              profilePicture: null,
              updatedAt: new Date(),
            },
          },
        ],
        comments: [
          {
            id: 1,
            content: 'Test comment',
            createdAt: new Date(),
            user: {
              id: 3,
              email: 'commenter@test.com',
              pseudo: 'commenter',
              profilePicture: null,
              updatedAt: new Date(),
            },
          },
        ],
      },
    ]

    mockPrisma.carpoolOffer.findMany.mockResolvedValue(mockOffers)

    const result = await handler(mockEvent)

    // Vérifier que les emails sont masqués et remplacés par des hash
    expect(result[0].user).not.toHaveProperty('email')
    expect(result[0].user.emailHash).toBe('test-hash')

    expect(result[0].passengers[0].user).not.toHaveProperty('email')
    expect(result[0].passengers[0].user.emailHash).toBe('test-hash')

    expect(result[0].comments[0].user).not.toHaveProperty('email')
    expect(result[0].comments[0].user.emailHash).toBe('test-hash')

    // Vérifier que getEmailHash est appelé pour chaque utilisateur
    expect(mockGetEmailHash).toHaveBeenCalledTimes(3)
    expect(mockGetEmailHash).toHaveBeenCalledWith('driver@test.com')
    expect(mockGetEmailHash).toHaveBeenCalledWith('passenger@test.com')
    expect(mockGetEmailHash).toHaveBeenCalledWith('commenter@test.com')
  })

  it('devrait préserver les autres propriétés des utilisateurs', async () => {
    const mockOffers = [
      {
        id: 1,
        user: {
          id: 1,
          email: 'user@test.com',
          pseudo: 'testuser',
          profilePicture: 'avatar.jpg',
          updatedAt: new Date('2024-01-01'),
        },
        passengers: [],
        comments: [],
      },
    ]

    mockPrisma.carpoolOffer.findMany.mockResolvedValue(mockOffers)

    const result = await handler(mockEvent)

    expect(result[0].user).toEqual({
      id: 1,
      pseudo: 'testuser',
      emailHash: 'test-hash',
      profilePicture: 'avatar.jpg',
      updatedAt: new Date('2024-01-01'),
    })
  })

  it('devrait parser correctement les IDs numériques', async () => {
    const eventWithStringId = {
      context: {
        params: {
          id: '123',
        },
      },
    }

    mockPrisma.carpoolOffer.findMany.mockResolvedValue([])

    await handler(eventWithStringId)

    expect(mockPrisma.carpoolOffer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { editionId: 123 },
      })
    )
  })
})
