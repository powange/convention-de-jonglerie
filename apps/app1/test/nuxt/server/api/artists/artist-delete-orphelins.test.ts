import { describe, it, expect, beforeEach, vi } from 'vitest'

const mockCanManageArtists = vi.hoisted(() => vi.fn())
const mockGetEdition = vi.hoisted(() => vi.fn())

vi.mock('#server/utils/permissions/edition-permissions', () => ({
  canManageArtists: mockCanManageArtists,
  getEditionWithPermissions: mockGetEdition,
}))

import handler from '../../../../../../../layers/artists/server/api/editions/[id]/artists/[artistId].delete'
import { global } from '../../../globales-nitro'

const prismaMock = (globalThis as any).prisma

/**
 * La suppression d'un artiste peut emporter ses numéros devenus muets — mais c'est le SERVEUR qui
 * décide lesquels.
 *
 * Exécuter la liste envoyée par l'écran telle quelle ferait de ce point d'API un moyen détourné de
 * supprimer n'importe quel numéro ou spectacle de l'édition : il suffirait d'en glisser
 * l'identifiant à la suppression d'un artiste quelconque. Ces tests tiennent cette garde.
 */
describe('DELETE /api/editions/[id]/artists/[artistId] — ce qu’il emporte', () => {
  const evenement = (corps?: unknown) => ({
    context: { params: { id: '22', artistId: '7' }, user: { id: 1, pseudo: 'orga' } },
    _corps: corps,
  })

  /** Un cabaret dont le numéro 10 n'est tenu que par l'artiste 7, et le 11 par quelqu'un d'autre. */
  const cabaret = {
    id: 5,
    title: 'Cabaret du samedi',
    acts: [
      { id: 10, title: 'Massues', showId: 5, artists: [{ artistId: 7, actId: 10 }] },
      { id: 11, title: 'Diabolo', showId: 5, artists: [{ artistId: 8, actId: 11 }] },
    ],
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetEdition.mockResolvedValue({ id: 22 })
    mockCanManageArtists.mockReturnValue(true)
    prismaMock.editionArtist.findFirst.mockResolvedValue({ id: 7 })
    prismaMock.show.findMany.mockResolvedValue([cabaret])
    prismaMock.$transaction.mockImplementation(async (fn: any) => fn(prismaMock))
    prismaMock.editionArtist.delete.mockResolvedValue({ id: 7 })
    prismaMock.showAct.deleteMany.mockResolvedValue({ count: 0 })
    prismaMock.show.deleteMany.mockResolvedValue({ count: 0 })
    global.readBody = vi.fn(async (e: any) => e._corps)
  })

  it('supprime le seul artiste quand rien n’est demandé — le contrat d’avant tient', async () => {
    // Un appel sans corps doit continuer de fonctionner : les clients ouverts n'envoient rien.
    await handler(evenement(undefined) as any)

    expect(prismaMock.editionArtist.delete).toHaveBeenCalledWith({ where: { id: 7 } })
    expect(prismaMock.showAct.deleteMany).not.toHaveBeenCalled()
    expect(prismaMock.show.deleteMany).not.toHaveBeenCalled()
  })

  it('emporte le numéro dont l’artiste était le seul interprète', async () => {
    await handler(evenement({ actIds: [10] }) as any)

    expect(prismaMock.showAct.deleteMany).toHaveBeenCalledWith({ where: { id: { in: [10] } } })
  })

  it('REFUSE d’emporter un numéro tenu par quelqu’un d’autre', async () => {
    // Le numéro 11 est à l'artiste 8 : le demander ne doit rien produire.
    await handler(evenement({ actIds: [11] }) as any)

    expect(prismaMock.showAct.deleteMany).not.toHaveBeenCalled()
  })

  it('REFUSE d’emporter un numéro d’un spectacle où l’artiste n’intervient pas', async () => {
    // L'identifiant d'un numéro inconnu de la requête n'apparaît dans aucun spectacle chargé.
    await handler(evenement({ actIds: [999] }) as any)

    expect(prismaMock.showAct.deleteMany).not.toHaveBeenCalled()
  })

  it('REFUSE de supprimer un cabaret où il resterait un numéro', async () => {
    // On emporte le 10 ; le 11 reste, donc le cabaret n'est pas vide.
    await handler(evenement({ actIds: [10], showIds: [5] }) as any)

    expect(prismaMock.show.deleteMany).not.toHaveBeenCalled()
  })

  it('supprime le cabaret quand tous ses numéros partent', async () => {
    prismaMock.show.findMany.mockResolvedValue([
      {
        id: 5,
        title: 'Cabaret solo',
        acts: [
          { id: 10, title: 'Un', showId: 5, artists: [{ artistId: 7, actId: 10 }] },
          { id: 11, title: 'Deux', showId: 5, artists: [{ artistId: 7, actId: 11 }] },
        ],
      },
    ])

    await handler(evenement({ actIds: [10, 11], showIds: [5] }) as any)

    expect(prismaMock.show.deleteMany).toHaveBeenCalledWith({ where: { id: { in: [5] } } })
  })

  it('REFUSE de supprimer un spectacle qu’on n’a pas vidé', async () => {
    // Le cas que cette garde existe pour empêcher : demander un spectacle sans toucher ses numéros.
    await handler(evenement({ showIds: [5] }) as any)

    expect(prismaMock.show.deleteMany).not.toHaveBeenCalled()
    expect(prismaMock.editionArtist.delete).toHaveBeenCalled()
  })

  it('fait le tout sous une seule transaction', async () => {
    // Une suppression partielle laisserait l'écran en désaccord avec ce qui a été demandé.
    await handler(evenement({ actIds: [10] }) as any)

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1)
  })
})
