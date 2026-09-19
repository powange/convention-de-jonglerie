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

import handler from '../../../../../../../../../layers/tasks/server/api/editions/[id]/tasks/overdue-count.get'

const prismaMock = (globalThis as any).prisma

const mockUser = { id: 1, pseudo: 'testuser' }
const mockEdition = {
  id: 1,
  convention: { id: 10, authorId: 200, organizers: [] },
  organizerPermissions: [],
}
const baseEvent = { context: { params: { id: '1' }, user: mockUser } }

/**
 * Le compte qui alimente la pastille du menu.
 *
 * Ce qui s'éprouve ici est la définition de « en retard » : une échéance passée, sur une tâche
 * encore ouverte. Compter les tâches closes allumerait la pastille à jamais et lui ferait perdre
 * tout sens — c'est la règle que partagent les emprunts et les listes de courses.
 */
describe('GET /api/editions/[id]/tasks/overdue-count', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetEditionWithPermissions.mockResolvedValue(mockEdition)
    mockCanManageTasks.mockReturnValue(true)
    prismaMock.task.count.mockReset()
    prismaMock.task.count.mockResolvedValue(3)
  })

  it('rend le nombre de tâches en retard', async () => {
    const result = await handler(baseEvent as any)

    expect(result).toEqual({ success: true, data: { overdue: 3 } })
  })

  it('ne compte que les tâches encore ouvertes, et seulement dans cette édition', async () => {
    await handler(baseEvent as any)

    const where = prismaMock.task.count.mock.calls[0][0].where
    expect(where.group).toEqual({ editionId: 1 })
    expect(where.status).toEqual({ in: ['TODO', 'IN_PROGRESS'] })
    expect(where.deadline.lt).toBeInstanceOf(Date)
  })

  it("rejette si l'édition est introuvable", async () => {
    mockGetEditionWithPermissions.mockResolvedValue(null)

    await expect(handler(baseEvent as any)).rejects.toThrow('Édition non trouvée')
  })

  it('refuse un compte qui ne gère pas les tâches', async () => {
    mockCanManageTasks.mockReturnValue(false)

    await expect(handler(baseEvent as any)).rejects.toThrow(
      "Vous n'êtes pas autorisé à gérer les tâches de cette édition"
    )
    expect(prismaMock.task.count).not.toHaveBeenCalled()
  })
})
