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

import lireLesApports from '../../../../../server/api/editions/[id]/treasury/cash-float/index.get'
import creerUnApport from '../../../../../server/api/editions/[id]/treasury/cash-float/index.post'
import supprimerUnApport from '../../../../../server/api/editions/[id]/treasury/cash-float/[floatId].delete'
import corrigerUnApport from '../../../../../server/api/editions/[id]/treasury/cash-float/[floatId].put'
import enregistrerLeComptage from '../../../../../server/api/editions/[id]/treasury/cash-float-count.put'
import lireLaTresorerie from '../../../../../server/api/editions/[id]/treasury/index.get'
import { global } from '../../../globales-nitro'

const prismaMock = (globalThis as any).prisma

const evenement = (params: Record<string, string> = {}) => ({
  context: { params: { id: '21', ...params }, user: { id: 3 } },
})

/**
 * Les gardes du fonds de caisse, et l'invariant qui justifie sa table séparée.
 *
 * Le parcours Playwright éprouve l'écran ; ce fichier éprouve ce qu'un écran ne montre pas — les
 * refus, et le fait que la trésorerie n'aille jamais lire les apports.
 */
describe('fonds de caisse : les gardes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCanManage.mockResolvedValue(true)
    prismaMock.edition.findUnique.mockResolvedValue({
      id: 21,
      currency: 'EUR',
      conventionId: 2,
      cashFloatCount: null,
      cashFloatCountedAt: null,
    })
    prismaMock.treasuryCashFloat.findMany.mockResolvedValue([])
    prismaMock.treasuryCashFloat.create.mockResolvedValue({ id: 1 })
    prismaMock.treasuryCashFloat.findFirst.mockResolvedValue({ id: 5, restitutedAt: null })
    prismaMock.treasuryCashFloat.update.mockResolvedValue({ id: 5 })
    prismaMock.treasuryCashFloat.deleteMany.mockResolvedValue({ count: 1 })
    global.readBody.mockResolvedValue({ amount: 50 })
  })

  /*
   * Le droit de la TRÉSORERIE, et non celui de l'édition : les apports nomment des personnes et
   * des sommes qu'on leur doit. Les cinq points sont vérifiés un par un — une garde posée sur
   * quatre d'entre eux laisserait le cinquième ouvert, et c'est toujours celui qu'on oublie.
   */
  it('refuse les cinq points d’API sans le droit de gérer la trésorerie', async () => {
    mockCanManage.mockResolvedValue(false)
    const points: [string, (e: any) => Promise<unknown>][] = [
      ['lecture', (e) => lireLesApports(e)],
      ['création', (e) => creerUnApport(e)],
      ['correction', (e) => corrigerUnApport(e)],
      ['suppression', (e) => supprimerUnApport(e)],
      ['comptage', (e) => enregistrerLeComptage(e)],
    ]

    for (const [nom, appel] of points) {
      await expect(appel(evenement({ floatId: '5' })), `${nom} devrait refuser`).rejects.toThrow()
    }
    // Et rien n'a été écrit : un refus qui écrit d'abord ne serait pas un refus.
    expect(prismaMock.treasuryCashFloat.create).not.toHaveBeenCalled()
    expect(prismaMock.treasuryCashFloat.update).not.toHaveBeenCalled()
    expect(prismaMock.treasuryCashFloat.deleteMany).not.toHaveBeenCalled()
  })

  /*
   * ⚠️ L'ÉDITION DOIT FIGURER DANS LE `where`. Le droit est vérifié sur l'édition de l'URL : sans
   * ce filtre, quelqu'un qui gère la trésorerie d'une édition pourrait corriger ou supprimer
   * l'apport d'une AUTRE en passant son identifiant. Ce que ces deux cas vérifient n'est pas le
   * code de retour, c'est la REQUÊTE.
   */
  it('cantonne la correction à l’édition de l’URL', async () => {
    await corrigerUnApport(evenement({ floatId: '5' }))

    expect(prismaMock.treasuryCashFloat.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 5, editionId: 21 } })
    )
  })

  it('cantonne la suppression à l’édition de l’URL', async () => {
    await supprimerUnApport(evenement({ floatId: '5' }))

    expect(prismaMock.treasuryCashFloat.deleteMany).toHaveBeenCalledWith({
      where: { id: 5, editionId: 21 },
    })
  })

  it('rend 404 plutôt que de supprimer en silence un apport d’ailleurs', async () => {
    prismaMock.treasuryCashFloat.deleteMany.mockResolvedValue({ count: 0 })

    await expect(supprimerUnApport(evenement({ floatId: '5' }))).rejects.toThrow()
  })

  it('refuse un identifiant d’apport qui n’en est pas un', async () => {
    await expect(supprimerUnApport(evenement({ floatId: 'count' }))).rejects.toThrow()
    expect(prismaMock.treasuryCashFloat.deleteMany).not.toHaveBeenCalled()
  })

  /*
   * ⚠️ L'INVARIANT, mesuré sur la REQUÊTE et non sur un total.
   *
   * Le fonds de caisse ne doit entrer dans aucun chiffre du compte de résultat. La façon la plus
   * solide de le tenir est que la trésorerie n'aille même pas LIRE cette table : si la donnée
   * n'est jamais chargée, aucune arithmétique ne peut la compter. Ce test tombe le jour où
   * quelqu'un ajoute une jointure, bien avant qu'un total ne devienne faux.
   */
  it('la trésorerie ne lit JAMAIS la table du fonds de caisse', async () => {
    prismaMock.treasuryEntry.findMany.mockResolvedValue([])
    prismaMock.editionArtist.findMany.mockResolvedValue([])
    prismaMock.ticketingOrderItem.findMany.mockResolvedValue([])
    prismaMock.treasurySourceCode.findMany.mockResolvedValue([])
    prismaMock.treasuryCode.findMany.mockResolvedValue([])
    prismaMock.ticketingTier.findMany.mockResolvedValue([])

    await lireLaTresorerie(evenement())

    for (const methode of ['findMany', 'findFirst', 'findUnique'] as const) {
      expect(
        prismaMock.treasuryCashFloat[methode],
        `la trésorerie a appelé treasuryCashFloat.${methode}`
      ).not.toHaveBeenCalled()
    }
  })

  it('accepte un comptage à zéro, qui est une caisse vidée et non une absence', async () => {
    global.readBody.mockResolvedValue({ count: 0 })

    await enregistrerLeComptage(evenement())

    expect(prismaMock.edition.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ cashFloatCount: 0 }),
      })
    )
  })

  it('efface la date du comptage en même temps que le montant', async () => {
    global.readBody.mockResolvedValue({ count: null })

    await enregistrerLeComptage(evenement())

    expect(prismaMock.edition.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { cashFloatCount: null, cashFloatCountedAt: null },
      })
    )
  })
})
