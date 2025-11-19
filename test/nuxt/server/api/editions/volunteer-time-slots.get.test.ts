import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock des utilitaires - DOIT être avant les imports
vi.mock('../../../../../server/utils/permissions/volunteer-permissions', () => ({
  requireVolunteerPlanningAccess: vi.fn(),
  isAcceptedVolunteer: vi.fn(),
}))

import {
  requireVolunteerPlanningAccess,
  isAcceptedVolunteer,
} from '@@/server/utils/permissions/volunteer-permissions'
import handler from '../../../../../server/api/editions/[id]/volunteer-time-slots/index.get'

// Utiliser le mock global de Prisma défini dans test/setup-common.ts
const prismaMock = (globalThis as any).prisma

const mockRequirePlanningAccess = requireVolunteerPlanningAccess as ReturnType<typeof vi.fn>
const mockIsAcceptedVolunteer = isAcceptedVolunteer as ReturnType<typeof vi.fn>

const baseEvent = {
  context: {
    params: { id: '1' },
    user: { id: 10 },
  },
}

describe('/api/editions/[id]/volunteer-time-slots GET', () => {
  beforeEach(() => {
    mockRequirePlanningAccess.mockReset()
    mockIsAcceptedVolunteer.mockReset()
    prismaMock.volunteerTimeSlot.findMany.mockReset()
  })

  it('retourne les créneaux avec delayMinutes', async () => {
    mockRequirePlanningAccess.mockResolvedValue({ id: 10 })
    mockIsAcceptedVolunteer.mockResolvedValue(true)

    const mockTimeSlots = [
      {
        id: 'slot1',
        editionId: 1,
        teamId: 'team1',
        title: 'Accueil',
        description: 'Accueil des participants',
        startDateTime: new Date('2024-06-01T09:00:00Z'),
        endDateTime: new Date('2024-06-01T12:00:00Z'),
        maxVolunteers: 3,
        delayMinutes: 15,
        team: {
          id: 'team1',
          name: 'Équipe Accueil',
          color: '#3b82f6',
        },
        assignments: [
          {
            id: 'assign1',
            user: {
              id: 10,
              pseudo: 'John',
              nom: 'Doe',
              prenom: 'John',
              email: 'john@example.com',
              emailHash: 'hash-john',
              profilePicture: null,
              updatedAt: new Date('2024-01-01'),
            },
          },
        ],
        _count: {
          assignments: 1,
        },
      },
      {
        id: 'slot2',
        editionId: 1,
        teamId: 'team2',
        title: 'Bar',
        description: 'Service au bar',
        startDateTime: new Date('2024-06-01T14:00:00Z'),
        endDateTime: new Date('2024-06-01T18:00:00Z'),
        maxVolunteers: 2,
        delayMinutes: null,
        team: {
          id: 'team2',
          name: 'Équipe Bar',
          color: '#ef4444',
        },
        assignments: [],
        _count: {
          assignments: 0,
        },
      },
    ]

    prismaMock.volunteerTimeSlot.findMany.mockResolvedValue(mockTimeSlots as any)

    const res = await handler(baseEvent as any)

    expect(res).toHaveLength(2)

    // Vérifier que delayMinutes est bien retourné
    expect(res[0].delayMinutes).toBe(15)
    expect(res[1].delayMinutes).toBeNull()

    // Vérifier les autres champs
    expect(res[0].id).toBe('slot1')
    expect(res[0].title).toBe('Accueil')
    expect(res[0].maxVolunteers).toBe(3)
    expect(res[0].assignedVolunteers).toBe(1)
    expect(res[0].team).toEqual({
      id: 'team1',
      name: 'Équipe Accueil',
      color: '#3b82f6',
    })

    expect(prismaMock.volunteerTimeSlot.findMany).toHaveBeenCalledWith({
      where: { editionId: 1 },
      include: {
        team: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
        assignments: {
          include: {
            user: {
              select: {
                id: true,
                pseudo: true,
                nom: true,
                prenom: true,
                email: true,
                emailHash: true,
                profilePicture: true,
                updatedAt: true,
              },
            },
          },
        },
        _count: {
          select: {
            assignments: true,
          },
        },
      },
      orderBy: {
        startDateTime: 'asc',
      },
    })
  })

  it('retourne les créneaux pour un gestionnaire avec emails en clair', async () => {
    mockRequirePlanningAccess.mockResolvedValue({ id: 99 })
    mockIsAcceptedVolunteer.mockResolvedValue(false) // Pas un bénévole, donc un gestionnaire

    const mockTimeSlots = [
      {
        id: 'slot1',
        editionId: 1,
        teamId: 'team1',
        title: 'Accueil',
        description: 'Accueil des participants',
        startDateTime: new Date('2024-06-01T09:00:00Z'),
        endDateTime: new Date('2024-06-01T12:00:00Z'),
        maxVolunteers: 3,
        delayMinutes: 10,
        team: {
          id: 'team1',
          name: 'Équipe Accueil',
          color: '#3b82f6',
        },
        assignments: [
          {
            id: 'assign1',
            user: {
              id: 10,
              pseudo: 'John',
              nom: 'Doe',
              prenom: 'John',
              email: 'john@example.com',
              emailHash: 'hash-john',
              profilePicture: null,
              updatedAt: new Date('2024-01-01'),
            },
          },
        ],
        _count: {
          assignments: 1,
        },
      },
    ]

    prismaMock.volunteerTimeSlot.findMany.mockResolvedValue(mockTimeSlots as any)

    const res = await handler({
      ...baseEvent,
      context: { ...baseEvent.context, user: { id: 99 } },
    } as any)

    expect(res).toHaveLength(1)
    expect(res[0].delayMinutes).toBe(10)
    // Les gestionnaires ont accès à l'email en clair ET au emailHash
    expect(res[0].assignments[0].user.email).toBe('john@example.com')
    expect(res[0].assignments[0].user.emailHash).toBe('hash-john')
  })

  it('retourne les créneaux pour un bénévole sans emails en clair', async () => {
    mockRequirePlanningAccess.mockResolvedValue({ id: 10 })
    mockIsAcceptedVolunteer.mockResolvedValue(true) // Bénévole accepté

    const mockTimeSlots = [
      {
        id: 'slot1',
        editionId: 1,
        teamId: 'team1',
        title: 'Accueil',
        description: 'Accueil des participants',
        startDateTime: new Date('2024-06-01T09:00:00Z'),
        endDateTime: new Date('2024-06-01T12:00:00Z'),
        maxVolunteers: 3,
        delayMinutes: 20,
        team: {
          id: 'team1',
          name: 'Équipe Accueil',
          color: '#3b82f6',
        },
        assignments: [
          {
            id: 'assign1',
            user: {
              id: 10,
              pseudo: 'John',
              nom: 'Doe',
              prenom: 'John',
              email: 'john@example.com',
              emailHash: 'hash-john',
              profilePicture: null,
              updatedAt: new Date('2024-01-01'),
            },
          },
        ],
        _count: {
          assignments: 1,
        },
      },
    ]

    prismaMock.volunteerTimeSlot.findMany.mockResolvedValue(mockTimeSlots as any)

    const res = await handler(baseEvent as any)

    expect(res).toHaveLength(1)
    expect(res[0].delayMinutes).toBe(20)
    // Les bénévoles n'ont pas accès à l'email en clair mais ont le emailHash
    expect(res[0].assignments[0].user.email).toBeUndefined()
    expect(res[0].assignments[0].user.emailHash).toBe('hash-john')
  })

  it('rejette utilisateur non authentifié', async () => {
    mockRequirePlanningAccess.mockRejectedValue(new Error('Unauthorized'))

    await expect(
      handler({ ...baseEvent, context: { ...baseEvent.context, user: null } } as any)
    ).rejects.toThrow()
  })

  it('rejette si pas de permission', async () => {
    mockRequirePlanningAccess.mockRejectedValue(new Error('Accès refusé'))

    await expect(handler(baseEvent as any)).rejects.toThrow()
  })

  it('valide id invalide', async () => {
    const ev = { ...baseEvent, context: { ...baseEvent.context, params: { id: '0' } } }
    await expect(handler(ev as any)).rejects.toThrow('ID')
  })

  it('retourne tableau vide si aucun créneau', async () => {
    mockRequirePlanningAccess.mockResolvedValue({ id: 10 })
    mockIsAcceptedVolunteer.mockResolvedValue(true)
    prismaMock.volunteerTimeSlot.findMany.mockResolvedValue([])

    const res = await handler(baseEvent as any)

    expect(res).toEqual([])
  })

  it('retourne les créneaux triés par date de début', async () => {
    mockRequirePlanningAccess.mockResolvedValue({ id: 10 })
    mockIsAcceptedVolunteer.mockResolvedValue(true)

    const mockTimeSlots = [
      {
        id: 'slot1',
        editionId: 1,
        teamId: 'team1',
        title: 'Créneau 1',
        description: null,
        startDateTime: new Date('2024-06-01T09:00:00Z'),
        endDateTime: new Date('2024-06-01T12:00:00Z'),
        maxVolunteers: 2,
        delayMinutes: 5,
        team: null,
        assignments: [],
        _count: { assignments: 0 },
      },
      {
        id: 'slot2',
        editionId: 1,
        teamId: 'team2',
        title: 'Créneau 2',
        description: null,
        startDateTime: new Date('2024-06-02T14:00:00Z'),
        endDateTime: new Date('2024-06-02T18:00:00Z'),
        maxVolunteers: 3,
        delayMinutes: 10,
        team: null,
        assignments: [],
        _count: { assignments: 0 },
      },
    ]

    prismaMock.volunteerTimeSlot.findMany.mockResolvedValue(mockTimeSlots as any)

    const res = await handler(baseEvent as any)

    expect(res).toHaveLength(2)
    expect(res[0].start).toBe('2024-06-01T09:00:00.000Z')
    expect(res[1].start).toBe('2024-06-02T14:00:00.000Z')
    expect(res[0].delayMinutes).toBe(5)
    expect(res[1].delayMinutes).toBe(10)
  })
})
