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

  it("ne rend pas l'adresse e-mail", async () => {
    // Gérer un stock ne donne pas droit aux adresses des bénévoles : le pseudo et l'état civil
    // suffisent à reconnaître quelqu'un de son équipe.
    await handler(evenement() as any)

    const appel = prismaMock.user.findMany.mock.calls[0][0]
    expect(appel.select.email).toBeUndefined()
    expect(appel.select.pseudo).toBe(true)
  })
})
