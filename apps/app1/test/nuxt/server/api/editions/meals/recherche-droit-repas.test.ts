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

const listMealSelections = vi.fn(async () => [])

vi.mock('../../../../../../server/meals/ports/registry', () => ({
  useMealsPorts: vi.fn(() => ({
    artists: { listMealSelections },
    ticketing: { listMealTicketParticipants: vi.fn(async () => []) },
  })),
}))

import rechercher from '../../../../../../../../layers/meals/server/api/editions/[id]/meals/[mealId]/search.get'
import { global } from '../../../../globales-nitro'

const prismaMock = (globalThis as any).prisma

const evenement = { context: { params: { id: '21', mealId: '7' }, user: { id: 1 } } }

/**
 * Une personne qui ne prend pas ce repas ne doit pas ressortir de la recherche.
 *
 * Le défaut signalé : une artiste n'ayant que le vendredi soir apparaissait sur le samedi midi, et
 * on pouvait lui valider le repas. Les sélections portent `accepted`, et il était ignoré pour les
 * bénévoles comme pour les artistes — alors que les ORGANISATEURS y étaient déjà filtrés dans ce
 * même fichier.
 *
 * ⚠️ L'assertion porte sur la REQUÊTE, pas sur le résultat : un mock rend ce qu'on lui dit, quelle
 * que soit la condition. Vérifier la réponse resterait vert avec le filtre retiré — c'est
 * exactement ainsi que le défaut a survécu.
 */
describe('recherche de repas : qui y a droit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.getQuery = vi.fn(() => ({ q: 'juliette' }))
    prismaMock.volunteerMeal.findFirst.mockResolvedValue({ id: 7, editionId: 21 })
    prismaMock.volunteerMealSelection.findMany.mockResolvedValue([])
    prismaMock.editionOrganizer.findMany.mockResolvedValue([])
  })

  it('ne DEMANDE que les sélections acceptées des bénévoles', async () => {
    await rechercher(evenement as any)

    const requete = prismaMock.volunteerMealSelection.findMany.mock.calls[0][0]
    expect(requete.where).toMatchObject({ mealId: 7, accepted: true })
  })

  it('laisse le port artistes filtrer de son côté', async () => {
    // Le port est la seule voie vers les sélections d'artistes : c'est lui qui répond du filtre,
    // et son propre test le vérifie. Ici on s'assure seulement qu'il est bien interrogé.
    await rechercher(evenement as any)

    expect(listMealSelections).toHaveBeenCalledWith(21, 7)
  })

  it('écarte toujours les organisateurs ayant refusé', async () => {
    // Ce filtre-là existait déjà : le correctif ne devait pas l'emporter au passage.
    await rechercher(evenement as any)

    const requete = prismaMock.editionOrganizer.findMany.mock.calls[0][0]
    expect(requete.where.NOT).toEqual({ mealSelections: { some: { mealId: 7, accepted: false } } })
  })
})
