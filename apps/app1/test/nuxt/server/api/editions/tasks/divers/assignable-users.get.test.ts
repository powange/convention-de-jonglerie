import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetEditionWithPermissions = vi.hoisted(() => vi.fn())
const mockCanManageTasks = vi.hoisted(() => vi.fn())
const mockGetAssignableUsers = vi.hoisted(() => vi.fn())

vi.mock('#server/utils/permissions/edition-permissions', () => ({
  getEditionWithPermissions: mockGetEditionWithPermissions,
  canManageTasks: mockCanManageTasks,
}))
vi.mock('#server/utils/auth-utils', () => ({
  requireAuth: vi.fn((event) => event.context.user),
}))
vi.mock('#server/taskboard/ports/registry', () => ({
  useTaskboardPorts: () => ({ directory: { getAssignableUsers: mockGetAssignableUsers } }),
}))

import handler from '../../../../../../../../../layers/tasks/server/api/editions/[id]/tasks/assignable-users.get'

const mockUser = { id: 1, pseudo: 'testuser' }
const mockEdition = {
  id: 1,
  convention: { id: 10, authorId: 200, organizers: [] },
  organizerPermissions: [],
}
const baseEvent = { context: { params: { id: '1' }, user: mockUser } }

/**
 * Qui l'on peut assigner à une tâche.
 *
 * La résolution — organisateurs et bénévoles acceptés — appartient au port `directory` et se teste
 * ailleurs. Ce qui se vérifie ici est la porte : ce point rend des identités de personnes, il ne
 * doit s'ouvrir qu'à qui gère les tâches.
 */
describe('GET /api/editions/[id]/tasks/assignable-users', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetEditionWithPermissions.mockResolvedValue(mockEdition)
    mockCanManageTasks.mockReturnValue(true)
    mockGetAssignableUsers.mockResolvedValue([{ id: 2, pseudo: 'alice' }])
  })

  it('rend les personnes assignables', async () => {
    const result = await handler(baseEvent as any)
    expect(result).toEqual({ success: true, data: { users: [{ id: 2, pseudo: 'alice' }] } })
    expect(mockGetAssignableUsers).toHaveBeenCalledWith(1)
  })

  it("rejette si l'édition est introuvable", async () => {
    mockGetEditionWithPermissions.mockResolvedValue(null)
    await expect(handler(baseEvent as any)).rejects.toThrow('Édition non trouvée')
  })

  it('refuse un compte qui ne gère pas les tâches', async () => {
    mockCanManageTasks.mockReturnValue(false)
    await expect(handler(baseEvent as any)).rejects.toThrow('Droits insuffisants')
    expect(mockGetAssignableUsers).not.toHaveBeenCalled()
  })
})
