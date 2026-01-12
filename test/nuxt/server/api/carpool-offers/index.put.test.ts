import { describe, it, expect, beforeEach, vi } from 'vitest'

import handler from '../../../../../server/api/carpool-offers/[id]/index.put'

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

const mockCarpoolOffer = {
  id: 1,
  editionId: 1,
  userId: 1,
  tripDate: new Date('2024-07-15'),
  locationCity: 'Paris',
  locationAddress: '10 rue de Paris',
  availableSeats: 3,
  description: 'Covoiturage sympa',
  smokingAllowed: false,
  petsAllowed: true,
  musicAllowed: true,
  phoneNumber: null,
  createdAt: new Date(),
  user: { id: 1, pseudo: 'testuser' },
}

describe('/api/carpool-offers/[id] PUT', () => {
  beforeEach(() => {
    prismaMock.carpoolOffer.findUnique.mockReset()
    prismaMock.carpoolOffer.update.mockReset()
    global.readBody = vi.fn()
    global.getRouterParam = vi.fn().mockReturnValue('1')
  })

  it('devrait modifier une offre avec succès', async () => {
    const updateData = {
      locationCity: 'Lyon',
      availableSeats: 4,
      description: 'Nouveau description',
    }

    global.readBody.mockResolvedValue(updateData)
    prismaMock.carpoolOffer.findUnique.mockResolvedValue(mockCarpoolOffer)
    prismaMock.carpoolOffer.update.mockResolvedValue({
      ...mockCarpoolOffer,
      ...updateData,
    })

    const result = await handler(mockEvent as any)

    expect(result.locationCity).toBe('Lyon')
    expect(result.availableSeats).toBe(4)
    expect(prismaMock.carpoolOffer.update).toHaveBeenCalled()
  })

  it('devrait rejeter si utilisateur non authentifié', async () => {
    await expect(handler(mockEventWithoutUser as any)).rejects.toThrow('Unauthorized')
  })

  it("devrait rejeter un ID d'offre invalide", async () => {
    global.getRouterParam = vi.fn().mockReturnValue('invalid')
    global.readBody.mockResolvedValue({})

    await expect(handler(mockEvent as any)).rejects.toThrow("ID d'offre invalide")
  })

  it('devrait rejeter si offre non trouvée', async () => {
    global.readBody.mockResolvedValue({ locationCity: 'Lyon' })
    prismaMock.carpoolOffer.findUnique.mockResolvedValue(null)

    await expect(handler(mockEvent as any)).rejects.toThrow('Offre de covoiturage introuvable')
  })

  it("devrait rejeter si l'utilisateur n'est pas le créateur", async () => {
    const offerByOtherUser = { ...mockCarpoolOffer, userId: 999 }
    global.readBody.mockResolvedValue({ locationCity: 'Lyon' })
    prismaMock.carpoolOffer.findUnique.mockResolvedValue(offerByOtherUser)

    await expect(handler(mockEvent as any)).rejects.toThrow(
      "Vous n'avez pas les droits pour modifier cette offre"
    )
  })

  it('devrait valider les places disponibles (min 1)', async () => {
    global.readBody.mockResolvedValue({ availableSeats: 0 })

    await expect(handler(mockEvent as any)).rejects.toThrow()
  })

  it('devrait valider les places disponibles (max 8)', async () => {
    global.readBody.mockResolvedValue({ availableSeats: 10 })

    await expect(handler(mockEvent as any)).rejects.toThrow()
  })

  it('devrait valider la longueur de la description (max 500)', async () => {
    const longDescription = 'a'.repeat(501)
    global.readBody.mockResolvedValue({ description: longDescription })

    await expect(handler(mockEvent as any)).rejects.toThrow()
  })

  it('devrait accepter une description vide', async () => {
    global.readBody.mockResolvedValue({ description: '' })
    prismaMock.carpoolOffer.findUnique.mockResolvedValue(mockCarpoolOffer)
    prismaMock.carpoolOffer.update.mockResolvedValue(mockCarpoolOffer)

    const result = await handler(mockEvent as any)

    expect(result).toBeDefined()
  })

  it('devrait permettre de modifier le numéro de téléphone', async () => {
    const updateData = { phoneNumber: '0612345678' }

    global.readBody.mockResolvedValue(updateData)
    prismaMock.carpoolOffer.findUnique.mockResolvedValue(mockCarpoolOffer)
    prismaMock.carpoolOffer.update.mockResolvedValue({
      ...mockCarpoolOffer,
      phoneNumber: '0612345678',
    })

    const result = await handler(mockEvent as any)

    expect(result.phoneNumber).toBe('0612345678')
  })

  it('devrait permettre de supprimer le numéro de téléphone (null)', async () => {
    global.readBody.mockResolvedValue({ phoneNumber: null })
    prismaMock.carpoolOffer.findUnique.mockResolvedValue({
      ...mockCarpoolOffer,
      phoneNumber: '0612345678',
    })
    prismaMock.carpoolOffer.update.mockResolvedValue({
      ...mockCarpoolOffer,
      phoneNumber: null,
    })

    const result = await handler(mockEvent as any)

    expect(result.phoneNumber).toBeNull()
  })

  it('devrait permettre de modifier les préférences (fumeur, animaux, musique)', async () => {
    const updateData = {
      smokingAllowed: true,
      petsAllowed: false,
      musicAllowed: false,
    }

    global.readBody.mockResolvedValue(updateData)
    prismaMock.carpoolOffer.findUnique.mockResolvedValue(mockCarpoolOffer)
    prismaMock.carpoolOffer.update.mockResolvedValue({
      ...mockCarpoolOffer,
      ...updateData,
    })

    const result = await handler(mockEvent as any)

    expect(result.smokingAllowed).toBe(true)
    expect(result.petsAllowed).toBe(false)
    expect(result.musicAllowed).toBe(false)
  })

  it('devrait convertir tripDate en objet Date', async () => {
    const updateData = { tripDate: '2024-08-20T10:00:00Z' }

    global.readBody.mockResolvedValue(updateData)
    prismaMock.carpoolOffer.findUnique.mockResolvedValue(mockCarpoolOffer)
    prismaMock.carpoolOffer.update.mockResolvedValue({
      ...mockCarpoolOffer,
      tripDate: new Date('2024-08-20T10:00:00Z'),
    })

    await handler(mockEvent as any)

    expect(prismaMock.carpoolOffer.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tripDate: expect.any(Date),
        }),
      })
    )
  })

  it('devrait gérer les erreurs de base de données', async () => {
    global.readBody.mockResolvedValue({ locationCity: 'Lyon' })
    prismaMock.carpoolOffer.findUnique.mockRejectedValue(new Error('DB Error'))

    await expect(handler(mockEvent as any)).rejects.toThrow('Erreur serveur interne')
  })

  it('devrait relancer les erreurs HTTP', async () => {
    const httpError = {
      statusCode: 403,
      statusMessage: 'Access denied',
    }

    global.readBody.mockResolvedValue({ locationCity: 'Lyon' })
    prismaMock.carpoolOffer.findUnique.mockRejectedValue(httpError)

    await expect(handler(mockEvent as any)).rejects.toEqual(httpError)
  })
})
