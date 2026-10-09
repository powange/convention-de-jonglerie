import { describe, it, expect, beforeEach, vi } from 'vitest'

import handler from '../../../../../../../layers/carpool/server/api/carpool-offers/[id]/index.put'
import { global } from '../../../globales-nitro'

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
    prismaMock.carpoolBooking.findMany.mockReset()
    /*
     * Un changement de date ou de ville de départ prévient les passagers acceptés : le handler lit
     * donc leurs réservations. À vide par défaut — la plupart de ces tests ne portent pas sur la
     * notification, et les mocker ici évite d'en faire dépendre leur passage.
     */
    prismaMock.carpoolBooking.findMany.mockResolvedValue([])
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

    expect(result.data.locationCity).toBe('Lyon')
    expect(result.data.availableSeats).toBe(4)
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
    /*
     * ⚠️ UN NUMÉRO INTERNATIONAL, et ce test CONSACRAIT le défaut.
     *
     * Il employait `'0612345678'` — un numéro national — et vérifiait qu'il était accepté. C'était
     * précisément le défaut : la mise à jour ne validait pas le format, alors que la CRÉATION
     * l'exige et que le lien `tel:` de l'écran suppose le `+…`. Le test ne décrivait pas une
     * tolérance, il figeait l'absence de règle.
     */
    const updateData = { phoneNumber: '+33612345678' }

    global.readBody.mockResolvedValue(updateData)
    prismaMock.carpoolOffer.findUnique.mockResolvedValue(mockCarpoolOffer)
    prismaMock.carpoolOffer.update.mockResolvedValue({
      ...mockCarpoolOffer,
      phoneNumber: '+33612345678',
    })

    const result = await handler(mockEvent as any)

    expect(result.data.phoneNumber).toBe('+33612345678')
  })

  it('devrait permettre de supprimer le numéro de téléphone (null)', async () => {
    global.readBody.mockResolvedValue({ phoneNumber: null })
    prismaMock.carpoolOffer.findUnique.mockResolvedValue({
      ...mockCarpoolOffer,
      phoneNumber: '+33612345678',
    })
    prismaMock.carpoolOffer.update.mockResolvedValue({
      ...mockCarpoolOffer,
      phoneNumber: null,
    })

    const result = await handler(mockEvent as any)

    expect(result.data.phoneNumber).toBeNull()
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

    expect(result.data.smokingAllowed).toBe(true)
    expect(result.data.petsAllowed).toBe(false)
    expect(result.data.musicAllowed).toBe(false)
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
  /**
   * On ne descend pas les places sous ce qui a déjà été accordé.
   *
   * ## Le défaut
   *
   * La mise à jour acceptait n'importe quel `availableSeats` entre 1 et 8 **sans le comparer aux
   * réservations acceptées**. Un conducteur ayant accordé trois places pouvait passer à une :
   * `carpool-transform.ts` ramène alors `remainingSeats` à 0 par un `Math.max`, **l'écran reste
   * parfaitement plausible**, et trois passagers gardent une réservation confirmée pour une seule
   * place. Personne n'est prévenu, et rien dans la donnée ne dit que le compte est faux.
   *
   * 📍 LA GARDE MANQUAIT D'UN SEUL CÔTÉ : l'acceptation d'une réservation vérifie bien la capacité.
   * Une capacité se contrôle aux DEUX bouts — on peut la dépasser en ajoutant des passagers, ou en
   * retirant des places.
   */
  describe('places et réservations déjà accordées', () => {
    const avecPlacesAccordees = (places: number[]) => {
      prismaMock.carpoolOffer.findUnique.mockResolvedValue(mockCarpoolOffer)
      prismaMock.carpoolBooking.findMany.mockResolvedValue(places.map((seats) => ({ seats })))
      prismaMock.carpoolOffer.update.mockResolvedValue(mockCarpoolOffer)
    }

    it('refuse de descendre sous la somme des places accordées, et dit laquelle', async () => {
      global.readBody.mockResolvedValue({ availableSeats: 1 })
      avecPlacesAccordees([2, 1])

      await expect(handler(mockEvent as any)).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining('3 place'),
        data: { field: 'availableSeats', minimum: 3 },
      })
      // Rien n'est écrit : le refus précède l'`update`.
      expect(prismaMock.carpoolOffer.update).not.toHaveBeenCalled()
    })

    it('accepte de ramener les places EXACTEMENT au nombre accordé', async () => {
      /*
       * ⚠️ `<` et non `<=` : c'est ce que fait un conducteur dont la voiture est pleine et qui veut
       * fermer son offre aux demandes suivantes. Le refuser l'obligerait à supprimer l'offre, ce
       * qui prévient tout le monde pour n'empêcher que de nouvelles demandes.
       */
      global.readBody.mockResolvedValue({ availableSeats: 3 })
      avecPlacesAccordees([2, 1])

      await handler(mockEvent as any)
      expect(prismaMock.carpoolOffer.update).toHaveBeenCalled()
    })

    it('accepte d’augmenter les places', async () => {
      global.readBody.mockResolvedValue({ availableSeats: 6 })
      avecPlacesAccordees([2, 1])

      await handler(mockEvent as any)
      expect(prismaMock.carpoolOffer.update).toHaveBeenCalled()
    })

    it('accepte quand aucune réservation n’est accordée', async () => {
      global.readBody.mockResolvedValue({ availableSeats: 1 })
      avecPlacesAccordees([])

      await handler(mockEvent as any)
      expect(prismaMock.carpoolOffer.update).toHaveBeenCalled()
    })

    it('n’interroge pas les réservations quand les places ne changent pas', async () => {
      /*
       * Le cas de très loin le plus fréquent — on modifie une description, un téléphone. Payer une
       * requête pour une garde qui n'a rien à garder serait un coût pour rien.
       */
      global.readBody.mockResolvedValue({ description: 'Autre texte' })
      prismaMock.carpoolOffer.findUnique.mockResolvedValue(mockCarpoolOffer)
      prismaMock.carpoolOffer.update.mockResolvedValue(mockCarpoolOffer)

      await handler(mockEvent as any)
      expect(prismaMock.carpoolBooking.findMany).not.toHaveBeenCalled()
    })

    it('ne compte QUE les réservations acceptées', async () => {
      /*
       * ⚠️ L'ASSERTION QUI N'EST PAS CREUSE. Le mock central IGNORE le `where` : tous les cas
       * ci-dessus resteraient VERTS si la garde comptait aussi les réservations en attente ou
       * annulées — et un conducteur se verrait alors refuser une réduction à cause de demandes
       * qu'il n'a jamais acceptées.
       */
      global.readBody.mockResolvedValue({ availableSeats: 3 })
      avecPlacesAccordees([2, 1])

      await handler(mockEvent as any)
      expect(prismaMock.carpoolBooking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { carpoolOfferId: 1, status: 'ACCEPTED' },
        })
      )
    })
  })
  /**
   * Une date invalide doit rendre 400, et non 500.
   *
   * ⚠️ POURQUOI CE CAS EXISTE EN PLUS DES TESTS DE SCHÉMA. Éprouver `updateCarpoolOfferSchema`
   * prouve que la règle est juste ; il ne prouve PAS qu'elle est branchée sur ce point d'API. Et
   * c'est exactement le défaut d'origine : la règle existait à la création, pas à la mise à jour.
   *
   * Le handler faisait `new Date(val)` sans contrôle. `new Date('demain')` donne un `Invalid Date`
   * que Prisma rejette — et la réponse était un **500**, c'est-à-dire « le serveur a un problème »
   * là où le client avait simplement mal saisi.
   */
  describe('date invalide', () => {
    it('rend 400 et non 500', async () => {
      global.readBody.mockResolvedValue({ tripDate: 'demain' })
      prismaMock.carpoolOffer.findUnique.mockResolvedValue(mockCarpoolOffer)

      await expect(handler(mockEvent as any)).rejects.toMatchObject({ statusCode: 400 })
      // Rien n'est écrit : le refus vient de la validation, avant toute requête.
      expect(prismaMock.carpoolOffer.update).not.toHaveBeenCalled()
    })

    it('rend 400 sur un numéro non international', async () => {
      global.readBody.mockResolvedValue({ phoneNumber: '0612345678' })
      prismaMock.carpoolOffer.findUnique.mockResolvedValue(mockCarpoolOffer)

      await expect(handler(mockEvent as any)).rejects.toMatchObject({ statusCode: 400 })
      expect(prismaMock.carpoolOffer.update).not.toHaveBeenCalled()
    })
  })
})
