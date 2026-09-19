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
import handler from '../../../../../../../../../layers/tasks/server/api/editions/[id]/task-groups/[groupId]/reorder.post'

const evenement = (body: unknown) => ({
  context: { params: { id: '1', groupId: '5' }, user: mockUser },
  __body: body,
})

/**
 * Réordonner les tâches d'un groupe.
 *
 * Deux gardes et une frugalité : refuser un corps forgé qui nommerait les tâches d'un autre
 * groupe, refuser un identifiant répété — qui produirait un ordre incohérent —, et n'écrire que
 * les positions qui changent.
 */
describe('POST /api/editions/[id]/task-groups/[groupId]/reorder', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetEditionWithPermissions.mockResolvedValue(mockEdition)
    mockCanManageTasks.mockReturnValue(true)
    prismaMock.taskGroup.findFirst.mockReset()
    prismaMock.task.findMany.mockReset()
    prismaMock.task.updateMany.mockReset()
    prismaMock.$transaction.mockReset()
    prismaMock.$transaction.mockResolvedValue([])
    prismaMock.taskGroup.findFirst.mockResolvedValue({ id: 5 })
    prismaMock.task.findMany.mockResolvedValue([
      { id: 11, displayOrder: 0 },
      { id: 12, displayOrder: 1 },
      { id: 13, displayOrder: 2 },
    ])
    ;(globalThis as any).readBody = vi.fn(async (e: any) => e.__body)
  })

  it("n'écrit que les tâches dont la position change", async () => {
    const result = await handler(evenement({ taskIds: [12, 11, 13] }) as any)
    expect(result).toEqual({ success: true, data: { updated: 2 } })
    expect(prismaMock.task.updateMany).toHaveBeenCalledTimes(2)
  })

  it("n'écrit rien quand l'ordre est déjà le bon", async () => {
    // Un glissement relâché à sa place de départ ne doit prendre aucun verrou.
    const result = await handler(evenement({ taskIds: [11, 12, 13] }) as any)
    expect(result).toEqual({ success: true, data: { updated: 0 } })
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })

  it("refuse une tâche qui n'appartient pas au groupe", async () => {
    prismaMock.task.findMany.mockResolvedValue([{ id: 11, displayOrder: 0 }])
    await expect(handler(evenement({ taskIds: [11, 999] }) as any)).rejects.toThrow(
      "Certaines tâches n'appartiennent pas à ce groupe"
    )
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })

  it('refuse un identifiant répété', async () => {
    prismaMock.task.findMany.mockResolvedValue([{ id: 11, displayOrder: 0 }])
    await expect(handler(evenement({ taskIds: [11, 11] }) as any)).rejects.toThrow(
      "Certaines tâches n'appartiennent pas à ce groupe"
    )
  })

  it('rejette un groupe introuvable', async () => {
    prismaMock.taskGroup.findFirst.mockResolvedValue(null)
    await expect(handler(evenement({ taskIds: [11] }) as any)).rejects.toThrow('Groupe introuvable')
  })

  it('refuse un compte qui ne gère pas les tâches', async () => {
    mockCanManageTasks.mockReturnValue(false)
    await expect(handler(evenement({ taskIds: [11] }) as any)).rejects.toThrow(
      'Droits insuffisants'
    )
  })
})
