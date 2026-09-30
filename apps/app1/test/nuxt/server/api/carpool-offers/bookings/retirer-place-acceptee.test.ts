import { describe, it, expect, beforeEach, vi } from 'vitest'

const placeRetiree = vi.hoisted(() => vi.fn(async () => ({ id: 'n1' })))
const demandeRefusee = vi.hoisted(() => vi.fn(async () => ({ id: 'n2' })))

vi.mock('../../../../../../server/utils/notification-service', () => ({
  NotificationHelpers: {
    carpoolBookingRevoked: placeRetiree,
    carpoolBookingRejected: demandeRefusee,
    carpoolBookingAccepted: vi.fn(async () => ({})),
    carpoolBookingCancelled: vi.fn(async () => ({})),
  },
  safeNotify: async (operation: () => Promise<unknown>) => {
    try {
      return await operation()
    } catch {
      return null
    }
  },
}))

import handler from '../../../../../../../../layers/carpool/server/api/carpool-offers/[id]/bookings/[bookingId].put'
import { global } from '../../../../globales-nitro'

const prismaMock = (globalThis as any).prisma

/**
 * Le conducteur peut retirer une place qu'il avait accordée.
 *
 * ⚠️ CE QUI MANQUAIT. `REJECT` exigeait que la réservation soit encore `PENDING` : une fois
 * acceptée, le conducteur ne pouvait plus retirer personne. Sa voiture peut pourtant tomber en
 * panne ou perdre une place — et il ne lui restait alors qu'à SUPPRIMER L'OFFRE ENTIÈRE, ce qui
 * prévient tout le monde pour retirer une seule personne.
 *
 * ⚠️ REJECTED et non CANCELLED pour ce retrait, et c'est un choix documenté : `CANCELLED` est le
 * geste du DEMANDEUR, `REJECTED` celui du CONDUCTEUR. Les confondre ferait lire « annulé » au
 * passager dans sa propre liste, comme s'il s'était désisté.
 *
 * Ce fichier est séparé de `put.test.ts` pour une raison de portée : il remplace le module de
 * notification, et le faire dans `put.test.ts` changerait le comportement de ses vingt tests, qui
 * exercent aujourd'hui le vrai service.
 */

const CONDUCTEUR = 1
const PASSAGER = 2
const OFFRE = 1
const RESERVATION = 2

const offre = {
  id: OFFRE,
  editionId: 1,
  userId: CONDUCTEUR,
  tripDate: new Date('2026-07-15'),
  locationCity: 'Lyon',
  availableSeats: 3,
  user: { id: CONDUCTEUR, pseudo: 'Conducteur' },
  bookings: [{ id: RESERVATION, status: 'ACCEPTED', seats: 2 }],
}

const reservationAcceptee = {
  id: RESERVATION,
  carpoolOfferId: OFFRE,
  requesterId: PASSAGER,
  seats: 2,
  status: 'ACCEPTED',
}

const evenementConducteur = {
  context: {
    params: { id: String(OFFRE), bookingId: String(RESERVATION) },
    user: { id: CONDUCTEUR, pseudo: 'Conducteur', isGlobalAdmin: false },
  },
}

const evenementPassager = {
  context: {
    params: { id: String(OFFRE), bookingId: String(RESERVATION) },
    user: { id: PASSAGER, pseudo: 'Passager', isGlobalAdmin: false },
  },
}

// `validateResourceId` lit les deux paramètres dans cet ordre : l'offre, puis la réservation.
const parametresDeRoute = () =>
  vi.fn().mockReturnValueOnce(String(OFFRE)).mockReturnValueOnce(String(RESERVATION))

