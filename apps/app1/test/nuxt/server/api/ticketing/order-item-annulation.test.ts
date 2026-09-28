import { describe, it, expect, beforeEach, vi } from 'vitest'

const mockCanManage = vi.hoisted(() => vi.fn())
const mockCanAccess = vi.hoisted(() => vi.fn())

vi.mock('#server/utils/permissions/edition-permissions', () => ({
  canManageTicketingById: mockCanManage,
  canAccessEditionDataOrAccessControl: mockCanAccess,
}))

const mockJournal = vi.hoisted(() => vi.fn())
vi.mock('#server/utils/ticketing/journal-des-entrees', () => ({
  journaliserMouvementDEntree: mockJournal,
}))

import annulation from '../../../../../../../layers/ticketing/server/api/editions/[id]/ticketing/order-items/[itemId]/cancellation.patch'
import remboursement from '../../../../../../../layers/ticketing/server/api/editions/[id]/ticketing/order-items/[itemId]/refund.patch'
import { global } from '../../../globales-nitro'

const prismaMock = (globalThis as any).prisma

const evenement = {
  context: { params: { id: '22', itemId: '77' }, user: { id: 5, pseudo: 'orga' } },
}

/** Ce qui a été écrit sur le billet. */
const ecrit = () => prismaMock.ticketingOrderItem.update.mock.calls[0]?.[0]?.data

/**
 * Annuler un billet, et dire si on a rendu l'argent.
 *
 * Deux gestes distincts, et c'est tout le propos du lot : **annulé ne veut pas dire remboursé**.
 * Un billet réglé puis annulé reste une dette tant que personne n'a coché la case.
 *
 * Les deux points d'API ne portent volontairement pas la même garde : annuler relève de la
 * gestion de la billetterie, rembourser se fait à la porte, face à la personne, par qui tient le
 * contrôle d'accès.
 */
