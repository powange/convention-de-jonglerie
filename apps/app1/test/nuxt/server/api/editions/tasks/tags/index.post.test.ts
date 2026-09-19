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
import handler from '../../../../../../../../../layers/tasks/server/api/editions/[id]/task-groups/[groupId]/tags/index.post'

const evenement = (body: unknown) => ({
  context: { params: { id: '1', groupId: '5' }, user: mockUser },
  __body: body,
})

/**
 * Créer une étiquette dans un groupe.
 *
 * L'unicité du nom ne se vérifie PAS avant d'écrire : elle s'appuie sur la contrainte de base, et
 * le code P2002 devient un 409. C'est mieux qu'une lecture préalable, qui laisserait une fenêtre
 * entre la vérification et l'insertion — deux organisateurs créant « urgent » en même temps la
 * franchiraient tous les deux. Ce test éprouve donc le vrai mécanisme, pas celui qu'on imagine.
 */
describe('POST /api/editions/[id]/task-groups/[groupId]/tags', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetEditionWithPermissions.mockResolvedValue(mockEdition)
    mockCanManageTasks.mockReturnValue(true)
    prismaMock.taskGroup.findFirst.mockReset()
    prismaMock.taskTag.findFirst.mockReset()
    prismaMock.taskTag.aggregate.mockReset()
    prismaMock.taskTag.create.mockReset()
    prismaMock.taskGroup.findFirst.mockResolvedValue({ id: 5 })
    prismaMock.taskTag.findFirst.mockResolvedValue(null)
    prismaMock.taskTag.aggregate.mockResolvedValue({ _max: { displayOrder: 1 } })
    prismaMock.taskTag.create.mockResolvedValue({ id: 20, name: 'urgent' })
    ;(globalThis as any).readBody = vi.fn(async (e: any) => e.__body)
  })

  it('crée l’étiquette', async () => {
    const result: any = await handler(evenement({ name: 'urgent', color: '#ff0000' }) as any)
    expect(result.success).toBe(true)
  })

  it('traduit la contrainte d\u2019unicit\u00e9 en refus lisible', async () => {
    const collision = Object.assign(new Error('Unique constraint failed'), { code: 'P2002' })
    prismaMock.taskTag.create.mockRejectedValue(collision)

    await expect(handler(evenement({ name: 'urgent', color: '#ff0000' }) as any)).rejects.toThrow(
      'Un tag avec ce nom existe d\u00e9j\u00e0'
    )
  })

  it('ne crée rien quand le groupe est introuvable', async () => {
    prismaMock.taskGroup.findFirst.mockResolvedValue(null)
    await expect(handler(evenement({ name: 'x', color: '#ff0000' }) as any)).rejects.toThrow(
      'Groupe introuvable'
    )
  })

  it('ne crée rien sans le droit de gérer les tâches', async () => {
    mockCanManageTasks.mockReturnValue(false)
    await expect(handler(evenement({ name: 'x', color: '#ff0000' }) as any)).rejects.toThrow(
      'Droits insuffisants'
    )
    expect(prismaMock.taskTag.create).not.toHaveBeenCalled()
  })
})
