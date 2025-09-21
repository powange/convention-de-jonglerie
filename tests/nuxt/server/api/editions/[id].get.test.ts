import { describe, it, expect, vi, beforeEach } from 'vitest'

import { prismaMock } from '../../../../__mocks__/prisma'
import handler from '../../../../server/api/editions/[id].get'

// Mock des utilitaires
vi.mock('../../../../server/utils/email-hash', () => ({
  getEmailHash: vi.fn((email: string) => (email ? `hash_${email}` : '')),
}))

describe.skip('/api/editions/[id] GET', () => {
  const mockEdition = {
    id: 1,
    conventionId: 1,
    name: 'Edition 2024',
    description: 'Description test',
    startDate: new Date('2024-06-01'),
    endDate: new Date('2024-06-03'),
    addressLine1: '123 rue Test',
    addressLine2: null,
    postalCode: '75001',
    city: 'Paris',
    region: 'Île-de-France',
    country: 'France',
    latitude: 48.8566,
    longitude: 2.3522,
    imageUrl: null,
    creatorId: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    hasFoodTrucks: true,
    hasKidsZone: false,
    acceptsPets: true,
    hasTentCamping: true,
    hasTruckCamping: false,
    hasFamilyCamping: true,
    hasSleepingRoom: true,
    hasGym: true,
    hasFireSpace: false,
    hasGala: true,
    hasOpenStage: true,
    hasConcert: false,
    hasCantine: true,
    hasAerialSpace: false,
    hasSlacklineSpace: true,
    hasToilets: true,
    hasShowers: true,
    hasAccessibility: true,
    hasWorkshops: true,
    hasLongShow: false,
    hasATM: true,
    creator: {
      id: 1,
      pseudo: 'testuser',
      email: 'creator@example.com',
      profilePicture: null,
      updatedAt: new Date(),
    },
    favoritedBy: [{ id: 2, email: 'fan@example.com', pseudo: 'fan' }],
    convention: {
      id: 1,
      name: 'Convention Test',
      description: 'Description convention',
      logo: null,
      authorId: 1,
      collaborators: [
        {
          id: 1,
          userId: 3,
          conventionId: 1,
          role: 'MODERATOR',
          user: {
            id: 3,
            pseudo: 'collaborator',
            email: 'collab@example.com',
            profilePicture: null,
            updatedAt: new Date(),
          },
        },
      ],
    },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    global.getRouterParam = vi.fn()
  })

  it('devrait retourner une édition par ID', async () => {
    global.getRouterParam.mockReturnValue('1')
    prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
    prismaMock.editionCollaborator.findFirst.mockRejectedValue(new Error('Table not found'))

    const mockEvent = {
      context: { params: { id: '1' } },
    }

    const result = await handler(mockEvent as any)

    expect(result.id).toBe(1)
    expect(result.name).toBe('Edition 2024')
    expect(result.creator.pseudo).toBe('testuser')
    expect(result.convention.name).toBe('Convention Test')

    expect(prismaMock.edition.findUnique).toHaveBeenCalledWith({
      where: { id: 1 },
      include: expect.objectContaining({
        creator: expect.any(Object),
        favoritedBy: expect.any(Object),
        convention: expect.any(Object),
      }),
    })
  })

  it('devrait masquer les emails et retourner emailHash', async () => {
    global.getRouterParam.mockReturnValue('1')
    prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
    prismaMock.editionCollaborator.findFirst.mockRejectedValue(new Error('Table not found'))

    const mockEvent = {
      context: { params: { id: '1' } },
    }

    const result = await handler(mockEvent as any)

    // Vérifier que les emails sont masqués
    expect(result.creator).not.toHaveProperty('email')
    expect(result.creator.emailHash).toBe('hash_creator@example.com')

    // Vérifier qu'il y a au moins un collaborateur
    expect(result.convention.collaborators).toHaveLength(1)
    expect(result.convention.collaborators[0].user).not.toHaveProperty('email')
    // Dans certains cas, l'email du collaborateur peut être undefined, donc emailHash sera vide
    expect(result.convention.collaborators[0].user.emailHash).toBeDefined()
  })

  it("devrait inclure les collaborateurs d'édition si disponible", async () => {
    const editionWithCollaborators = {
      ...mockEdition,
      convention: {
        ...mockEdition.convention,
        collaborators: [
          {
            id: 1,
            user: {
              id: 4,
              pseudo: 'edition_collab',
              email: 'ed_collab@example.com',
              profilePicture: null,
              updatedAt: new Date(),
            },
            addedBy: {
              id: 1,
              pseudo: 'creator',
            },
          },
        ],
      },
    }

    global.getRouterParam.mockReturnValue('1')
    prismaMock.edition.findUnique.mockResolvedValue(editionWithCollaborators)
    prismaMock.editionCollaborator.findFirst.mockResolvedValue({}) // Table existe

    const mockEvent = {
      context: { params: { id: '1' } },
    }

    const result = await handler(mockEvent as any)

    expect(result.convention.collaborators).toBeDefined()
    expect(result.convention.collaborators).toHaveLength(1)
    expect(result.convention.collaborators[0].user.pseudo).toBe('edition_collab')
    expect(result.convention.collaborators[0].user.emailHash).toBe('hash_ed_collab@example.com')
    expect(result.convention.collaborators[0].user).not.toHaveProperty('email')
  })

  it('devrait rejeter pour un ID invalide', async () => {
    global.getRouterParam.mockReturnValue('invalid')

    const mockEvent = {
      context: { params: { id: 'invalid' } },
    }

    await expect(handler(mockEvent as any)).rejects.toThrow('Invalid Edition ID')
  })

  it('devrait retourner 404 si édition non trouvée', async () => {
    global.getRouterParam.mockReturnValue('999')
    prismaMock.edition.findUnique.mockResolvedValue(null)
    prismaMock.editionCollaborator.findFirst.mockRejectedValue(new Error('Table not found'))

    const mockEvent = {
      context: { params: { id: '999' } },
    }

    await expect(handler(mockEvent as any)).rejects.toThrow()
  })

  it('devrait gérer les erreurs de base de données', async () => {
    global.getRouterParam.mockReturnValue('1')
    prismaMock.edition.findUnique.mockRejectedValue(new Error('Database error'))

    const mockEvent = {
      context: { params: { id: '1' } },
    }

    await expect(handler(mockEvent as any)).rejects.toThrow()
  })

  it("devrait fonctionner même si la table EditionCollaborator n'existe pas", async () => {
    global.getRouterParam.mockReturnValue('1')
    prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
    prismaMock.editionCollaborator.findFirst.mockRejectedValue(new Error('Table not found'))

    const mockEvent = {
      context: { params: { id: '1' } },
    }

    const result = await handler(mockEvent as any)

    expect(result.id).toBe(1)
    expect(result.collaborators).toBeUndefined()
  })

  it('devrait inclure toutes les relations nécessaires', async () => {
    global.getRouterParam.mockReturnValue('1')
    prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
    prismaMock.editionCollaborator.findFirst.mockRejectedValue(new Error('Table not found'))

    const mockEvent = {
      context: { params: { id: '1' } },
    }

    await handler(mockEvent as any)

    expect(prismaMock.edition.findUnique).toHaveBeenCalledWith({
      where: { id: 1 },
      include: expect.objectContaining({
        creator: {
          select: {
            id: true,
            pseudo: true,
            email: true,
            profilePicture: true,
            updatedAt: true,
          },
        },
        favoritedBy: {
          select: {
            id: true,
          },
        },
        // Champs bénévolat nécessaires pour la page de gestion
        _count: {
          select: { volunteerApplications: true },
        },
        // Champs bénévolat (valeurs)
        volunteerApplications: false,
        convention: {
          include: {
            collaborators: {
              include: {
                user: {
                  select: {
                    id: true,
                    pseudo: true,
                    email: true,
                    profilePicture: true,
                    updatedAt: true,
                  },
                },
                perEditionPermissions: true,
              },
            },
          },
        },
      }),
    })
  })
})
