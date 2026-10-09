import { describe, it, expect, beforeEach, vi } from 'vitest'

import handler from '../../../../../../../layers/carpool/server/api/carpool-offers/[id]/comments.post'
import { global } from '../../../globales-nitro'

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
  carpoolOfferId: 1,
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

describe('/api/carpool-offers/[id]/comments POST', () => {
  beforeEach(() => {
    // Reset tous les mocks avant chaque test
    /*
     * Les commentateurs à prévenir, requête ajoutée avec les notifications de commentaire. Un
     * `findMany` réel rend TOUJOURS un tableau : un mock qui ne le simule pas rend `undefined`, et
     * la boucle de diffusion lève. Complété ici plutôt que de rendre le handler tolérant à une
     * valeur que Prisma ne produit jamais.
     */
    prismaMock.carpoolComment.findMany.mockResolvedValue([])
    prismaMock.carpoolOffer.findUnique.mockReset()
    prismaMock.carpoolComment.create.mockReset()
    global.readBody = vi.fn()
  })

  it('devrait créer un commentaire avec succès', async () => {
    const requestBody = {
      content: "Salut ! Ça m'intéresse, peux-tu me contacter ?",
    }

    const mockCarpoolOffer = {
      id: 1,
      editionId: 1,
      userId: 2,
      tripDate: new Date('2024-07-15'),
      locationCity: 'Paris',
    }

    const mockComment = createMockComment(requestBody.content)

    global.readBody.mockResolvedValue(requestBody)
    prismaMock.carpoolOffer.findUnique.mockResolvedValue(mockCarpoolOffer)
    prismaMock.carpoolComment.create.mockResolvedValue(mockComment)

    const result = await handler(mockEvent as any)

    expect(result).toEqual({ success: true, data: mockComment })
    expect(prismaMock.carpoolOffer.findUnique).toHaveBeenCalledWith({
      where: { id: 1 },
      // `userId` et `editionId` en plus de l'existence : ils servent à prévenir l'auteur de
      // l'annonce et à construire l'URL de la notification. Les redemander ensuite ferait une
      // requête de plus pour une donnée qu'on tient déjà.
      select: { id: true, userId: true, editionId: true },
    })
    expect(prismaMock.carpoolComment.create).toHaveBeenCalledWith({
      data: {
        carpoolOfferId: 1,
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

  it("devrait rejeter un ID d'offre de covoiturage invalide", async () => {
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
    prismaMock.carpoolOffer.findUnique.mockResolvedValue({ id: 1 })
    global.readBody.mockResolvedValue(emptyBody)

    await expect(handler(mockEvent as any)).rejects.toMatchObject({ statusCode: 400 })
    expect(prismaMock.carpoolComment.create).not.toHaveBeenCalled()
  })

  it("devrait valider que le contenu n'est pas seulement des espaces", async () => {
    const whitespaceBody = {
      content: '   ',
    }

    // La ressource parente doit exister pour atteindre la validation du contenu
    prismaMock.carpoolOffer.findUnique.mockResolvedValue({ id: 1 })
    global.readBody.mockResolvedValue(whitespaceBody)

    await expect(handler(mockEvent as any)).rejects.toMatchObject({ statusCode: 400 })
    expect(prismaMock.carpoolComment.create).not.toHaveBeenCalled()
  })

  it('devrait valider que le contenu existe', async () => {
    const noContentBody = {}

    // La ressource parente doit exister pour atteindre la validation du contenu
    prismaMock.carpoolOffer.findUnique.mockResolvedValue({ id: 1 })
    global.readBody.mockResolvedValue(noContentBody)

    await expect(handler(mockEvent as any)).rejects.toMatchObject({ statusCode: 400 })
    expect(prismaMock.carpoolComment.create).not.toHaveBeenCalled()
  })

  it('devrait rejeter si offre de covoiturage non trouvée', async () => {
    const requestBody = {
      content: 'Commentaire de test',
    }

    global.readBody.mockResolvedValue(requestBody)
    prismaMock.carpoolOffer.findUnique.mockResolvedValue(null)

    await expect(handler(mockEvent as any)).rejects.toThrow('Offre de covoiturage non trouvée')
  })

  it('devrait gérer les erreurs de base de données', async () => {
    const requestBody = {
      content: 'Commentaire de test',
    }

    global.readBody.mockResolvedValue(requestBody)
    prismaMock.carpoolOffer.findUnique.mockRejectedValue(new Error('Database error'))

    await expect(handler(mockEvent as any)).rejects.toThrow(
      'Erreur lors de la création du commentaire'
    )
  })

  it('devrait gérer les erreurs lors de la création du commentaire', async () => {
    const requestBody = {
      content: 'Commentaire de test',
    }

    const mockCarpoolOffer = {
      id: 1,
      editionId: 1,
      userId: 2,
    }

    global.readBody.mockResolvedValue(requestBody)
    prismaMock.carpoolOffer.findUnique.mockResolvedValue(mockCarpoolOffer)
    prismaMock.carpoolComment.create.mockRejectedValue(new Error('Creation error'))

    await expect(handler(mockEvent as any)).rejects.toThrow(
      'Erreur lors de la création du commentaire'
    )
  })

  it('devrait accepter un commentaire de 1 000 caractères', async () => {
    /*
     * ⚠️ CE TEST CONSACRAIT LE DÉFAUT. Il s'appelait « accepte un commentaire long » et employait
     * 1 120 caractères, vérifiant qu'ils passaient — c'est-à-dire **l'absence de borne**. La
     * colonne est un `TEXT` : on pouvait y déposer 64 Ko, que chaque chargement de la liste
     * retransportait ensuite.
     *
     * `commentSchema` borne à 1 000 depuis toujours ; il n'était simplement branché nulle part. Ce
     * cas garde la borne par le bas — un refus de TOUT commentaire long le satisferait sinon — et
     * le cas suivant la garde par le haut. Un seul des deux ne dirait pas OÙ elle est.
     */
    const longContent = 'a'.repeat(1000)
    const requestBody = {
      content: longContent,
    }

    const mockCarpoolOffer = { id: 1, editionId: 1, userId: 2 }
    const mockComment = createMockComment(longContent)

    global.readBody.mockResolvedValue(requestBody)
    prismaMock.carpoolOffer.findUnique.mockResolvedValue(mockCarpoolOffer)
    prismaMock.carpoolComment.create.mockResolvedValue(mockComment)

    const result = await handler(mockEvent as any)

    expect(result.data.content).toBe(longContent)
    expect(prismaMock.carpoolComment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          content: longContent,
        }),
      })
    )
  })

  it('devrait refuser un commentaire de plus de 1 000 caractères', async () => {
    /*
     * ⚠️ LE SECOND CÔTÉ DE LA BORNE, ET LE CODE QUI LA DIT.
     *
     * Sans ce cas, le test précédent serait satisfait par l'ABSENCE de borne — c'est exactement ce
     * qu'il mesurait avant. Et le `statusCode` compte autant que le refus : la `ZodError` levée par
     * le schéma était attrapée puis convertie en **500** par le `catch` du handler partagé. Brancher
     * le schéma sans faire remonter l'erreur aurait transformé une saisie trop longue en panne
     * serveur — un défaut déplacé, pas refermé.
     */
    prismaMock.carpoolOffer.findUnique.mockResolvedValue({ id: 1, editionId: 1, userId: 2 })
    global.readBody.mockResolvedValue({ content: 'a'.repeat(1001) })

    await expect(handler(mockEvent as any)).rejects.toMatchObject({ statusCode: 400 })
    expect(prismaMock.carpoolComment.create).not.toHaveBeenCalled()
  })

  it("devrait permettre à l'auteur de l'offre de commenter sa propre offre", async () => {
    const requestBody = {
      content: 'Mise à jour : encore 1 place disponible !',
    }

    // L'utilisateur connecté est aussi l'auteur de l'offre
    const mockCarpoolOffer = {
      id: 1,
      editionId: 1,
      userId: 1, // Même ID que l'utilisateur connecté
    }

    const mockComment = createMockComment(requestBody.content)

    global.readBody.mockResolvedValue(requestBody)
    prismaMock.carpoolOffer.findUnique.mockResolvedValue(mockCarpoolOffer)
    prismaMock.carpoolComment.create.mockResolvedValue(mockComment)

    const result = await handler(mockEvent as any)

    expect(result).toEqual({ success: true, data: mockComment })
  })
})
