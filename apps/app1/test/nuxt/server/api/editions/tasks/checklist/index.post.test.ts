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

import handler from '../../../../../../../../../layers/tasks/server/api/editions/[id]/tasks/[taskId]/checklist-items/index.post'

const prismaMock = (globalThis as any).prisma
const mockUser = { id: 1, pseudo: 'testuser' }
const mockEdition = {
  id: 1,
  convention: { id: 10, authorId: 200, organizers: [] },
  organizerPermissions: [],
}
const mockTask = { id: 5, taskGroupId: 2, assignments: [{ userId: 1 }, { userId: 9 }] }
const evenement = (body: unknown) => ({
  context: { params: { id: '1', taskId: '5' }, user: mockUser },
  __body: body,
})

/**
 * Ajouter un item de checklist.
 *
 * Ce point n'exige PAS de gérer les tâches : un bénévole assigné coche et complète sa propre
 * checklist. C'est `canCommentTask` qui arbitre — organisateur, ou assigné — et la liste des
 * assignés qu'on lui transmet est donc le vrai sujet de ce fichier.
 */
describe('POST /api/editions/[id]/tasks/[taskId]/checklist-items', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetEditionWithPermissions.mockResolvedValue(mockEdition)
    mockCanCommentTask.mockReturnValue(true)
    prismaMock.task.findFirst.mockReset()
    prismaMock.taskChecklistItem.aggregate.mockReset()
    prismaMock.taskChecklistItem.create.mockReset()
    prismaMock.task.findFirst.mockResolvedValue(mockTask)
    prismaMock.taskChecklistItem.aggregate.mockResolvedValue({ _max: { displayOrder: 2 } })
    prismaMock.taskChecklistItem.create.mockResolvedValue({ id: 30, title: 'Acheter' })
    ;(globalThis as any).readBody = vi.fn(async (e: any) => e.__body)
  })

  it('crée l’item', async () => {
    const result = await handler(evenement({ title: 'Acheter' }) as any)
    expect(result).toEqual({ success: true, data: { item: { id: 30, title: 'Acheter' } } })
  })

  it('transmet la liste des assignés à canCommentTask', async () => {
    await handler(evenement({ title: 'Acheter' }) as any)
    expect(mockCanCommentTask).toHaveBeenCalledWith(mockEdition, mockUser, [1, 9])
  })

  it('cherche la tâche DANS l’édition', async () => {
    await handler(evenement({ title: 'Acheter' }) as any)
    expect(prismaMock.task.findFirst.mock.calls[0][0].where).toMatchObject({ id: 5 })
  })

  it('rejette une tâche introuvable', async () => {
    prismaMock.task.findFirst.mockResolvedValue(null)
    await expect(handler(evenement({ title: 'x' }) as any)).rejects.toThrow('Tâche introuvable')
  })

  it('refuse qui ne peut ni gérer ni commenter', async () => {
    mockCanCommentTask.mockReturnValue(false)
    await expect(handler(evenement({ title: 'x' }) as any)).rejects.toThrow('Droits insuffisants')
    expect(prismaMock.taskChecklistItem.create).not.toHaveBeenCalled()
  })

  it('rejette un identifiant de tâche invalide', async () => {
    const mauvais = { context: { params: { id: '1', taskId: 'abc' }, user: mockUser }, __body: {} }
    await expect(handler(mauvais as any)).rejects.toThrow('Identifiant de tâche invalide')
  })
})
