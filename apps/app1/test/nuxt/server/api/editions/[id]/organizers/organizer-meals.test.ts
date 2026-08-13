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

vi.mock('../../../../../../../server/utils/auth-utils', () => ({
  requireAuth: vi.fn(() => ({ id: 1 })),
}))

vi.mock('../../../../../../../server/utils/permissions/edition-permissions', () => ({
  canManageMealsById: vi.fn(),
}))

import { canManageMealsById } from '../../../../../../../server/utils/permissions/edition-permissions'
import getHandler from '../../../../../../../server/api/editions/[id]/organizers/edition-organizers/[editionOrganizerId]/meals.get'
import putHandler from '../../../../../../../server/api/editions/[id]/organizers/edition-organizers/[editionOrganizerId]/meals.put'

const prismaMock = (globalThis as any).prisma
const mockCanManageMeals = canManageMealsById as ReturnType<typeof vi.fn>

const mockEvent = { context: { params: { id: '17', editionOrganizerId: '5' } } }

const dbMeals = [
  { id: 1, date: new Date('2026-08-01'), mealType: 'LUNCH', phases: ['EVENT'] },
  { id: 2, date: new Date('2026-08-01'), mealType: 'DINNER', phases: ['EVENT'] },
]

describe('repas par organisateur', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCanManageMeals.mockResolvedValue(true)

    prismaMock.editionOrganizer.findFirst.mockReset()
    prismaMock.editionOrganizer.findFirst.mockResolvedValue({
      id: 5,
      dietaryPreference: 'NONE',
      allergies: null,
      allergySeverity: null,
    })
    prismaMock.editionOrganizer.findUnique.mockReset()
    prismaMock.editionOrganizer.findUnique.mockResolvedValue({
      dietaryPreference: 'VEGAN',
      allergies: null,
      allergySeverity: null,
    })
    prismaMock.editionOrganizer.update.mockReset()
    prismaMock.editionOrganizer.update.mockResolvedValue({})

    prismaMock.volunteerMeal.findMany.mockReset()
    prismaMock.volunteerMeal.findMany.mockResolvedValue(dbMeals)

    prismaMock.organizerMealSelection.findMany.mockReset()
    prismaMock.organizerMealSelection.findMany.mockResolvedValue([])
    prismaMock.organizerMealSelection.upsert.mockReset()
    prismaMock.organizerMealSelection.upsert.mockResolvedValue({})
    prismaMock.organizerMealSelection.deleteMany.mockReset()
    prismaMock.organizerMealSelection.deleteMany.mockResolvedValue({ count: 1 })
    prismaMock.organizerMealSelection.updateMany.mockReset()
    prismaMock.organizerMealSelection.updateMany.mockResolvedValue({ count: 0 })
  })

  describe('GET', () => {
    it('accepte tous les repas par défaut quand aucune ligne n’existe', async () => {
      const response: any = await getHandler(mockEvent as any)

      expect(response.data.meals).toHaveLength(2)
      expect(response.data.meals.every((m: any) => m.accepted)).toBe(true)
      expect(response.data.meals.every((m: any) => m.consumedAt === null)).toBe(true)
    })

    it('reflète les exceptions et les consommations enregistrées', async () => {
      const consumedAt = new Date('2026-08-01T12:30:00Z')
      prismaMock.organizerMealSelection.findMany.mockResolvedValue([
        { mealId: 1, accepted: false, consumedAt: null },
        { mealId: 2, accepted: true, consumedAt },
      ])

      const response: any = await getHandler(mockEvent as any)

      expect(response.data.meals[0]).toMatchObject({ id: 1, accepted: false, consumedAt: null })
      expect(response.data.meals[1]).toMatchObject({ id: 2, accepted: true, consumedAt })
    })

    it('rejette (403) sans le droit de gestion des repas', async () => {
      mockCanManageMeals.mockResolvedValue(false)

      await expect(getHandler(mockEvent as any)).rejects.toMatchObject({ status: 403 })
    })

    it("rejette (404) si l'organisateur n'est pas présent sur l'édition", async () => {
      prismaMock.editionOrganizer.findFirst.mockResolvedValue(null)

      await expect(getHandler(mockEvent as any)).rejects.toMatchObject({ status: 404 })
    })
  })

  describe('PUT', () => {
    it('enregistre une exception pour un repas décoché', async () => {
      ;(globalThis as any).readBody = vi.fn().mockResolvedValue({
        selections: [{ mealId: 1, accepted: false }],
      })

      await putHandler(mockEvent as any)

      expect(prismaMock.organizerMealSelection.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: { editionOrganizerId: 5, mealId: 1, accepted: false },
          update: { accepted: false },
        })
      )
    })

    it('supprime la ligne quand le repas est recoché (retour au comportement par défaut)', async () => {
      ;(globalThis as any).readBody = vi.fn().mockResolvedValue({
        selections: [{ mealId: 1, accepted: true }],
      })

      await putHandler(mockEvent as any)

      expect(prismaMock.organizerMealSelection.deleteMany).toHaveBeenCalledWith({
        where: { editionOrganizerId: 5, mealId: 1, consumedAt: null },
      })
      expect(prismaMock.organizerMealSelection.updateMany).not.toHaveBeenCalled()
    })

    it('conserve la ligne portant une consommation et se contente de la ré-accepter', async () => {
      prismaMock.organizerMealSelection.deleteMany.mockResolvedValue({ count: 0 })
      ;(globalThis as any).readBody = vi.fn().mockResolvedValue({
        selections: [{ mealId: 1, accepted: true }],
      })

      await putHandler(mockEvent as any)

      expect(prismaMock.organizerMealSelection.updateMany).toHaveBeenCalledWith({
        where: { editionOrganizerId: 5, mealId: 1 },
        data: { accepted: true },
      })
    })

    it('ignore un repas qui n’appartient pas à l’édition', async () => {
      ;(globalThis as any).readBody = vi.fn().mockResolvedValue({
        selections: [{ mealId: 999, accepted: false }],
      })

      await putHandler(mockEvent as any)

      expect(prismaMock.organizerMealSelection.upsert).not.toHaveBeenCalled()
    })

    it('met à jour le régime alimentaire', async () => {
      ;(globalThis as any).readBody = vi.fn().mockResolvedValue({
        dietaryPreference: 'VEGAN',
        allergies: 'Arachides',
        allergySeverity: 'SEVERE',
      })

      const response: any = await putHandler(mockEvent as any)

      expect(prismaMock.editionOrganizer.update).toHaveBeenCalledWith({
        where: { id: 5 },
        data: {
          dietaryPreference: 'VEGAN',
          allergies: 'Arachides',
          allergySeverity: 'SEVERE',
        },
      })
      expect(response.data.dietaryPreference).toBe('VEGAN')
    })
  })
})
