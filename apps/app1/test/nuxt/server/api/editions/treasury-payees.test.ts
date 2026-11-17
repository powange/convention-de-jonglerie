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

import lister from '../../../../../server/api/editions/[id]/treasury/payees/index.get'
import creer from '../../../../../server/api/editions/[id]/treasury/payees/index.post'
import modifier from '../../../../../server/api/editions/[id]/treasury/payees/[payeeId].put'
import supprimer from '../../../../../server/api/editions/[id]/treasury/payees/[payeeId].delete'
import { global } from '../../../globales-nitro'

const prismaMock = (globalThis as any).prisma

/**
 * Le carnet des bénéficiaires d'une édition.
 *
 * ## ⚠️ CE QUE CES CAS PROTÈGENT
 *
 * Cette table contient des **IBAN**. Deux défauts y seraient coûteux et silencieux :
 *
 * 1. **Une écriture adressée par `id` seul.** La garde `canManageTreasuryById` ne vérifie que les
 *    droits sur l'édition DU CHEMIN. Sans `editionId` dans le `where`, un organisateur habilité
 *    sur une édition modifierait les coordonnées bancaires d'une autre en changeant l'identifiant
 *    dans l'URL — et la réponse serait 200.
 * 2. **Un IBAN non normalisé.** « FR76 1234 » et « fr7612 34 » sont le même compte. Stockés tels
 *    quels, ils produiraient DEUX virements au lieu d'un dans la vue groupée du lot suivant.
 *    Le défaut ne se voit pas à la lecture d'une fiche : il n'apparaît qu'au moment du regroupement.
 */
const EDITION = 22
const AUTRE_EDITION = 21

const evenement = (params: Record<string, string> = {}) => ({
  context: { user: { id: 7 }, params: { id: String(EDITION), ...params } },
})

const appeler = (handler: unknown, corps?: unknown, params: Record<string, string> = {}) => {
  if (corps !== undefined) global.readBody = vi.fn().mockResolvedValue(corps)
  /*
   * ⚠️ `id` DOIT figurer ici. `validateEditionId` passe par `validateResourceId`, qui lit
   * `getRouterParam(event, 'id')` — pas `event.context.params`. Sans cette clé, tous les cas
   * échouaient sur « ID d'édition invalide », et l'erreur désignait le handler alors qu'elle
   * venait du bouchon.
   */
  global.getRouterParam = vi.fn(
    (_e: unknown, nom: string) => ({ id: String(EDITION), ...params })[nom]
  )
  return (handler as (e: unknown) => Promise<any>)(evenement(params))
}

describe('GET /api/editions/[id]/treasury/payees', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCanManage.mockResolvedValue(true)
    prismaMock.treasuryPayee.findMany.mockResolvedValue([])
  })

  it('📍 ne rend que les bénéficiaires de CETTE édition', async () => {
    await appeler(lister)

    expect(prismaMock.treasuryPayee.findMany.mock.calls[0]![0].where).toEqual({
      editionId: EDITION,
    })
  })

  it('⚠️ refuse qui n’a pas le droit de gérer la trésorerie — ce sont des IBAN', async () => {
    mockCanManage.mockResolvedValue(false)

    await expect(appeler(lister)).rejects.toBeDefined()
    expect(prismaMock.treasuryPayee.findMany).not.toHaveBeenCalled()
  })
})

describe('POST /api/editions/[id]/treasury/payees', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCanManage.mockResolvedValue(true)
    prismaMock.treasuryPayee.findFirst.mockResolvedValue(null)
    prismaMock.treasuryPayee.count.mockResolvedValue(0)
    prismaMock.treasuryPayee.create.mockResolvedValue({ id: 1 })
    prismaMock.treasuryPayee.findMany.mockResolvedValue([])
  })

  it('⚠️ NORMALISE l’IBAN et le BIC avant de les écrire', async () => {
    /*
     * LE cas. Le regroupement des versements compare des IBAN : deux saisies du même compte
     * doivent donner la même chaîne. Stockées telles quelles, « FR76 3000 … » et
     * « fr7630 00… » produiraient deux virements pour un seul bénéficiaire — et le défaut
     * n'apparaîtrait qu'au moment du groupement, jamais à la lecture d'une fiche.
     */
    await appeler(creer, {
      label: 'Chapiteaux du Sud',
      iban: '  fr76 3000 1007 9412 3456 7890 185  ',
      bic: ' bnpafrpp ',
    })

    const data = prismaMock.treasuryPayee.create.mock.calls[0]![0].data
    expect(data.iban).toBe('FR7630001007941234567890185')
    expect(data.bic).toBe('BNPAFRPP')
  })

  it('📍 accepte un bénéficiaire SANS coordonnées bancaires', async () => {
    /*
     * On peut vouloir suivre ce qu'on doit à quelqu'un avant d'avoir son RIB. L'exiger ferait
     * renoncer à enregistrer la dette, ce qui est précisément ce que la fonctionnalité évite.
     */
    await appeler(creer, { label: 'Salle des fêtes' })

    const data = prismaMock.treasuryPayee.create.mock.calls[0]![0].data
    expect(data.label).toBe('Salle des fêtes')
    expect(data.iban).toBeUndefined()
  })

  it('⚠️ refuse un libellé déjà pris dans cette édition', async () => {
    prismaMock.treasuryPayee.findFirst.mockResolvedValue({ id: 3 })

    await expect(appeler(creer, { label: 'Chapiteaux du Sud' })).rejects.toBeDefined()
    expect(prismaMock.treasuryPayee.create).not.toHaveBeenCalled()
  })

  it('refuse un libellé fait d’espaces', async () => {
    // `trim()` avant `min(1)` : sans cet ordre, la chaîne brute passerait et s'enregistrerait vide.
    await expect(appeler(creer, { label: '   ' })).rejects.toBeDefined()
    expect(prismaMock.treasuryPayee.create).not.toHaveBeenCalled()
  })
})

