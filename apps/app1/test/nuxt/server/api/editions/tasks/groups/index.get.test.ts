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

import handler from '../../../../../../../../../layers/tasks/server/api/editions/[id]/task-groups/index.get'

const prismaMock = (globalThis as any).prisma

const mockUser = { id: 1, pseudo: 'testuser' }
const mockEdition = {
  id: 1,
  convention: { id: 10, authorId: 200, organizers: [] },
  organizerPermissions: [],
}

const baseEvent = { context: { params: { id: '1' }, user: mockUser } }

/**
 * La liste des groupes ne rend que des RÉSUMÉS.
 *
 * Elle portait chaque groupe avec toutes ses tâches, leurs assignés, leurs checklists et leurs
 * étiquettes — alors que ses deux appelants n'en lisent que le nom et le nombre de tâches. Ce
 * fichier verrouille cette frugalité : c'est elle qui se perd à la première relecture distraite.
 */
describe('GET /api/editions/[id]/task-groups', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetEditionWithPermissions.mockResolvedValue(mockEdition)
    mockCanManageTasks.mockReturnValue(true)
    prismaMock.taskGroup.findMany.mockReset()
    prismaMock.taskGroup.findMany.mockResolvedValue([
      { id: 3, name: 'Logistique', description: null, displayOrder: 0, _count: { tasks: 12 } },
    ])
  })

  it('rend les groupes avec le nombre de tâches', async () => {
    const result = await handler(baseEvent as any)

    expect(result).toEqual({
      success: true,
      data: {
        groups: [
          { id: 3, name: 'Logistique', description: null, displayOrder: 0, _count: { tasks: 12 } },
        ],
      },
    })
  })

  it('ne demande PAS les tâches à la base', async () => {
    // Le cœur du sujet : compter se fait en base, pas en transférant les lignes pour les compter
    // dans le navigateur.
    await handler(baseEvent as any)

    const args = prismaMock.taskGroup.findMany.mock.calls[0][0]
    expect(args.include).toBeUndefined()
    expect(args.select.tasks).toBeUndefined()
    expect(args.select._count).toEqual({ select: { tasks: true } })
  })

  it('reste ordonné par position puis par ancienneté', async () => {
    await handler(baseEvent as any)

    const args = prismaMock.taskGroup.findMany.mock.calls[0][0]
    expect(args.orderBy).toEqual([{ displayOrder: 'asc' }, { createdAt: 'asc' }])
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
    expect(prismaMock.taskGroup.findMany).not.toHaveBeenCalled()
  })
})
