import { describe, it, expect, beforeEach, vi } from 'vitest'

import handler from '../../../../../server/api/carpool-requests/[id]/index.put'

// Utiliser le mock global de Prisma défini dans test/setup-common.ts
const prismaMock = (globalThis as any).prisma

const mockEvent = {
  context: {
    params: { id: '1' },
    user: { id: 1, email: 'test@example.com', pseudo: 'testuser', isGlobalAdmin: false },
  },
}

const mockEventWithoutUser = {
  context: {
    params: { id: '1' },
  },
}

const mockCarpoolRequest = {
  id: 1,
  editionId: 1,
  userId: 1,
  tripDate: new Date('2024-07-15'),
  locationCity: 'Paris',
  seatsNeeded: 2,
  description: 'Recherche covoiturage',
  phoneNumber: null,
  createdAt: new Date(),
  user: { id: 1, pseudo: 'testuser' },
}

describe('/api/carpool-requests/[id] PUT', () => {
  beforeEach(() => {
    prismaMock.carpoolRequest.findUnique.mockReset()
    prismaMock.carpoolRequest.update.mockReset()
    global.readBody = vi.fn()
    global.getRouterParam = vi.fn().mockReturnValue('1')
  })

  it('devrait modifier une demande avec succès', async () => {
    const updateData = {
      locationCity: 'Lyon',
      seatsNeeded: 3,
      description: 'Nouvelle description',
    }

    global.readBody.mockResolvedValue(updateData)
    prismaMock.carpoolRequest.findUnique.mockResolvedValue(mockCarpoolRequest)
    prismaMock.carpoolRequest.update.mockResolvedValue({
      ...mockCarpoolRequest,
      ...updateData,
    })

    const result = await handler(mockEvent as any)

    expect(result.locationCity).toBe('Lyon')
    expect(result.seatsNeeded).toBe(3)
    expect(prismaMock.carpoolRequest.update).toHaveBeenCalled()
  })

  it('devrait rejeter si utilisateur non authentifié', async () => {
    await expect(handler(mockEventWithoutUser as any)).rejects.toThrow('Unauthorized')
  })

  it('devrait rejeter un ID de demande invalide', async () => {
    global.getRouterParam = vi.fn().mockReturnValue('invalid')
    global.readBody.mockResolvedValue({})

    await expect(handler(mockEvent as any)).rejects.toThrow('ID de demande invalide')
  })

  it('devrait rejeter si demande non trouvée', async () => {
    global.readBody.mockResolvedValue({ locationCity: 'Lyon' })
    prismaMock.carpoolRequest.findUnique.mockResolvedValue(null)

    await expect(handler(mockEvent as any)).rejects.toThrow('Demande de covoiturage introuvable')
  })

  it("devrait rejeter si l'utilisateur n'est pas le créateur", async () => {
    const requestByOtherUser = { ...mockCarpoolRequest, userId: 999 }
    global.readBody.mockResolvedValue({ locationCity: 'Lyon' })
    prismaMock.carpoolRequest.findUnique.mockResolvedValue(requestByOtherUser)

    await expect(handler(mockEvent as any)).rejects.toThrow(
      "Vous n'avez pas les droits pour modifier cette demande"
    )
  })

  it('devrait valider les places nécessaires (min 1)', async () => {
    global.readBody.mockResolvedValue({ seatsNeeded: 0 })

    await expect(handler(mockEvent as any)).rejects.toThrow()
  })

  it('devrait valider les places nécessaires (max 8)', async () => {
    global.readBody.mockResolvedValue({ seatsNeeded: 10 })

    await expect(handler(mockEvent as any)).rejects.toThrow()
  })

  it('devrait valider la longueur de la description (max 500)', async () => {
    const longDescription = 'a'.repeat(501)
    global.readBody.mockResolvedValue({ description: longDescription })

    await expect(handler(mockEvent as any)).rejects.toThrow()
  })

  it('devrait accepter une description vide', async () => {
    global.readBody.mockResolvedValue({ description: '' })
    prismaMock.carpoolRequest.findUnique.mockResolvedValue(mockCarpoolRequest)
    prismaMock.carpoolRequest.update.mockResolvedValue(mockCarpoolRequest)

    const result = await handler(mockEvent as any)

    expect(result).toBeDefined()
  })

  it('devrait permettre de modifier le numéro de téléphone', async () => {
    const updateData = { phoneNumber: '0612345678' }

    global.readBody.mockResolvedValue(updateData)
    prismaMock.carpoolRequest.findUnique.mockResolvedValue(mockCarpoolRequest)
    prismaMock.carpoolRequest.update.mockResolvedValue({
      ...mockCarpoolRequest,
      phoneNumber: '0612345678',
    })

    const result = await handler(mockEvent as any)

    expect(result.phoneNumber).toBe('0612345678')
  })

  it('devrait permettre de supprimer le numéro de téléphone (null)', async () => {
    global.readBody.mockResolvedValue({ phoneNumber: null })
    prismaMock.carpoolRequest.findUnique.mockResolvedValue({
      ...mockCarpoolRequest,
      phoneNumber: '0612345678',
    })
    prismaMock.carpoolRequest.update.mockResolvedValue({
      ...mockCarpoolRequest,
      phoneNumber: null,
    })

    const result = await handler(mockEvent as any)

    expect(result.phoneNumber).toBeNull()
  })

  it('devrait convertir tripDate en objet Date', async () => {
    const updateData = { tripDate: '2024-08-20T10:00:00Z' }

    global.readBody.mockResolvedValue(updateData)
    prismaMock.carpoolRequest.findUnique.mockResolvedValue(mockCarpoolRequest)
    prismaMock.carpoolRequest.update.mockResolvedValue({
      ...mockCarpoolRequest,
      tripDate: new Date('2024-08-20T10:00:00Z'),
    })

    await handler(mockEvent as any)

    expect(prismaMock.carpoolRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tripDate: expect.any(Date),
        }),
      })
    )
  })

  it('devrait trimmer les valeurs de chaînes', async () => {
    const updateData = {
      locationCity: '  Lyon  ',
      description: '  Test description  ',
    }

    global.readBody.mockResolvedValue(updateData)
    prismaMock.carpoolRequest.findUnique.mockResolvedValue(mockCarpoolRequest)
    prismaMock.carpoolRequest.update.mockResolvedValue({
      ...mockCarpoolRequest,
      locationCity: 'Lyon',
      description: 'Test description',
    })

    await handler(mockEvent as any)

    expect(prismaMock.carpoolRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          locationCity: 'Lyon',
          description: 'Test description',
        }),
      })
    )
  })

  it('devrait gérer les erreurs de base de données', async () => {
    global.readBody.mockResolvedValue({ locationCity: 'Lyon' })
    prismaMock.carpoolRequest.findUnique.mockRejectedValue(new Error('DB Error'))

    await expect(handler(mockEvent as any)).rejects.toThrow('Erreur serveur interne')
  })

  it('devrait relancer les erreurs HTTP', async () => {
    const httpError = {
      statusCode: 403,
      statusMessage: 'Access denied',
    }

    global.readBody.mockResolvedValue({ locationCity: 'Lyon' })
    prismaMock.carpoolRequest.findUnique.mockRejectedValue(httpError)

    await expect(handler(mockEvent as any)).rejects.toEqual(httpError)
  })
})
