import { describe, it, expect, vi, beforeEach } from 'vitest'

// wrapApiHandler et validateEditionId sont auto-importés (Nitro) dans les handlers : on fournit
// des équivalents globaux avant leur chargement (vi.hoisted s'exécute avant les imports).
vi.hoisted(() => {
  if (!(globalThis as any).wrapApiHandler) {
    ;(globalThis as any).wrapApiHandler = (handler: any) => handler
  }
  if (!(globalThis as any).validateEditionId) {
    ;(globalThis as any).validateEditionId = (event: any) =>
      parseInt(event?.context?.params?.id, 10)
  }
})

const mockCanAccessEditionData = vi.hoisted(() => vi.fn())
vi.mock('#server/utils/permissions/edition-permissions', () => ({
  canAccessEditionDataOrAccessControl: mockCanAccessEditionData,
}))
vi.mock('#server/utils/auth-utils', () => ({
  requireAuth: vi.fn((event) => event.context.user),
}))
vi.mock('#server/utils/notification-service', () => ({
  NotificationHelpers: { volunteerEntryValidated: vi.fn() },
  safeNotify: vi.fn(),
}))
vi.mock('#server/utils/editions/volunteers/responsables-equipe', () => ({
  utilisateursResponsablesDeLEquipe: vi.fn().mockResolvedValue([]),
}))
vi.mock('#server/utils/editions/ticketing/user-info-update', () => ({
  updateUserInfo: vi.fn(),
}))

import validateHandler from '../../../../../../server/api/editions/[id]/ticketing/validate-entry.post'
import { global } from '../../../../globales-nitro'

const prismaMock = (globalThis as any).prisma

/**
 * L'encaissement au scan, et la borne d'édition qui lui manquait.
 *
 * ## ⚠️ LE DÉFAUT (constat B5)
 *
 * La validation elle-même est bornée : `porteeTicket` porte `order: { editionId }`. Mais dès que
 * `paymentMethod` est fourni, les **trois** requêtes du bloc d'encaissement travaillaient sur
 * `body.participantIds` **nus** — la relecture des lignes, la mise à jour des commandes, celle des
 * lignes.
 *
 * Un bénévole en créneau de contrôle d'accès sur l'édition A pouvait donc, avec des identifiants
 * de billets de l'édition B et un `paymentMethod`, marquer **payées** des commandes en attente de
 * B. La réponse annonçait `validated: 0` — la validation, elle, était bien refusée — **mais
 * l'écriture avait eu lieu**. Un encaissement fantôme sur une édition qu'on n'administre pas,
 * invisible dans la réponse.
 *
 * ## ⚠️⚠️ POURQUOI CES TESTS PORTENT SUR LA FORME DU `where`, ET NON SUR UN VERDICT
 *
 * Le mock central de Prisma **ignore le `where`** : il rend ce qu'on lui a dit de rendre, quelle
 * que soit la condition. Un test qui scannerait un billet d'une autre édition et vérifierait
 * qu'aucune commande n'a changé serait donc **vert avant comme après la correction** — il
 * mesurerait le mock, pas le code.
 *
 * La seule assertion qui n'est pas creuse ici est la **requête envoyée** : chacune des trois doit
 * porter la borne. C'est aussi la seule qui résiste à un refactor : si quelqu'un remplace
 * `porteeTicket` par une condition écrite à la main, ces cas le voient.
 */
