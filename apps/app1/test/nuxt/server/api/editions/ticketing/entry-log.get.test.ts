import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.hoisted(() => {
  if (!(globalThis as any).wrapApiHandler) {
    ;(globalThis as any).wrapApiHandler = (handler: any) => handler
  }
  // Auto-importé par Nitro dans le handler, comme `wrapApiHandler`.
  if (!(globalThis as any).createPaginatedResponse) {
    ;(globalThis as any).createPaginatedResponse = (
      items: unknown[],
      total: number,
      page: number,
      limit: number
    ) => ({
      success: true,
      data: items,
      pagination: {
        page,
        limit,
        totalCount: total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      },
    })
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

import handler from '../../../../../../server/api/editions/[id]/ticketing/entry-log.get'
import { global } from '../../../../globales-nitro'

const prismaMock = (globalThis as any).prisma

/**
 * L'historique complet : pagination, recherche et filtres.
 *
 * Ces tests assurent la REQUÊTE envoyée à Prisma. C'est ce qui compte ici : un filtre qui ne
 * descend pas dans le `where` rendrait un compte total faux, et la pagination afficherait des
 * pages vides qu'on prendrait pour une absence de résultats.
 */
describe('GET /api/editions/[id]/ticketing/entry-log', () => {
  const evenement = { context: { params: { id: '42' }, user: { id: 1 } } }

  const avecQuery = (query: Record<string, unknown> = {}) => {
    global.getQuery = vi.fn().mockReturnValue(query)
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockCanAccessEditionData.mockResolvedValue(true)
    prismaMock.entryValidationLog.count.mockResolvedValue(0)
    prismaMock.entryValidationLog.findMany.mockResolvedValue([])
    avecQuery()
  })

  it("refuse l'accès sans droits, et n'interroge pas le journal", async () => {
    mockCanAccessEditionData.mockResolvedValue(false)

    await expect(handler(evenement as any)).rejects.toThrow(/Droits insuffisants/)
    expect(prismaMock.entryValidationLog.findMany).not.toHaveBeenCalled()
  })

  it('pagine côté serveur, du plus récent au plus ancien', async () => {
    avecQuery({ page: '3', pageSize: '25' })

    await handler(evenement as any)

    const appel = prismaMock.entryValidationLog.findMany.mock.calls[0][0]
    expect(appel).toMatchObject({ orderBy: { createdAt: 'desc' }, skip: 50, take: 25 })
  })

  it('plafonne la taille de page', async () => {
    avecQuery({ pageSize: '5000' })

    // Sans plafond, un appelant curieux ramènerait tout le journal en une requête — et la
    // résolution des noms qui suit chargerait autant de participants.
    await expect(handler(evenement as any)).rejects.toThrow()
  })

  it('descend les trois filtres dans le where, et pas seulement dans la page affichée', async () => {
    avecQuery({
      movement: 'INVALIDATED',
      kind: 'volunteer',
      from: '2026-08-01',
      to: '2026-08-06',
    })

    await handler(evenement as any)

    const where = prismaMock.entryValidationLog.findMany.mock.calls[0][0].where
    expect(where.editionId).toBe(42)
    expect(where.movement).toBe('INVALIDATED')
    expect(where.participantKind).toBe('VOLUNTEER')
    expect(where.createdAt.gte).toEqual(new Date('2026-08-01'))
    // La borne haute couvre le jour ENTIER : s'arrêter à minuit écarterait toute la journée du 6.
    expect(where.createdAt.lte.toISOString()).toBe('2026-08-06T23:59:59.999Z')
    // Le compte total doit porter le même critère, sans quoi la pagination annonce des pages
    // qui n'existent pas.
    expect(prismaMock.entryValidationLog.count.mock.calls[0][0].where).toEqual(where)
  })

  it('cherche les personnes AVANT de filtrer le journal', async () => {
    avecQuery({ search: 'lovelace' })
    prismaMock.ticketingOrderItem.findMany.mockResolvedValue([{ id: 300 }])
    prismaMock.editionVolunteerApplication.findMany.mockResolvedValue([])
    prismaMock.editionArtist.findMany.mockResolvedValue([{ id: 5 }])
    prismaMock.editionOrganizer.findMany.mockResolvedValue([])

    await handler(evenement as any)

    // Le journal ne porte pas les noms : on résout d'abord les participants, puis on filtre sur
    // eux. L'inverse — filtrer après pagination — donnerait un compte total faux.
    const where = prismaMock.entryValidationLog.findMany.mock.calls[0][0].where
    expect(where.OR).toEqual([
      { participantKind: 'TICKET', participantId: { in: [300] } },
      { participantKind: 'ARTIST', participantId: { in: [5] } },
    ])
  })

  it('cherche aussi sur le code du billet', async () => {
    avecQuery({ search: 'onsite-abc' })
    prismaMock.ticketingOrderItem.findMany.mockResolvedValue([])
    prismaMock.editionVolunteerApplication.findMany.mockResolvedValue([])
    prismaMock.editionArtist.findMany.mockResolvedValue([])
    prismaMock.editionOrganizer.findMany.mockResolvedValue([])

    await handler(evenement as any)

    // C'est ce que la personne présente quand son nom ne dit rien à l'agent.
    const critere = prismaMock.ticketingOrderItem.findMany.mock.calls[0][0].where
    expect(critere.AND[0].OR).toContainEqual({ qrCode: { contains: 'onsite-abc' } })
  })

  it('cherche par MOTS, pour que « prénom nom » trouve la personne', async () => {
    avecQuery({ search: 'ada lovelace' })
    prismaMock.ticketingOrderItem.findMany.mockResolvedValue([])
    prismaMock.editionVolunteerApplication.findMany.mockResolvedValue([])
    prismaMock.editionArtist.findMany.mockResolvedValue([])
    prismaMock.editionOrganizer.findMany.mockResolvedValue([])

    await handler(evenement as any)

    // Un `contains` sur la chaîne entière ne trouvait rien : aucun champ ne vaut « ada lovelace ».
    // Chaque mot est cherché séparément, et tous doivent se retrouver — « ada love » trouve Ada
    // Lovelace, pas Ada Byron.
    const critere = prismaMock.editionVolunteerApplication.findMany.mock.calls[0][0].where
    expect(critere.user.AND).toHaveLength(2)
    expect(critere.user.AND[0].OR).toContainEqual({ prenom: { contains: 'ada' } })
    expect(critere.user.AND[1].OR).toContainEqual({ nom: { contains: 'lovelace' } })
  })

  it("n'interroge pas le journal quand aucune personne ne correspond", async () => {
    avecQuery({ search: 'introuvable' })
    prismaMock.ticketingOrderItem.findMany.mockResolvedValue([])
    prismaMock.editionVolunteerApplication.findMany.mockResolvedValue([])
    prismaMock.editionArtist.findMany.mockResolvedValue([])
    prismaMock.editionOrganizer.findMany.mockResolvedValue([])

    const resultat = await handler(evenement as any)

    expect(prismaMock.entryValidationLog.findMany).not.toHaveBeenCalled()
    expect(resultat.data).toEqual([])
    expect(resultat.pagination.totalCount).toBe(0)
  })

  it('refuse une recherche d’un seul caractère', async () => {
    avecQuery({ search: 'a' })

    // Un `contains` se traduit par LIKE '%a%', qui n'utilise aucun index : une lettre
    // déclencherait quatre balayages de table. C'est le reproche du constat P2 à la recherche
    // voisine, qu'on ne reproduit pas ici.
    await expect(handler(evenement as any)).rejects.toThrow()
    expect(prismaMock.entryValidationLog.findMany).not.toHaveBeenCalled()
  })

  it('rend la forme paginée attendue par le client', async () => {
    avecQuery({ page: '2', pageSize: '25' })
    prismaMock.entryValidationLog.count.mockResolvedValue(60)
    prismaMock.entryValidationLog.findMany.mockResolvedValue([])

    const resultat = await handler(evenement as any)

    expect(resultat.pagination).toMatchObject({
      page: 2,
      limit: 25,
      totalCount: 60,
      totalPages: 3,
      hasNextPage: true,
      hasPrevPage: true,
    })
  })
})
