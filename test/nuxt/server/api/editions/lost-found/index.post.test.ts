import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock des utilitaires - DOIT être avant les imports
vi.mock('../../../../../../server/utils/permissions/permissions', () => ({
  hasEditionEditPermission: vi.fn(),
}))

import { hasEditionEditPermission } from '../../../../../../server/utils/permissions/permissions'
import { prismaMock } from '../../../../../__mocks__/prisma'
import handler from '../../../../../../server/api/editions/[id]/lost-found/index.post'

const mockHasPermission = hasEditionEditPermission as ReturnType<typeof vi.fn>

const mockEvent = {
  context: {
    params: { id: '1' },
    user: { id: 1, email: 'test@example.com', pseudo: 'testuser', isGlobalAdmin: false },
  },
}

const mockUser = {
  id: 1,
  pseudo: 'testuser',
  email: 'test@example.com',
}

const mockEdition = {
  id: 1,
  name: 'Convention Test 2024',
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-01-03'), // Édition terminée
  convention: {
    id: 1,
    collaborators: [],
  },
}

const mockLostFoundItem = {
  id: 1,
  editionId: 1,
  userId: 1,
  description: 'Gants noirs trouvés près de la scène',
  imageUrl: '/uploads/lost-found/item-123.jpg',
  status: 'LOST',
  user: {
    id: 1,
    pseudo: 'testuser',
    prenom: 'John',
    nom: 'Doe',
    profilePicture: null,
    emailHash: '55502f40dc8b7c769880b10874abc9d0', // MD5 hash of 'test@example.com'
  },
  comments: [],
}

const mockEventWithoutUser = {
  context: {
    params: { id: '1' },
  },
}

