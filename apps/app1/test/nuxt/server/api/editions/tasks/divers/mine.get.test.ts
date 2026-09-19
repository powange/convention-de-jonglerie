import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockIsTasksEnabled = vi.hoisted(() => vi.fn())

vi.mock('#server/utils/auth-utils', () => ({
  requireAuth: vi.fn((event) => event.context.user),
}))
vi.mock('#server/taskboard/ports/registry', () => ({
  useTaskboardPorts: () => ({ directory: { isTasksEnabled: mockIsTasksEnabled } }),
}))

import handler from '../../../../../../../../../layers/tasks/server/api/editions/[id]/tasks/mine.get'

const prismaMock = (globalThis as any).prisma
const mockUser = { id: 7, pseudo: 'benevole' }
const baseEvent = { context: { params: { id: '1' }, user: mockUser } }

/**
 * « Mes tâches », côté bénévole.
 *
 * C'est le SEUL point du module ouvert à qui ne gère pas les tâches : sa sélection est donc sa
 * seule garde, et elle se vérifie ici. Il est aussi le seul à honorer le drapeau du module —
 * désactiver les tâches doit fermer cette page, pas la gestion.
 */
describe('GET /api/editions/[id]/tasks/mine', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsTasksEnabled.mockResolvedValue({ found: true, enabled: true })
    prismaMock.task.findMany.mockReset()
    prismaMock.task.findMany.mockResolvedValue([])
  })

  it('ne rend que les tâches assignées à qui demande', async () => {
    await handler(baseEvent as any)
    const where = prismaMock.task.findMany.mock.calls[0][0].where
    expect(where.group).toEqual({ editionId: 1 })
    expect(where.assignments).toEqual({ some: { userId: 7 } })
  })

  it("ne transmet pas l'adresse e-mail des co-assignés", async () => {
    // Elle partait jusqu'à des bénévoles simplement co-assignés, sans qu'aucun écran ne l'affiche.
    await handler(baseEvent as any)
    const select = prismaMock.task.findMany.mock.calls[0][0].include.assignments.include.user.select
    expect(select.email).toBeUndefined()
    expect(select.emailHash).toBe(true)
  })

  it("rejette si l'édition est introuvable", async () => {
    mockIsTasksEnabled.mockResolvedValue({ found: false, enabled: false })
    await expect(handler(baseEvent as any)).rejects.toThrow('Édition non trouvée')
  })

  it('rejette si le module est désactivé', async () => {
    mockIsTasksEnabled.mockResolvedValue({ found: true, enabled: false })
    await expect(handler(baseEvent as any)).rejects.toThrow('Module tâches désactivé')
    expect(prismaMock.task.findMany).not.toHaveBeenCalled()
  })
})
