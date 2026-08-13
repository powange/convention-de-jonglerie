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

vi.mock('../../../../../../server/meals/ports/registry', () => ({
  useMealsPorts: vi.fn(() => ({ artists: {}, ticketing: {} })),
}))

import { canManageMealsOrValidation } from '../../../../../../server/utils/permissions/edition-permissions'
import validateHandler from '../../../../../../../../layers/meals/server/api/editions/[id]/meals/[mealId]/validate.post'
import cancelHandler from '../../../../../../../../layers/meals/server/api/editions/[id]/meals/[mealId]/cancel.post'

const prismaMock = (globalThis as any).prisma
const mockCanValidate = canManageMealsOrValidation as ReturnType<typeof vi.fn>

const mockEvent = { context: { params: { id: '17', mealId: '3' } } }

/**
 * Validation d'un repas pour un organisateur : contrairement aux bénévoles et aux artistes,
 * aucune ligne n'existe tant que personne n'a rien décoché ni consommé. L'id transmis est
 * celui de l'EditionOrganizer et la ligne est créée à la volée.
 */
describe('POST /api/editions/[id]/meals/[mealId]/validate — type organizer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCanValidate.mockResolvedValue(true)
    ;(globalThis as any).readBody = vi.fn().mockResolvedValue({ type: 'organizer', id: 5 })

    prismaMock.volunteerMeal.findFirst.mockReset()
    prismaMock.volunteerMeal.findFirst.mockResolvedValue({ id: 3, editionId: 17 })
    prismaMock.editionOrganizer.findFirst.mockReset()
    prismaMock.editionOrganizer.findFirst.mockResolvedValue({ id: 5 })

    prismaMock.organizerMealSelection.updateMany.mockReset()
    prismaMock.organizerMealSelection.create.mockReset()
    prismaMock.organizerMealSelection.findUnique.mockReset()
  })

  it('crée la ligne de consommation quand aucune n’existe (cas nominal)', async () => {
    prismaMock.organizerMealSelection.updateMany.mockResolvedValue({ count: 0 })
    prismaMock.organizerMealSelection.create.mockResolvedValue({})

    const response: any = await validateHandler(mockEvent as any)

    expect(prismaMock.organizerMealSelection.create).toHaveBeenCalledWith({
      data: { editionOrganizerId: 5, mealId: 3, consumedAt: expect.any(Date) },
    })
    expect(response.data.consumedAt).toBeInstanceOf(Date)
  })

  it('met à jour la ligne existante sans la recréer', async () => {
    prismaMock.organizerMealSelection.updateMany.mockResolvedValue({ count: 1 })

    await validateHandler(mockEvent as any)

    expect(prismaMock.organizerMealSelection.updateMany).toHaveBeenCalledWith({
      where: { editionOrganizerId: 5, mealId: 3, accepted: true, consumedAt: null },
      data: { consumedAt: expect.any(Date) },
    })
    expect(prismaMock.organizerMealSelection.create).not.toHaveBeenCalled()
  })

  // Course : la ligne est apparue entre le updateMany et le create (ou elle existait déjà avec
  // consumedAt renseigné). Le P2002 doit être rattrapé et traduit selon `accepted`.
  it('rejette (400) si le repas a déjà été validé', async () => {
    prismaMock.organizerMealSelection.updateMany.mockResolvedValue({ count: 0 })
    prismaMock.organizerMealSelection.create.mockRejectedValue({ code: 'P2002' })
    prismaMock.organizerMealSelection.findUnique.mockResolvedValue({ accepted: true })

    await expect(validateHandler(mockEvent as any)).rejects.toMatchObject({
      status: 400,
      message: 'Ce repas a déjà été validé',
    })
  })

  it('rejette (403) si le repas a été décoché pour cet organisateur', async () => {
    prismaMock.organizerMealSelection.updateMany.mockResolvedValue({ count: 0 })
    prismaMock.organizerMealSelection.create.mockRejectedValue({ code: 'P2002' })
    prismaMock.organizerMealSelection.findUnique.mockResolvedValue({ accepted: false })

    await expect(validateHandler(mockEvent as any)).rejects.toMatchObject({
      status: 403,
      message: "Cet organisateur n'a pas accès à ce repas",
    })
  })

  // Une panne de base ne doit pas être traduite en « déjà validé » ou « pas d'accès » :
  // wrapApiHandler la relaie en 500 en conservant l'erreur d'origine en `cause`.
  it('propage une erreur Prisma qui n’est pas un conflit d’unicité', async () => {
    prismaMock.organizerMealSelection.updateMany.mockResolvedValue({ count: 0 })
    prismaMock.organizerMealSelection.create.mockRejectedValue({ code: 'P1001' })

    await expect(validateHandler(mockEvent as any)).rejects.toMatchObject({
      statusCode: 500,
      cause: { code: 'P1001' },
    })
  })

  it("rejette (404) si l'organisateur n'est pas présent sur l'édition", async () => {
    prismaMock.editionOrganizer.findFirst.mockResolvedValue(null)

    await expect(validateHandler(mockEvent as any)).rejects.toMatchObject({ status: 404 })
  })
})

describe('POST /api/editions/[id]/meals/[mealId]/cancel — type organizer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCanValidate.mockResolvedValue(true)
    ;(globalThis as any).readBody = vi.fn().mockResolvedValue({ type: 'organizer', id: 5 })

    prismaMock.volunteerMeal.findFirst.mockReset()
    prismaMock.volunteerMeal.findFirst.mockResolvedValue({ id: 3, editionId: 17 })
    prismaMock.organizerMealSelection.updateMany.mockReset()
  })

  it('remet consumedAt à null sans toucher au droit par défaut', async () => {
    prismaMock.organizerMealSelection.updateMany.mockResolvedValue({ count: 1 })

    await cancelHandler(mockEvent as any)

    expect(prismaMock.organizerMealSelection.updateMany).toHaveBeenCalledWith({
      where: { mealId: 3, editionOrganizer: { id: 5, editionId: 17 } },
      data: { consumedAt: null },
    })
  })

  it('rejette (404) si aucune consommation à annuler', async () => {
    prismaMock.organizerMealSelection.updateMany.mockResolvedValue({ count: 0 })

    await expect(cancelHandler(mockEvent as any)).rejects.toMatchObject({ status: 404 })
  })
})
