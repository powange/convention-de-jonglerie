import { describe, it, expect, beforeEach, vi } from 'vitest'

const mockCanManage = vi.hoisted(() => vi.fn())

vi.mock('#server/utils/permissions/edition-permissions', () => ({
  canManageTicketingById: mockCanManage,
}))

import handler from '../../../../../../../layers/ticketing/server/api/editions/[id]/ticketing/orders/[orderId]/payment-method.patch'
import { global } from '../../../globales-nitro'

/**
 * Le moyen de paiement d'une commande — constat D8.
 *
 * ## Ce que la mesure a corrigé dans la fiche
 *
 * Elle décrivait un conflit entre la saisie de l'organisateur et la synchronisation HelloAsso,
 * et demandait de trancher « qui gagne ». Or **l'interface n'offrait déjà pas** cette correction
 * sur une commande importée :
 *
 * - le menu d'actions de la liste est gardé par `!order.externalTicketing` ;
 * - la pastille cliquable n'apparaît que si le moyen de paiement est **vide**, ce que la
 *   synchronisation ne laisse jamais — elle écrit toujours `card`.
 *
 * 📊 Mesuré sur la base de développement : **600 commandes importées, 600 en `card`, zéro numéro
 * de chèque**. Aucune n'a jamais été corrigée, et aucune ne pouvait l'être depuis un écran.
 *
 * Il ne restait donc qu'un écart entre le serveur et l'interface : ce point d'API acceptait la
 * requête et répondait « mise à jour avec succès », pour une valeur que le prochain import
 * aurait effacée — en laissant au passage un `checkNumber` orphelin.
 *
 * ## ⚠️ Ce fichier existe aussi parce que ce point d'API n'avait AUCUN test
 *
 * Ni la garde de droits, ni le refus sur une commande non payée, ni l'effacement du numéro de
 * chèque quand on repasse à un autre moyen n'étaient couverts.
 */
const prismaMock = (globalThis as any).prisma

const evenement = {
  context: { params: { id: '22', orderId: '7' }, user: { id: 1, pseudo: 'orga' } },
}

const envoyer = (body: unknown) => {
  global.readBody = vi.fn().mockResolvedValue(body)
  return handler(evenement as any)
}

const COMMANDE_GUICHET = {
  id: 7,
  editionId: 22,
  status: 'Onsite',
  externalTicketingId: null,
  paymentMethod: null,
}

describe('PATCH moyen de paiement d’une commande', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCanManage.mockResolvedValue(true)
    prismaMock.ticketingOrder.findUnique.mockResolvedValue(COMMANDE_GUICHET)
    prismaMock.ticketingOrder.update.mockResolvedValue({ id: 7 })
  })

  it('⚠️ REFUSE UNE COMMANDE IMPORTÉE — la synchronisation l’écraserait', async () => {
    prismaMock.ticketingOrder.findUnique.mockResolvedValue({
      ...COMMANDE_GUICHET,
      externalTicketingId: 3,
      paymentMethod: 'card',
    })

    await expect(envoyer({ paymentMethod: 'cash' })).rejects.toMatchObject({ statusCode: 409 })
    expect(
      prismaMock.ticketingOrder.update,
      'la commande importée a été écrite malgré le refus'
    ).not.toHaveBeenCalled()
  })

  it('⚠️ LE TÉMOIN : une commande de guichet, elle, se corrige', async () => {
    /*
     * Sans lui, la garde ci-dessus serait satisfaite par un point d'API qui refuserait TOUT —
     * et on retirerait la correction des 134 commandes sans moyen de paiement mesurées en base,
     * qui est précisément à quoi ce point d'API sert.
     */
    await envoyer({ paymentMethod: 'cash' })

    expect(prismaMock.ticketingOrder.update.mock.calls[0][0].data).toEqual({
      paymentMethod: 'cash',
      checkNumber: null,
    })
  })

  it('garde le numéro de chèque, et l’efface quand on change de moyen', async () => {
    await envoyer({ paymentMethod: 'check', checkNumber: '0042' })
    expect(prismaMock.ticketingOrder.update.mock.calls[0][0].data).toEqual({
      paymentMethod: 'check',
      checkNumber: '0042',
    })

    vi.clearAllMocks()
    prismaMock.ticketingOrder.findUnique.mockResolvedValue(COMMANDE_GUICHET)
    prismaMock.ticketingOrder.update.mockResolvedValue({ id: 7 })
    /*
     * ⚠️ LE NUMÉRO EST ENVOYÉ AVEC « carte », et c'est tout l'intérêt de ce cas. Ma première
     * version ne l'envoyait pas — un sabotage remplaçant la condition par `body.checkNumber ??
     * null` restait donc VERT, puisque le corps n'en contenait aucun. C'est pourtant le cas
     * réel : la modale garde la saisie du chèque à l'écran, et le client peut la renvoyer telle
     * quelle en basculant sur « carte ». Un numéro de chèque sur une commande payée par carte
     * est une trace fausse, que rien ensuite ne contredit.
     */
    await envoyer({ paymentMethod: 'card', checkNumber: '0042' })
    expect(prismaMock.ticketingOrder.update.mock.calls[0][0].data.checkNumber).toBeNull()
  })

  it('refuse une commande qui n’est pas payée', async () => {
    prismaMock.ticketingOrder.findUnique.mockResolvedValue({
      ...COMMANDE_GUICHET,
      status: 'Pending',
    })

    await expect(envoyer({ paymentMethod: 'cash' })).rejects.toMatchObject({ statusCode: 400 })
    expect(prismaMock.ticketingOrder.update).not.toHaveBeenCalled()
  })

  it('refuse une commande d’une AUTRE édition', async () => {
    prismaMock.ticketingOrder.findUnique.mockResolvedValue({ ...COMMANDE_GUICHET, editionId: 99 })

    await expect(envoyer({ paymentMethod: 'cash' })).rejects.toMatchObject({ statusCode: 403 })
    expect(prismaMock.ticketingOrder.update).not.toHaveBeenCalled()
  })

  it('refuse qui n’a pas le droit de gérer la billetterie', async () => {
    mockCanManage.mockResolvedValue(false)

    await expect(envoyer({ paymentMethod: 'cash' })).rejects.toMatchObject({ statusCode: 403 })
    expect(prismaMock.ticketingOrder.findUnique).not.toHaveBeenCalled()
  })

  it('refuse un moyen de paiement inconnu', async () => {
    // Le schéma zod n'accepte que `cash | card | check` : une valeur libre atteindrait la
    // colonne sans cela.
    await expect(envoyer({ paymentMethod: 'bitcoin' })).rejects.toThrow()
    expect(prismaMock.ticketingOrder.update).not.toHaveBeenCalled()
  })
})
