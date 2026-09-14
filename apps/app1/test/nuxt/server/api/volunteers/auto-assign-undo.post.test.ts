import { describe, it, expect, beforeEach, vi } from 'vitest'

const mockCanManage = vi.hoisted(() => vi.fn())

vi.mock('#server/utils/api-helpers', () => ({
  wrapApiHandler: (handler: any) => handler,
  createSuccessResponse: (data: unknown) => ({ success: true, data }),
}))

vi.mock('#server/utils/validation-helpers', () => ({
  validateEditionId: (event: any) => parseInt(event?.context?.params?.id, 10),
}))

vi.mock('#server/utils/auth-utils', () => ({
  requireAuth: (event: any) => event?.context?.user,
}))

vi.mock('#server/volunteers/ports/registry', () => ({
  useVolunteerPorts: () => ({ organizers: { canManage: mockCanManage } }),
}))

import handler from '../../../../../../../layers/volunteers/server/api/editions/[id]/volunteers/auto-assign/undo.post'
import { global } from '../../../globales-nitro'

const prismaMock = (globalThis as any).prisma

const evenement = { context: { params: { id: '22' }, user: { id: 7 } } }

const JOURNAL = {
  id: 'journal-1',
  eventId: 22,
  mode: 'replace-all',
  createdAssignments: [{ timeSlotId: 'creneau-a', userId: 10 }],
  deletedAssignments: [
    {
      timeSlotId: 'creneau-b',
      userId: 11,
      source: 'MANUAL',
      assignedById: 3,
      assignedAt: '2026-07-01T10:00:00.000Z',
    },
  ],
  createdTeamLinks: [{ applicationId: 5, teamId: 'cuisine' }],
  deletedTeamLinks: [
    { applicationId: 6, teamId: 'bar', isLeader: false, assignedAt: '2026-07-01T10:00:00.000Z' },
  ],
}

/**
 * Défaire un calcul, ce n'est pas en relancer un autre : on retire ce qu'il a créé et on remet ce
 * qu'il avait effacé, à l'identique — origine et auteur compris.
 */
describe('POST …/volunteers/auto-assign/undo', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCanManage.mockResolvedValue(true)
    prismaMock.volunteerAutoAssignRun.findFirst.mockResolvedValue(JOURNAL)
    prismaMock.volunteerAutoAssignRun.update.mockResolvedValue({})
    prismaMock.volunteerAssignment.deleteMany.mockResolvedValue({ count: 1 })
    prismaMock.volunteerAssignment.createMany.mockResolvedValue({ count: 1 })
    prismaMock.applicationTeamAssignment.deleteMany.mockResolvedValue({ count: 1 })
    prismaMock.applicationTeamAssignment.createMany.mockResolvedValue({ count: 1 })
    global.readBody = vi.fn().mockResolvedValue({})
  })

  it('retire les affectations que le calcul avait créées', async () => {
    await handler(evenement as any)

    expect(prismaMock.volunteerAssignment.deleteMany.mock.calls.at(-1)[0].where.OR).toEqual([
      { timeSlotId: 'creneau-a', userId: 10 },
    ])
  })

  it('remet celles qu’il avait effacées, avec leur origine et leur auteur', async () => {
    // Recréer une affectation manuelle en la marquant AUTO la rendrait effaçable par la relance
    // suivante : l'annulation aurait alors fragilisé ce qu'elle prétendait restaurer.
    await handler(evenement as any)

    const [{ data, skipDuplicates }] = prismaMock.volunteerAssignment.createMany.mock.calls.at(-1)
    expect(skipDuplicates).toBe(true)
    expect(data[0]).toMatchObject({
      timeSlotId: 'creneau-b',
      userId: 11,
      source: 'MANUAL',
      assignedById: 3,
    })
    expect(data[0].assignedAt).toBeInstanceOf(Date)
  })

  it('traite les rattachements d’équipe de la même façon', async () => {
    await handler(evenement as any)

    expect(prismaMock.applicationTeamAssignment.deleteMany.mock.calls.at(-1)[0].where.OR).toEqual([
      { applicationId: 5, teamId: 'cuisine' },
    ])
    const [{ data }] = prismaMock.applicationTeamAssignment.createMany.mock.calls.at(-1)
    expect(data[0]).toMatchObject({ applicationId: 6, teamId: 'bar', isLeader: false })
  })

  it('marque le journal pour qu’il ne soit pas annulé deux fois', async () => {
    await handler(evenement as any)

    const [appel] = prismaMock.volunteerAutoAssignRun.update.mock.calls.at(-1)
    expect(appel.where).toEqual({ id: 'journal-1' })
    expect(appel.data.undoneById).toBe(7)
    expect(appel.data.undoneAt).toBeInstanceOf(Date)
  })

  it('refuse quand un autre calcul a été appliqué depuis', async () => {
    // Entre l'affichage du bouton et le clic, un collègue a pu relancer : annuler « le dernier »
    // ne défait alors pas ce que l'organisateur avait sous les yeux.
    global.readBody = vi.fn().mockResolvedValue({ journalId: 'journal-precedent' })

    await expect(handler(evenement as any)).rejects.toBeDefined()
    expect(prismaMock.volunteerAssignment.deleteMany).not.toHaveBeenCalled()
  })

  it('refuse quand il n’y a rien à annuler', async () => {
    prismaMock.volunteerAutoAssignRun.findFirst.mockResolvedValue(null)

    await expect(handler(evenement as any)).rejects.toBeDefined()
  })

  it('refuse à qui ne gère pas les bénévoles', async () => {
    mockCanManage.mockResolvedValue(false)

    await expect(handler(evenement as any)).rejects.toBeDefined()
    expect(prismaMock.volunteerAutoAssignRun.findFirst).not.toHaveBeenCalled()
  })

  it('ne cherche que les journaux non annulés de cette édition', async () => {
    await handler(evenement as any)

    expect(prismaMock.volunteerAutoAssignRun.findFirst.mock.calls.at(-1)[0].where).toEqual({
      eventId: 22,
      undoneAt: null,
    })
  })
})
