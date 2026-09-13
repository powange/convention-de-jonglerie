import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('../../../../../server/utils/permissions/edition-permissions', () => ({
  getEditionWithPermissions: vi.fn(),
  canManageStock: vi.fn(() => true),
  canAccessStock: vi.fn(async () => true),
}))

import { getEditionWithPermissions } from '#server/utils/permissions/edition-permissions'
import creerListe from '../../../../../../../layers/stock/server/api/editions/[id]/stock-shopping-lists/index.post'
import renommerListe from '../../../../../../../layers/stock/server/api/editions/[id]/stock-shopping-lists/[listId]/index.put'
import supprimerListe from '../../../../../../../layers/stock/server/api/editions/[id]/stock-shopping-lists/[listId]/index.delete'
import ajouterArticles from '../../../../../../../layers/stock/server/api/editions/[id]/stock-shopping-lists/[listId]/items.post'
import cocherArticle from '../../../../../../../layers/stock/server/api/editions/[id]/stock-shopping-lists/[listId]/items/[articleId].patch'
import { global } from '../../../globales-nitro'

const prismaMock = (globalThis as any).prisma
const mockEdition = getEditionWithPermissions as ReturnType<typeof vi.fn>

/**
 * Les listes de courses tirées du recomptage.
 *
 * ⚠️ Ces tests portent sur le SERVEUR, et deux gardes y sont vitales : une liste ne se manipule
 * que depuis SON édition, et une liste ne contient que du matériel de CETTE édition. Sans elles,
 * quelqu'un qui gère le stock d'une édition atteindrait celui d'une autre en changeant un nombre
 * dans l'URL — les droits ayant été vérifiés sur la première, l'écriture faite sur la seconde.
 */
