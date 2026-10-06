import { describe, it, expect, beforeEach, vi } from 'vitest'

const mockCanManage = vi.hoisted(() => vi.fn())
const mockCanAccess = vi.hoisted(() => vi.fn())

vi.mock('#server/utils/permissions/edition-permissions', () => ({
  canManageTicketingById: mockCanManage,
  canAccessEditionDataOrAccessControl: mockCanAccess,
}))

import remise from '../../../../../../../layers/ticketing/server/api/editions/[id]/ticketing/order-items/[itemId]/discount.patch'
import remiseRendue from '../../../../../../../layers/ticketing/server/api/editions/[id]/ticketing/order-items/[itemId]/discount-paid-back.patch'
import { global } from '../../../globales-nitro'

const prismaMock = (globalThis as any).prisma

const evenement = {
  context: { params: { id: '22', itemId: '77' }, user: { id: 5, pseudo: 'orga' } },
}

/** Ce qui a été écrit sur le billet. */
const ecrit = () => prismaMock.ticketingOrderItem.update.mock.calls[0]?.[0]?.data

/**
 * Accorder une remise sur un billet.
 *
 * ⚠️ UNE REMISE N'EST PAS UNE ANNULATION, et les deux gestes ne doivent jamais se recouvrir. Le
 * billet remis reste VIVANT — il donne toujours droit d'entrée —, et c'est ce qui oblige la
 * trésorerie à voir la remise : rien n'a été retiré avant elle, contrairement à une annulation.
 *
 * Les gardes ci-dessous valent plus que le chemin heureux : on est sur de l'argent, et chacune
 * empêche un encaissé faux qui s'afficherait exactement comme un encaissé juste.
 */
describe('la remise accordée sur un billet', () => {
  const billet = (surcharge: Record<string, unknown> = {}) => ({
    id: 77,
    state: 'Processed',
    amount: 2000,
    selectedOptions: [],
    order: { editionId: 22 },
    ...surcharge,
  })

  const appeler = (discountAmount: number) => {
    global.readBody = vi.fn().mockResolvedValue({ discountAmount })
    return remise(evenement as any)
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockCanManage.mockResolvedValue(true)
    prismaMock.ticketingOrderItem.findUnique.mockResolvedValue(billet())
    prismaMock.ticketingOrderItem.update.mockResolvedValue({})
  })

  it('enregistre le montant, sa date et son auteur', async () => {
    await appeler(500)

    expect(ecrit()).toMatchObject({ discountAmount: 500, discountedById: 5 })
    expect(ecrit().discountedAt).toBeInstanceOf(Date)
  })

  it('zéro retire la remise ET sa trace', async () => {
    // Garder un auteur sur une remise nulle ferait lire « remise accordée par X » là où il n'y en
    // a plus — l'écran dirait le contraire de la donnée.
    await appeler(0)

    expect(ecrit()).toEqual({ discountAmount: 0, discountedAt: null, discountedById: null })
  })

  it('⚠️ REFUSE une remise supérieure au prix, options comprises', async () => {
    /*
     * Rogner en silence laisserait croire qu'on a rendu plus qu'on ne l'a fait. Et un net négatif
     * ferait *gagner* de l'argent à l'encaissé : un total qui monte quand on rend de l'argent est
     * le genre d'erreur qu'on ne cherche pas là où elle est.
     */
    prismaMock.ticketingOrderItem.findUnique.mockResolvedValue(
      billet({ amount: 2000, selectedOptions: [{ amount: 500 }] })
    )

    await expect(appeler(3000)).rejects.toThrow(/dépasser le prix/)
    expect(prismaMock.ticketingOrderItem.update).not.toHaveBeenCalled()
  })

  it('…mais accepte jusqu’au prix OPTIONS COMPRISES', async () => {
    // Le témoin négatif du test précédent : sans lui, un point d'API qui refuse TOUT le passerait.
    prismaMock.ticketingOrderItem.findUnique.mockResolvedValue(
      billet({ amount: 2000, selectedOptions: [{ amount: 500 }] })
    )

    await appeler(2500)

    expect(ecrit()).toMatchObject({ discountAmount: 2500 })
  })

  it('⚠️ REFUSE une remise sur un billet ANNULÉ', async () => {
    /*
     * Miroir exact de la règle du remboursement, qui exige l'inverse. Le montant d'un billet
     * annulé a déjà quitté l'encaissé en entier : une remise par-dessus le soustrairait une
     * SECONDE fois, et le produit baisserait d'une somme jamais sortie de la caisse.
     */
    prismaMock.ticketingOrderItem.findUnique.mockResolvedValue(billet({ state: 'Canceled' }))

    await expect(appeler(500)).rejects.toThrow(/annulé/)
    expect(prismaMock.ticketingOrderItem.update).not.toHaveBeenCalled()
  })

  it('…mais laisse RETIRER une remise d’un billet devenu annulé', async () => {
    // Sinon une remise accordée avant l'annulation deviendrait impossible à défaire, et resterait
    // à soustraire pour toujours.
    prismaMock.ticketingOrderItem.findUnique.mockResolvedValue(billet({ state: 'Canceled' }))

    await appeler(0)

    expect(ecrit()).toMatchObject({ discountAmount: 0 })
  })

  it('refuse un montant NÉGATIF', async () => {
    // Il majorerait le prix : on encaisserait plus que ce que la personne a payé.
    await expect(appeler(-500)).rejects.toThrow()
    expect(prismaMock.ticketingOrderItem.update).not.toHaveBeenCalled()
  })

  it('refuse des CENTIMES décimaux plutôt que de les arrondir', async () => {
    // Tout est en centimes : `12.5` est une saisie en euros déguisée, cent fois trop petite.
    await expect(appeler(12.5)).rejects.toThrow()
  })

  it('⚠️ exige le droit de GESTION, pas celui du guichet', async () => {
    /*
     * Rembourser se fait à la porte, devant la personne. Accorder une remise est une décision,
     * prise depuis la page des commandes — même droit que l'annulation, sa voisine immédiate.
     */
    mockCanManage.mockResolvedValue(false)

    await expect(appeler(500)).rejects.toThrow(/Droits insuffisants/)
    expect(prismaMock.ticketingOrderItem.findUnique).not.toHaveBeenCalled()
  })

  it('refuse un billet d’une AUTRE édition', async () => {
    // L'identifiant d'un billet est unique : sans ce contrôle, on remiserait depuis la gestion
    // d'une édition sur laquelle on n'a aucun droit.
    prismaMock.ticketingOrderItem.findUnique.mockResolvedValue(billet({ order: { editionId: 99 } }))

    await expect(appeler(500)).rejects.toThrow(/n'appartient pas/)
    expect(prismaMock.ticketingOrderItem.update).not.toHaveBeenCalled()
  })
})

