import { describe, it, expect, beforeEach, vi } from 'vitest'

const mockCanManageTicketing = vi.hoisted(() => vi.fn())
const mockCanManageArtists = vi.hoisted(() => vi.fn())

/*
 * Les DEUX droits sont mockés, alors que le point d'API n'en emploie qu'un.
 *
 * C'est délibéré : si quelqu'un rebasculait la route sur `canManageArtistsById`, le module
 * exporterait toujours ce qu'il faut et rien ne planterait — c'est l'assertion explicite plus
 * bas qui l'attraperait. Un mock qui n'expose qu'un seul droit ferait échouer le test pour la
 * mauvaise raison (un import manquant) plutôt que pour la bonne.
 */
vi.mock('#server/utils/permissions/edition-permissions', () => ({
  canManageTicketingById: mockCanManageTicketing,
  canManageArtistsById: mockCanManageArtists,
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
    mockCanManageTicketing.mockResolvedValue(true)
    mockCanManageArtists.mockResolvedValue(false)
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
    mockCanManageTicketing.mockResolvedValue(false)

    await expect(envoyer({ handoutItemIds: [{ handoutItemId: 5 }] })).rejects.toBeDefined()
    expect(prismaMock.artistHandoutItem.createMany).not.toHaveBeenCalled()
  })

  /*
   * F5 — le droit exigé, épinglé.
   *
   * Cette route était la SEULE des huit points d'API dédiés aux articles à remettre à demander
   * `canManageArtists`. Ce n'était pas qu'une incohérence : la seule surface qui l'appelle est la
   * page billetterie, gardée par `canManageTicketing`. Les deux droits étant des colonnes
   * indépendantes, un organisateur qui gère la billetterie sans gérer les artistes voyait le
   * bouton et recevait un 403 en enregistrant.
   */
  it('exige le droit billetterie, et non le droit artistes', async () => {
    await envoyer({ handoutItemIds: [{ handoutItemId: 5 }] })

    expect(mockCanManageTicketing).toHaveBeenCalledWith(22, 1, expect.anything())
    expect(mockCanManageArtists).not.toHaveBeenCalled()
  })

  it('refuse celui qui ne gère que les artistes', async () => {
    mockCanManageTicketing.mockResolvedValue(false)
    mockCanManageArtists.mockResolvedValue(true)

    await expect(envoyer({ handoutItemIds: [{ handoutItemId: 5 }] })).rejects.toBeDefined()
    expect(prismaMock.artistHandoutItem.createMany).not.toHaveBeenCalled()
  })
})
