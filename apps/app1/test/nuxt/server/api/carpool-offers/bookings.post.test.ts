import { describe, it, expect, beforeEach, vi } from 'vitest'

import handler from '../../../../../../../layers/carpool/server/api/carpool-offers/[id]/bookings.post'
import { global } from '../../../globales-nitro'

const prismaMock = (globalThis as any).prisma

vi.mock('../../../../../../../apps/app1/server/utils/auth-utils', () => ({
  requireAuth: vi.fn((event: any) => {
    if (!event.context.user) {
      const erreur = new Error('Non authentifié')
      ;(erreur as any).statusCode = 401
      throw erreur
    }
    return event.context.user
  }),
}))

vi.mock('../../../../../../../apps/app1/server/utils/notification-service', () => ({
  safeNotify: vi.fn(async (action: () => unknown) => action()),
  NotificationHelpers: { carpoolBookingReceived: vi.fn() },
}))

/**
 * Réserver une place sur une offre de covoiturage.
 *
 * ## ⚠️ CE FICHIER NE TESTAIT RIEN
 *
 * Il contenait six « smoke tests » qui assertaient `true === true`, qu'un objet littéral portait
 * les propriétés qu'on venait d'y écrire, et que `['PENDING', …]` contenait `'PENDING'`. Pas une
 * seule ligne n'appelait le handler. Son commentaire s'en justifiait par une « complexité de
 * mocking trop élevée pour `requireUserSession` » — **or ce handler n'emploie pas
 * `requireUserSession`** : il emploie `requireAuth`, que des dizaines de tests de ce dépôt
 * remplacent en quatre lignes. La justification était fausse, et elle a tenu le fichier vide.
 *
 * ## Les deux défauts que ces cas ferment
 *
 * **1. Aucun contrôle de `tripDate`.** La liste des offres filtre bien sur `tripDate >= now`, mais
 * l'option « Afficher tout » les ramène : une offre passée restait **réservable**, le formulaire
 * n'étant gardé que par les places restantes. Le conducteur recevait une notification pour un
 * trajet **terminé**.
 *
 * **2. La garde anti-doublon ne regardait que `PENDING`.** Un passager déjà ACCEPTÉ pouvait déposer
 * une seconde réservation, et il comptait alors **deux fois** dans les places du conducteur.
 */
