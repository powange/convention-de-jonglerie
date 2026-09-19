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
import handler from '../../../../../../../../../layers/tasks/server/api/editions/[id]/task-groups/[groupId]/tags/[tagId].delete'

const evenement = { context: { params: { id: '1', groupId: '5', tagId: '20' }, user: mockUser } }

/** Supprimer une étiquette la retire de toutes les tâches du groupe qui la portent. */
describe('DELETE /api/editions/[id]/task-groups/[groupId]/tags/[tagId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetEditionWithPermissions.mockResolvedValue(mockEdition)
    mockCanManageTasks.mockReturnValue(true)
    prismaMock.taskGroup.findFirst.mockReset()
    prismaMock.taskTag.findFirst.mockReset()
    prismaMock.taskTag.delete.mockReset()
    prismaMock.taskGroup.findFirst.mockResolvedValue({ id: 5 })
    prismaMock.taskTag.findFirst.mockResolvedValue({ id: 20 })
  })

  it('supprime l’étiquette', async () => {
    await handler(evenement as any)
    expect(prismaMock.taskTag.delete).toHaveBeenCalledWith({ where: { id: 20 } })
  })

  it('ne supprime rien quand l’étiquette n’est pas dans ce groupe', async () => {
    prismaMock.taskTag.findFirst.mockResolvedValue(null)
    await expect(handler(evenement as any)).rejects.toThrow('Tag introuvable')
    expect(prismaMock.taskTag.delete).not.toHaveBeenCalled()
  })

  it('ne supprime rien sans le droit de gérer les tâches', async () => {
    mockCanManageTasks.mockReturnValue(false)
    await expect(handler(evenement as any)).rejects.toThrow('Droits insuffisants')
    expect(prismaMock.taskTag.delete).not.toHaveBeenCalled()
  })
})
