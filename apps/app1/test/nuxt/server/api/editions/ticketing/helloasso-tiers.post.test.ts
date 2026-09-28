import { describe, it, expect, beforeEach, vi } from 'vitest'

// `wrapApiHandler` et `validateEditionId` sont des auto-imports Nitro, absents de l'environnement
// de test : on les pose avant que le module du handler ne soit évalué.
vi.hoisted(() => {
  if (!(globalThis as any).wrapApiHandler) {
    ;(globalThis as any).wrapApiHandler = (handler: any) => handler
  }
  if (!(globalThis as any).validateEditionId) {
    ;(globalThis as any).validateEditionId = (event: any) =>
      parseInt(event?.context?.params?.id, 10)
  }
})

vi.mock('#server/utils/auth-utils', () => ({
  requireAuth: vi.fn((event: any) => event.context.user),
}))

const mockCanManage = vi.hoisted(() => vi.fn())
vi.mock('#server/utils/permissions/edition-permissions', () => ({
  canManageTicketingById: mockCanManage,
}))

const mockRecuperer = vi.hoisted(() => vi.fn())
vi.mock('#server/utils/editions/ticketing/helloasso', () => ({
  getHelloAssoTiersAndOptions: mockRecuperer,
}))

vi.mock('#server/utils/encryption', () => ({
  decrypt: vi.fn(() => 'secret-en-clair'),
}))

// La synchronisation exclusive n'est pas l'objet de ces tests : on exécute simplement son contenu.
vi.mock('../../../../../../../../layers/ticketing/server/utils/synchronisation-unique', () => ({
  synchronisationUnique: vi.fn((_cle: string, travail: () => unknown) => travail()),
}))

import handler from '../../../../../../../../layers/ticketing/server/api/editions/[id]/ticketing/helloasso/tiers.post'

const prismaMock = (globalThis as any).prisma

/**
 * La prudence de la synchronisation HelloAsso, appliquée aux OPTIONS.
 *
 * Quelqu'un avait vu le risque et l'avait traité pour les tarifs : une réponse HelloAsso vide
 * n'entraîne aucune suppression, parce que rien ne distingue « ce tarif a disparu » de « HelloAsso
 * ne me l'a pas renvoyé cette fois-ci ». Cent cinquante lignes plus bas, les options n'avaient
 * aucune garde équivalente.
 *
 * Or leur cascade va PLUS LOIN que celle des tarifs : supprimer une option emporte les
 * `TicketingOrderItemOption`, c'est-à-dire le relevé de ce que chaque participant a acheté. Le
 * montant encaissé resterait, mais on ne saurait plus ce qui a été vendu.
 *
 * Ce fichier n'était nommé par AUCUN test — le corriger sans test, c'était corriger à l'aveugle un
 * chemin qui écrit en base pendant une synchronisation.
 */
