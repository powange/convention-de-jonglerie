import { describe, it, expect, beforeEach, vi } from 'vitest'

const mockCanManage = vi.hoisted(() => vi.fn())

vi.mock('#server/utils/api-helpers', () => ({
  wrapApiHandler: (handler: any) => handler,
  createPaginatedResponse: (items: unknown[], total: number, page: number, limit: number) => ({
    success: true,
    data: items,
    pagination: { page, limit, totalCount: total, totalPages: Math.ceil(total / limit) },
  }),
}))

vi.mock('#server/utils/validation-helpers', () => ({
  validateEditionId: (event: any) => parseInt(event?.context?.params?.id, 10),
  validatePagination: () => ({ page: 1, limit: 10, skip: 0, take: 10 }),
}))

vi.mock('#server/utils/auth-utils', () => ({
  requireAuth: (event: any) => event?.context?.user,
}))

vi.mock('#server/utils/prisma-select-helpers', () => ({
  userWithNameSelect: { id: true, pseudo: true },
}))

vi.mock('#server/volunteers/ports/registry', () => ({
  useVolunteerPorts: () => ({ organizers: { canManage: mockCanManage } }),
}))

import handler from '../../../../../../../layers/volunteers/server/api/editions/[id]/volunteers/auto-assign/history.get'

const prismaMock = (globalThis as any).prisma

const evenement = { context: { params: { id: '22' }, user: { id: 7 } } }

/**
 * Le journal des calculs existait depuis le début — c'est lui qui permet d'annuler — mais rien ne
 * le montrait. Un organisateur qui revenait le lendemain n'avait aucun moyen de savoir qu'un
 * collègue avait appliqué un calcul, avec quels réglages, ni ce qui en avait découlé.
 */
describe('GET …/volunteers/auto-assign/history', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCanManage.mockResolvedValue(true)
    prismaMock.volunteerAutoAssignRun.findMany.mockResolvedValue([
      { id: 'journal-2', createdCount: 12, deletedCount: 3 },
      { id: 'journal-1', createdCount: 40, deletedCount: 0 },
    ])
    prismaMock.volunteerAutoAssignRun.count.mockResolvedValue(2)
    prismaMock.volunteerAutoAssignRun.findFirst.mockResolvedValue({ id: 'journal-2' })
  })

  it('rend les calculs de cette édition, du plus récent au plus ancien', async () => {
    const reponse: any = await handler(evenement as any)

    const [appel] = prismaMock.volunteerAutoAssignRun.findMany.mock.calls.at(-1)
    expect(appel.where).toEqual({ eventId: 22 })
    expect(appel.orderBy).toEqual({ executedAt: 'desc' })
    expect(reponse.data).toHaveLength(2)
    expect(reponse.pagination.totalCount).toBe(2)
  })

  it('n’embarque pas le détail des affectations', async () => {
    // `createdAssignments` et `deletedAssignments` pèsent plusieurs centaines de kilo-octets par
    // ligne sur une grosse édition, et l'écran n'en affiche que les compteurs.
    await handler(evenement as any)

    const [{ select }] = prismaMock.volunteerAutoAssignRun.findMany.mock.calls.at(-1)
    expect(select.createdAssignments).toBeUndefined()
    expect(select.deletedAssignments).toBeUndefined()
    expect(select.createdCount).toBe(true)
  })

  /**
   * Seul le dernier calcul non annulé peut l'être : défaire par-dessus un autre restaurerait un
   * état que le suivant a déjà modifié. L'écran doit donc n'offrir le bouton que sur cette
   * ligne-là — et le déduire d'une page de résultats serait faux dès la deuxième page.
   */
  it('désigne le seul calcul que l’annulation peut défaire', async () => {
    const reponse: any = await handler(evenement as any)

    expect(prismaMock.volunteerAutoAssignRun.findFirst.mock.calls.at(-1)[0].where).toEqual({
      eventId: 22,
      undoneAt: null,
    })
    expect(reponse.annulableId).toBe('journal-2')
  })

  it('n’en désigne aucun quand tout a déjà été annulé', async () => {
    prismaMock.volunteerAutoAssignRun.findFirst.mockResolvedValue(null)

    const reponse: any = await handler(evenement as any)

    expect(reponse.annulableId).toBeNull()
  })

  it('refuse à qui ne gère pas les bénévoles', async () => {
    mockCanManage.mockResolvedValue(false)

    await expect(handler(evenement as any)).rejects.toBeDefined()
    expect(prismaMock.volunteerAutoAssignRun.findMany).not.toHaveBeenCalled()
  })
})