describe('les listes de courses du stock', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Sans édition, les endpoints s'arrêtent avant d'atteindre la garde : le test passerait au
    // vert sans avoir rien vérifié.
    mockEdition.mockResolvedValue({ id: 1, stockEnabled: true })
    // Trois identifiants distincts, et non deux : l'édition est lue par `validateEditionId`, qui
    // passe lui aussi par `getRouterParam`. Les confondre ferait chercher la liste dans l'édition
    // 3 tout en vérifiant les droits sur la 1 — exactement ce que ces tests traquent.
    global.getRouterParam = vi.fn((_e: any, nom: string) => {
      if (nom === 'id') return '1'
      if (nom === 'listId') return '7'
      return '3'
    })
    global.readBody = vi.fn().mockResolvedValue({})
  })

  const evenement = { context: { params: { id: '1' }, user: { id: 10 } } }

  describe('créer une liste', () => {
    beforeEach(() => {
      prismaMock.stockShoppingList.create.mockResolvedValue({ id: 5, name: 'Quincaillerie' })
    })

    it('n’enregistre que le matériel de cette édition', async () => {
      // L'objet 99 appartient à une autre édition : la requête est forgée, et il doit tomber.
      global.readBody = vi.fn().mockResolvedValue({ name: 'Quincaillerie', itemIds: [3, 99] })
      prismaMock.stockItem.findMany.mockResolvedValue([{ id: 3 }])

      await creerListe(evenement as any)

      const data = prismaMock.stockShoppingList.create.mock.calls.at(-1)![0].data
      expect(data.items.create).toEqual([{ stockItemId: 3 }])
    })

    it('accepte une liste vide', async () => {
      // On crée parfois la liste d'abord, on la remplit ensuite.
      global.readBody = vi.fn().mockResolvedValue({ name: 'Magasin de jonglerie' })

      await creerListe(evenement as any)

      const data = prismaMock.stockShoppingList.create.mock.calls.at(-1)![0].data
      expect(data.items.create).toEqual([])
      // Aucun objet demandé : inutile d'aller interroger la base pour s'en assurer.
      expect(prismaMock.stockItem.findMany).not.toHaveBeenCalled()
    })

    it('refuse un nom vide', async () => {
      global.readBody = vi.fn().mockResolvedValue({ name: '   ' })

      await expect(creerListe(evenement as any)).rejects.toMatchObject({ statusCode: 400 })
      expect(prismaMock.stockShoppingList.create).not.toHaveBeenCalled()
    })
  })

  describe('agir sur une liste d’une AUTRE édition', () => {
    beforeEach(() => {
      // La garde cherche la liste par (id, editionId) : celle-ci n'appartient pas à l'édition 1.
      prismaMock.stockShoppingList.findFirst.mockResolvedValue(null)
    })

    it('refuse de la renommer', async () => {
      global.readBody = vi.fn().mockResolvedValue({ name: 'Détournée' })

      await expect(renommerListe(evenement as any)).rejects.toMatchObject({ statusCode: 404 })
      expect(prismaMock.stockShoppingList.update).not.toHaveBeenCalled()
    })

    it('refuse de la supprimer', async () => {
      await expect(supprimerListe(evenement as any)).rejects.toMatchObject({ statusCode: 404 })
      expect(prismaMock.stockShoppingList.delete).not.toHaveBeenCalled()
    })

    it('refuse d’y ajouter du matériel', async () => {
      global.readBody = vi.fn().mockResolvedValue({ itemIds: [3] })

      await expect(ajouterArticles(evenement as any)).rejects.toMatchObject({ statusCode: 404 })
      expect(prismaMock.stockShoppingListItem.createMany).not.toHaveBeenCalled()
    })

    it('refuse d’y cocher un article', async () => {
      global.readBody = vi.fn().mockResolvedValue({ purchased: true })

      await expect(cocherArticle(evenement as any)).rejects.toMatchObject({ statusCode: 404 })
      expect(prismaMock.stockShoppingListItem.update).not.toHaveBeenCalled()
    })
  })

  describe('ajouter du matériel à une liste', () => {
    beforeEach(() => {
      prismaMock.stockShoppingList.findFirst.mockResolvedValue({ id: 7, name: 'Quincaillerie' })
      prismaMock.stockShoppingList.findUnique.mockResolvedValue({ id: 7, items: [] })
    })

    it('écarte le matériel étranger à l’édition', async () => {
      global.readBody = vi.fn().mockResolvedValue({ itemIds: [3, 99] })
      prismaMock.stockItem.findMany.mockResolvedValue([{ id: 3 }])

      await ajouterArticles(evenement as any)

      expect(prismaMock.stockShoppingListItem.createMany.mock.calls.at(-1)![0].data).toEqual([
        { listId: 7, stockItemId: 3 },
      ])
    })

    it('ignore les doublons plutôt que d’échouer', async () => {
      // Rouvrir la page des manquants et recocher le même objet est un geste anodin : le contrat
      // d'unicité en ferait sans cela une erreur dont l'utilisateur ne saurait que faire.
      global.readBody = vi.fn().mockResolvedValue({ itemIds: [3] })
      prismaMock.stockItem.findMany.mockResolvedValue([{ id: 3 }])

      await ajouterArticles(evenement as any)

      expect(prismaMock.stockShoppingListItem.createMany.mock.calls.at(-1)![0]).toMatchObject({
        skipDuplicates: true,
      })
    })

    it('n’écrit rien quand aucun identifiant ne survit au filtre', async () => {
      global.readBody = vi.fn().mockResolvedValue({ itemIds: [99] })
      prismaMock.stockItem.findMany.mockResolvedValue([])

      await ajouterArticles(evenement as any)

      expect(prismaMock.stockShoppingListItem.createMany).not.toHaveBeenCalled()
    })

    it('refuse une sélection vide', async () => {
      global.readBody = vi.fn().mockResolvedValue({ itemIds: [] })

      await expect(ajouterArticles(evenement as any)).rejects.toMatchObject({ statusCode: 400 })
    })
  })

  describe('cocher un article', () => {
    beforeEach(() => {
      prismaMock.stockShoppingList.findFirst.mockResolvedValue({ id: 7, name: 'Quincaillerie' })
      prismaMock.stockShoppingListItem.update.mockResolvedValue({ id: 3, purchased: true })
    })

    it('refuse un article qui appartient à une autre liste', async () => {
      prismaMock.stockShoppingListItem.findFirst.mockResolvedValue(null)
      global.readBody = vi.fn().mockResolvedValue({ purchased: true })

      await expect(cocherArticle(evenement as any)).rejects.toMatchObject({ statusCode: 404 })
      expect(prismaMock.stockShoppingListItem.update).not.toHaveBeenCalled()
    })

    it('écrit l’état demandé, sans le basculer', async () => {
      // Deux personnes qui cochent la même ligne au même moment doivent aboutir au même état, pas
      // à deux bascules qui s'annulent.
      prismaMock.stockShoppingListItem.findFirst.mockResolvedValue({ id: 3 })
      global.readBody = vi.fn().mockResolvedValue({ purchased: false })

      await cocherArticle(evenement as any)

      expect(prismaMock.stockShoppingListItem.update.mock.calls.at(-1)![0].data).toEqual({
        purchased: false,
      })
    })

    it('exige un booléen', async () => {
      prismaMock.stockShoppingListItem.findFirst.mockResolvedValue({ id: 3 })
      global.readBody = vi.fn().mockResolvedValue({ purchased: 'oui' })

      await expect(cocherArticle(evenement as any)).rejects.toMatchObject({ statusCode: 400 })
    })
  })

  /**
   * ⚠️ Les tests ci-dessus mockent Prisma : il rend ce qu'on lui dit, quel que soit le `where`.
   * Ils prouvent donc que l'endpoint s'arrête quand la base ne trouve rien — pas que la recherche
   * était bornée à l'édition. Retirer `editionId` du `where` les laisserait tous verts.
   *
   * Ceux-ci regardent la requête elle-même. C'est la seule façon de vérifier un filtre qu'un mock
   * ne peut pas appliquer.
   */
  describe('les requêtes sont bornées à leur portée', () => {
    it('cherche la liste par (id, édition), et non par son seul identifiant', async () => {
      prismaMock.stockShoppingList.findFirst.mockResolvedValue({ id: 7, name: 'Quincaillerie' })
      prismaMock.stockShoppingList.delete.mockResolvedValue({ id: 7 })

      await supprimerListe(evenement as any)

      expect(prismaMock.stockShoppingList.findFirst.mock.calls.at(-1)![0].where).toEqual({
        id: 7,
        editionId: 1,
      })
    })

    it('cherche l’article dans SA liste', async () => {
      prismaMock.stockShoppingList.findFirst.mockResolvedValue({ id: 7, name: 'Quincaillerie' })
      prismaMock.stockShoppingListItem.findFirst.mockResolvedValue({ id: 3 })
      prismaMock.stockShoppingListItem.update.mockResolvedValue({ id: 3, purchased: true })
      global.readBody = vi.fn().mockResolvedValue({ purchased: true })

      await cocherArticle(evenement as any)

      expect(prismaMock.stockShoppingListItem.findFirst.mock.calls.at(-1)![0].where).toEqual({
        id: 3,
        listId: 7,
      })
    })

    it('ne retient que le matériel dont le groupe est dans l’édition', async () => {
      // Sans `group: { editionId }`, le filtre rendrait n'importe quel identifiant existant, et
      // une requête forgée glisserait dans la liste du matériel d'une autre convention.
      global.readBody = vi.fn().mockResolvedValue({ name: 'Quincaillerie', itemIds: [3, 99] })
      prismaMock.stockItem.findMany.mockResolvedValue([{ id: 3 }])
      prismaMock.stockShoppingList.create.mockResolvedValue({ id: 5 })

      await creerListe(evenement as any)

      expect(prismaMock.stockItem.findMany.mock.calls.at(-1)![0].where).toEqual({
        id: { in: [3, 99] },
        group: { editionId: 1 },
      })
    })
  })

  describe('un identifiant d’URL absurde', () => {
    it('est refusé en 400, et non cherché en base', async () => {
      // `Number('')` vaut zéro : sans contrôle, on irait chercher la liste numéro zéro et l'on
      // rendrait un 404 incompréhensible plutôt qu'une erreur de saisie.
      global.getRouterParam = vi.fn(() => '')

      await expect(supprimerListe(evenement as any)).rejects.toMatchObject({ statusCode: 400 })
      expect(prismaMock.stockShoppingList.findFirst).not.toHaveBeenCalled()
    })
  })
})