describe('POST /api/editions/[id]/ticketing/helloasso/tiers — prudence des suppressions', () => {
  const evenement = { context: { params: { id: '42' }, user: { id: 1 } } } as any

  /** Les deux transactions du handler reçoivent le même mock : on observe ce qu'il écrit. */
  const tx = {
    ticketingTier: { findMany: vi.fn(), deleteMany: vi.fn(), upsert: vi.fn() },
    ticketingOption: { findMany: vi.fn(), deleteMany: vi.fn(), upsert: vi.fn() },
    ticketingTierCustomField: { findMany: vi.fn(), deleteMany: vi.fn(), upsert: vi.fn() },
    ticketingTierCustomFieldAssociation: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
      upsert: vi.fn(),
    },
    ticketingTierOption: { findMany: vi.fn(), deleteMany: vi.fn(), create: vi.fn() },
    /** Interrogé pour savoir si un tarif obsolète porte des billets déjà vendus. */
    ticketingOrderItem: { findMany: vi.fn() },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockCanManage.mockResolvedValue(true)
    prismaMock.externalTicketing.findUnique.mockResolvedValue({
      id: 7,
      editionId: 42,
      helloAssoConfig: {
        id: 3,
        clientId: 'client',
        clientSecret: 'chiffre',
        organizationSlug: 'orga',
        formType: 'Event',
        formSlug: 'formulaire',
      },
    })
    prismaMock.$transaction.mockImplementation(async (fn: any) => fn(tx))

    // Un tarif et une option déjà synchronisés, tous deux rattachés à HelloAsso.
    tx.ticketingTier.findMany.mockResolvedValue([
      { id: 11, name: 'Pass week-end', helloAssoTierId: 100 },
    ])
    tx.ticketingOption.findMany.mockResolvedValue([
      { id: 21, name: 'Tee-shirt', helloAssoOptionId: '900' },
    ])
    tx.ticketingTierCustomField.findMany.mockResolvedValue([])
    tx.ticketingTierCustomFieldAssociation.findMany.mockResolvedValue([])
    tx.ticketingTierOption.findMany.mockResolvedValue([])
    // Par défaut, aucun billet vendu : les tarifs obsolètes sont supprimables.
    tx.ticketingOrderItem.findMany.mockResolvedValue([])
    tx.ticketingTier.upsert.mockResolvedValue({ id: 11 })
    tx.ticketingOption.upsert.mockResolvedValue({ id: 21 })
  })

  it('ne supprime AUCUNE option quand HelloAsso n’en renvoie aucune', async () => {
    /*
     * Le test qui motive tout le lot. Une réponse sans options, alors qu'une option est
     * enregistrée, est traitée comme suspecte — exactement comme pour les tarifs.
     */
    mockRecuperer.mockResolvedValue({
      tiers: [{ id: 100, name: 'Pass week-end', customFields: [] }],
      options: [],
    })

    await handler(evenement)

    expect(tx.ticketingOption.deleteMany).not.toHaveBeenCalled()
  })

  it('supprime une option réellement retirée chez HelloAsso', async () => {
    // La contrepartie : sans elle, la garde pourrait tout bloquer et le test précédent passerait
    // encore. On envoie donc une réponse qui contient DES options, mais pas celle-là.
    mockRecuperer.mockResolvedValue({
      tiers: [{ id: 100, name: 'Pass week-end', customFields: [] }],
      options: [{ id: 901, name: 'Gourde', price: 500 }],
    })

    await handler(evenement)

    expect(tx.ticketingOption.deleteMany).toHaveBeenCalledWith({ where: { id: { in: [21] } } })
  })

  it('conserve un tarif retiré chez HelloAsso mais qui porte des billets vendus', async () => {
    /*
     * Constat D4. `TicketingOrderItem.tierId` est en `ON DELETE SET NULL` : supprimer le tarif ne
     * supprimerait pas ses billets, il les DÉTACHERAIT — et un billet détaché perd ses quotas, ses
     * repas, ses articles à remettre et son `countAsParticipant`. Douze billets de la base portent
     * déjà cette trace.
     *
     * La divergence avec HelloAsso est le prix assumé : un tarif en trop se voit, un billet vidé de
     * son sens ne se remarque pas.
     */
    mockRecuperer.mockResolvedValue({
      tiers: [{ id: 999, name: 'Nouveau tarif', customFields: [] }],
      options: [{ id: 900, name: 'Tee-shirt' }],
    })
    // Le tarif 11 n'est plus renvoyé par HelloAsso, mais un billet l'utilise.
    tx.ticketingOrderItem.findMany.mockResolvedValue([{ tierId: 11 }])

    await handler(evenement)

    expect(tx.ticketingTier.deleteMany).not.toHaveBeenCalled()
  })

  it('supprime bien un tarif obsolète que personne n’a acheté', async () => {
    // La contrepartie : sans elle, la garde pourrait tout bloquer et le test précédent passerait
    // encore. Le nettoyage doit continuer de fonctionner.
    mockRecuperer.mockResolvedValue({
      tiers: [{ id: 999, name: 'Nouveau tarif', customFields: [] }],
      options: [{ id: 900, name: 'Tee-shirt' }],
    })
    tx.ticketingOrderItem.findMany.mockResolvedValue([])

    await handler(evenement)

    expect(tx.ticketingTier.deleteMany).toHaveBeenCalledWith({ where: { id: { in: [11] } } })
  })

  it('ne supprime aucun tarif quand HelloAsso n’en renvoie aucun', async () => {
    // La garde d'origine, qu'on ne veut pas casser en généralisant la fonction.
    mockRecuperer.mockResolvedValue({ tiers: [], options: [{ id: 900, name: 'Tee-shirt' }] })

    await handler(evenement)

    expect(tx.ticketingTier.deleteMany).not.toHaveBeenCalled()
  })

  it('laisse intacte une option créée à la main', async () => {
    // Sans identifiant HelloAsso, elle n'a jamais été synchronisée : elle n'appartient pas à cette
    // comparaison, et une réponse complète ne doit pas l'emporter.
    tx.ticketingOption.findMany.mockResolvedValue([
      { id: 22, name: 'Option maison', helloAssoOptionId: null },
    ])
    mockRecuperer.mockResolvedValue({
      tiers: [{ id: 100, name: 'Pass week-end', customFields: [] }],
      options: [{ id: 901, name: 'Gourde', price: 500 }],
    })

    await handler(evenement)

    expect(tx.ticketingOption.deleteMany).not.toHaveBeenCalled()
  })
})
