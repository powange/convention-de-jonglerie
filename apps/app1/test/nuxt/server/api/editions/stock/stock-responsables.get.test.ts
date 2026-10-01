import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetEditionWithPermissions = vi.hoisted(() => vi.fn())
const mockCanManageStock = vi.hoisted(() => vi.fn())
const mockRateLimiter = vi.hoisted(() => vi.fn())

vi.mock('#server/utils/permissions/edition-permissions', () => ({
  getEditionWithPermissions: mockGetEditionWithPermissions,
  canManageStock: mockCanManageStock,
}))

vi.mock('#server/utils/api-rate-limiter', () => ({
  personSearchRateLimiter: mockRateLimiter,
}))

vi.mock('#server/utils/auth-utils', () => ({
  requireAuth: vi.fn((event) => event.context.user),
}))

import handler from '../../../../../../../../layers/stock/server/api/editions/[id]/stock-responsables.get'

const prismaMock = (globalThis as any).prisma

const mockUser = { id: 1, email: 'u@t.com', pseudo: 'u' }
const mockEdition = {
  id: 1,
  conventionId: 10,
  convention: { id: 10, authorId: 200, organizers: [] },
  organizerPermissions: [],
}

const evenement = (pseudo = 'jo') => ({
  context: { params: { id: '1' }, user: mockUser },
  node: { req: { url: `/api/editions/1/stock-responsables?pseudo=${pseudo}` } },
})

/**
 * Ce point d'API rend des personnes. Il est donc gardé de deux façons : par un périmètre — les
 * gens de l'édition, et eux seuls — et par un débit, pour qu'un balayage méthodique ne
 * reconstitue pas cet annuaire à petites doses.
 */
