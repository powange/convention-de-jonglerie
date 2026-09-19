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

import handler from '../../../../../../../../../layers/tasks/server/api/editions/[id]/task-groups/[groupId]/index.get'

const prismaMock = (globalThis as any).prisma
const mockUser = { id: 1, pseudo: 'testuser' }
const mockEdition = {
  id: 1,
  convention: { id: 10, authorId: 200, organizers: [] },
  organizerPermissions: [],
}
const evenement = { context: { params: { id: '1', groupId: '5' }, user: mockUser } }

/**
 * Un groupe, avec son contenu.
 *
 * Ce point existe pour que l'écran d'un groupe cesse de charger toute l'édition. Deux choses s'y
 * jouent : la clause doit nommer l'ÉDITION en plus du groupe — sinon connaître un numéro suffirait
 * à lire les tâches d'une autre convention — et l'adresse e-mail des assignés ne doit pas repartir.
 */
describe('GET /api/editions/[id]/task-groups/[groupId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetEditionWithPermissions.mockResolvedValue(mockEdition)
    mockCanManageTasks.mockReturnValue(true)
    prismaMock.taskGroup.findFirst.mockReset()
    prismaMock.taskGroup.findFirst.mockResolvedValue({ id: 5, name: 'Logistique', tasks: [] })
  })

  it('rend le groupe demandé', async () => {
    const result = await handler(evenement as any)
    expect(result).toEqual({
      success: true,
      data: { group: { id: 5, name: 'Logistique', tasks: [] } },
    })
  })

  it("cherche le groupe DANS l'édition, pas par son seul identifiant", async () => {
    await handler(evenement as any)
    expect(prismaMock.taskGroup.findFirst.mock.calls[0][0].where).toEqual({ id: 5, editionId: 1 })
  })

  it("ne transmet pas l'adresse e-mail des assignés", async () => {
    await handler(evenement as any)
    const select =
      prismaMock.taskGroup.findFirst.mock.calls[0][0].include.tasks.include.assignments.include.user
        .select
    expect(select.email).toBeUndefined()
    expect(select.emailHash).toBe(true)
  })

  it('rejette un groupe introuvable', async () => {
    prismaMock.taskGroup.findFirst.mockResolvedValue(null)
    await expect(handler(evenement as any)).rejects.toThrow('Groupe introuvable')
  })

  it('rejette un identifiant de groupe invalide', async () => {
    const mauvais = { context: { params: { id: '1', groupId: 'abc' }, user: mockUser } }
    await expect(handler(mauvais as any)).rejects.toThrow('Identifiant de groupe invalide')
  })

  it('refuse un compte qui ne gère pas les tâches', async () => {
    mockCanManageTasks.mockReturnValue(false)
    await expect(handler(evenement as any)).rejects.toThrow(
      "Vous n'êtes pas autorisé à gérer les tâches de cette édition"
    )
    expect(prismaMock.taskGroup.findFirst).not.toHaveBeenCalled()
  })
})
