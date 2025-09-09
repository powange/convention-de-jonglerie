import { describe, it, expect, vi, beforeEach } from 'vitest'

import { prismaMock } from '../../../../__mocks__/prisma'
import handler from '../../../../server/api/editions/[id].put'

// Mock des utilitaires
vi.mock('../../../../../server/utils/geocoding', () => ({
  geocodeEdition: vi.fn().mockResolvedValue({
    latitude: 48.8566,
    longitude: 2.3522,
  }),
}))

// Mock nuxt-file-storage
vi.mock('nuxt-file-storage', () => ({
  getFileLocally: vi.fn().mockReturnValue('/tmp/mock/file/path'),
  storeFileLocally: vi.fn().mockResolvedValue('mock-filename.jpg'),
  deleteFile: vi.fn().mockResolvedValue(true),
}))

// Mock fs/promises
vi.mock('fs/promises', () => ({
  readFile: vi.fn().mockResolvedValue(Buffer.from('fake-image-data')),
}))

describe('/api/editions/[id] PUT', () => {
  const mockUser = {
    id: 1,
    email: 'user@example.com',
    pseudo: 'testuser',
    nom: 'Test',
    prenom: 'User',
  }

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
    creator: mockUser,
    convention: {
      id: 1,
      name: 'Convention Test',
      authorId: 1,
      collaborators: [],
    },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    global.readBody = vi.fn()
    global.getRouterParam = vi.fn()
  })

  it('devrait permettre de modifier une édition', async () => {
    const updateData = {
      name: 'Edition 2024 Modifiée',
      description: 'Nouvelle description',
      city: 'Lyon',
      hasFoodTrucks: true,
      hasToilets: true,
    }

    global.getRouterParam.mockReturnValue('1')
    prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
    prismaMock.edition.update.mockResolvedValue({
      ...mockEdition,
      ...updateData,
    })

    global.readBody.mockResolvedValue(updateData)

    const mockEvent = {
      context: {
        user: mockUser,
        params: { id: '1' },
      },
    }

    const result = await handler(mockEvent as any)

    expect(result.name).toBe(updateData.name)
    expect(result.description).toBe(updateData.description)
    expect(result.city).toBe(updateData.city)

    expect(prismaMock.edition.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: expect.objectContaining({
        name: updateData.name,
        description: updateData.description,
        city: updateData.city,
        hasFoodTrucks: true,
        hasToilets: true,
      }),
      include: expect.any(Object),
    })
  })

  it('devrait rejeter si utilisateur non authentifié', async () => {
    const mockEvent = {
      context: {
        user: null,
        params: { id: '1' },
      },
    }

    await expect(handler(mockEvent as any)).rejects.toThrow('Non authentifié')
  })

  it('devrait rejeter pour un ID invalide', async () => {
    global.getRouterParam.mockReturnValue('invalid')

    const mockEvent = {
      context: {
        user: mockUser,
        params: { id: 'invalid' },
      },
    }

    await expect(handler(mockEvent as any)).rejects.toThrow("ID d'édition invalide")
  })

  it('devrait rejeter si édition non trouvée', async () => {
    global.getRouterParam.mockReturnValue('999')
    prismaMock.edition.findUnique.mockResolvedValue(null)

    const mockEvent = {
      context: {
        user: mockUser,
        params: { id: '999' },
      },
    }

    await expect(handler(mockEvent as any)).rejects.toThrow('Données invalides')
  })

  it("devrait rejeter si l'utilisateur n'a pas les droits", async () => {
    const otherUserEdition = {
      ...mockEdition,
      creatorId: 2,
      creator: { id: 2 },
      convention: {
        ...mockEdition.convention,
        authorId: 2,
        collaborators: [],
      },
    }

    global.getRouterParam.mockReturnValue('1')
    prismaMock.edition.findUnique.mockResolvedValue(otherUserEdition)

    global.readBody.mockResolvedValue({ name: 'Test' })

    const mockEvent = {
      context: {
        user: mockUser,
        params: { id: '1' },
      },
    }

    await expect(handler(mockEvent as any)).rejects.toThrow(
      "Vous n'avez pas les droits pour modifier cette édition"
    )
  })

  it("devrait permettre à l'auteur de la convention de modifier", async () => {
    const conventionAuthorEdition = {
      ...mockEdition,
      creatorId: 2, // Créé par quelqu'un d'autre
      creator: { id: 2 },
      convention: {
        ...mockEdition.convention,
        authorId: 1, // Mais convention appartient à l'utilisateur
      },
    }

    global.getRouterParam.mockReturnValue('1')
    prismaMock.edition.findUnique.mockResolvedValue(conventionAuthorEdition)
    prismaMock.edition.update.mockResolvedValue(conventionAuthorEdition)

    global.readBody.mockResolvedValue({ name: 'Edition Modifiée' })

    const mockEvent = {
      context: {
        user: mockUser,
        params: { id: '1' },
      },
    }

    const result = await handler(mockEvent as any)

    expect(result).toBeDefined()
    expect(prismaMock.edition.update).toHaveBeenCalled()
  })

  it('devrait permettre à un collaborateur admin de modifier', async () => {
    const collaboratorEdition = {
      ...mockEdition,
      creatorId: 2,
      creator: { id: 2 },
      convention: {
        ...mockEdition.convention,
        authorId: 2,
        collaborators: [
          {
            userId: 1,
            canEditConvention: true,
            canEditAllEditions: true,
            canManageCollaborators: true,
          },
        ],
      },
    }

    global.getRouterParam.mockReturnValue('1')
    prismaMock.edition.findUnique.mockResolvedValue(collaboratorEdition)
    prismaMock.edition.update.mockResolvedValue(collaboratorEdition)

    global.readBody.mockResolvedValue({ name: 'Edition Modifiée' })

    const mockEvent = {
      context: {
        user: mockUser,
        params: { id: '1' },
      },
    }

    const result = await handler(mockEvent as any)

    expect(result).toBeDefined()
  })

  it('devrait permettre à un collaborateur modérateur de modifier', async () => {
    const moderatorEdition = {
      ...mockEdition,
      creatorId: 2,
      creator: { id: 2 },
      convention: {
        ...mockEdition.convention,
        authorId: 2,
        collaborators: [
          {
            userId: 1,
            canEditConvention: true,
          },
        ],
      },
    }

    global.getRouterParam.mockReturnValue('1')
    prismaMock.edition.findUnique.mockResolvedValue(moderatorEdition)
    prismaMock.edition.update.mockResolvedValue(moderatorEdition)

    global.readBody.mockResolvedValue({ name: 'Edition Modifiée' })

    const mockEvent = {
      context: {
        user: mockUser,
        params: { id: '1' },
      },
    }

    const result = await handler(mockEvent as any)

    expect(result).toBeDefined()
  })

  it('devrait rejeter un collaborateur viewer', async () => {
    const viewerEdition = {
      ...mockEdition,
      creatorId: 2,
      creator: { id: 2 },
      convention: {
        ...mockEdition.convention,
        authorId: 2,
        collaborators: [], // L'API filtre les VIEWER, donc ils n'apparaissent pas dans les résultats
      },
    }

    global.getRouterParam.mockReturnValue('1')
    prismaMock.edition.findUnique.mockResolvedValue(viewerEdition)

    global.readBody.mockResolvedValue({ name: 'Test' })

    const mockEvent = {
      context: {
        user: mockUser,
        params: { id: '1' },
      },
    }

    await expect(handler(mockEvent as any)).rejects.toThrow(
      "Vous n'avez pas les droits pour modifier cette édition"
    )
  })

  it("devrait géocoder lors du changement d'adresse", async () => {
    const { geocodeEdition } = await import('../../../../../server/utils/geocoding')

    const updateData = {
      addressLine1: '456 rue Nouvelle',
      city: 'Marseille',
      postalCode: '13001',
      country: 'France',
    }

    global.getRouterParam.mockReturnValue('1')
    prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
    prismaMock.edition.update.mockResolvedValue({
      ...mockEdition,
      ...updateData,
    })

    global.readBody.mockResolvedValue(updateData)

    const mockEvent = {
      context: {
        user: mockUser,
        params: { id: '1' },
      },
    }

    await handler(mockEvent as any)

    expect(geocodeEdition).toHaveBeenCalledWith({
      addressLine1: updateData.addressLine1,
      addressLine2: null,
      city: updateData.city,
      postalCode: updateData.postalCode,
      country: updateData.country,
    })
  })

  it("devrait gérer l'upload d'image", async () => {
    const updateData = {
      name: 'Edition Modifiée',
      imageUrl: 'simple-filename.jpg', // Test avec un nom de fichier simple
    }

    global.getRouterParam.mockReturnValue('1')
    prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
    prismaMock.edition.update.mockResolvedValue({
      ...mockEdition,
      name: updateData.name,
      imageUrl: updateData.imageUrl,
    })

    global.readBody.mockResolvedValue(updateData)

    const mockEvent = {
      context: {
        user: mockUser,
        params: { id: '1' },
      },
    }

    const result = await handler(mockEvent as any)

    expect(result.imageUrl).toBe('simple-filename.jpg')
    expect(prismaMock.edition.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1 },
        data: expect.objectContaining({
          name: updateData.name,
          imageUrl: updateData.imageUrl,
        }),
      })
    )
  })

  it('devrait valider que la date de fin est après la date de début', async () => {
    const invalidData = {
      startDate: '2024-06-10',
      endDate: '2024-06-05', // Date de fin avant date de début
    }

    global.getRouterParam.mockReturnValue('1')
    prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
    global.readBody.mockResolvedValue(invalidData)

    const mockEvent = {
      context: {
        user: mockUser,
        params: { id: '1' },
      },
    }

    await expect(handler(mockEvent as any)).rejects.toThrow('Données invalides')
  })

  it('devrait gérer les erreurs de base de données', async () => {
    global.getRouterParam.mockReturnValue('1')
    prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
    prismaMock.edition.update.mockRejectedValue(new Error('Database error'))

    global.readBody.mockResolvedValue({ name: 'Test' })

    const mockEvent = {
      context: {
        user: mockUser,
        params: { id: '1' },
      },
    }

    await expect(handler(mockEvent as any)).rejects.toThrow()
  })

  it("ne devrait pas géocoder si l'adresse n'a pas changé", async () => {
    const { geocodeEdition } = await import('../../../../../server/utils/geocoding')

    const updateData = {
      name: 'Nouveau nom seulement',
      description: 'Nouvelle description',
    }

    global.getRouterParam.mockReturnValue('1')
    prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
    prismaMock.edition.update.mockResolvedValue({
      ...mockEdition,
      ...updateData,
    })

    global.readBody.mockResolvedValue(updateData)

    const mockEvent = {
      context: {
        user: mockUser,
        params: { id: '1' },
      },
    }

    await handler(mockEvent as any)

    expect(geocodeEdition).not.toHaveBeenCalled()
  })
})
