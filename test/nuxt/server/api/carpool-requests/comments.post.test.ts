import { describe, it, expect, beforeEach } from 'vitest'

import handler from '../../../../../server/api/carpool-requests/[id]/comments.post'

// Utiliser le mock global de Prisma défini dans test/setup-common.ts
const prismaMock = (globalThis as any).prisma

// Mock des modules Nuxt
const mockEvent = {
  context: {
    params: { id: '1' },
    user: {
      id: 1,
      email: 'user@test.com',
      pseudo: 'testuser',
    },
  },
}

// Helper pour créer un mock de commentaire avec le format attendu par le handler
const createMockComment = (content: string) => ({
  id: 1,
  carpoolRequestId: 1,
  userId: 1,
  content,
  createdAt: new Date(),
  user: {
    id: 1,
    pseudo: 'testuser',
    profilePicture: null,
    emailHash: 'abc123',
    updatedAt: new Date(),
  },
})

describe('/api/carpool-requests/[id]/comments POST', () => {
  beforeEach(() => {
    // Reset tous les mocks avant chaque test
    prismaMock.carpoolRequest.findUnique.mockReset()
    prismaMock.carpoolRequestComment.create.mockReset()
    global.readBody = vi.fn()
  })

  it('devrait créer un commentaire avec succès', async () => {
    const requestBody = {
      content: 'Je peux te prendre ! Contacte-moi par MP.',
    }

    const mockCarpoolRequest = {
      id: 1,
      editionId: 1,
      userId: 2,
      tripDate: new Date('2024-07-15'),
      locationCity: 'Lyon',
    }

    const mockComment = createMockComment(requestBody.content)

    global.readBody.mockResolvedValue(requestBody)
    prismaMock.carpoolRequest.findUnique.mockResolvedValue(mockCarpoolRequest)
    prismaMock.carpoolRequestComment.create.mockResolvedValue(mockComment)

    const result = await handler(mockEvent as any)

    expect(result).toEqual(mockComment)
    expect(prismaMock.carpoolRequest.findUnique).toHaveBeenCalledWith({
      where: { id: 1 },
      select: { id: true },
    })
    expect(prismaMock.carpoolRequestComment.create).toHaveBeenCalledWith({
      data: {
        carpoolRequestId: 1,
        userId: 1,
        content: requestBody.content,
      },
      include: {
        user: {
          select: {
            id: true,
            pseudo: true,
            profilePicture: true,
            emailHash: true,
            updatedAt: true,
          },
        },
      },
    })
  })

  it('devrait rejeter si utilisateur non authentifié', async () => {
    const eventWithoutUser = {
      ...mockEvent,
      context: { ...mockEvent.context, user: null },
    }

    await expect(handler(eventWithoutUser as any)).rejects.toThrow('Authentification requise')
  })

  it('devrait rejeter un ID de demande de covoiturage invalide', async () => {
    const eventWithBadId = {
      ...mockEvent,
      context: { ...mockEvent.context, params: { id: 'invalid' } },
    }

    global.readBody.mockResolvedValue({ content: 'Test' })

    await expect(handler(eventWithBadId as any)).rejects.toThrow('ID manquant')
  })

  it("devrait valider que le contenu n'est pas vide", async () => {
    const emptyBody = {
      content: '',
    }

    // La ressource parente doit exister pour atteindre la validation du contenu
    prismaMock.carpoolRequest.findUnique.mockResolvedValue({ id: 1 })
    global.readBody.mockResolvedValue(emptyBody)

    await expect(handler(mockEvent as any)).rejects.toThrow('Le contenu du commentaire est requis')
  })

  it("devrait valider que le contenu n'est pas seulement des espaces", async () => {
    const whitespaceBody = {
      content: '   ',
    }

    // La ressource parente doit exister pour atteindre la validation du contenu
    prismaMock.carpoolRequest.findUnique.mockResolvedValue({ id: 1 })
    global.readBody.mockResolvedValue(whitespaceBody)

    await expect(handler(mockEvent as any)).rejects.toThrow('Le contenu du commentaire est requis')
  })

  it('devrait valider que le contenu existe', async () => {
    const noContentBody = {}

    // La ressource parente doit exister pour atteindre la validation du contenu
    prismaMock.carpoolRequest.findUnique.mockResolvedValue({ id: 1 })
    global.readBody.mockResolvedValue(noContentBody)

    await expect(handler(mockEvent as any)).rejects.toThrow('Le contenu du commentaire est requis')
  })

  it('devrait rejeter si demande de covoiturage non trouvée', async () => {
    const requestBody = {
      content: 'Commentaire de test',
    }

    global.readBody.mockResolvedValue(requestBody)
    prismaMock.carpoolRequest.findUnique.mockResolvedValue(null)

    await expect(handler(mockEvent as any)).rejects.toThrow('Demande de covoiturage non trouvée')
  })

  it('devrait gérer les erreurs de base de données', async () => {
    const requestBody = {
      content: 'Commentaire de test',
    }

    global.readBody.mockResolvedValue(requestBody)
    prismaMock.carpoolRequest.findUnique.mockRejectedValue(new Error('Database error'))

    await expect(handler(mockEvent as any)).rejects.toThrow(
      'Erreur lors de la création du commentaire'
    )
  })

  it('devrait gérer les erreurs lors de la création du commentaire', async () => {
    const requestBody = {
      content: 'Commentaire de test',
    }

    const mockCarpoolRequest = {
      id: 1,
      editionId: 1,
      userId: 2,
    }

    global.readBody.mockResolvedValue(requestBody)
    prismaMock.carpoolRequest.findUnique.mockResolvedValue(mockCarpoolRequest)
    prismaMock.carpoolRequestComment.create.mockRejectedValue(new Error('Creation error'))

    await expect(handler(mockEvent as any)).rejects.toThrow(
      'Erreur lors de la création du commentaire'
    )
  })

  it("devrait permettre à l'auteur de la demande de commenter sa propre demande", async () => {
    const requestBody = {
      content: "Mise à jour : toujours besoin d'une place !",
    }

    // L'utilisateur connecté est aussi l'auteur de la demande
    const mockCarpoolRequest = {
      id: 1,
      editionId: 1,
      userId: 1, // Même ID que l'utilisateur connecté
    }

    const mockComment = createMockComment(requestBody.content)

    global.readBody.mockResolvedValue(requestBody)
    prismaMock.carpoolRequest.findUnique.mockResolvedValue(mockCarpoolRequest)
    prismaMock.carpoolRequestComment.create.mockResolvedValue(mockComment)

    const result = await handler(mockEvent as any)

    expect(result).toEqual(mockComment)
  })
})
