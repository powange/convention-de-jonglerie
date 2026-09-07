import { describe, it, expect, beforeEach, vi } from 'vitest'

const mockRequireManagement = vi.hoisted(() => vi.fn())

vi.mock('#server/utils/api-helpers', () => ({
  wrapApiHandler: (handler: any) => handler,
  createSuccessResponse: (data: unknown) => ({ success: true, data }),
}))

vi.mock('#server/utils/validation-helpers', () => ({
  validateEditionId: (event: any) => parseInt(event?.context?.params?.id, 10),
  validateStringId: (event: any, nom: string) => event?.context?.params?.[nom],
  validateResourceId: (event: any, nom: string) => parseInt(event?.context?.params?.[nom], 10),
}))

vi.mock('#server/volunteers/ports/registry', () => ({
  useVolunteerPorts: () => ({ organizers: { requireManagementAccess: mockRequireManagement } }),
}))

import supprimer from '../../../../../../../layers/volunteers/server/api/editions/[id]/volunteer-time-slots/[slotId]/organizer-assignments/[editionOrganizerId].delete'
import affecter from '../../../../../../../layers/volunteers/server/api/editions/[id]/volunteer-time-slots/[slotId]/organizer-assignments.post'
import { global } from '../../../globales-nitro'

const prismaMock = (globalThis as any).prisma

const evenement = {
  context: { params: { id: '22', slotId: 'creneau-1', editionOrganizerId: '7' }, user: { id: 1 } },
}

describe('affectation d’un organisateur à un créneau', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireManagement.mockResolvedValue({ id: 1 })
    prismaMock.eventVolunteerSettings.findUnique.mockResolvedValue({ organizersInTeams: true })
    prismaMock.volunteerTimeSlot.findFirst.mockResolvedValue({
      id: 'creneau-1',
      maxVolunteers: 2,
      _count: { assignments: 0, organizerAssignments: 0 },
    })
    prismaMock.editionOrganizer.findFirst.mockResolvedValue({ id: 7 })
    prismaMock.organizerSlotAssignment.findUnique.mockResolvedValue(null)
    prismaMock.organizerSlotAssignment.create.mockResolvedValue({})
    prismaMock.organizerSlotAssignment.deleteMany.mockResolvedValue({ count: 1 })
  })

  const poster = (body: unknown) => {
    global.readBody = vi.fn().mockResolvedValue(body)
    return affecter(evenement as any)
  }

  describe('POST', () => {
    it('affecte l’organisateur au créneau', async () => {
      const res = await poster({ editionOrganizerId: 7 })

      expect(res.success).toBe(true)
      expect(prismaMock.organizerSlotAssignment.create).toHaveBeenCalledWith({
        data: { editionOrganizerId: 7, timeSlotId: 'creneau-1' },
      })
    })

    /**
     * Un organisateur occupe une place : `maxVolunteers` dit combien de personnes le créneau
     * demande, sans distinguer les titres. Sur un créneau à deux places déjà pourvues, il n'y a
     * plus de poste, pour personne.
     */
    it('refuse un organisateur sur un créneau déjà complet', async () => {
      prismaMock.volunteerTimeSlot.findFirst.mockResolvedValue({
        id: 'creneau-1',
        maxVolunteers: 2,
        _count: { assignments: 2, organizerAssignments: 0 },
      })

      await expect(poster({ editionOrganizerId: 7 })).rejects.toBeDefined()
      expect(prismaMock.organizerSlotAssignment.create).not.toHaveBeenCalled()
    })

    it('compte les organisateurs déjà présents dans les places prises', async () => {
      // Deux organisateurs sur un créneau à deux places le remplissent aussi bien que deux
      // bénévoles : ne compter que ces derniers laisserait s'en ajouter un troisième.
      prismaMock.volunteerTimeSlot.findFirst.mockResolvedValue({
        id: 'creneau-1',
        maxVolunteers: 2,
        _count: { assignments: 0, organizerAssignments: 2 },
      })

      await expect(poster({ editionOrganizerId: 7 })).rejects.toBeDefined()
      expect(prismaMock.organizerSlotAssignment.create).not.toHaveBeenCalled()
    })

    it('accepte tant qu’il reste une place', async () => {
      prismaMock.volunteerTimeSlot.findFirst.mockResolvedValue({
        id: 'creneau-1',
        maxVolunteers: 2,
        _count: { assignments: 1, organizerAssignments: 0 },
      })

      await poster({ editionOrganizerId: 7 })

      expect(prismaMock.organizerSlotAssignment.create).toHaveBeenCalled()
    })

    it("refuse quand l'édition n'a pas ouvert l'option", async () => {
      prismaMock.eventVolunteerSettings.findUnique.mockResolvedValue({ organizersInTeams: false })

      await expect(poster({ editionOrganizerId: 7 })).rejects.toBeDefined()
      expect(prismaMock.organizerSlotAssignment.create).not.toHaveBeenCalled()
    })

    it("refuse un créneau étranger à l'édition", async () => {
      prismaMock.volunteerTimeSlot.findFirst.mockResolvedValue(null)

      await expect(poster({ editionOrganizerId: 7 })).rejects.toBeDefined()
      expect(prismaMock.organizerSlotAssignment.create).not.toHaveBeenCalled()
    })

    it("refuse un organisateur étranger à l'édition", async () => {
      prismaMock.editionOrganizer.findFirst.mockResolvedValue(null)

      await expect(poster({ editionOrganizerId: 7 })).rejects.toBeDefined()
      expect(prismaMock.organizerSlotAssignment.create).not.toHaveBeenCalled()
    })

    it('refuse une affectation en double', async () => {
      prismaMock.organizerSlotAssignment.findUnique.mockResolvedValue({ timeSlotId: 'creneau-1' })

      await expect(poster({ editionOrganizerId: 7 })).rejects.toBeDefined()
      expect(prismaMock.organizerSlotAssignment.create).not.toHaveBeenCalled()
    })

    it('refuse un contributeur sans droit sur les bénévoles', async () => {
      mockRequireManagement.mockRejectedValue(new Error('403'))

      await expect(poster({ editionOrganizerId: 7 })).rejects.toBeDefined()
      expect(prismaMock.organizerSlotAssignment.create).not.toHaveBeenCalled()
    })
  })

  describe('DELETE', () => {
    it("retire l'affectation", async () => {
      const res = await supprimer(evenement as any)

      expect(res.success).toBe(true)
      expect(prismaMock.organizerSlotAssignment.deleteMany).toHaveBeenCalledWith({
        where: { editionOrganizerId: 7, timeSlotId: 'creneau-1' },
      })
    })

    /**
     * Refermer l'option ne doit pas enfermer des affectations qu'on ne pourrait plus défaire :
     * retirer reste possible, ajouter non.
     */
    it("retire même quand l'option est refermée", async () => {
      prismaMock.eventVolunteerSettings.findUnique.mockResolvedValue({ organizersInTeams: false })

      await expect(supprimer(evenement as any)).resolves.toBeDefined()
    })

    it("refuse un créneau étranger à l'édition", async () => {
      prismaMock.volunteerTimeSlot.findFirst.mockResolvedValue(null)

      await expect(supprimer(evenement as any)).rejects.toBeDefined()
      expect(prismaMock.organizerSlotAssignment.deleteMany).not.toHaveBeenCalled()
    })

    it('signale une affectation inexistante', async () => {
      prismaMock.organizerSlotAssignment.deleteMany.mockResolvedValue({ count: 0 })

      await expect(supprimer(evenement as any)).rejects.toBeDefined()
    })
  })
})
