import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('../../../../../../server/utils/auth-utils', () => ({
  requireAuth: vi.fn(() => ({ id: 1, email: 'orga@test.com' })),
}))

const droitAccorde = vi.hoisted(() => vi.fn(async () => true))
vi.mock('../../../../../../server/utils/permissions/edition-permissions', () => ({
  canManageTicketingById: droitAccorde,
}))

import handler from '../../../../../../server/api/editions/[id]/ticketing/stats/order-sources.get'
import { global } from '../../../../globales-nitro'

const prismaMock = (globalThis as any).prisma

/**
 * La provenance des billets : saisis au guichet, ou importés d'une billetterie externe.
 *
 * ⚠️ TROIS DÉFAUTS, et le graphique s'affichait sans rien dire dans les trois cas.
 *
 * 1. AUCUN FILTRE DE STATUT : une commande `Refunded` ou `Canceled` était comptée comme les
 *    autres. La provenance annonçait donc plus de billets que l'onglet « achats » du MÊME écran,
 *    qui retient `Processed` et `Onsite`. Deux chiffres côte à côte, tirés de la même base, qui ne
 *    se recoupaient pas — et rien pour dire lequel croire.
 *
 * 2. « EXTERNE » DÉFINI PAR `helloAssoOrderId`, qui ne concerne que HelloAsso : une commande
 *    importée d'Infomaniak — l'autre fournisseur pris en charge — était comptée comme SAISIE À LA
 *    MAIN. Le graphique attribuait au guichet des billets vendus en ligne.
 *
 * 3. LES LIGNES N'ÉTAIENT PAS TRIÉES : un billet annulé au sein d'une commande vivante comptait
 *    pour un billet vendu.
 *
 * 🔬 LES TESTS PORTENT SUR LA FORME DES REQUÊTES, et c'est le seul niveau possible : le mock de
 * Prisma IGNORE le `where`, donc un test qui compare des nombres mesurerait ce qu'on a demandé au
 * mock de rendre, pas ce que la base rendrait. Ce qui se vérifie ici, c'est ce qu'on DEMANDE.
 */

const EDITION = 42
const evenement = { context: { params: { id: String(EDITION) }, user: { id: 1 } } } as any