describe('PUT bookings — retirer une place accordée', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.getRouterParam = parametresDeRoute()
    global.readBody = vi.fn().mockResolvedValue({ action: 'REJECT' })
    prismaMock.carpoolOffer.findUnique.mockReset()
    prismaMock.carpoolBooking.findUnique.mockReset()
    prismaMock.carpoolBooking.update.mockReset()
    prismaMock.carpoolOffer.findUnique.mockResolvedValue(offre)
    prismaMock.carpoolBooking.findUnique.mockResolvedValue(reservationAcceptee)
    prismaMock.carpoolBooking.update.mockResolvedValue({
      ...reservationAcceptee,
      status: 'REJECTED',
      requester: { id: PASSAGER, pseudo: 'Passager' },
    })
  })

  it('le conducteur retire une réservation ACCEPTÉE', async () => {
    const reponse: any = await handler(evenementConducteur as any)

    expect(reponse.data.status).toBe('REJECTED')
    expect(prismaMock.carpoolBooking.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: RESERVATION }, data: { status: 'REJECTED' } })
    )
  })

  it('prévient le passager par un message de RETRAIT, pas de refus', async () => {
    /*
     * Le passager avait une place et organisait son trajet autour. Lui dire « votre demande a été
     * refusée » serait faux et lui laisserait croire qu'il n'en avait jamais eu.
     */
    await handler(evenementConducteur as any)

    expect(placeRetiree).toHaveBeenCalledWith(PASSAGER, 'Conducteur', OFFRE, 2, 'Lyon')
    expect(demandeRefusee).not.toHaveBeenCalled()
  })

  it('refuse toujours une DEMANDE en attente par le message de refus', async () => {
    // La distinction doit tenir dans les deux sens : un refus reste un refus.
    prismaMock.carpoolBooking.findUnique.mockResolvedValue({
      ...reservationAcceptee,
      status: 'PENDING',
    })

    await handler(evenementConducteur as any)

    expect(demandeRefusee).toHaveBeenCalled()
    expect(placeRetiree).not.toHaveBeenCalled()
  })

  it('un PASSAGER ne peut pas retirer, même sa propre réservation', async () => {
    // `REJECT` reste le geste du conducteur. Le passager a `CANCEL`, qui écrit un autre statut et
    // envoie une autre notification — lui ouvrir `REJECT` brouillerait qui a décidé quoi.
    await expect(handler(evenementPassager as any)).rejects.toThrow('Action non autorisée')
    expect(prismaMock.carpoolBooking.update).not.toHaveBeenCalled()
  })

  it('ne permet pas de retirer une réservation déjà REFUSÉE', async () => {
    // Rien à retirer : elle n'a jamais donné de place. Le laisser passer enverrait au passager une
    // seconde notification pour une décision déjà prise.
    prismaMock.carpoolBooking.findUnique.mockResolvedValue({
      ...reservationAcceptee,
      status: 'REJECTED',
    })

    await expect(handler(evenementConducteur as any)).rejects.toThrow('Réservation déjà traitée')
    expect(placeRetiree).not.toHaveBeenCalled()
  })

  it('ne permet pas de retirer une réservation ANNULÉE par le demandeur', async () => {
    // Le passager s'est désisté de lui-même : le conducteur n'a plus rien à retirer, et le faire
    // réécrirait son geste en refus.
    prismaMock.carpoolBooking.findUnique.mockResolvedValue({
      ...reservationAcceptee,
      status: 'CANCELLED',
    })

    await expect(handler(evenementConducteur as any)).rejects.toThrow('Réservation déjà traitée')
  })

  it('une action INCONNUE répond 400, et n’écrit rien', async () => {
    /*
     * Le défaut le plus discret du lot : l'ancien contrôle ne refusait que l'ABSENCE d'action. Une
     * valeur comme « DECLINE » passait donc, `newStatus` restait égal au statut courant, et
     * l'`update` réécrivait la même valeur. L'appelant recevait un 200 et une réservation intacte,
     * sans jamais savoir que son action n'existait pas.
     */
    global.readBody = vi.fn().mockResolvedValue({ action: 'DECLINE' })

    await expect(handler(evenementConducteur as any)).rejects.toThrow('Données invalides')
    expect(prismaMock.carpoolBooking.update).not.toHaveBeenCalled()
  })

  it('une action en MINUSCULES est refusée, elle aussi', async () => {
    // `z.enum` est sensible à la casse, et c'est voulu : accepter « reject » obligerait à
    // normaliser partout, et la première omission rouvrirait le 200 silencieux.
    global.readBody = vi.fn().mockResolvedValue({ action: 'reject' })

    await expect(handler(evenementConducteur as any)).rejects.toThrow('Données invalides')
    expect(prismaMock.carpoolBooking.update).not.toHaveBeenCalled()
  })
})
