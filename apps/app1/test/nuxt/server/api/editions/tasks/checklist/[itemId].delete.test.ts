import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetEditionWithPermissions = vi.hoisted(() => vi.fn())
const mockCanCommentTask = vi.hoisted(() => vi.fn())

vi.mock('#server/utils/permissions/edition-permissions', () => ({
  getEditionWithPermissions: mockGetEditionWithPermissions,
  canManageTasks: vi.fn(),
}))
vi.mock('#server/utils/tasks-helpers', () => ({ canCommentTask: mockCanCommentTask }))
vi.mock('#server/utils/auth-utils', () => ({
  requireAuth: vi.fn((event) => event.context.user),
}))
vi.mock('#server/utils/validation-schemas', () => ({
  handleValidationError: (e: unknown) => {
    throw e
  },
}))

import handler from '../../../../../../../../../layers/tasks/server/api/editions/[id]/tasks/[taskId]/checklist-items/[itemId].delete'

const prismaMock = (globalThis as any).prisma
const mockUser = { id: 1, pseudo: 'testuser' }
const mockEdition = {
  id: 1,
  convention: { id: 10, authorId: 200, organizers: [] },
  organizerPermissions: [],
}
const mockTask = { id: 5, taskGroupId: 2, assignments: [{ userId: 1 }, { userId: 9 }] }
const evenement = { context: { params: { id: '1', taskId: '5', itemId: '30' }, user: mockUser } }

/** Supprimer un item : mêmes gardes que l'ajout, plus l'appartenance de l'item à la tâche. */
describe('DELETE /api/editions/[id]/tasks/[taskId]/checklist-items/[itemId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetEditionWithPermissions.mockResolvedValue(mockEdition)
    mockCanCommentTask.mockReturnValue(true)
    prismaMock.task.findFirst.mockReset()
    prismaMock.taskChecklistItem.findFirst.mockReset()
    prismaMock.taskChecklistItem.delete.mockReset()
    prismaMock.task.findFirst.mockResolvedValue(mockTask)
    prismaMock.taskChecklistItem.findFirst.mockResolvedValue({ id: 30 })
  })

  it('supprime l’item', async () => {
    await handler(evenement as any)
    expect(prismaMock.taskChecklistItem.delete).toHaveBeenCalledWith({ where: { id: 30 } })
  })

  it('ne supprime rien quand l’item n’appartient pas à la tâche', async () => {
    prismaMock.taskChecklistItem.findFirst.mockResolvedValue(null)
    await expect(handler(evenement as any)).rejects.toThrow('Item introuvable')
    expect(prismaMock.taskChecklistItem.delete).not.toHaveBeenCalled()
  })

  it('ne supprime rien sans le droit', async () => {
    mockCanCommentTask.mockReturnValue(false)
    await expect(handler(evenement as any)).rejects.toThrow('Droits insuffisants')
    expect(prismaMock.taskChecklistItem.delete).not.toHaveBeenCalled()
  })

  it('rejette une tâche introuvable', async () => {
    prismaMock.task.findFirst.mockResolvedValue(null)
    await expect(handler(evenement as any)).rejects.toThrow('Tâche introuvable')
  })
})
