import { describe, it, expect, beforeEach, vi } from 'vitest'

const mockRequireAccess = vi.hoisted(() => vi.fn())

vi.mock('#server/volunteers/ports/registry', () => ({
  useVolunteerPorts: () => ({ organizers: { requireManagementAccess: mockRequireAccess } }),
}))

// L'authentification est vérifiée ailleurs : ici on éprouve la répétition des créneaux.
vi.mock('#server/utils/auth-utils', () => ({
  requireAuth: () => ({ id: 1, pseudo: 'orga' }),
}))

import handler from '../../../../../../../layers/volunteers/server/api/editions/[id]/volunteer-time-slots/index.post'

const prismaMock = (globalThis as any).prisma

/** Édition du vendredi 2 au dimanche 4 octobre, montage dès le mercredi 30 septembre. */
const evenement = {
  startDate: new Date('2026-10-02T08:00:00.000Z'),
  endDate: new Date('2026-10-04T16:00:00.000Z'),
  volunteerSettings: {
    setupStartDate: new Date('2026-09-30T08:00:00.000Z'),
    teardownEndDate: new Date('2026-10-05T18:00:00.000Z'),
  },
}

// Sans montage, la borne de début est celle de l'événement : on la place au petit matin pour
// que le créneau de 9 h y tienne, sans quoi la validation de période le rejetterait — à raison.
const evenementSansMontage = {
  startDate: new Date('2026-10-02T00:00:00.000Z'),
  endDate: evenement.endDate,
  volunteerSettings: { setupStartDate: null, teardownEndDate: null },
}

const creneauCree = (i: number) => ({
  id: `slot-${i}`,
  title: 'Accueil',
  description: null,
  startDateTime: new Date('2026-10-02T07:00:00.000Z'),
  endDateTime: new Date('2026-10-02T10:00:00.000Z'),
  teamId: null,
  team: null,
  maxVolunteers: 2,
  assignments: [],
  _count: { assignments: 0 },
})

const corps = (recurrence?: string) => ({
  title: 'Accueil',
  startDateTime: '2026-10-02T07:00:00.000Z',
  endDateTime: '2026-10-02T10:00:00.000Z',
  maxVolunteers: 2,
  ...(recurrence ? { recurrence } : {}),
})

/** Dates transmises à Prisma, dans l'ordre de création. */
const datesEcrites = () =>
  prismaMock.volunteerTimeSlot.create.mock.calls.map((c: any) =>
    new Date(c[0].data.startDateTime).toISOString()
  )

describe('POST /api/editions/[id]/volunteer-time-slots — récurrence', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAccess.mockResolvedValue({ id: 1 })
    prismaMock.event.findUnique.mockResolvedValue(evenement)
    prismaMock.edition.findUnique.mockResolvedValue({ timezone: 'Europe/Paris' })
    prismaMock.volunteerTimeSlot.create.mockImplementation(async () => creneauCree(1))
    prismaMock.$transaction.mockImplementation(async (ops: any) => Promise.all(ops))
    global.readValidatedBody = vi.fn()
    global.setResponseStatus = vi.fn()
  })

  const envoyer = (body: Record<string, unknown>) => {
    global.readValidatedBody = vi.fn().mockImplementation((_e, parse) => parse(body))
    return handler({ context: { params: { id: '22' }, user: { id: 1 } } } as any)
  }

  it("crée un seul créneau quand aucune récurrence n'est demandée", async () => {
    const result = await envoyer(corps())

    expect(result.data.timeSlots).toHaveLength(1)
    expect(prismaMock.volunteerTimeSlot.create).toHaveBeenCalledTimes(1)
  })

  it("répète le créneau sur chaque journée de l'événement", async () => {
    await envoyer(corps('EVENEMENT'))

    // 2, 3 et 4 octobre, à 9 h heure de Paris
    expect(datesEcrites()).toEqual([
      '2026-10-02T07:00:00.000Z',
      '2026-10-03T07:00:00.000Z',
      '2026-10-04T07:00:00.000Z',
    ])
  })

  it('couvre le montage et le démontage quand on les demande', async () => {
    await envoyer(corps('AVEC_MONTAGE'))

    // du 30 septembre au 5 octobre
    expect(datesEcrites()).toHaveLength(6)
    expect(datesEcrites()[0]).toBe('2026-09-30T07:00:00.000Z')
    expect(datesEcrites()[5]).toBe('2026-10-05T07:00:00.000Z')
  })

  it("retombe sur l'événement quand montage et démontage ne sont pas déclarés", async () => {
    prismaMock.event.findUnique.mockResolvedValue(evenementSansMontage)

    await envoyer(corps('AVEC_MONTAGE'))

    expect(datesEcrites()).toHaveLength(3)
  })

  it('écrit toutes les répétitions dans une seule transaction', async () => {
    // Une répétition à moitié écrite laisserait un planning à démêler à la main
    await envoyer(corps('EVENEMENT'))

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1)
  })

  it('refuse une récurrence inconnue', async () => {
    await expect(envoyer(corps('CHAQUE_SEMAINE'))).rejects.toBeDefined()
    expect(prismaMock.volunteerTimeSlot.create).not.toHaveBeenCalled()
  })
})
