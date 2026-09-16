import { describe, expect, it, beforeEach, vi } from 'vitest'

import { getQuotaStats } from '../../../../server/utils/editions/ticketing/quota-stats'

const prismaMock = (globalThis as any).prisma

/**
 * Le rapprochement d'un quota posé sur un CHAMP PERSONNALISÉ.
 *
 * Il se faisait par comparaison de libellés contre l'instantané JSON figé à l'achat : renommer un
 * champ — ne serait-ce que pour corriger une faute — détachait d'un coup tous les billets
 * antérieurs, et la jauge baissait sans explication.
 *
 * L'instantané porte pourtant de quoi identifier le champ, et de DEUX façons distinctes qu'il ne
 * faut surtout pas confondre :
 *
 * - un billet importé porte `id`, qui est l'identifiant du champ CHEZ LE FOURNISSEUR
 *   (`helloAssoCustomFieldId`) ;
 * - un billet saisi ici porte `customFieldId`, l'identifiant INTERNE du champ.
 *
 * Deux espaces d'identifiants sans rapport : les rapprocher l'un de l'autre ferait correspondre
 * n'importe quoi. Le libellé ne sert plus que de repli, pour les billets déjà en base qui ne
 * portent ni l'un ni l'autre.
 */
describe('quotas — les champs personnalisés', () => {
  const quotaDeBase = {
    id: 1,
    title: 'Repas végétarien',
    description: null,
    quantity: 100,
    position: 0,
    tiers: [],
    options: [],
    customFields: [],
    organizers: [],
    volunteers: [],
    artists: [],
  }

  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.ticketingOrderItem.findMany.mockResolvedValue([])
    prismaMock.ticketingOrderItemOption.findMany.mockResolvedValue([])
    prismaMock.editionOrganizer.findMany.mockResolvedValue([])
    prismaMock.editionVolunteerApplication.findMany.mockResolvedValue([])
    prismaMock.editionArtist.findMany.mockResolvedValue([])
  })

  /** Le champ tel que le quota le vise : identifiant interne, identifiant fournisseur, libellé. */
  const champ = (choiceValue: string | null = null) => ({
    customField: { id: 12, label: 'Régime alimentaire', helloAssoCustomFieldId: 6402086 },
    choiceValue,
  })

  const statsAvecBillet = async (instantane: unknown[], choiceValue: string | null = null) => {
    prismaMock.ticketingQuota.findMany.mockResolvedValue([
      { ...quotaDeBase, customFields: [champ(choiceValue)] },
    ])
    prismaMock.ticketingOrderItem.findMany.mockResolvedValue([
      { id: 7, customFields: instantane, entryValidated: false },
    ])
    const [stats] = await getQuotaStats(22)
    return stats!
  }

  it('reconnaît un billet saisi ici par son identifiant interne, malgré un renommage', async () => {
    // Le libellé de l'instantané est l'ANCIEN : c'est tout l'enjeu.
    const stats = await statsAvecBillet([
      { customFieldId: 12, name: 'Régime alimentare', answer: 'Végétarien' },
    ])

    expect(stats.currentCount).toBe(1)
  })

  it('reconnaît un billet importé par l’identifiant du fournisseur, malgré un renommage', async () => {
    const stats = await statsAvecBillet([
      { id: 6402086, name: 'Ancien libellé', answer: 'Végétarien' },
    ])

    expect(stats.currentCount).toBe(1)
  })

  it('retombe sur le libellé quand l’instantané ne porte aucun identifiant', async () => {
    // Les billets déjà en base avant la correction : c'est tout ce qu'on a pour eux.
    const stats = await statsAvecBillet([{ name: 'Régime alimentaire', answer: 'Végétarien' }])

    expect(stats.currentCount).toBe(1)
  })

  /**
   * Le test qui protège du pire : les deux identifiants vivent dans des espaces SANS rapport.
   * Confondre l'un avec l'autre ferait correspondre des champs étrangers.
   */
  it('ne confond pas l’identifiant interne avec celui du fournisseur', async () => {
    // 6402086 est l'identifiant FOURNISSEUR du champ visé ; ici il est posé comme identifiant
    // interne, ce qui désigne un tout autre champ.
    const stats = await statsAvecBillet([
      { customFieldId: 6402086, name: 'Sans rapport', answer: 'Végétarien' },
    ])

    expect(stats.currentCount).toBe(0)
  })

  it('ignore un champ que le quota ne vise pas', async () => {
    const stats = await statsAvecBillet([
      { customFieldId: 99, name: 'Taille de t-shirt', answer: 'L' },
    ])

    expect(stats.currentCount).toBe(0)
  })

  it('respecte le choix visé quand le quota en désigne un', async () => {
    const vegetarien = await statsAvecBillet(
      [{ customFieldId: 12, name: 'Régime alimentaire', answer: 'Végétarien' }],
      'Végétarien'
    )
    expect(vegetarien.currentCount).toBe(1)

    const omnivore = await statsAvecBillet(
      [{ customFieldId: 12, name: 'Régime alimentaire', answer: 'Omnivore' }],
      'Végétarien'
    )
    expect(omnivore.currentCount).toBe(0)
  })

  it('compte toute réponse non vide quand le quota ne vise aucun choix', async () => {
    const repondu = await statsAvecBillet([
      { customFieldId: 12, name: 'Régime alimentaire', answer: 'Peu importe' },
    ])
    expect(repondu.currentCount).toBe(1)

    const sansReponse = await statsAvecBillet([
      { customFieldId: 12, name: 'Régime alimentaire', answer: '' },
    ])
    expect(sansReponse.currentCount).toBe(0)
  })
})