describe('PUT et DELETE /api/editions/[id]/treasury/payees/[payeeId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCanManage.mockResolvedValue(true)
    prismaMock.treasuryPayee.findFirst.mockResolvedValue(null)
    prismaMock.treasuryPayee.updateMany.mockResolvedValue({ count: 1 })
    prismaMock.treasuryPayee.deleteMany.mockResolvedValue({ count: 1 })
    prismaMock.treasuryPayee.findMany.mockResolvedValue([])
  })

  it('⚠️ la MODIFICATION est adressée par { id, editionId }, jamais par id seul', async () => {
    /*
     * Sans `editionId` dans le `where`, un organisateur habilité sur l'édition 22 changerait
     * l'IBAN d'un bénéficiaire de l'édition 21 en modifiant l'identifiant dans l'URL — la garde
     * aurait dit oui, puisqu'elle ne vérifie que ses droits sur l'édition du chemin. Sur des
     * coordonnées bancaires, le détournement serait coûteux.
     */
    await appeler(modifier, { label: 'Renommé' }, { payeeId: '42' })

    const where = prismaMock.treasuryPayee.updateMany.mock.calls[0]![0].where
    expect(where).toEqual({ id: 42, editionId: EDITION })
    expect(where.editionId).not.toBe(AUTRE_EDITION)
  })

  it('⚠️ la SUPPRESSION est adressée par { id, editionId }, jamais par id seul', async () => {
    await appeler(supprimer, undefined, { payeeId: '42' })

    expect(prismaMock.treasuryPayee.deleteMany.mock.calls[0]![0].where).toEqual({
      id: 42,
      editionId: EDITION,
    })
  })

  it('⚠️ répond 404 quand rien n’a été touché, au lieu d’un succès mensonger', async () => {
    /*
     * `updateMany` et `deleteMany` ne lèvent PAS sur une ligne absente : ils rendent `count: 0`.
     * Sans ce contrôle, viser le bénéficiaire d'une autre édition répondrait 200 en n'ayant rien
     * fait, et l'écran afficherait une réussite.
     */
    prismaMock.treasuryPayee.updateMany.mockResolvedValue({ count: 0 })
    prismaMock.treasuryPayee.deleteMany.mockResolvedValue({ count: 0 })

    await expect(appeler(modifier, { label: 'X' }, { payeeId: '42' })).rejects.toMatchObject({
      statusCode: 404,
    })
    await expect(appeler(supprimer, undefined, { payeeId: '42' })).rejects.toMatchObject({
      statusCode: 404,
    })
  })

  it('⚠️ un champ ABSENT n’efface pas les coordonnées bancaires', async () => {
    /*
     * Le piège documenté pour les artistes, et il vaut ici. Renommer un bénéficiaire ne doit pas
     * effacer son IBAN : un corps qui ne parle pas d'`iban` laisse l'existant intact. Seul un
     * `null` explicite efface — voir le cas suivant.
     */
    await appeler(modifier, { label: 'Nouveau nom' }, { payeeId: '42' })

    const data = prismaMock.treasuryPayee.updateMany.mock.calls[0]![0].data
    expect(data).not.toHaveProperty('iban')
    expect(data).not.toHaveProperty('bic')
  })

  it('📍 mais un `null` explicite les efface bien', async () => {
    await appeler(modifier, { iban: null, bic: null }, { payeeId: '42' })

    const data = prismaMock.treasuryPayee.updateMany.mock.calls[0]![0].data
    expect(data.iban).toBe(null)
    expect(data.bic).toBe(null)
  })

  it('refuse un identifiant de bénéficiaire qui n’en est pas un', async () => {
    await expect(appeler(modifier, { label: 'X' }, { payeeId: 'abc' })).rejects.toBeDefined()
    expect(prismaMock.treasuryPayee.updateMany).not.toHaveBeenCalled()
  })
})