describe('validate-entry — encaissement borné à l’édition', () => {
  const acteur = { id: 42, email: 'agent@example.com', pseudo: 'agent' }
  const evenement = { context: { params: { id: '7' }, user: acteur } }

  beforeEach(() => {
    vi.clearAllMocks()
    mockCanAccessEditionData.mockResolvedValue(true)
    prismaMock.entryValidationLog.createMany.mockResolvedValue({ count: 0 })
    prismaMock.ticketingOrderItem.updateMany.mockResolvedValue({ count: 1 })
    /*
     * ⚠️ DEUX `findMany` DIFFÉRENTS SUR LE MÊME MODÈLE, et les distinguer est indispensable.
     *
     * Le premier cherche les billets ANNULÉS (`select: { id: true }`) : lui rendre des lignes fait
     * court-circuiter le handler sur « ce billet a été annulé », et les trois cas ci-dessous
     * tombent sans que rien ne dise pourquoi. Le second est la relecture du bloc d'encaissement
     * (`select: { orderId: true }`).
     *
     * On répond donc selon ce qui est DEMANDÉ, pas selon l'ordre des appels — un test qui
     * compterait les appels casserait au premier remaniement du handler.
     */
    prismaMock.ticketingOrderItem.findMany.mockImplementation((args: any) =>
      Promise.resolve(args?.select?.orderId ? [{ orderId: 900, state: 'Pending' }] : [])
    )
    prismaMock.ticketingOrder.updateMany.mockResolvedValue({ count: 1 })
    prismaMock.$transaction.mockImplementation((operations: unknown[]) =>
      Promise.resolve(operations)
    )
    global.readBody = vi.fn().mockResolvedValue({
      type: 'ticket',
      participantIds: [11],
      paymentMethod: 'cash',
    })
  })

  /** Le dernier appel à `findMany` qui demande `orderId` : la relecture du bloc d'encaissement. */
  const relectureDesLignes = () =>
    prismaMock.ticketingOrderItem.findMany.mock.calls
      .map(([args]: [any]) => args)
      .filter((a: any) => a?.select?.orderId)
      .at(-1)

  it('borne la relecture des lignes à l’édition', async () => {
    await validateHandler(evenement as any)

    const args = relectureDesLignes()
    expect(args, 'la relecture du bloc d’encaissement doit avoir lieu').toBeTruthy()
    expect(args.where).toMatchObject({ order: { editionId: 7 } })
  })

  it('borne la mise à jour des COMMANDES à l’édition', async () => {
    /*
     * ⚠️ LE CAS LE PLUS COÛTEUX DU CONSTAT. C'est cette requête qui écrivait `status: 'Onsite'` et
     * le moyen de paiement : sans borne, elle soldait des commandes d'une autre édition.
     */
    await validateHandler(evenement as any)

    const args = prismaMock.ticketingOrder.updateMany.mock.calls.at(-1)![0]
    expect(args.where).toMatchObject({ editionId: 7, status: 'Pending' })
    expect(args.data).toMatchObject({ status: 'Onsite', paymentMethod: 'cash' })
  })

  it('borne la mise à jour des LIGNES à l’édition', async () => {
    await validateHandler(evenement as any)

    const soldeDesLignes = prismaMock.ticketingOrderItem.updateMany.mock.calls
      .map(([args]: [any]) => args)
      .filter((a: any) => a?.data?.state === 'Processed')
      .at(-1)
    expect(soldeDesLignes, 'le solde des lignes doit avoir lieu').toBeTruthy()
    expect(soldeDesLignes.where).toMatchObject({ order: { editionId: 7 }, state: 'Pending' })
  })

  it('n’encaisse rien quand aucun moyen de paiement n’est donné', async () => {
    /*
     * ⚠️ LE TÉMOIN QUI BORNE LES TROIS CAS CI-DESSUS. Sans lui, un bloc d'encaissement qui
     * s'exécuterait À CHAQUE scan les satisferait tous — et le guichet solderait des commandes que
     * personne n'a payées, au simple passage d'un billet.
     */
    global.readBody = vi.fn().mockResolvedValue({ type: 'ticket', participantIds: [11] })

    await validateHandler(evenement as any)

    expect(prismaMock.ticketingOrder.updateMany).not.toHaveBeenCalled()
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })

  it('garde la condition qui rend le double scan atomique', async () => {
    // La validation est ailleurs dans le handler, mais ce lot touche le même `porteeTicket` : si
    // quelqu'un le remaniait, `entryValidated: false` pourrait disparaître sans bruit — et deux
    // portes simultanées valideraient deux fois le même billet.
    await validateHandler(evenement as any)

    const validation = prismaMock.ticketingOrderItem.updateMany.mock.calls
      .map(([args]: [any]) => args)
      .find((a: any) => a?.data?.entryValidated === true)
    expect(validation.where).toMatchObject({ entryValidated: false, order: { editionId: 7 } })
  })
})
