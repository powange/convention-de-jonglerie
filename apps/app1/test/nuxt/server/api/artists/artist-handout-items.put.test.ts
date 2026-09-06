import { describe, it, expect, beforeEach, vi } from 'vitest'

const mockCanManage = vi.hoisted(() => vi.fn())

vi.mock('#server/utils/permissions/edition-permissions', () => ({
  canManageArtistsById: mockCanManage,
}))

import handler from '../../../../../../../layers/artists/server/api/editions/[id]/artists/[artistId]/handout-items.put'
import { global } from '../../../globales-nitro'

const prismaMock = (globalThis as any).prisma

const evenement = {
  context: { params: { id: '22', artistId: '77' }, user: { id: 1, pseudo: 'orga' } },
}

/** Lignes transmises au createMany des associations */
const lignesEcrites = () => prismaMock.artistHandoutItem.createMany.mock.calls[0]?.[0]?.data ?? []

describe('PUT /api/editions/[id]/artists/[artistId]/handout-items', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCanManage.mockResolvedValue(true)
    prismaMock.editionArtist.findFirst.mockResolvedValue({ id: 77 })
    // Par défaut, tous les articles demandés appartiennent bien à l'édition
    prismaMock.ticketingHandoutItem.count.mockImplementation(
      async ({ where }: any) => where.id.in.length
    )
    prismaMock.artistHandoutItem.deleteMany.mockResolvedValue({ count: 0 })
    prismaMock.artistHandoutItem.createMany.mockResolvedValue({ count: 2 })
    prismaMock.$transaction.mockImplementation(async (fn: any) => fn(prismaMock))
  })

  const envoyer = (body: unknown) => {
    global.readBody = vi.fn().mockResolvedValue(body)
    return handler(evenement as any)
  }

  it('associe les articles demandés à cet artiste, avec leur nombre d’exemplaires', async () => {
    const result = await envoyer({
      handoutItemIds: [
        { handoutItemId: 5, quantity: 3 },
        { handoutItemId: 6, quantity: 1 },
      ],
    })

    expect(result.success).toBe(true)
    expect(lignesEcrites()).toEqual([
      { artistId: 77, handoutItemId: 5, quantity: 3 },
      { artistId: 77, handoutItemId: 6, quantity: 1 },
    ])
  })

  it("accepte une liste d'identifiants nus, comme les autres cibles", async () => {
    await envoyer({ handoutItemIds: [5, 6] })

    expect(lignesEcrites()).toEqual([
      { artistId: 77, handoutItemId: 5, quantity: 1 },
      { artistId: 77, handoutItemId: 6, quantity: 1 },
    ])
  })

  it('remplace les associations existantes de cet artiste', async () => {
    await envoyer({ handoutItemIds: [{ handoutItemId: 5 }] })

    expect(prismaMock.artistHandoutItem.deleteMany).toHaveBeenCalledWith({
      where: { artistId: 77 },
    })
  })

  it('vide les associations sans rien réécrire quand la sélection est vide', async () => {
    await envoyer({ handoutItemIds: [] })

    expect(prismaMock.artistHandoutItem.deleteMany).toHaveBeenCalled()
    expect(prismaMock.artistHandoutItem.createMany).not.toHaveBeenCalled()
  })

  it('refuse un article étranger à l’édition', async () => {
    prismaMock.ticketingHandoutItem.count.mockResolvedValue(1) // un seul des deux existe

    await expect(
      envoyer({ handoutItemIds: [{ handoutItemId: 5 }, { handoutItemId: 99 }] })
    ).rejects.toBeDefined()
  })

  it("refuse un artiste qui n'appartient pas à cette édition", async () => {
    // Sans ce contrôle, l'identifiant d'un artiste d'une autre édition passerait la
    // permission de celle-ci et se verrait attribuer des articles.
    prismaMock.editionArtist.findFirst.mockResolvedValue(null)

    await expect(envoyer({ handoutItemIds: [{ handoutItemId: 5 }] })).rejects.toBeDefined()
    expect(prismaMock.artistHandoutItem.createMany).not.toHaveBeenCalled()
  })

  it('refuse un contributeur sans droit sur les artistes', async () => {
    mockCanManage.mockResolvedValue(false)

    await expect(envoyer({ handoutItemIds: [{ handoutItemId: 5 }] })).rejects.toBeDefined()
    expect(prismaMock.artistHandoutItem.createMany).not.toHaveBeenCalled()
  })
})
