import { describe, it, expect, beforeEach, vi } from 'vitest'

const mockGetEventTiming = vi.hoisted(() => vi.fn())

// Mock des utilitaires - DOIT être avant les imports
vi.mock('#server/utils/permissions/edition-permissions', () => ({
  canAccessEditionData: vi.fn(),
}))

// Étape modularisation : existence + date de début de l'événement via le port lost-found.
vi.mock('#server/lost-found/ports/registry', () => ({
  useLostFoundPorts: () => ({ event: { getEventTiming: mockGetEventTiming } }),
}))

import { canAccessEditionData } from '#server/utils/permissions/edition-permissions'

import handler from '../../../../../../../../layers/lost-found/server/api/editions/[id]/lost-found/index.post'

// Utiliser le mock global de Prisma défini dans test/setup-common.ts
const prismaMock = (globalThis as any).prisma

const mockHasPermission = canAccessEditionData as ReturnType<typeof vi.fn>

const mockEvent = {
  context: {
    params: { id: '1' },
    user: { id: 1, email: 'test@example.com', pseudo: 'testuser', isGlobalAdmin: false },
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
    vi.clearAllMocks()
    // Par défaut : événement trouvé, déjà commencé (date passée).
    mockGetEventTiming.mockResolvedValue({ found: true, startDate: new Date('2024-01-01') })
    mockHasPermission.mockReset()
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
    mockHasPermission.mockResolvedValue(true)
    prismaMock.lostFoundItem.create.mockResolvedValue(mockLostFoundItem)

    const result = await handler(mockEvent as any)

    expect(result).toEqual({ success: true, data: mockLostFoundItem })
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

    await handler(mockEvent as any)

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
    mockGetEventTiming.mockResolvedValue({ found: false, startDate: null })

    await expect(handler(mockEvent as any)).rejects.toThrow('Édition non trouvée')
  })

  it("devrait rejeter si l'édition n'a pas encore commencé", async () => {
    mockGetEventTiming.mockResolvedValue({
      found: true,
      startDate: new Date(Date.now() + 86400000), // Demain
    })

    await expect(handler(mockEvent as any)).rejects.toThrow(
      "Les objets trouvés ne peuvent pas être ajoutés avant le début de l'édition"
    )
  })

  it("devrait rejeter si utilisateur n'est pas organisateur", async () => {
    mockHasPermission.mockResolvedValue(false)

    await expect(handler(mockEvent as any)).rejects.toThrow(
      'Vous devez être organisateur pour ajouter un objet trouvé'
    )
  })

  it('devrait rejeter si description manquante', async () => {
    const requestBody = {
      imageUrl: '/uploads/test.jpg',
    }

    global.readBody.mockResolvedValue(requestBody)
    mockHasPermission.mockResolvedValue(true)

    await expect(handler(mockEvent as any)).rejects.toThrow('La description est requise')
  })

  it('devrait rejeter si description vide', async () => {
    const requestBody = {
      description: '   ',
    }

    global.readBody.mockResolvedValue(requestBody)
    mockHasPermission.mockResolvedValue(true)

    await expect(handler(mockEvent as any)).rejects.toThrow('La description est requise')
  })

  it("devrait rejeter si description n'est pas une string", async () => {
    const requestBody = {
      description: 123,
    }

    global.readBody.mockResolvedValue(requestBody)
    mockHasPermission.mockResolvedValue(true)

    await expect(handler(mockEvent as any)).rejects.toThrow('La description est requise')
  })

  it('devrait trimmer la description', async () => {
    const requestBody = {
      description: '  Objet avec espaces  ',
    }

    global.readBody.mockResolvedValue(requestBody)
    mockHasPermission.mockResolvedValue(true)
    prismaMock.lostFoundItem.create.mockResolvedValue(mockLostFoundItem)

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
    mockHasPermission.mockResolvedValue(true)
    prismaMock.lostFoundItem.create.mockRejectedValue(new Error('DB Error'))

    await expect(handler(mockEvent as any)).rejects.toThrow('Erreur serveur interne')
  })

  it('devrait relancer les erreurs HTTP', async () => {
    const httpError = {
      statusCode: 403,
      message: 'Permission denied',
    }

    mockHasPermission.mockRejectedValue(httpError)

    await expect(handler(mockEvent as any)).rejects.toEqual(httpError)
  })
})
