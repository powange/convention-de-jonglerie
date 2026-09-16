import { describe, it, expect, vi, beforeEach } from 'vitest'

// wrapApiHandler, validateEditionId et validateResourceId sont auto-importés (Nitro).
vi.hoisted(() => {
  if (!(globalThis as any).wrapApiHandler) {
    ;(globalThis as any).wrapApiHandler = (handler: any) => handler
  }
  if (!(globalThis as any).validateEditionId) {
    ;(globalThis as any).validateEditionId = (event: any) =>
      parseInt(event?.context?.params?.id, 10)
  }
  if (!(globalThis as any).validateResourceId) {
    ;(globalThis as any).validateResourceId = (event: any, name: string) =>
      parseInt(event?.context?.params?.[name], 10)
  }
})

vi.mock('../../../../../../server/utils/auth-utils', () => ({
  requireAuth: vi.fn(() => ({ id: 1 })),
}))

vi.mock('../../../../../../server/utils/permissions/edition-permissions', () => ({
  canManageMealsOrValidation: vi.fn(async () => true),
}))

const listMealSelections = vi.fn()

vi.mock('../../../../../../server/meals/ports/registry', () => ({
  useMealsPorts: vi.fn(() => ({
    artists: { listMealSelections },
    ticketing: { listMealTicketParticipants: vi.fn(async () => []) },
  })),
}))

import statistiques from '../../../../../../../../layers/meals/server/api/editions/[id]/meals/[mealId]/stats.get'

const prismaMock = (globalThis as any).prisma

const evenement = { context: { params: { id: '21', mealId: '7' }, user: { id: 1 } } }

const selection = (afterShow: boolean, consumedAt: Date | null) => ({
  selectionId: Math.random(),
  userId: 1,
  nom: null,
  prenom: null,
  pseudo: 'x',
  email: 'x@x.fr',
  phone: null,
  afterShow,
  consumedAt,
})

/**
 * Les assiettes qu'il reste à mettre de côté.
 *
 * Un artiste peut demander à manger APRÈS son spectacle : sa part est réservée plutôt que servie
 * au coup de feu. La cuisine a besoin de ce nombre — mais de celui qui RESTE, pas du total : une
 * part déjà servie n'est plus à garder, et la compter ferait réserver des assiettes pour des gens
 * déjà passés.
 */
describe('statistiques d’un repas : assiettes mises de côté', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.volunteerMeal.findFirst.mockResolvedValue({ id: 7, editionId: 21 })
    prismaMock.volunteerMealSelection.count.mockResolvedValue(0)
    prismaMock.editionOrganizer.count.mockResolvedValue(0)
    prismaMock.organizerMealSelection.count.mockResolvedValue(0)
  })

  const compter = async () => {
    const reponse: any = await statistiques(evenement as any)
    return reponse.data.stats.breakdown.artists
  }

  it('compte les parts à garder', async () => {
    listMealSelections.mockResolvedValue([selection(true, null), selection(true, null)])

    expect((await compter()).afterShow).toBe(2)
  })

  it('DÉCOMPTE une part déjà servie', async () => {
    // Le correctif : cet artiste avait demandé à manger après, mais il est déjà passé. Son
    // assiette n'est plus à garder.
    listMealSelections.mockResolvedValue([
      selection(true, null),
      selection(true, new Date('2026-09-26T22:00:00Z')),
    ])

    expect((await compter()).afterShow).toBe(1)
  })

  it('ignore les artistes qui mangent au service normal', async () => {
    listMealSelections.mockResolvedValue([selection(false, null), selection(false, new Date())])

    expect((await compter()).afterShow).toBe(0)
  })

  it('n’altère pas les autres compteurs', async () => {
    // Le décompte des assiettes ne doit toucher ni le total ni les validés : ce sont trois
    // mesures distinctes de la même population.
    listMealSelections.mockResolvedValue([
      selection(true, null),
      selection(true, new Date()),
      selection(false, new Date()),
    ])

    expect(await compter()).toMatchObject({ total: 3, validated: 2, afterShow: 1 })
  })
})
