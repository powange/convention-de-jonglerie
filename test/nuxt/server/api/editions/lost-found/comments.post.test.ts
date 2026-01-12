import { describe, it, expect, beforeEach, vi } from 'vitest'

import handler from '../../../../../../server/api/editions/[id]/lost-found/[itemId]/comments.post'

// Utiliser le mock global de Prisma défini dans test/setup-common.ts
const prismaMock = (globalThis as any).prisma

const mockEvent = {
  context: {
    params: { id: '1', itemId: '1' },
    user: { id: 1, email: 'test@example.com', pseudo: 'testuser', isGlobalAdmin: false },
  },
}

const mockEventWithoutUser = {
  context: {
    params: { id: '1', itemId: '1' },
  },
}

const mockLostFoundItem = {
  id: 1,
  editionId: 1,
  userId: 2,
  description: 'Gants noirs trouvés',
  status: 'LOST',
  createdAt: new Date('2024-01-04T10:00:00Z'),
}

const mockComment = {
  id: 1,
  lostFoundItemId: 1,
  userId: 1,
  content: "Je pense que c'est à moi",
  createdAt: new Date('2024-01-04T11:00:00Z'),
  user: {
    id: 1,
    pseudo: 'testuser',
    prenom: 'John',
    nom: 'Doe',
    profilePicture: null,
    updatedAt: new Date(),
    emailHash: 'abc123',
  },
}