/**
 * Rendre l'argent d'une remise, au guichet.
 *
 * ⚠️ UN GESTE DISTINCT DE L'ACCORD, et pris à un autre endroit par d'autres personnes : accorder
 * une remise est une décision, prise depuis la page des commandes avec le droit de GESTION ; la
 * rendre se fait à la porte, devant la personne, par qui tient le CONTRÔLE D'ACCÈS. Confondre les
 * deux gardes fermerait le guichet à qui doit justement sortir la caisse.
 */
describe('la remise rendue à la personne', () => {
  const billet = (surcharge: Record<string, unknown> = {}) => ({
    id: 77,
    discountAmount: 500,
    order: { editionId: 22 },
    ...surcharge,
  })

  const appeler = (paidBack: boolean) => {
    global.readBody = vi.fn().mockResolvedValue({ paidBack })
    return remiseRendue(evenement as any)
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockCanAccess.mockResolvedValue(true)
    prismaMock.ticketingOrderItem.findUnique.mockResolvedValue(billet())
    prismaMock.ticketingOrderItem.update.mockResolvedValue({})
  })

  it('enregistre que l’argent est sorti, avec sa date et son auteur', async () => {
    await appeler(true)

    expect(ecrit()).toMatchObject({ discountPaidBack: true, discountPaidBackById: 5 })
    expect(ecrit().discountPaidBackAt).toBeInstanceOf(Date)
  })

  it('défait le geste ET sa trace', async () => {
    // Pour rattraper une erreur sans quitter le guichet. Garder un auteur sur une remise non
    // rendue ferait lire « rendue par X » là où l'argent est encore en caisse.
    await appeler(false)

    expect(ecrit()).toEqual({
      discountPaidBack: false,
      discountPaidBackAt: null,
      discountPaidBackById: null,
    })
  })

  it('⚠️ REFUSE de solder un billet SANS remise', async () => {
    // On enregistrerait avoir rendu une somme que personne n'a accordée, et le guichet n'aurait
    // aucun montant à annoncer en face.
    prismaMock.ticketingOrderItem.findUnique.mockResolvedValue(billet({ discountAmount: 0 }))

    await expect(appeler(true)).rejects.toThrow(/aucune remise/)
    expect(prismaMock.ticketingOrderItem.update).not.toHaveBeenCalled()
  })

  it('…mais laisse DÉFAIRE sur un billet dont la remise a été retirée', async () => {
    // Sinon une trace resterait pour toujours sur un billet qui ne porte plus rien.
    prismaMock.ticketingOrderItem.findUnique.mockResolvedValue(billet({ discountAmount: 0 }))

    await appeler(false)

    expect(ecrit()).toMatchObject({ discountPaidBack: false })
  })

  it('⚠️ exige le droit du GUICHET, pas celui de la gestion', async () => {
    /*
     * Le miroir du test de l'accord : là-bas c'est `canManageTicketingById`. Exiger ici la gestion
     * empêcherait le bénévole qui tient la porte de solder la dette devant la personne — et il
     * devrait aller chercher un responsable, la file derrière lui.
     */
    mockCanAccess.mockResolvedValue(false)

    await expect(appeler(true)).rejects.toThrow(/Droits insuffisants/)
    expect(prismaMock.ticketingOrderItem.findUnique).not.toHaveBeenCalled()
  })

  it('refuse un billet d’une AUTRE édition', async () => {
    prismaMock.ticketingOrderItem.findUnique.mockResolvedValue(billet({ order: { editionId: 99 } }))

    await expect(appeler(true)).rejects.toThrow(/n'appartient pas/)
    expect(prismaMock.ticketingOrderItem.update).not.toHaveBeenCalled()
  })
})
