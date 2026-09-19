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

import handler from '../../../../../../../../../layers/tasks/server/api/editions/[id]/tasks/[taskId]/checklist-items/[itemId].put'

const prismaMock = (globalThis as any).prisma
const mockUser = { id: 1, pseudo: 'testuser' }
const mockEdition = {
  id: 1,
  convention: { id: 10, authorId: 200, organizers: [] },
  organizerPermissions: [],
}
const mockTask = { id: 5, taskGroupId: 2, assignments: [{ userId: 1 }, { userId: 9 }] }
const evenement = (body: unknown) => ({
  context: { params: { id: '1', taskId: '5', itemId: '30' }, user: mockUser },
  __body: body,
})

/** Cocher ou renommer un item : le geste le plus courant du module, et le moins gardé jusqu'ici. */
describe('PUT /api/editions/[id]/tasks/[taskId]/checklist-items/[itemId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetEditionWithPermissions.mockResolvedValue(mockEdition)
    mockCanCommentTask.mockReturnValue(true)
    prismaMock.task.findFirst.mockReset()
    prismaMock.taskChecklistItem.findFirst.mockReset()
    prismaMock.taskChecklistItem.update.mockReset()
    prismaMock.task.findFirst.mockResolvedValue(mockTask)
    prismaMock.taskChecklistItem.findFirst.mockResolvedValue({ id: 30, done: false })
    prismaMock.taskChecklistItem.update.mockResolvedValue({ id: 30, done: true })
    ;(globalThis as any).readBody = vi.fn(async (e: any) => e.__body)
  })

  it('coche l’item', async () => {
    const result = await handler(evenement({ done: true }) as any)
    expect(result).toEqual({ success: true, data: { item: { id: 30, done: true } } })
  })

  it('n’écrit rien quand l’item n’appartient pas à la tâche', async () => {
    prismaMock.taskChecklistItem.findFirst.mockResolvedValue(null)
    await expect(handler(evenement({ done: true }) as any)).rejects.toThrow('Item introuvable')
    expect(prismaMock.taskChecklistItem.update).not.toHaveBeenCalled()
  })

  it('n’écrit rien sans le droit', async () => {
    mockCanCommentTask.mockReturnValue(false)
    await expect(handler(evenement({ done: true }) as any)).rejects.toThrow('Droits insuffisants')
    expect(prismaMock.taskChecklistItem.update).not.toHaveBeenCalled()
  })
})
