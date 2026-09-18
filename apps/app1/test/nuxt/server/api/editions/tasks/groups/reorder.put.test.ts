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

import handler from '../../../../../../../../../layers/tasks/server/api/editions/[id]/task-groups/reorder.put'

const prismaMock = (globalThis as any).prisma

const mockUser = { id: 1, pseudo: 'testuser' }
const mockEdition = {
  id: 1,
  convention: { id: 10, authorId: 200, organizers: [] },
  organizerPermissions: [],
}

const evenement = (body: unknown) => ({
  context: { params: { id: '1' }, user: mockUser },
  __body: body,
})

/**
 * Réordonner les groupes de tâches.
 *
 * Deux choses s'éprouvent ici, et aucune n'est cosmétique : le refus d'un corps forgé qui nommerait
 * les groupes d'une autre convention, et le fait qu'on n'écrive que les positions qui CHANGENT —
 * déplacer un groupe d'un rang n'en dérange que deux.
 */
describe('PUT /api/editions/[id]/task-groups/reorder', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetEditionWithPermissions.mockResolvedValue(mockEdition)
    mockCanManageTasks.mockReturnValue(true)
    prismaMock.taskGroup.findMany.mockReset()
    prismaMock.taskGroup.updateMany.mockReset()
    prismaMock.$transaction.mockReset()
    prismaMock.$transaction.mockResolvedValue([])
    // Ordre en base : 7 puis 8 puis 9.
    prismaMock.taskGroup.findMany.mockResolvedValue([
      { id: 7, displayOrder: 0 },
      { id: 8, displayOrder: 1 },
      { id: 9, displayOrder: 2 },
    ])
    ;(globalThis as any).readBody = vi.fn(async (e: any) => e.__body)
  })

  it("n'écrit que les groupes dont la position change", async () => {
    // 7 et 8 échangent leurs places ; 9 ne bouge pas et ne doit pas être réécrit.
    const result = await handler(evenement({ orderedIds: [8, 7, 9] }) as any)

    expect(result).toEqual({ success: true, data: { reordered: 2 } })
    expect(prismaMock.taskGroup.updateMany).toHaveBeenCalledTimes(2)
    const cibles = prismaMock.taskGroup.updateMany.mock.calls.map((c: any[]) => c[0].where.id)
    expect(cibles.sort()).toEqual([7, 8])
  })

  it("n'écrit rien du tout quand l'ordre est déjà le bon", async () => {
    // Un glissement relâché à sa place de départ ne doit prendre aucun verrou.
    const result = await handler(evenement({ orderedIds: [7, 8, 9] }) as any)

    expect(result).toEqual({ success: true, data: { reordered: 0 } })
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })

  it('redit editionId dans chaque écriture', async () => {
    await handler(evenement({ orderedIds: [8, 7, 9] }) as any)

    for (const appel of prismaMock.taskGroup.updateMany.mock.calls) {
      expect(appel[0].where.editionId).toBe(1)
    }
  })

  it("refuse un groupe qui n'appartient pas à l'édition", async () => {
    prismaMock.taskGroup.findMany.mockResolvedValue([{ id: 7, displayOrder: 0 }])

    await expect(handler(evenement({ orderedIds: [7, 999] }) as any)).rejects.toThrow(
      "Certains groupes n'appartiennent pas à cette édition"
    )
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })

  it('refuse un identifiant répété', async () => {
    // `findMany` dédoublonne : la comparaison des longueurs rejette le doublon, qui produirait
    // sinon un ordre incohérent.
    prismaMock.taskGroup.findMany.mockResolvedValue([{ id: 7, displayOrder: 0 }])

    await expect(handler(evenement({ orderedIds: [7, 7] }) as any)).rejects.toThrow(
      "Certains groupes n'appartiennent pas à cette édition"
    )
  })

  it('refuse un compte qui ne gère pas les tâches', async () => {
    mockCanManageTasks.mockReturnValue(false)

    await expect(handler(evenement({ orderedIds: [7] }) as any)).rejects.toThrow(
      "Vous n'êtes pas autorisé à gérer les tâches de cette édition"
    )
    expect(prismaMock.taskGroup.findMany).not.toHaveBeenCalled()
  })
})
