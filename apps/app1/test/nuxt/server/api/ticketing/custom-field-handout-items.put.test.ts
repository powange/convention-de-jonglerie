import { describe, it, expect, beforeEach, vi } from 'vitest'

const mockCanManage = vi.hoisted(() => vi.fn())

vi.mock('#server/utils/permissions/edition-permissions', () => ({
  canManageTicketingById: mockCanManage,
}))

import handler from '../../../../../../../layers/ticketing/server/api/editions/[id]/ticketing/custom-fields/[customFieldId]/handout-items.put'
import { global } from '../../../globales-nitro'

/**
 * Les articles à remettre associés à un champ personnalisé — constat O3.
 *
 * Ce point d'API n'avait **aucun** test, et versait le corps de la requête tel quel dans
 * `createMany`. Or l'unicité `(customFieldId, handoutItemId, choiceValue)` **ne protège pas** la
 * ligne « tous les choix » : sous MySQL, deux NULL sont distincts dans un index unique. Prouvé
 * en base, dans une transaction annulée ensuite — deux `create` identiques, deux identifiants
 * rendus.
 *
 * ## ⚠️ CE QUI EST MESURÉ ICI
 *
 * Le mock Prisma ignore le `where` et le `select` : ce qui se vérifie est donc ce qui lui est
 * **transmis** — la liste exacte envoyée à `createMany`. C'est aussi la seule prise possible :
 * le mock n'a pas d'index unique, donc aucun doublon n'y lèverait jamais.
 */
const prismaMock = (globalThis as any).prisma

const evenement = {
  context: { params: { id: '22', customFieldId: '42' }, user: { id: 1, pseudo: 'orga' } },
}

const envoyer = (items: unknown) => {
  global.readBody = vi.fn().mockResolvedValue({ items })
  return handler(evenement as any)
}

const lignesCreees = () =>
  prismaMock.ticketingTierCustomFieldHandoutItem.createMany.mock.calls[0]?.[0]?.data

describe('PUT articles à remettre d’un champ personnalisé', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCanManage.mockResolvedValue(true)
    prismaMock.$transaction.mockImplementation(async (fn: any) => fn(prismaMock))
    prismaMock.ticketingTierCustomField.findFirst.mockResolvedValue({ id: 42, editionId: 22 })
    // Tous les articles demandés appartiennent bien à l'édition.
    prismaMock.ticketingHandoutItem.count.mockImplementation(
      async ({ where }: any) => where.id.in.length
    )
    prismaMock.ticketingTierCustomFieldHandoutItem.deleteMany.mockResolvedValue({ count: 0 })
    prismaMock.ticketingTierCustomFieldHandoutItem.createMany.mockResolvedValue({ count: 1 })
  })

  it('⚠️ NE CRÉE QU’UNE LIGNE « tous les choix » pour un article répété', async () => {
    await envoyer([
      { handoutItemId: 7, choiceValue: null },
      { handoutItemId: 7, choiceValue: null },
    ])

    expect(lignesCreees()).toEqual([{ customFieldId: 42, handoutItemId: 7, choiceValue: null }])
  })

  it('⚠️ TRAITE LA CHAÎNE VIDE COMME `null` — elles donnent la MÊME ligne', async () => {
    /*
     * ⚠️⚠️ LE CAS QUI A ATTRAPÉ UN DÉFAUT DE LA CORRECTION ELLE-MÊME. L'écriture normalise
     * (`choiceValue || null`), donc `''` et `null` aboutissent à la même ligne. Une clé de
     * dédoublonnage calculée sur la valeur BRUTE les voyait différentes, laissait passer les
     * deux, et recréait exactement le doublon qu'on cherche à empêcher.
     */
    await envoyer([
      { handoutItemId: 7, choiceValue: '' },
      { handoutItemId: 7, choiceValue: null },
    ])

    expect(lignesCreees()).toEqual([{ customFieldId: 42, handoutItemId: 7, choiceValue: null }])
  })

  it('⚠️ LE TÉMOIN : le même article sur deux réponses différentes est GARDÉ', async () => {
    /*
     * Sans lui, un dédoublonnage sur le seul article satisferait les deux cas précédents — et
     * perdrait une association parfaitement légitime, l'unicité portant sur le TRIPLET.
     */
    await envoyer([
      { handoutItemId: 7, choiceValue: 'S' },
      { handoutItemId: 7, choiceValue: 'M' },
    ])

    expect(lignesCreees()).toEqual([
      { customFieldId: 42, handoutItemId: 7, choiceValue: 'S' },
      { customFieldId: 42, handoutItemId: 7, choiceValue: 'M' },
    ])
  })

  it('remplace l’ensemble des associations du champ', async () => {
    // Le `deleteMany` porte sur le champ entier : c'est lui qui tient réellement l'unicité
    // d'une requête à l'autre, l'index ne la tenant pas sur la ligne globale.
    await envoyer([{ handoutItemId: 7 }])

    expect(
      prismaMock.ticketingTierCustomFieldHandoutItem.deleteMany.mock.calls[0][0].where
    ).toEqual({ customFieldId: 42 })
  })

  it('refuse un article qui n’appartient pas à l’édition', async () => {
    prismaMock.ticketingHandoutItem.count.mockResolvedValue(0)

    await expect(envoyer([{ handoutItemId: 7 }])).rejects.toMatchObject({ statusCode: 400 })
    expect(prismaMock.ticketingTierCustomFieldHandoutItem.createMany).not.toHaveBeenCalled()
  })

  it('refuse qui n’a pas le droit de gérer la billetterie', async () => {
    mockCanManage.mockResolvedValue(false)

    await expect(envoyer([{ handoutItemId: 7 }])).rejects.toMatchObject({ statusCode: 403 })
    expect(prismaMock.ticketingTierCustomFieldHandoutItem.deleteMany).not.toHaveBeenCalled()
  })
})
