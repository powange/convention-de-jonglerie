import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.hoisted(() => {
  if (!(globalThis as any).wrapApiHandler) {
    ;(globalThis as any).wrapApiHandler = (handler: any) => handler
  }
  if (!(globalThis as any).validateEditionId) {
    ;(globalThis as any).validateEditionId = (event: any) =>
      parseInt(event?.context?.params?.id, 10)
  }
})

const mockCanManage = vi.hoisted(() => vi.fn())
vi.mock('#server/utils/permissions/edition-permissions', () => ({
  canManageTreasuryById: mockCanManage,
  canAccessEditionData: vi.fn(async () => true),
}))

vi.mock('#server/utils/auth-utils', () => ({
  requireAuth: vi.fn((event) => event.context.user),
}))

import lire from '../../../../../server/api/editions/[id]/treasury/index.get'

const prismaMock = (globalThis as any).prisma
const evenement = { context: { params: { id: '21' }, user: { id: 3 } } }

/**
 * Une remise accordée sur un billet doit se voir dans la trésorerie.
 *
 * ⚠️ POURQUOI CE TEST EXISTE, ET POURQUOI ICI. Le remboursement d'un billet ANNULÉ n'a volontairement
 * aucun effet comptable : l'annulation a déjà retiré la totalité du montant avant lui. Une REMISE
 * porte sur un billet VIVANT — rien n'a été retiré. Sommer le prix plein laisserait donc le produit
 * trop haut du montant rendu, **sans erreur et sans alerte** : on ne s'en apercevrait qu'au bilan.
 *
 * 📍 La soustraction se fait dans le point d'API, au moment de bâtir les lignes, et non dans
 * `aggregateTicketingItems`, qui reçoit des montants déjà sommés. C'est pourquoi un test unitaire
 * de l'agrégation ne couvrirait PAS cette règle, et qu'il faut monter le point d'API.
 */
describe('la remise d’un billet et le produit de billetterie', () => {
  const billet = (amount: number, discountAmount: number, options: number[] = []) => ({
    amount,
    type: null,
    state: 'Processed',
    order: { status: 'Onsite' },
    tier: { id: 1, countAsParticipant: true },
    selectedOptions: options.map((a) => ({ amount: a })),
    discountAmount,
  })

  /**
   * Le produit de billetterie réglé, tel que l'écran l'affiche.
   *
   * 📍 `settled` est porté par la LIGNE elle-même — `TreasuryLine extends TreasuryAmounts` — et non
   * par un objet `amounts`. Ma première version lisait `l.amounts.settled`, donc `undefined`, et
   * tous les produits sortaient à zéro : le test « une ligne annulée ne compte pas » passait alors
   * pour la mauvaise raison. C'est le témoin négatif — « sans remise, le prix plein » — qui l'a dit.
   */
  const produitRegle = (reponse: any) =>
    (reponse.data ?? reponse).lines
      .filter((l: any) => l.kind === 'INCOME')
      .reduce((somme: number, l: any) => somme + (l.settled ?? 0), 0)

  beforeEach(() => {
    vi.clearAllMocks()
    mockCanManage.mockResolvedValue(true)
    prismaMock.edition.findUnique.mockResolvedValue({ id: 21, currency: 'EUR', conventionId: 2 })
    prismaMock.editionArtist.findMany.mockResolvedValue([])
    prismaMock.treasuryEntry.findMany.mockResolvedValue([])
    prismaMock.treasurySourceCode.findMany.mockResolvedValue([])
    prismaMock.treasuryCode.findMany.mockResolvedValue([])
    prismaMock.ticketingTier.findMany.mockResolvedValue([])
  })

  it('⚠️ LE CŒUR DU LOT : la remise est SOUSTRAITE du produit', async () => {
    prismaMock.ticketingOrderItem.findMany.mockResolvedValue([billet(2000, 500)])

    const rapport: any = await lire(evenement as any)

    expect(produitRegle(rapport)).toBe(1500)
  })

  it('sans remise, le produit reste le prix plein', async () => {
    // Le témoin négatif : sans lui, un produit toujours nul passerait le test précédent.
    prismaMock.ticketingOrderItem.findMany.mockResolvedValue([billet(2000, 0)])

    const rapport: any = await lire(evenement as any)

    expect(produitRegle(rapport)).toBe(2000)
  })

  it('la remise porte sur le prix OPTIONS COMPRISES', async () => {
    // 20 € de tarif, 30 € d'options, 25 € rendus : il reste 25 €.
    prismaMock.ticketingOrderItem.findMany.mockResolvedValue([billet(2000, 2500, [3000])])

    const rapport: any = await lire(evenement as any)

    expect(produitRegle(rapport)).toBe(2500)
  })

  it('⚠️ une ligne ANNULÉE ne voit pas sa remise soustraite deux fois', async () => {
    /*
     * Une annulation retire déjà la totalité du montant du produit. Si la remise s'appliquait en
     * plus, on soustrairait deux fois — et le produit baisserait d'un montant qui n'est jamais
     * sorti de la caisse.
     */
    prismaMock.ticketingOrderItem.findMany.mockResolvedValue([
      { ...billet(2000, 500), state: 'Canceled' },
    ])

    const rapport: any = await lire(evenement as any)

    expect(produitRegle(rapport)).toBe(0)
  })
})