describe('annulation et remboursement d’un billet', () => {
  const billet = (surcharge: Record<string, unknown> = {}) => ({
    id: 77,
    state: 'Processed',
    refunded: false,
    entryValidated: false,
    order: { editionId: 22, status: 'Onsite' },
    ...surcharge,
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockCanManage.mockResolvedValue(true)
    mockCanAccess.mockResolvedValue(true)
    prismaMock.ticketingOrderItem.findUnique.mockResolvedValue(billet())
    prismaMock.ticketingOrderItem.update.mockResolvedValue({})
  })

  const annuler = (body: unknown) => {
    global.readBody = vi.fn().mockResolvedValue(body)
    return annulation(evenement as any)
  }

  const rembourser = (body: unknown) => {
    global.readBody = vi.fn().mockResolvedValue(body)
    return remboursement(evenement as any)
  }

  describe('annuler', () => {
    it('écrit l’état, la date et l’auteur', async () => {
      await annuler({ canceled: true })

      expect(ecrit()).toMatchObject({ state: 'Canceled', canceledById: 5 })
      expect(ecrit().canceledAt).toBeInstanceOf(Date)
    })

    it('accepte désormais un billet venu d’une billetterie externe', async () => {
      // HelloAsso sait rembourser une commande ENTIÈRE — l'annulation de commande continue de
      // renvoyer vers elle — mais pas une partie. On ouvre exactement ce qu'elle ne sait pas
      // faire, et la synchronisation respecte l'annulation grâce à `canceledAt`.
      prismaMock.ticketingOrderItem.findUnique.mockResolvedValue(
        billet({ order: { editionId: 22, status: 'Processed' } })
      )

      await expect(annuler({ canceled: true })).resolves.toBeDefined()
      expect(ecrit()).toMatchObject({ state: 'Canceled' })
    })

    it('refuse un billet d’une autre édition', async () => {
      prismaMock.ticketingOrderItem.findUnique.mockResolvedValue(
        billet({ order: { editionId: 999, status: 'Onsite' } })
      )

      await expect(annuler({ canceled: true })).rejects.toMatchObject({ statusCode: 403 })
    })

    it('refuse sans le droit de gérer la billetterie', async () => {
      mockCanManage.mockResolvedValue(false)

      await expect(annuler({ canceled: true })).rejects.toMatchObject({ statusCode: 403 })
      expect(prismaMock.ticketingOrderItem.findUnique).not.toHaveBeenCalled()
    })
  })

  describe('un billet annulé ne reste pas « entré »', () => {
    it('dévalide l’entrée et l’inscrit au journal', async () => {
      /**
       * Le drapeau seul ne suffirait pas : le graphique d'affluence se lit sur le JOURNAL des
       * mouvements, et une personne dont l'entrée est effacée sans trace y resterait comptée
       * présente jusqu'à la fin de l'édition. Les deux écritures vont ensemble.
       */
      prismaMock.ticketingOrderItem.findUnique.mockResolvedValue(billet({ entryValidated: true }))

      await annuler({ canceled: true })

      expect(ecrit()).toMatchObject({
        entryValidated: false,
        entryValidatedAt: null,
        entryValidatedBy: null,
      })
      expect(mockJournal).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'ticket',
          participantIds: [77],
          mouvement: 'INVALIDATED',
          actorId: 5,
        })
      )
    })

    it('n’écrit rien au journal pour un billet jamais entré', async () => {
      // Un mouvement de sortie sans entrée correspondante fausserait la courbe dans l'autre sens.
      await annuler({ canceled: true })

      expect(ecrit()).not.toHaveProperty('entryValidated')
      expect(mockJournal).not.toHaveBeenCalled()
    })
  })

  describe('revenir sur une annulation', () => {
    it('rend au billet l’état que dit le paiement de sa commande', async () => {
      prismaMock.ticketingOrderItem.findUnique.mockResolvedValue(
        billet({
          state: 'Canceled',
          order: { editionId: 22, externalTicketingId: null, status: 'Onsite' },
        })
      )

      await annuler({ canceled: false })

      expect(ecrit()).toMatchObject({ state: 'Processed', canceledAt: null, canceledById: null })
    })

    it('le rend « en attente » si la commande n’était pas réglée', async () => {
      prismaMock.ticketingOrderItem.findUnique.mockResolvedValue(
        billet({ state: 'Canceled', order: { editionId: 22, status: 'Pending' } })
      )

      await annuler({ canceled: false })

      expect(ecrit()).toMatchObject({ state: 'Pending' })
    })

    it('refuse de rétablir un billet déjà remboursé', async () => {
      // Le remettre en circulation après avoir rendu l'argent donnerait une entrée gratuite.
      prismaMock.ticketingOrderItem.findUnique.mockResolvedValue(
        billet({ state: 'Canceled', refunded: true })
      )

      await expect(annuler({ canceled: false })).rejects.toMatchObject({ statusCode: 400 })
      expect(prismaMock.ticketingOrderItem.update).not.toHaveBeenCalled()
    })
  })

  describe('rembourser', () => {
    it('écrit la case, la date et l’auteur', async () => {
      prismaMock.ticketingOrderItem.findUnique.mockResolvedValue(billet({ state: 'Canceled' }))

      await rembourser({ refunded: true })

      expect(ecrit()).toMatchObject({ refunded: true, refundedById: 5 })
      expect(ecrit().refundedAt).toBeInstanceOf(Date)
    })

    it('refuse de rembourser un billet qui n’est pas annulé', async () => {
      // Sinon on rendrait l'argent d'un billet qui donne toujours droit d'entrée.
      await expect(rembourser({ refunded: true })).rejects.toMatchObject({ statusCode: 400 })
      expect(prismaMock.ticketingOrderItem.update).not.toHaveBeenCalled()
    })

    it('efface la date et l’auteur quand on décoche', async () => {
      prismaMock.ticketingOrderItem.findUnique.mockResolvedValue(
        billet({ state: 'Canceled', refunded: true })
      )

      await rembourser({ refunded: false })

      expect(ecrit()).toMatchObject({ refunded: false, refundedAt: null, refundedById: null })
    })

    it('s’ouvre à qui tient le contrôle d’accès, et pas seulement aux gestionnaires', async () => {
      // C'est à la porte qu'on rend l'argent : exiger le droit billetterie obligerait le bénévole
      // à aller chercher un responsable, la personne devant lui.
      mockCanManage.mockResolvedValue(false)
      mockCanAccess.mockResolvedValue(true)
      prismaMock.ticketingOrderItem.findUnique.mockResolvedValue(billet({ state: 'Canceled' }))

      await expect(rembourser({ refunded: true })).resolves.toBeDefined()
    })

    it('refuse qui ne tient pas le contrôle d’accès', async () => {
      mockCanAccess.mockResolvedValue(false)

      await expect(rembourser({ refunded: true })).rejects.toMatchObject({ statusCode: 403 })
      expect(prismaMock.ticketingOrderItem.findUnique).not.toHaveBeenCalled()
    })
  })
})
