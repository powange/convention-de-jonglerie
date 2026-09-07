import { describe, it, expect, beforeEach, vi } from 'vitest'

const mockRequireManagement = vi.hoisted(() => vi.fn())

vi.mock('#server/utils/api-helpers', () => ({
  wrapApiHandler: (handler: any) => handler,
  createSuccessResponse: (data: unknown) => ({ success: true, data }),
}))

vi.mock('#server/utils/validation-helpers', () => ({
  validateEditionId: (event: any) => parseInt(event?.context?.params?.id, 10),
  validateStringId: (event: any, nom: string) => event?.context?.params?.[nom],
}))

vi.mock('#server/volunteers/ports/registry', () => ({
  useVolunteerPorts: () => ({ organizers: { requireManagementAccess: mockRequireManagement } }),
}))

import handler from '../../../../../../../layers/volunteers/server/api/editions/[id]/volunteer-time-slots/[slotId]/assignments.post'
import { global } from '../../../globales-nitro'

const prismaMock = (globalThis as any).prisma

const evenement = {
  context: { params: { id: '22', slotId: 'creneau-1' }, user: { id: 1 } },
}

const creneau = (assignments: number, organizerAssignments: number, maxVolunteers = 2) => ({
  id: 'creneau-1',
  maxVolunteers,
  _count: { assignments, organizerAssignments },
})

/**
 * Un créneau a des **places**, et un organisateur en occupe une comme un bénévole. Ne compter
 * que les bénévoles laissait s'ajouter quelqu'un de trop sur un créneau déjà pourvu.
 */
describe('POST …/volunteer-time-slots/[slotId]/assignments — capacité', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireManagement.mockResolvedValue({ id: 1 })
    prismaMock.volunteerTimeSlot.findFirst.mockResolvedValue(creneau(0, 0))
    prismaMock.editionVolunteerApplication.findFirst.mockResolvedValue({ id: 5 })
    prismaMock.volunteerAssignment.findUnique.mockResolvedValue(null)
    prismaMock.volunteerAssignment.create.mockResolvedValue({ id: 'aff-1' })
    global.readValidatedBody = vi.fn(async (_e: any, parse: any) => parse({ userId: 10 }))
  })

  it('affecte un bénévole quand il reste une place', async () => {
    await handler(evenement as any)

    expect(prismaMock.volunteerAssignment.create).toHaveBeenCalled()
  })

  it('refuse quand les places sont prises par des bénévoles', async () => {
    prismaMock.volunteerTimeSlot.findFirst.mockResolvedValue(creneau(2, 0))

    await expect(handler(evenement as any)).rejects.toBeDefined()
    expect(prismaMock.volunteerAssignment.create).not.toHaveBeenCalled()
  })

  it('refuse quand un organisateur occupe la dernière place', async () => {
    // Le cas qui manquait : un créneau à deux places, un bénévole et un organisateur, était
    // encore vu comme à moitié libre.
    prismaMock.volunteerTimeSlot.findFirst.mockResolvedValue(creneau(1, 1))

    await expect(handler(evenement as any)).rejects.toBeDefined()
    expect(prismaMock.volunteerAssignment.create).not.toHaveBeenCalled()
  })

  it('refuse quand les places sont prises par des organisateurs seuls', async () => {
    prismaMock.volunteerTimeSlot.findFirst.mockResolvedValue(creneau(0, 2))

    await expect(handler(evenement as any)).rejects.toBeDefined()
    expect(prismaMock.volunteerAssignment.create).not.toHaveBeenCalled()
  })
})