describe('GET /api/editions/[id]/ticketing/stats/order-sources', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    droitAccorde.mockResolvedValue(true)
    global.validateEditionId = vi.fn(() => EDITION) as any
    global.getQuery = vi.fn(() => ({})) as any
    prismaMock.ticketingOrderItem.count.mockResolvedValue(0)
    prismaMock.ticketingOrder.count.mockResolvedValue(0)
  })

  it('une commande REFUNDED n’est pas comptée', async () => {
    /*
     * Le cas que l'énoncé demande. On le vérifie sur le `where` : les quatre comptages doivent
     * restreindre le statut de la commande à `Processed` / `Onsite`, donc exclure `Refunded` —
     * et aussi `Canceled`, `Pending` et tout autre statut à venir, puisque la liste est
     * POSITIVE plutôt qu'un complément.
     */
    await handler(evenement)

    const whereLignes = prismaMock.ticketingOrderItem.count.mock.calls.map((a: any) => a[0].where)
    const whereCommandes = prismaMock.ticketingOrder.count.mock.calls.map((a: any) => a[0].where)

    expect(whereLignes).toHaveLength(2)
    expect(whereCommandes).toHaveLength(2)

    for (const où of whereLignes) {
      expect(où.order.status).toEqual({ in: ['Processed', 'Onsite'] })
    }
    for (const où of whereCommandes) {
      expect(où.status).toEqual({ in: ['Processed', 'Onsite'] })
    }
  })

  it('« externe » se lit sur `externalTicketingId`, PAS sur `helloAssoOrderId`', async () => {
    /*
     * ⚠️ LE DÉFAUT LE PLUS TROMPEUR des trois. `helloAssoOrderId` ne concerne qu'un fournisseur :
     * une commande Infomaniak le porte à `null` et était donc comptée comme saisie au guichet.
     * Le graphique attribuait au comptoir des ventes en ligne — un chiffre faux et parfaitement
     * plausible.
     */
    await handler(evenement)

    const tous = [
      ...prismaMock.ticketingOrderItem.count.mock.calls.map((a: any) => a[0].where.order),
      ...prismaMock.ticketingOrder.count.mock.calls.map((a: any) => a[0].where),
    ]

    const manuels = tous.filter((o: any) => o.externalTicketingId === null)
    const externes = tous.filter((o: any) => o.externalTicketingId?.not === null)

    expect(manuels).toHaveLength(2)
    expect(externes).toHaveLength(2)
    // Et plus aucune trace de l'ancienne clé.
    expect(JSON.stringify(tous)).not.toContain('helloAssoOrderId')
  })

  it('les LIGNES sont triées par `billetsQuiComptent`', async () => {
    /*
     * Un billet annulé (`state: 'Canceled'`) au sein d'une commande vivante comptait pour un
     * billet vendu. La règle partagée retient `Processed` et `Pending`, et c'est la même que celle
     * du guichet — deux surfaces qui répondent à la même question doivent compter pareil.
     */
    await handler(evenement)

    for (const appel of prismaMock.ticketingOrderItem.count.mock.calls) {
      expect(appel[0].where.state).toEqual({ in: ['Processed', 'Pending'] })
    }
  })

  it('une commande ne compte que si elle a au moins une ligne retenue', async () => {
    /*
     * Sans ce `some`, une commande dont TOUS les billets sont annulés gonflerait le total des
     * commandes tout en n'apportant aucune ligne. Les deux chiffres du graphique — commandes et
     * billets — se contrediraient alors entre eux.
     */
    await handler(evenement)

    for (const appel of prismaMock.ticketingOrder.count.mock.calls) {
      expect(appel[0].where.items?.some).toBeTruthy()
    }
  })

  it('le filtre de tarifs de l’écran est transmis', async () => {
    // L'écran restreint le graphique à une sélection de tarifs ; le perdre changerait le chiffre
    // sans changer la légende.
    global.getQuery = vi.fn(() => ({ tierIds: ['3', '7'] })) as any

    await handler(evenement)

    for (const appel of prismaMock.ticketingOrderItem.count.mock.calls) {
      expect(appel[0].where.tierId).toEqual({ in: [3, 7] })
    }
  })

  it('sans filtre, aucune restriction de tarif', async () => {
    // Un `tierId: { in: [] }` rendrait zéro partout — l'écran afficherait un graphique vide.
    await handler(evenement)

    for (const appel of prismaMock.ticketingOrderItem.count.mock.calls) {
      expect(appel[0].where).not.toHaveProperty('tierId')
    }
  })

  it('la réponse est ENVELOPPÉE et ses totaux s’additionnent', async () => {
    prismaMock.ticketingOrderItem.count
      .mockResolvedValueOnce(12) // manuels
      .mockResolvedValueOnce(30) // externes
    prismaMock.ticketingOrder.count.mockResolvedValueOnce(5).mockResolvedValueOnce(9)

    const reponse: any = await handler(evenement)

    expect(reponse.success).toBe(true)
    expect(reponse.data.items).toEqual({ manual: 12, external: 30, total: 42 })
    expect(reponse.data.orders).toEqual({ manual: 5, external: 9, total: 14 })
  })

  it('REFUSE sans le droit de gérer la billetterie', async () => {
    /*
     * La garde était une réimplémentation : un `findUnique` de quarante lignes avec ses
     * `organizerPermissions`, suivi de `canManageTicketing(edition, user)`. Elle passe par
     * `canManageTicketingById`, qui est celle qu'on tient à jour.
     */
    droitAccorde.mockResolvedValue(false)

    await expect(handler(evenement)).rejects.toMatchObject({ statusCode: 403 })
    expect(prismaMock.ticketingOrderItem.count).not.toHaveBeenCalled()
  })

  it('ne charge PLUS toutes les commandes de l’édition', async () => {
    /*
     * L'ancien code faisait un `findMany` de toutes les commandes AVEC toutes leurs lignes, pour
     * n'en garder que des longueurs de tableau : un transfert complet pour produire quatre
     * nombres. Ce test empêche le retour en arrière.
     */
    await handler(evenement)

    expect(prismaMock.ticketingOrder.findMany).not.toHaveBeenCalled()
  })
})