describe('/api/editions/[id]/lost-found POST', () => {
  beforeEach(async () => {
    mockHasPermission.mockReset()
    prismaMock.edition.findUnique.mockReset()
    prismaMock.lostFoundItem.create.mockReset()
    global.readBody = vi.fn()
    global.getRouterParam = vi.fn().mockReturnValue('1')
  })

  it('devrait créer un objet trouvé avec succès', async () => {
    const requestBody = {
      description: 'Gants noirs trouvés près de la scène',
      imageUrl: '/uploads/lost-found/item-123.jpg',
    }

    global.readBody.mockResolvedValue(requestBody)
    prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
    mockHasPermission.mockResolvedValue(true)
    prismaMock.lostFoundItem.create.mockResolvedValue({
      ...mockLostFoundItem,
      user: {
        ...mockLostFoundItem.user,
        email: 'test@example.com', // Inclure l'email pour que getEmailHash fonctionne
      },
    })

    const result = await handler(mockEvent as any)

    expect(result).toEqual(mockLostFoundItem)
    expect(prismaMock.lostFoundItem.create).toHaveBeenCalledWith({
      data: {
        editionId: 1,
        userId: 1,
        description: 'Gants noirs trouvés près de la scène',
        imageUrl: '/uploads/lost-found/item-123.jpg',
        status: 'LOST',
      },
      include: expect.objectContaining({
        user: expect.any(Object),
        comments: expect.any(Object),
      }),
    })
  })

  it('devrait créer un objet trouvé sans image', async () => {
    const requestBody = {
      description: 'Clés trouvées dans les toilettes',
    }

    global.readBody.mockResolvedValue(requestBody)
    prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
    mockHasPermission.mockResolvedValue(true)
    prismaMock.lostFoundItem.create.mockResolvedValue({
      ...mockLostFoundItem,
      description: 'Clés trouvées dans les toilettes',
      imageUrl: null,
      user: {
        ...mockLostFoundItem.user,
        email: 'test@example.com', // Inclure l'email pour que getEmailHash fonctionne
      },
    })

    const result = await handler(mockEvent as any)

    expect(prismaMock.lostFoundItem.create).toHaveBeenCalledWith({
      data: {
        editionId: 1,
        userId: 1,
        description: 'Clés trouvées dans les toilettes',
        imageUrl: null,
        status: 'LOST',
      },
      include: expect.any(Object),
    })
  })

  it("devrait rejeter si ID d'édition invalide", async () => {
    global.getRouterParam.mockReturnValue('invalid')

    await expect(handler(mockEvent as any)).rejects.toThrow("ID d'édition invalide")
  })

  it('devrait rejeter si non authentifié (pas de session)', async () => {
    await expect(handler(mockEventWithoutUser as any)).rejects.toThrow('Unauthorized')
  })

  it('devrait rejeter si édition non trouvée', async () => {
    prismaMock.edition.findUnique.mockResolvedValue(null)

    await expect(handler(mockEvent as any)).rejects.toThrow('Édition non trouvée')
  })

  it("devrait rejeter si l'édition n'a pas encore commencé", async () => {
    const futureEdition = {
      ...mockEdition,
      startDate: new Date(Date.now() + 86400000), // Demain
      endDate: new Date(Date.now() + 3 * 86400000),
    }

    prismaMock.edition.findUnique.mockResolvedValue(futureEdition)

    await expect(handler(mockEvent as any)).rejects.toThrow(
      "Les objets trouvés ne peuvent pas être ajoutés avant le début de l'édition"
    )
  })

  it("devrait rejeter si utilisateur n'est pas collaborateur", async () => {
    prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
    mockHasPermission.mockResolvedValue(false)

    await expect(handler(mockEvent as any)).rejects.toThrow(
      'Vous devez être collaborateur pour ajouter un objet trouvé'
    )
  })

  it('devrait rejeter si description manquante', async () => {
    const requestBody = {
      imageUrl: '/uploads/test.jpg',
    }

    global.readBody.mockResolvedValue(requestBody)
    prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
    mockHasPermission.mockResolvedValue(true)

    await expect(handler(mockEvent as any)).rejects.toThrow('La description est requise')
  })

  it('devrait rejeter si description vide', async () => {
    const requestBody = {
      description: '   ',
    }

    global.readBody.mockResolvedValue(requestBody)
    prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
    mockHasPermission.mockResolvedValue(true)

    await expect(handler(mockEvent as any)).rejects.toThrow('La description est requise')
  })

  it("devrait rejeter si description n'est pas une string", async () => {
    const requestBody = {
      description: 123,
    }

    global.readBody.mockResolvedValue(requestBody)
    prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
    mockHasPermission.mockResolvedValue(true)

    await expect(handler(mockEvent as any)).rejects.toThrow('La description est requise')
  })

  it('devrait trimmer la description', async () => {
    const requestBody = {
      description: '  Objet avec espaces  ',
    }

    global.readBody.mockResolvedValue(requestBody)
    prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
    mockHasPermission.mockResolvedValue(true)
    prismaMock.lostFoundItem.create.mockResolvedValue({
      ...mockLostFoundItem,
      user: {
        ...mockLostFoundItem.user,
        email: 'test@example.com', // Inclure l'email pour que getEmailHash fonctionne
      },
    })

    await handler(mockEvent as any)

    expect(prismaMock.lostFoundItem.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        description: 'Objet avec espaces',
      }),
      include: expect.any(Object),
    })
  })

  it('devrait gérer les erreurs de base de données', async () => {
    global.readBody.mockResolvedValue({ description: 'Test item' })
    prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
    mockHasPermission.mockResolvedValue(true)
    prismaMock.lostFoundItem.create.mockRejectedValue(new Error('DB Error'))

    await expect(handler(mockEvent as any)).rejects.toThrow('Erreur interne du serveur')
  })

  it('devrait relancer les erreurs HTTP', async () => {
    const httpError = {
      statusCode: 403,
      message: 'Permission denied',
    }

    prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
    mockHasPermission.mockRejectedValue(httpError)

    await expect(handler(mockEvent as any)).rejects.toEqual(httpError)
  })
})