describe('/api/editions/[id]/lost-found/[itemId]/comments POST', () => {
  beforeEach(async () => {
    prismaMock.lostFoundItem.findFirst.mockReset()
    prismaMock.lostFoundComment.create.mockReset()
    global.readBody = vi.fn()
    global.getRouterParam = vi
      .fn()
      .mockReturnValueOnce('1') // editionId
      .mockReturnValueOnce('1') // itemId
  })

  it('devrait créer un commentaire avec succès', async () => {
    const requestBody = {
      content: "Je pense que c'est à moi",
    }

    global.readBody.mockResolvedValue(requestBody)
    prismaMock.lostFoundItem.findFirst.mockResolvedValue(mockLostFoundItem)
    prismaMock.lostFoundComment.create.mockResolvedValue(mockComment)

    const result = await handler(mockEvent as any)

    expect(result).toEqual(mockComment)
    expect(prismaMock.lostFoundComment.create).toHaveBeenCalledWith({
      data: {
        lostFoundItemId: 1,
        userId: 1,
        content: "Je pense que c'est à moi",
      },
      include: expect.objectContaining({
        user: expect.any(Object),
      }),
    })
  })

  it("devrait rejeter si ID d'édition invalide", async () => {
    global.getRouterParam = vi.fn().mockReturnValueOnce('invalid').mockReturnValueOnce('1')

    await expect(handler(mockEvent as any)).rejects.toThrow("ID d'édition invalide")
  })

  it("devrait rejeter si ID d'édition est 0", async () => {
    global.getRouterParam = vi.fn().mockReturnValueOnce('0').mockReturnValueOnce('1')

    await expect(handler(mockEvent as any)).rejects.toThrow("ID d'édition invalide")
  })

  it("devrait rejeter si ID d'objet invalide", async () => {
    global.getRouterParam = vi.fn().mockReturnValueOnce('1').mockReturnValueOnce('invalid')

    await expect(handler(mockEvent as any)).rejects.toThrow("ID d'objet invalide")
  })

  it("devrait rejeter si ID d'objet est 0", async () => {
    global.getRouterParam = vi.fn().mockReturnValueOnce('1').mockReturnValueOnce('0')

    await expect(handler(mockEvent as any)).rejects.toThrow("ID d'objet invalide")
  })

  it('devrait rejeter si non authentifié (pas de session)', async () => {
    await expect(handler(mockEventWithoutUser as any)).rejects.toThrow('Unauthorized')
  })

  it('devrait rejeter si objet trouvé non trouvé', async () => {
    global.readBody.mockResolvedValue({ content: 'Test' })
    prismaMock.lostFoundItem.findFirst.mockResolvedValue(null)

    await expect(handler(mockEvent as any)).rejects.toThrow('Objet trouvé non trouvé')
  })

  it("devrait vérifier que l'objet appartient à l'édition", async () => {
    global.getRouterParam = vi
      .fn()
      .mockReturnValueOnce('2') // editionId différent
      .mockReturnValueOnce('1') // itemId
    global.readBody.mockResolvedValue({ content: 'Test' })
    prismaMock.lostFoundItem.findFirst.mockResolvedValue(null) // Pas trouvé car mauvaise édition

    await expect(handler(mockEvent as any)).rejects.toThrow('Objet trouvé non trouvé')

    expect(prismaMock.lostFoundItem.findFirst).toHaveBeenCalledWith({
      where: {
        id: 1,
        editionId: 2,
      },
    })
  })

  it('devrait rejeter si contenu du commentaire manquant', async () => {
    const requestBody = {}

    global.readBody.mockResolvedValue(requestBody)
    prismaMock.lostFoundItem.findFirst.mockResolvedValue(mockLostFoundItem)

    await expect(handler(mockEvent as any)).rejects.toThrow('Le contenu du commentaire est requis')
  })

  it('devrait rejeter si contenu du commentaire vide', async () => {
    const requestBody = {
      content: '   ',
    }

    global.readBody.mockResolvedValue(requestBody)
    prismaMock.lostFoundItem.findFirst.mockResolvedValue(mockLostFoundItem)

    await expect(handler(mockEvent as any)).rejects.toThrow('Le contenu du commentaire est requis')
  })

  it("devrait rejeter si contenu n'est pas une string", async () => {
    const requestBody = {
      content: 123,
    }

    global.readBody.mockResolvedValue(requestBody)
    prismaMock.lostFoundItem.findFirst.mockResolvedValue(mockLostFoundItem)

    await expect(handler(mockEvent as any)).rejects.toThrow('Le contenu du commentaire est requis')
  })

  it('devrait trimmer le contenu du commentaire', async () => {
    const requestBody = {
      content: '  Commentaire avec espaces  ',
    }

    global.readBody.mockResolvedValue(requestBody)
    prismaMock.lostFoundItem.findFirst.mockResolvedValue(mockLostFoundItem)
    prismaMock.lostFoundComment.create.mockResolvedValue(mockComment)

    await handler(mockEvent as any)

    expect(prismaMock.lostFoundComment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        content: 'Commentaire avec espaces',
      }),
      include: expect.any(Object),
    })
  })

  it('devrait inclure les détails utilisateur dans la réponse', async () => {
    const requestBody = { content: 'Test' }

    global.readBody.mockResolvedValue(requestBody)
    prismaMock.lostFoundItem.findFirst.mockResolvedValue(mockLostFoundItem)
    prismaMock.lostFoundComment.create.mockResolvedValue(mockComment)

    const result = await handler(mockEvent as any)

    expect(result.user).toHaveProperty('id')
    expect(result.user).toHaveProperty('pseudo')
    expect(result.user).toHaveProperty('prenom')
    expect(result.user).toHaveProperty('nom')
    expect(result.user).toHaveProperty('profilePicture')
    expect(result.user).toHaveProperty('emailHash')
  })

  it('devrait gérer les erreurs de base de données', async () => {
    global.readBody.mockResolvedValue({ content: 'Test' })
    prismaMock.lostFoundItem.findFirst.mockResolvedValue(mockLostFoundItem)
    prismaMock.lostFoundComment.create.mockRejectedValue(new Error('DB Error'))

    await expect(handler(mockEvent as any)).rejects.toThrow('Erreur serveur interne')
  })

  it('devrait relancer les erreurs HTTP', async () => {
    const httpError = {
      statusCode: 403,
      statusMessage: 'Access denied',
    }

    global.readBody.mockResolvedValue({ content: 'Test' })
    prismaMock.lostFoundItem.findFirst.mockRejectedValue(httpError)

    await expect(handler(mockEvent as any)).rejects.toEqual(httpError)
  })

  it('devrait traiter correctement les IDs numériques', async () => {
    global.getRouterParam = vi.fn().mockReturnValueOnce('123').mockReturnValueOnce('456')
    global.readBody.mockResolvedValue({ content: 'Test' })
    prismaMock.lostFoundItem.findFirst.mockResolvedValue({
      ...mockLostFoundItem,
      id: 456,
      editionId: 123,
    })
    prismaMock.lostFoundComment.create.mockResolvedValue(mockComment)

    await handler(mockEvent as any)

    expect(prismaMock.lostFoundItem.findFirst).toHaveBeenCalledWith({
      where: {
        id: 456,
        editionId: 123,
      },
    })
    expect(prismaMock.lostFoundComment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        lostFoundItemId: 456,
        userId: 1,
      }),
      include: expect.any(Object),
    })
  })

  it('devrait utiliser le userId de la session', async () => {
    const eventWithDifferentUser = {
      context: {
        params: { id: '1', itemId: '1' },
        user: { id: 42, email: 'other@example.com', pseudo: 'otheruser', isGlobalAdmin: false },
      },
    }

    global.getRouterParam = vi.fn().mockReturnValueOnce('1').mockReturnValueOnce('1')
    global.readBody.mockResolvedValue({ content: 'Test' })
    prismaMock.lostFoundItem.findFirst.mockResolvedValue(mockLostFoundItem)
    prismaMock.lostFoundComment.create.mockResolvedValue({
      ...mockComment,
      userId: 42,
    })

    await handler(eventWithDifferentUser as any)

    expect(prismaMock.lostFoundComment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 42,
      }),
      include: expect.any(Object),
    })
  })
})
