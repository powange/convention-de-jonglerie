import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('#server/utils/api-helpers', () => ({
  wrapApiHandler: (handler: any) => handler,
  createSuccessResponse: (data: unknown) => ({ success: true, data }),
}))

vi.mock('#server/utils/validation-helpers', () => ({
  validateEditionId: (event: any) => parseInt(event?.context?.params?.id, 10),
}))

import handler from '../../../../../../../layers/volunteers/server/api/editions/[id]/volunteers/my-slots.get'

const prismaMock = (globalThis as any).prisma

const evenement = { context: { params: { id: '22' }, user: { id: 42 } } }

const creneau = (id: string, debut: string) => ({
  id,
  title: `Créneau ${id}`,
  startDateTime: new Date(debut),
  endDateTime: new Date(debut),
  delayMinutes: null,
  team: { id: 'accueil', name: 'Accueil', color: '#3b82f6' },
  assignments: [],
})

/**
 * `my-application` part d'une candidature, et un organisateur rattaché n'en a pas : il voyait
 * ses créneaux affectés par les responsables du planning sans jamais pouvoir les consulter.
 */
describe('GET /api/editions/[id]/volunteers/my-slots', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.volunteerAssignment.findMany.mockResolvedValue([
      {
        id: 'aff-1',
        assignedAt: new Date('2026-01-01'),
        timeSlot: creneau('b', '2026-10-02T18:00:00Z'),
      },
    ])
    prismaMock.organizerSlotAssignment.findMany.mockResolvedValue([
      { assignedAt: new Date('2026-01-02'), timeSlot: creneau('a', '2026-10-02T09:00:00Z') },
    ])
  })

  it('réunit les créneaux tenus comme bénévole et comme organisateur', async () => {
    const res = await handler(evenement as any)

    expect(res.data.slots.map((creneau: any) => creneau.timeSlot.id)).toEqual(['a', 'b'])
  })

  it('les rend par ordre chronologique, quelle que soit leur origine', async () => {
    // Les deux listes arrivent séparément : sans tri, l'affichage sautait de l'une à l'autre.
    const res = await handler(evenement as any)

    expect(res.data.slots[0].timeSlot.id).toBe('a')
  })

  it("marque l'origine de chaque créneau", async () => {
    // Un créneau de bénévole peut être échangé, celui d'un organisateur non : les distinguer
    // n'est pas cosmétique.
    const res = await handler(evenement as any)

    expect(res.data.slots.map((creneau: any) => creneau.origine)).toEqual([
      'ORGANIZER',
      'VOLUNTEER',
    ])
  })

  it('rend une liste vide pour qui ne tient aucun créneau', async () => {
    prismaMock.volunteerAssignment.findMany.mockResolvedValue([])
    prismaMock.organizerSlotAssignment.findMany.mockResolvedValue([])

    const res = await handler(evenement as any)

    expect(res.data.slots).toEqual([])
  })

  it("ne lit que les rattachements d'organisateur de cette édition", async () => {
    await handler(evenement as any)

    expect(prismaMock.organizerSlotAssignment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          timeSlot: { eventId: 22 },
          editionOrganizer: { editionId: 22, organizer: { userId: 42 } },
        },
      })
    )
  })
})
