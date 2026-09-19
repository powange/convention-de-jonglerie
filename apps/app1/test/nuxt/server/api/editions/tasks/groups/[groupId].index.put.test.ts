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
import handler from '../../../../../../../../../layers/tasks/server/api/editions/[id]/task-groups/[groupId]/index.put'

const evenement = (body: unknown) => ({
  context: { params: { id: '1', groupId: '5' }, user: mockUser },
  __body: body,
})

/** Renommer un groupe, ou changer sa position. */
describe('PUT /api/editions/[id]/task-groups/[groupId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetEditionWithPermissions.mockResolvedValue(mockEdition)
    mockCanManageTasks.mockReturnValue(true)
    prismaMock.taskGroup.findFirst.mockReset()
    prismaMock.taskGroup.update.mockReset()
    prismaMock.taskGroup.findFirst.mockResolvedValue({ id: 5 })
    prismaMock.taskGroup.update.mockResolvedValue({ id: 5, name: 'Logistique' })
    ;(globalThis as any).readBody = vi.fn(async (e: any) => e.__body)
  })

  it('renomme le groupe', async () => {
    const result = await handler(evenement({ name: 'Logistique' }) as any)
    expect(result).toEqual({ success: true, data: { group: { id: 5, name: 'Logistique' } } })
  })

  it("vérifie l'appartenance à l'édition avant d'écrire", async () => {
    await handler(evenement({ name: 'Logistique' }) as any)
    expect(prismaMock.taskGroup.findFirst.mock.calls[0][0].where).toMatchObject({
      id: 5,
      editionId: 1,
    })
  })

  it('n’écrit rien quand le groupe est introuvable', async () => {
    prismaMock.taskGroup.findFirst.mockResolvedValue(null)
    await expect(handler(evenement({ name: 'x' }) as any)).rejects.toThrow('Groupe introuvable')
    expect(prismaMock.taskGroup.update).not.toHaveBeenCalled()
  })

  it('n’écrit rien sans le droit de gérer les tâches', async () => {
    mockCanManageTasks.mockReturnValue(false)
    await expect(handler(evenement({ name: 'x' }) as any)).rejects.toThrow('Droits insuffisants')
    expect(prismaMock.taskGroup.update).not.toHaveBeenCalled()
  })
})
