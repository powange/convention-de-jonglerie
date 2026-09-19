import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetEditionWithPermissions = vi.hoisted(() => vi.fn())
const mockCanManageTasks = vi.hoisted(() => vi.fn())

vi.mock('#server/utils/permissions/edition-permissions', () => ({
  getEditionWithPermissions: mockGetEditionWithPermissions,
  canManageTasks: mockCanManageTasks,
}))
vi.mock('#server/utils/auth-utils', () => ({
  requireAuth: vi.fn((event) => event.context.user),
}))
vi.mock('#server/utils/validation-schemas', () => ({
  handleValidationError: (e: unknown) => {
    throw e
  },
}))

const prismaMock = (globalThis as any).prisma
const mockUser = { id: 1, pseudo: 'testuser' }
const mockEdition = {
  id: 1,
  convention: { id: 10, authorId: 200, organizers: [] },
  organizerPermissions: [],
}
import handler from '../../../../../../../../../layers/tasks/server/api/editions/[id]/task-groups/index.post'

const evenement = (body: unknown) => ({
  context: { params: { id: '1' }, user: mockUser },
  __body: body,
})

/**
 * Créer un groupe.
 *
 * Le nouveau groupe se place en DERNIER : sans cela il s'insérerait à la position zéro, devant
 * tout ce que l'édition avait déjà rangé.
 */
describe('POST /api/editions/[id]/task-groups', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetEditionWithPermissions.mockResolvedValue(mockEdition)
    mockCanManageTasks.mockReturnValue(true)
    prismaMock.taskGroup.findFirst.mockReset()
    prismaMock.taskGroup.create.mockReset()
    prismaMock.taskGroup.findFirst.mockResolvedValue({ displayOrder: 4 })
    prismaMock.taskGroup.create.mockResolvedValue({ id: 9, name: 'Sécurité' })
    ;(globalThis as any).readBody = vi.fn(async (e: any) => e.__body)
  })

  it('crée le groupe', async () => {
    const result = await handler(evenement({ name: 'Sécurité' }) as any)
    expect(result).toEqual({ success: true, data: { group: { id: 9, name: 'Sécurité' } } })
  })

  it('place le nouveau groupe après les existants', async () => {
    await handler(evenement({ name: 'Sécurité' }) as any)
    expect(prismaMock.taskGroup.create.mock.calls[0][0].data.displayOrder).toBe(5)
  })

  it('le rattache à l’édition de l’URL', async () => {
    await handler(evenement({ name: 'Sécurité' }) as any)
    expect(prismaMock.taskGroup.create.mock.calls[0][0].data.editionId).toBe(1)
  })

  it("rejette si l'édition est introuvable", async () => {
    mockGetEditionWithPermissions.mockResolvedValue(null)
    await expect(handler(evenement({ name: 'x' }) as any)).rejects.toThrow('Édition non trouvée')
  })

  it('refuse un compte qui ne gère pas les tâches', async () => {
    mockCanManageTasks.mockReturnValue(false)
    await expect(handler(evenement({ name: 'x' }) as any)).rejects.toThrow(
      "Vous n'êtes pas autorisé à gérer les tâches de cette édition"
    )
    expect(prismaMock.taskGroup.create).not.toHaveBeenCalled()
  })
})