describe('GET /api/editions/[id]/stock-responsables', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetEditionWithPermissions.mockResolvedValue(mockEdition)
    mockCanManageStock.mockReturnValue(true)
    mockRateLimiter.mockResolvedValue(undefined)
    prismaMock.user.findMany.mockReset()
    prismaMock.user.findMany.mockResolvedValue([{ id: 4, pseudo: 'jonglerie' }])
    // `globalThis as any`, comme les tests voisins : `getQuery` est injecté par H3 et n'existe
    // pas sur le type global.
    ;(globalThis as any).getQuery = vi.fn(() => ({ pseudo: 'jo' }))
  })

  it('rend les personnes trouvées', async () => {
    const resultat = await handler(evenement() as any)

    expect(resultat.success).toBe(true)
    expect(resultat.data.users).toHaveLength(1)
  })

  it('limite le débit, et avant toute requête à la base', async () => {
    // Un balayage n'a pas à consommer une requête de base pour se faire refouler. L'ordre compte
    // donc autant que la présence du garde-fou.
    // Le limiteur lève un 429, comme le fait le vrai : une `Error` nue serait convertie en 500
    // par le gestionnaire, et le test ne dirait plus rien du code rendu.
    mockRateLimiter.mockRejectedValue(
      createError({
        status: 429,
        message: 'Trop de recherches, veuillez réessayer dans une minute',
      })
    )

    await expect(handler(evenement() as any)).rejects.toMatchObject({ statusCode: 429 })
    expect(prismaMock.user.findMany).not.toHaveBeenCalled()
  })

  it('appelle le limiteur à chaque recherche', async () => {
    await handler(evenement() as any)

    expect(mockRateLimiter).toHaveBeenCalledTimes(1)
  })

  it('refuse qui ne gère pas le stock', async () => {
    mockCanManageStock.mockReturnValue(false)

    await expect(handler(evenement() as any)).rejects.toMatchObject({ statusCode: 403 })
  })

  it("ne cherche que parmi les gens de l'édition", async () => {
    // Le périmètre est la moitié de la protection : sans lui, le limiteur ne ferait que ralentir
    // le parcours de l'annuaire des comptes.
    await handler(evenement() as any)

    const appel = prismaMock.user.findMany.mock.calls[0][0]
    expect(appel.where.OR).toContainEqual({ organizations: { some: { conventionId: 10 } } })
    expect(appel.where.OR).toContainEqual({
      volunteerApplications: { some: { eventId: 1, status: 'ACCEPTED' } },
    })
  })

  it('🔬 cherche sur le PSEUDO, le PRÉNOM et le NOM', async () => {
    /*
     * ⚠️ ELLE NE REGARDAIT QUE LE PSEUDO, et il fallait donc le connaître — alors qu'on cherche
     * quelqu'un par son nom. C'était la demande de l'utilisateur.
     *
     * On mesure la FORME de la requête, et c'est la seule assertion qui compte ici : le mock de
     * Prisma ignore le `where`, donc compter les personnes rendues resterait vert avec un filtre
     * revenu au seul pseudo.
     */
    ;(globalThis as any).getQuery = vi.fn(() => ({ q: 'dupont' }))

    await handler(evenement() as any)

    const where = prismaMock.user.findMany.mock.calls[0][0].where
    expect(where.AND).toEqual([
      {
        OR: [
          { pseudo: { contains: 'dupont' } },
          { prenom: { contains: 'dupont' } },
          { nom: { contains: 'dupont' } },
        ],
      },
    ])
    // Et plus de filtre `pseudo` à la racine : il écraserait le groupe ci-dessus.
    expect(where.pseudo).toBeUndefined()
  })

  it('🔬 accepte « Nom prénom » comme « prénom nom »', async () => {
    /*
     * L'assertion qui porte la demande. Un groupe par mot, tous exigés : l'ordre n'a aucune
     * importance puisque chaque groupe accepte les trois champs. Chercher la saisie ENTIÈRE dans
     * chaque champ échouerait sur les deux formes — aucun champ ne contient « Jean Dupont ».
     */
    const formeDe = async (saisie: string) => {
      prismaMock.user.findMany.mockClear()
      ;(globalThis as any).getQuery = vi.fn(() => ({ q: saisie }))
      await handler(evenement() as any)
      return prismaMock.user.findMany.mock.calls[0][0].where.AND
    }

    const prenomNom = await formeDe('Jean Dupont')
    const nomPrenom = await formeDe('Dupont Jean')

    expect(prenomNom).toHaveLength(2)
    expect(prenomNom).toEqual(expect.arrayContaining(nomPrenom))
    expect(nomPrenom).toEqual(expect.arrayContaining(prenomNom))
  })

  it('🔬 propose aussi les ARTISTES de l’édition', async () => {
    /*
     * Ajoutés à la demande : ils font l'édition autant que les autres, et c'est souvent à eux
     * qu'on confie leur propre matériel. Le périmètre est partagé avec la garde d'écriture
     * (`assertResponsablesDeLEdition`) : sans cet ajout, un artiste trouvé ici serait refusé à
     * l'enregistrement.
     */
    await handler(evenement() as any)

    const where = prismaMock.user.findMany.mock.calls[0][0].where
    expect(where.OR).toContainEqual({ artistProfiles: { some: { editionId: 1 } } })
  })

  it('accepte encore l’ancien paramètre `pseudo`', async () => {
    /*
     * ⚠️ Un contrat d'API qu'on durcit casse les clients déjà ouverts : une page restée dans un
     * onglet continue d'envoyer `pseudo`, et ce dépôt a déjà payé ce cas deux fois. Les deux formes
     * sont donc acceptées, et elles doivent produire la MÊME requête.
     */
    ;(globalThis as any).getQuery = vi.fn(() => ({ pseudo: 'dupont' }))

    await handler(evenement() as any)

    const where = prismaMock.user.findMany.mock.calls[0][0].where
    expect(where.AND[0].OR[0]).toEqual({ pseudo: { contains: 'dupont' } })
  })

  it('refuse une recherche sans terme', async () => {
    // Sans mot, le `AND` serait vide et la liste rendrait toutes les personnes de l'édition d'un
    // coup — ce que le périmètre borne, mais que la saisie ne doit pas pouvoir déclencher.
    ;(globalThis as any).getQuery = vi.fn(() => ({}))

    await expect(handler(evenement() as any)).rejects.toThrow()
    expect(prismaMock.user.findMany).not.toHaveBeenCalled()
  })

  it("ne rend pas l'adresse e-mail", async () => {
    // Gérer un stock ne donne pas droit aux adresses des bénévoles : le pseudo et l'état civil
    // suffisent à reconnaître quelqu'un de son équipe.
    await handler(evenement() as any)

    const appel = prismaMock.user.findMany.mock.calls[0][0]
    expect(appel.select.email).toBeUndefined()
    expect(appel.select.pseudo).toBe(true)
  })
})