describe('/api/carpool-offers/[id]/bookings POST', () => {
  const MOI = { id: 2, pseudo: 'Passagère', isGlobalAdmin: false }

  const demain = () => new Date(Date.now() + 24 * 60 * 60 * 1000)
  const hier = () => new Date(Date.now() - 24 * 60 * 60 * 1000)

  const offre = (p: Record<string, unknown> = {}) => ({
    id: 1,
    userId: 99,
    editionId: 1,
    tripDate: demain(),
    availableSeats: 4,
    bookings: [],
    user: { id: 99, pseudo: 'Conducteur' },
    ...p,
  })

  const evenement = () => ({
    context: { user: MOI, params: { id: '1' } },
    node: { req: { url: '/api/carpool-offers/1/bookings', headers: {}, method: 'POST' } },
  })

  beforeEach(() => {
    vi.clearAllMocks()
    global.readBody = vi.fn().mockResolvedValue({ seats: 1 })
    prismaMock.carpoolOffer.findUnique.mockResolvedValue(offre())
    prismaMock.carpoolBooking.findFirst.mockResolvedValue(null)
    prismaMock.carpoolBooking.create.mockResolvedValue({
      id: 10,
      requester: { id: MOI.id, pseudo: MOI.pseudo },
    })
  })

  it('crée la réservation sur un trajet à venir', async () => {
    const resultat: any = await handler(evenement() as any)
    expect(resultat.data.id).toBe(10)
    expect(prismaMock.carpoolBooking.create).toHaveBeenCalled()
  })

  it('refuse un visiteur anonyme', async () => {
    await expect(handler({ context: { params: { id: '1' } } } as any)).rejects.toMatchObject({
      statusCode: 401,
    })
    expect(prismaMock.carpoolBooking.create).not.toHaveBeenCalled()
  })

  describe('un trajet déjà passé', () => {
    it('refuse en 400, et le dit', async () => {
      prismaMock.carpoolOffer.findUnique.mockResolvedValue(offre({ tripDate: hier() }))

      await expect(handler(evenement() as any)).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining('déjà passé'),
      })
      expect(prismaMock.carpoolBooking.create).not.toHaveBeenCalled()
    })

    it('accepte un trajet qui part dans une minute', async () => {
      /*
       * ⚠️ LE TÉMOIN QUI BORNE LA GARDE. Sans lui, un refus de TOUT trajet la satisferait aussi — et
       * plus personne ne pourrait réserver. La réservation n'a aucune tolérance, contrairement à la
       * création d'une offre : c'est « passé » ou « à venir », et la frontière est mesurée.
       */
      prismaMock.carpoolOffer.findUnique.mockResolvedValue(
        offre({ tripDate: new Date(Date.now() + 60_000) })
      )

      await handler(evenement() as any)
      expect(prismaMock.carpoolBooking.create).toHaveBeenCalled()
    })
  })

  describe('une réservation déjà vivante du même passager', () => {
    it('refuse quand elle est en attente', async () => {
      prismaMock.carpoolBooking.findFirst.mockResolvedValue({ id: 5, status: 'PENDING' })

      await expect(handler(evenement() as any)).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining('en attente'),
      })
    })

    it('refuse quand elle est ACCEPTÉE, avec un message qui le dit', async () => {
      /*
       * Le défaut : la garde ne regardait que `PENDING`. Un passager déjà accepté comptait DEUX
       * fois dans les places du conducteur — une place accordée plus une demande en attente pour la
       * même personne.
       */
      prismaMock.carpoolBooking.findFirst.mockResolvedValue({ id: 5, status: 'ACCEPTED' })

      await expect(handler(evenement() as any)).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining('déjà une place'),
      })
      expect(prismaMock.carpoolBooking.create).not.toHaveBeenCalled()
    })

    it('ne regarde QUE les réservations en attente ou acceptées', async () => {
      /*
       * ⚠️ L'ASSERTION QUI N'EST PAS CREUSE. Le mock central IGNORE le `where` : les deux cas
       * ci-dessus resteraient VERTS si la garde bloquait aussi sur `REJECTED` ou `CANCELLED` — et
       * un passager refusé une fois ne pourrait plus jamais redemander, alors que le conducteur a
       * peut-être libéré une place depuis.
       */
      await handler(evenement() as any)
      expect(prismaMock.carpoolBooking.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: { in: ['PENDING', 'ACCEPTED'] } }),
        })
      )
    })
  })

  describe('les gardes qui existaient déjà', () => {
    it('refuse au conducteur de réserver sa propre offre', async () => {
      prismaMock.carpoolOffer.findUnique.mockResolvedValue(offre({ userId: MOI.id }))
      await expect(handler(evenement() as any)).rejects.toMatchObject({ statusCode: 400 })
    })

    it('refuse quand il ne reste pas assez de places', async () => {
      global.readBody = vi.fn().mockResolvedValue({ seats: 2 })
      prismaMock.carpoolOffer.findUnique.mockResolvedValue(
        offre({ availableSeats: 3, bookings: [{ status: 'ACCEPTED', seats: 2 }] })
      )
      await expect(handler(evenement() as any)).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining('places disponibles'),
      })
    })

    it('refuse une offre introuvable', async () => {
      prismaMock.carpoolOffer.findUnique.mockResolvedValue(null)
      await expect(handler(evenement() as any)).rejects.toMatchObject({ statusCode: 404 })
    })
  })

  it('prévient le conducteur APRÈS la création, jamais avant', async () => {
    // Annoncer une réservation qui pourrait échouer est le défaut déjà payé sur le courriel de
    // suppression de compte : l'ordre se mesure, il ne se suppose pas.
    const { NotificationHelpers } =
      await import('../../../../../../../apps/app1/server/utils/notification-service')
    await handler(evenement() as any)
    expect(prismaMock.carpoolBooking.create.mock.invocationCallOrder[0]).toBeLessThan(
      (NotificationHelpers.carpoolBookingReceived as any).mock.invocationCallOrder[0]
    )
  })
})
