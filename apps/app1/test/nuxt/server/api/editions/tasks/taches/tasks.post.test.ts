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
import handler from '../../../../../../../../../layers/tasks/server/api/editions/[id]/task-groups/[groupId]/tasks.post'

const evenement = (body: unknown) => ({
  context: { params: { id: '1', groupId: '5' }, user: mockUser },
  __body: body,
})

/**
 * Créer une tâche dans un groupe.
 *
 * Deux gardes valent d'être verrouillées : le groupe doit appartenir à l'édition, et les personnes
 * assignées doivent être assignables — sans quoi une requête forgée rattacherait n'importe quel
 * compte du site à une tâche de convention.
 */
describe('POST /api/editions/[id]/task-groups/[groupId]/tasks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetEditionWithPermissions.mockResolvedValue(mockEdition)
    mockCanManageTasks.mockReturnValue(true)
    mockAssertAssignees.mockResolvedValue(undefined)
    prismaMock.taskGroup.findFirst.mockReset()
    prismaMock.task.findFirst.mockReset()
    prismaMock.task.create.mockReset()
    prismaMock.taskGroup.findFirst.mockResolvedValue({ id: 5 })
    prismaMock.task.findFirst.mockResolvedValue({ displayOrder: 1 })
    prismaMock.task.create.mockResolvedValue({ id: 40, title: 'Réserver', assignments: [] })
    ;(globalThis as any).readBody = vi.fn(async (e: any) => e.__body)
  })

  it('crée la tâche', async () => {
    const result: any = await handler(evenement({ title: 'Réserver' }) as any)
    expect(result.success).toBe(true)
    expect(prismaMock.task.create).toHaveBeenCalled()
  })

  it('vérifie que les assignés sont assignables', async () => {
    await handler(evenement({ title: 'Réserver', assigneeIds: [4, 6] }) as any)
    expect(mockAssertAssignees).toHaveBeenCalledWith(1, [4, 6])
  })

  it('ne crée rien quand le groupe est introuvable', async () => {
    prismaMock.taskGroup.findFirst.mockResolvedValue(null)
    await expect(handler(evenement({ title: 'x' }) as any)).rejects.toThrow('Groupe introuvable')
    expect(prismaMock.task.create).not.toHaveBeenCalled()
  })

  it('ne crée rien sans le droit de gérer les tâches', async () => {
    mockCanManageTasks.mockReturnValue(false)
    await expect(handler(evenement({ title: 'x' }) as any)).rejects.toThrow('Droits insuffisants')
    expect(prismaMock.task.create).not.toHaveBeenCalled()
  })
})
