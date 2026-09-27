import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.hoisted(() => {
  if (!(globalThis as any).wrapApiHandler) {
    ;(globalThis as any).wrapApiHandler = (handler: any) => handler
  }
  if (!(globalThis as any).validateEditionId) {
    ;(globalThis as any).validateEditionId = (event: any) =>
      parseInt(event?.context?.params?.id, 10)
  }
})

const mockCanAccess = vi.hoisted(() => vi.fn())
vi.mock('#server/utils/permissions/edition-permissions', () => ({
  canAccessEditionDataOrAccessControl: mockCanAccess,
}))

vi.mock('#server/utils/auth-utils', () => ({
  requireAuth: vi.fn((event) => event.context.user),
}))

import handler from '../../../../../../server/api/editions/[id]/ticketing/stats.get'

const prismaMock = (globalThis as any).prisma

/**
 * Les compteurs du contrôle d'accès.
 *
 * La tuile « Participants » comptait des LIGNES DE COMMANDE : une personne venue avec un billet
 * vendredi et un billet samedi y comptait deux fois, au numérateur comme au dénominateur. Le point
 * d'API rend désormais les deux lectures — par billet et par personne — pour que l'écran bascule
 * d'un clic, sans nouvelle requête.
 */
describe('GET /api/editions/[id]/ticketing/stats', () => {
  const evenement = { context: { params: { id: '42' }, user: { id: 1 } } } as any

  /** Deux billets au même nom, un seul validé, plus une autre personne non validée. */
  const billets = [
    {
      firstName: 'Alice',
      lastName: 'Martin',
      entryValidated: true,
      entryValidatedAt: new Date(),
    },
    { firstName: 'alice', lastName: 'MARTIN', entryValidated: false, entryValidatedAt: null },
    { firstName: 'Bob', lastName: 'Durand', entryValidated: false, entryValidatedAt: null },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    mockCanAccess.mockResolvedValue(true)
    prismaMock.ticketingOrderItem.findMany.mockResolvedValue(billets)
    // Aucune autre population : on isole la part des billets.
    prismaMock.editionVolunteerApplication.count.mockResolvedValue(0)
    prismaMock.editionArtist.count.mockResolvedValue(0)
    prismaMock.editionOrganizer.count.mockResolvedValue(0)
  })

  it('rend les deux lectures : trois billets, deux personnes', async () => {
    const reponse = (await handler(evenement)) as any
    const stats = reponse.data.stats

    expect(stats.totalTickets).toBe(3)
    expect(stats.ticketsValidated).toBe(1)
    // Alice a deux billets : une seule personne, comptée entrée car un billet est validé.
    expect(stats.totalPersonnes).toBe(2)
    expect(stats.personnesValidated).toBe(1)
  })

  it('ne lit les billets qu’une fois, pour que les deux comptes ne se contredisent pas', async () => {
    /*
     * Trois `count()` tenaient ce rôle avant. Les deux lectures tirées de requêtes séparées
     * pourraient se contredire à l'écran parce qu'une validation est tombée entre les deux — un
     * total regroupé supérieur au total par billet se lirait comme un bug.
     */
    await handler(evenement)

    expect(prismaMock.ticketingOrderItem.findMany).toHaveBeenCalledTimes(1)
    expect(prismaMock.ticketingOrderItem.count).not.toHaveBeenCalled()
  })

  it('demande les champs d’identité nécessaires au regroupement', async () => {
    // Sans `firstName`/`lastName` dans le `select`, le regroupement serait muet : toutes les clés
    // vaudraient `null` et chaque billet compterait pour une personne — un chiffre faux, sans erreur.
    await handler(evenement)

    expect(prismaMock.ticketingOrderItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          firstName: true,
          lastName: true,
          entryValidated: true,
          entryValidatedAt: true,
        }),
      })
    )
  })
})
