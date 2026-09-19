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
import handler from '../../../../../../../../../layers/tasks/server/api/editions/[id]/task-groups/[groupId]/tags/[tagId].put'

const evenement = (body: unknown) => ({
  context: { params: { id: '1', groupId: '5', tagId: '20' }, user: mockUser },
  __body: body,
})

/** Renommer une étiquette, ou changer sa couleur. L'unicité du nom vaut aussi ici. */
describe('PUT /api/editions/[id]/task-groups/[groupId]/tags/[tagId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetEditionWithPermissions.mockResolvedValue(mockEdition)
    mockCanManageTasks.mockReturnValue(true)
    prismaMock.taskGroup.findFirst.mockReset()
    prismaMock.taskTag.findFirst.mockReset()
    prismaMock.taskTag.update.mockReset()
    prismaMock.taskGroup.findFirst.mockResolvedValue({ id: 5 })
    prismaMock.taskTag.findFirst.mockResolvedValue({ id: 20, name: 'urgent' })
    prismaMock.taskTag.update.mockResolvedValue({ id: 20, name: 'prioritaire' })
    ;(globalThis as any).readBody = vi.fn(async (e: any) => e.__body)
  })

  it('renomme l’étiquette', async () => {
    const result: any = await handler(evenement({ name: 'prioritaire' }) as any)
    expect(result.success).toBe(true)
  })

  it('n’écrit rien quand l’étiquette est introuvable', async () => {
    prismaMock.taskTag.findFirst.mockResolvedValue(null)
    await expect(handler(evenement({ name: 'x' }) as any)).rejects.toThrow('Tag introuvable')
    expect(prismaMock.taskTag.update).not.toHaveBeenCalled()
  })

  it('n’écrit rien sans le droit de gérer les tâches', async () => {
    mockCanManageTasks.mockReturnValue(false)
    await expect(handler(evenement({ name: 'x' }) as any)).rejects.toThrow('Droits insuffisants')
    expect(prismaMock.taskTag.update).not.toHaveBeenCalled()
  })
})
