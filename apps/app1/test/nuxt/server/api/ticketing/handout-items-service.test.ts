import { describe, it, expect, beforeEach, vi } from 'vitest'

import {
  createHandoutItem,
  deleteHandoutItem,
  listHandoutItemsWithAssociationCounts,
  updateHandoutItem,
} from '../../../../../server/utils/editions/ticketing/handout-items'

const prismaMock = (globalThis as any).prisma

const compteursNuls = {
  tiers: 0,
  options: 0,
  customFields: 0,
  shows: 0,
  artists: 0,
  volunteerTicketingHandoutItems: 0,
  artistTicketingHandoutItems: 0,
  meals: 0,
}

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.ticketingHandoutItem.findFirst.mockResolvedValue(null)
  prismaMock.ticketingHandoutItem.create.mockImplementation(async ({ data }: any) => ({
    id: 1,
    ...data,
  }))
  prismaMock.ticketingHandoutItem.update.mockImplementation(async ({ data }: any) => ({
    id: 1,
    ...data,
  }))
  prismaMock.$transaction.mockResolvedValue([{ count: 0 }, { id: 1 }])
})

describe('unicité du nom d’un article à remettre', () => {
  it('crée un article dont le nom est libre', async () => {
    await createHandoutItem(22, { name: 'Bracelet' })

    expect(prismaMock.ticketingHandoutItem.create).toHaveBeenCalled()
  })

  /*
   * Deux articles de même nom sont indiscernables partout — et surtout au guichet, où la liste
   * de remise affiche deux lignes identiques. L'index unique tient la garantie ; ce contrôle
   * tient le message, sans quoi la violation d'index remonterait en 500.
   */
  it('refuse un nom déjà porté dans la même édition', async () => {
    prismaMock.ticketingHandoutItem.findFirst.mockResolvedValue({ id: 9 })

    await expect(createHandoutItem(22, { name: 'Bracelet' })).rejects.toMatchObject({
      statusCode: 400,
    })
    expect(prismaMock.ticketingHandoutItem.create).not.toHaveBeenCalled()
  })

  it('cherche l’homonyme dans la bonne édition, et seulement celle-là', async () => {
    await createHandoutItem(22, { name: 'Bracelet' })

    expect(prismaMock.ticketingHandoutItem.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ editionId: 22, name: 'Bracelet' }),
      })
    )
  })

  /*
   * Renommer un article sans changer son nom ne doit pas le faire passer pour son propre
   * doublon : la recherche exclut la ligne en cours de modification.
   */
  it('n’empêche pas un article de conserver son propre nom', async () => {
    prismaMock.ticketingHandoutItem.findUnique.mockResolvedValue({ id: 4, editionId: 22 })

    await updateHandoutItem(4, 22, { name: 'Bracelet' })

    expect(prismaMock.ticketingHandoutItem.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: { not: 4 } }) })
    )
    expect(prismaMock.ticketingHandoutItem.update).toHaveBeenCalled()
  })

  it('refuse de renommer un article avec le nom d’un autre', async () => {
    prismaMock.ticketingHandoutItem.findUnique.mockResolvedValue({ id: 4, editionId: 22 })
    prismaMock.ticketingHandoutItem.findFirst.mockResolvedValue({ id: 9 })

    await expect(updateHandoutItem(4, 22, { name: 'Bracelet' })).rejects.toMatchObject({
      statusCode: 400,
    })
    expect(prismaMock.ticketingHandoutItem.update).not.toHaveBeenCalled()
  })
})

describe('suppression d’un article à remettre', () => {
  beforeEach(() => {
    prismaMock.ticketingHandoutItem.findUnique.mockResolvedValue({ id: 4, editionId: 22 })
  })

  /*
   * Huit tables partent en cascade par leur clé étrangère. `EditionOrganizerHandoutItem` n'en a
   * pas : ses lignes SURVIVAIENT à la suppression en pointant vers un identifiant disparu, et
   * l'écran des organisateurs les affichait « Article inconnu ».
   */
  it('retire aussi les associations organisateurs, qui ne partent pas en cascade', async () => {
    await deleteHandoutItem(4, 22)

    expect(prismaMock.editionOrganizerHandoutItem.deleteMany).toHaveBeenCalledWith({
      where: { editionId: 22, handoutItemId: 4 },
    })
    expect(prismaMock.$transaction).toHaveBeenCalled()
  })

  it('refuse de supprimer un article d’une autre édition', async () => {
    prismaMock.ticketingHandoutItem.findUnique.mockResolvedValue({ id: 4, editionId: 99 })

    await expect(deleteHandoutItem(4, 22)).rejects.toMatchObject({ statusCode: 403 })
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })
})

describe('décompte des associations d’un article', () => {
  it('rend, pour chaque article, ce que sa suppression détacherait', async () => {
    prismaMock.ticketingHandoutItem.findMany.mockResolvedValue([
      {
        id: 4,
        name: 'Bracelet',
        _count: { ...compteursNuls, tiers: 3, options: 1, meals: 2 },
      },
    ])
    prismaMock.editionOrganizerHandoutItem.groupBy.mockResolvedValue([])

    const [article] = await listHandoutItemsWithAssociationCounts(22)

    expect(article).toMatchObject({ id: 4, name: 'Bracelet' })
    expect(article!.associations).toEqual({
      tarifs: 3,
      options: 1,
      champsPersonnalises: 0,
      spectacles: 0,
      artistes: 0,
      equipesBenevoles: 0,
      organisateurs: 0,
      repas: 2,
    })
  })

  // Deux tables distinctes pour les artistes : un artiste précis, et tous les artistes.
  it('additionne les deux tables d’articles d’artistes', async () => {
    prismaMock.ticketingHandoutItem.findMany.mockResolvedValue([
      {
        id: 4,
        name: 'Bracelet',
        _count: { ...compteursNuls, artists: 2, artistTicketingHandoutItems: 1 },
      },
    ])
    prismaMock.editionOrganizerHandoutItem.groupBy.mockResolvedValue([])

    const [article] = await listHandoutItemsWithAssociationCounts(22)

    expect(article!.associations.artistes).toBe(3)
  })

  // Les organisateurs sont comptés à part : aucune relation ne les relie à l'article.
  it('compte les organisateurs par une requête séparée', async () => {
    prismaMock.ticketingHandoutItem.findMany.mockResolvedValue([
      { id: 4, name: 'Bracelet', _count: { ...compteursNuls } },
      { id: 5, name: 'Tee-shirt', _count: { ...compteursNuls } },
    ])
    prismaMock.editionOrganizerHandoutItem.groupBy.mockResolvedValue([
      { handoutItemId: 5, _count: { _all: 6 } },
    ])

    const articles = await listHandoutItemsWithAssociationCounts(22)

    expect(articles[0]!.associations.organisateurs).toBe(0)
    expect(articles[1]!.associations.organisateurs).toBe(6)
  })

  it('ne laisse pas fuiter le _count brut de Prisma dans la réponse', async () => {
    prismaMock.ticketingHandoutItem.findMany.mockResolvedValue([
      { id: 4, name: 'Bracelet', _count: { ...compteursNuls } },
    ])
    prismaMock.editionOrganizerHandoutItem.groupBy.mockResolvedValue([])

    const [article] = await listHandoutItemsWithAssociationCounts(22)

    expect(article).not.toHaveProperty('_count')
  })
})
