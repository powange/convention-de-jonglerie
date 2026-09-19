import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetEditionWithPermissions = vi.hoisted(() => vi.fn())
const mockCanManageTasks = vi.hoisted(() => vi.fn())
const mockAssertAssignees = vi.hoisted(() => vi.fn())

vi.mock('#server/utils/permissions/edition-permissions', () => ({
  getEditionWithPermissions: mockGetEditionWithPermissions,
  canManageTasks: mockCanManageTasks,
}))
vi.mock('#server/utils/tasks-helpers', () => ({
  assertAssigneesAreAssignable: mockAssertAssignees,
  canCommentTask: vi.fn(),
}))
vi.mock('#server/utils/auth-utils', () => ({
  requireAuth: vi.fn((event) => event.context.user),
}))
vi.mock('#server/utils/validation-schemas', () => ({
  handleValidationError: (e: unknown) => {
    throw e
  },
}))
vi.mock('#server/utils/notification-service', () => ({
  NotificationHelpers: { taskAssigned: vi.fn() },
  safeNotify: vi.fn(),
}))

const prismaMock = (globalThis as any).prisma
const mockUser = { id: 1, pseudo: 'testuser' }
const mockEdition = {
  id: 1,
  name: 'E',
  convention: { id: 10, name: 'C', authorId: 200, organizers: [] },
  organizerPermissions: [],
}
import handler from '../../../../../../../../../layers/tasks/server/api/editions/[id]/tasks/[taskId]/index.put'

const evenement = (body: unknown) => ({
  context: { params: { id: '1', taskId: '5' }, user: mockUser },
  __body: body,
})

/**
 * Modifier une tâche : statut, échéance, assignés, groupe.
 *
 * C'est le point le plus chargé du module. Ce qui s'y vérifie : on ne déplace pas une tâche vers
 * le groupe d'une AUTRE édition, et les assignés restent contrôlés.
 */
describe('PUT /api/editions/[id]/tasks/[taskId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetEditionWithPermissions.mockResolvedValue(mockEdition)
    mockCanManageTasks.mockReturnValue(true)
    mockAssertAssignees.mockResolvedValue(undefined)
    prismaMock.task.findFirst.mockReset()
    prismaMock.taskGroup.findFirst.mockReset()
    prismaMock.task.update.mockReset()
    prismaMock.task.findFirst.mockResolvedValue({
      id: 5,
      taskGroupId: 2,
      title: 'T',
      assignments: [],
    })
    prismaMock.taskGroup.findFirst.mockResolvedValue({ id: 3 })
    prismaMock.task.update.mockResolvedValue({ id: 5, status: 'DONE', assignments: [] })
    ;(globalThis as any).readBody = vi.fn(async (e: any) => e.__body)
  })

  it('met à jour la tâche', async () => {
    const result: any = await handler(evenement({ status: 'DONE' }) as any)
    expect(result.success).toBe(true)
    expect(prismaMock.task.update).toHaveBeenCalled()
  })

  it("refuse un groupe cible d'une autre édition", async () => {
    prismaMock.taskGroup.findFirst.mockResolvedValue(null)
    await expect(handler(evenement({ taskGroupId: 999 }) as any)).rejects.toThrow(
      "Le groupe cible n'appartient pas à cette édition"
    )
    expect(prismaMock.task.update).not.toHaveBeenCalled()
  })

  it('vérifie les assignés proposés', async () => {
    await handler(evenement({ assigneeIds: [4] }) as any)
    expect(mockAssertAssignees).toHaveBeenCalledWith(1, [4])
  })

  it('rejette une tâche introuvable', async () => {
    prismaMock.task.findFirst.mockResolvedValue(null)
    await expect(handler(evenement({ status: 'DONE' }) as any)).rejects.toThrow('Tâche introuvable')
  })

  it("n'écrit rien sans le droit de gérer les tâches", async () => {
    mockCanManageTasks.mockReturnValue(false)
    await expect(handler(evenement({ status: 'DONE' }) as any)).rejects.toThrow(
      'Droits insuffisants'
    )
    expect(prismaMock.task.update).not.toHaveBeenCalled()
  })
})
