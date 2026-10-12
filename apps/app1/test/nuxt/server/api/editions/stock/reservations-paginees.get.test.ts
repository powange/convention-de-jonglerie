import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetEditionWithPermissions = vi.hoisted(() => vi.fn())
const mockCanAccessStock = vi.hoisted(() => vi.fn())

vi.mock('#server/utils/permissions/edition-permissions', () => ({
  getEditionWithPermissions: mockGetEditionWithPermissions,
}))
vi.mock('#server/utils/stock-helpers', () => ({
  canAccessStock: mockCanAccessStock,
}))
vi.mock('#server/utils/auth-utils', () => ({
  requireAuth: vi.fn((event) => event.context.user),
}))

import handler from '../../../../../../../../layers/stock/server/api/editions/[id]/stock-items/[itemId]/reservations.get'
import { global } from '../../../../globales-nitro'

/**
 * Les réservations d'un objet, page par page — constat E3.
 *
 * ## Le défaut
 *
 * La fiche de l'objet les chargeait **toutes** : ni `take`, ni `where`, alors que son propre
 * commentaire annonçait « ses réservations actives et futures ». Elle n'en prend plus que la
 * première page et le total ; ce point d'API sert les suivantes.
 *
 * 📍 **Mesuré avant d'y toucher : 0 réservation en base de développement.** Ce n'est donc pas la
 * correction d'une panne mais une échéance — et l'historique est **paginé** plutôt que borné aux
 * réservations à venir, parce que cet écran montre délibérément tout le passé. C'est la décision
 * prise le 12/10 entre trois branches.
 *
 * ## ⚠️ Ce que le mock Prisma de ce dépôt ignore
 *
 * Il ne tient compte ni de `where`, ni de `skip`, ni de `take` : il rend ce qu'on lui a donné.
 * Ces cas vérifient donc **la FORME de la requête** — que les bornes sont bien passées, et sur
 * quoi — et non le découpage lui-même, qui est l'affaire de la base. Un cas qui compterait les
 * lignes rendues ne mesurerait que le bouchon.
 */
const prismaMock = (globalThis as any).prisma

const utilisateur = { id: 1, email: 'u@t.com', pseudo: 'u' }
const edition = { id: 1, convention: { id: 10, authorId: 200, organizers: [] } }

/*
 * ⚠️ LA QUERY PASSE PAR LE BOUCHON GLOBAL, pas par `node.req.url`. Dans ce harnais, `getQuery`
 * est un espion posé sur `globalThis` — écrire l'URL ne l'alimente donc PAS, et `validatePagination`
 * retombait sur la page 1 : mon premier cas mesurait `skip: 0` en croyant demander la page 2,
 * c'est-à-dire exactement le défaut qu'il devait attraper.
 */
const evenement = (query: Record<string, string> = {}) => {
  global.getQuery = vi.fn().mockReturnValue(query)
  return {
    context: { params: { id: '1', itemId: '5' }, user: utilisateur, query },
    node: { req: { url: '/?' + new URLSearchParams(query).toString() } },
  }
}

describe('GET /api/editions/[id]/stock-items/[itemId]/reservations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetEditionWithPermissions.mockResolvedValue(edition)
    mockCanAccessStock.mockResolvedValue(true)
    prismaMock.stockItem.findFirst.mockResolvedValue({ id: 5 })
    prismaMock.stockReservation.findMany.mockResolvedValue([])
    prismaMock.stockReservation.count.mockResolvedValue(0)
  })

  it('borne la lecture, et la borne sur CET objet', async () => {
    // 📍 LE CŒUR DU CONSTAT : des bornes, et un `where` sur l'objet. Sans le `where`, la page 2
    // rendrait les réservations de tout le stock.
    await handler(evenement({ page: '2', limit: '20' }) as any)
    const appel = prismaMock.stockReservation.findMany.mock.calls[0]![0]
    expect(appel.where).toEqual({ stockItemId: 5 })
    expect(appel.take).toBe(20)
    expect(appel.skip).toBe(20)
  })

  it('trie comme la première page', async () => {
    // Sans le même tri, la page 2 ne serait pas la suite de la page 1 : elle rejouerait des
    // réservations déjà vues et en sauterait d'autres, sans que rien ne le signale.
    await handler(evenement() as any)
    expect(prismaMock.stockReservation.findMany.mock.calls[0]![0].orderBy).toEqual({
      startsAt: 'asc',
    })
  })

  it('ne rend pas l’adresse e-mail du réservataire', async () => {
    // ⚠️ Cette fiche est ouverte à qui peut consulter le stock, ce qui inclut les responsables
    // d'équipe bénévole — lesquels n'ont pas à connaître l'adresse des autres participants. La
    // première page ne la rendait déjà pas ; une seconde page plus bavarde serait une fuite.
    await handler(evenement() as any)
    const champs = prismaMock.stockReservation.findMany.mock.calls[0]![0].include.user.select
    expect(champs.email).toBeUndefined()
    expect(champs.emailHash).toBe(true)
  })

  it('rend le total, pour que l’écran sache s’il y a une suite', async () => {
    prismaMock.stockReservation.count.mockResolvedValue(57)
    const reponse: any = await handler(evenement() as any)
    expect(reponse.pagination.totalCount).toBe(57)
    expect(prismaMock.stockReservation.count.mock.calls[0]![0].where).toEqual({ stockItemId: 5 })
  })

  it('⚠️ refuse un objet d’une AUTRE édition, au lieu de rendre une liste vide', async () => {
    // 📍 Sans cette vérification, un identifiant étranger rendrait un 200 avec zéro ligne — qui se
    // lit « cet objet n'a pas de réservation », là où la réponse juste est « il n'existe pas ici ».
    prismaMock.stockItem.findFirst.mockResolvedValue(null)
    await expect(handler(evenement() as any)).rejects.toMatchObject({ statusCode: 404 })
    expect(prismaMock.stockReservation.findMany).not.toHaveBeenCalled()
  })

  it('vérifie l’appartenance de l’objet à l’édition de l’URL', async () => {
    await handler(evenement() as any)
    expect(prismaMock.stockItem.findFirst.mock.calls[0]![0].where).toEqual({
      id: 5,
      group: { editionId: 1 },
    })
  })

  it('refuse sans le droit de consulter le stock', async () => {
    mockCanAccessStock.mockResolvedValue(false)
    await expect(handler(evenement() as any)).rejects.toMatchObject({ statusCode: 403 })
    expect(prismaMock.stockReservation.findMany).not.toHaveBeenCalled()
  })

  it('refuse une édition inconnue', async () => {
    mockGetEditionWithPermissions.mockResolvedValue(null)
    await expect(handler(evenement() as any)).rejects.toMatchObject({ statusCode: 404 })
  })

  it('refuse un identifiant d’objet qui n’est pas un nombre', async () => {
    const mauvais = {
      context: { params: { id: '1', itemId: 'abc' }, user: utilisateur },
      node: { req: { url: '/' } },
    }
    await expect(handler(mauvais as any)).rejects.toMatchObject({ statusCode: 400 })
  })
})
