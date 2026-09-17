import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock des utilitaires - DOIT être avant les imports
vi.mock('../../../../../server/utils/permissions/volunteer-permissions', () => ({
  requireVolunteerPlanningAccess: vi.fn(),
  isAcceptedVolunteer: vi.fn(),
}))

// L'endpoint demande désormais le droit de gestion explicitement, au lieu de le déduire de
// « n'est pas bénévole accepté » — un raisonnement qui refusait son propre planning à un
// administrateur inscrit comme bénévole.
vi.mock('../../../../../server/utils/organizer-management', () => ({
  canManageEditionVolunteers: vi.fn(async () => false),
}))

vi.mock('../../../../../server/utils/editions/volunteers/responsables-equipe', () => ({
  equipesDontIlEstResponsable: vi.fn(async () => []),
  // L'appartenance décide de ce qu'on voit NOMMÉMENT ; la responsabilité, de QUAND.
  equipesDontIlEstMembre: vi.fn(async () => []),
}))

import {
  requireVolunteerPlanningAccess,
  isAcceptedVolunteer,
} from '#server/utils/permissions/volunteer-permissions'
import { canManageEditionVolunteers } from '#server/utils/organizer-management'
import handler from '../../../../../../../layers/volunteers/server/api/editions/[id]/volunteer-time-slots/index.get'

// Utiliser le mock global de Prisma défini dans test/setup-common.ts
const prismaMock = (globalThis as any).prisma

const mockRequirePlanningAccess = requireVolunteerPlanningAccess as ReturnType<typeof vi.fn>
const mockIsAcceptedVolunteer = isAcceptedVolunteer as ReturnType<typeof vi.fn>
const mockPeutGerer = canManageEditionVolunteers as ReturnType<typeof vi.fn>

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
    mockPeutGerer.mockReset()
    mockPeutGerer.mockResolvedValue(false)
    prismaMock.volunteerTimeSlot.findMany.mockReset()
    // Un bénévole accepté ne voit le planning que s'il est publié. Les éditions existantes le
    // sont ; ces cas décrivent donc bien la situation courante.
    prismaMock.eventVolunteerSettings.findUnique.mockResolvedValue({ planningPublished: true })
  })

  it('retourne les créneaux avec delayMinutes', async () => {
    mockRequirePlanningAccess.mockResolvedValue({ id: 10 })
    mockIsAcceptedVolunteer.mockResolvedValue(true)

    const mockTimeSlots = [
      {
        id: 'slot1',
        eventId: 1,
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
        organizerAssignments: [],
        _count: {
          assignments: 1,
        },
      },
      {
        id: 'slot2',
        eventId: 1,
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
        organizerAssignments: [],
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
      where: { eventId: 1 },
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
                pronouns: true,
                email: true,
                emailHash: true,
                profilePicture: true,
                updatedAt: true,
              },
            },
          },
        },
        organizerAssignments: {
          select: {
            editionOrganizer: {
              select: {
                id: true,
                organizer: {
                  select: {
                    user: {
                      select: {
                        id: true,
                        pseudo: true,
                        nom: true,
                        prenom: true,
                        pronouns: true,
                        emailHash: true,
                        profilePicture: true,
                        updatedAt: true,
                      },
                    },
                  },
                },
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
    // Un VRAI gestionnaire, et non « pas un bénévole » : la confusion entre les deux est
    // précisément le défaut que ce point d'API a déjà corrigé une fois. Depuis que le détail
    // nominatif tient à l'appartenance aux équipes, elle ne produit plus du tout le même
    // résultat — un organisateur sans équipe ne voit désormais que des pseudos.
    mockPeutGerer.mockResolvedValue(true)
    mockIsAcceptedVolunteer.mockResolvedValue(false)

    const mockTimeSlots = [
      {
        id: 'slot1',
        eventId: 1,
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
        organizerAssignments: [],
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
        eventId: 1,
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
        organizerAssignments: [],
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

  it('donne les emails en clair à un gestionnaire QUI EST AUSSI bénévole accepté', async () => {
    // ⚠️ Même défaut que sur la garde du planning : « n'est pas bénévole accepté » tenait lieu de
    // « est gestionnaire ». Un administrateur inscrit comme bénévole sur son édition voyait les
    // adresses masquées, alors qu'il y a accès partout ailleurs.
    mockRequirePlanningAccess.mockResolvedValue({ id: 10 })
    mockIsAcceptedVolunteer.mockResolvedValue(true)
    mockPeutGerer.mockResolvedValue(true)

    prismaMock.volunteerTimeSlot.findMany.mockResolvedValue([
      {
        id: 'slot1',
        eventId: 1,
        teamId: null,
        title: 'Accueil',
        description: null,
        startDateTime: new Date('2024-06-01T09:00:00Z'),
        endDateTime: new Date('2024-06-01T12:00:00Z'),
        maxVolunteers: 2,
        delayMinutes: null,
        team: null,
        assignments: [
          {
            id: 'a1',
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
        organizerAssignments: [],
        _count: { assignments: 1 },
      },
    ] as any)

    const res = await handler(baseEvent as any)

    expect(res[0].assignments[0].user.email).toBe('john@example.com')
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
        eventId: 1,
        teamId: 'team1',
        title: 'Créneau 1',
        description: null,
        startDateTime: new Date('2024-06-01T09:00:00Z'),
        endDateTime: new Date('2024-06-01T12:00:00Z'),
        maxVolunteers: 2,
        delayMinutes: 5,
        team: null,
        assignments: [],
        organizerAssignments: [],
        _count: { assignments: 0 },
      },
      {
        id: 'slot2',
        eventId: 1,
        teamId: 'team2',
        title: 'Créneau 2',
        description: null,
        startDateTime: new Date('2024-06-02T14:00:00Z'),
        endDateTime: new Date('2024-06-02T18:00:00Z'),
        maxVolunteers: 3,
        delayMinutes: 10,
        team: null,
        assignments: [],
        organizerAssignments: [],
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

  /**
   * Le planning affiche les organisateurs affectés à même le créneau : la requête les lit, et
   * la réponse doit les porter. C'est exactement le défaut qui avait vidé la colonne « Équipes »
   * de la page des organisateurs — une requête juste dont la projection laissait le champ de côté.
   */
  it('expose les organisateurs affectés à côté du compte de bénévoles', async () => {
    mockRequirePlanningAccess.mockResolvedValue({ id: 10 })
    mockPeutGerer.mockResolvedValue(true)
    mockIsAcceptedVolunteer.mockResolvedValue(false)

    prismaMock.volunteerTimeSlot.findMany.mockResolvedValue([
      {
        id: 'slot1',
        eventId: 1,
        teamId: 'team1',
        title: 'Accueil',
        description: null,
        startDateTime: new Date('2024-06-01T09:00:00Z'),
        endDateTime: new Date('2024-06-01T12:00:00Z'),
        maxVolunteers: 2,
        delayMinutes: null,
        team: { id: 'team1', name: 'Accueil', color: '#3b82f6' },
        assignments: [],
        organizerAssignments: [
          {
            editionOrganizer: {
              id: 7,
              organizer: { user: { id: 70, pseudo: 'orga', nom: 'Dupont', prenom: 'Jean' } },
            },
          },
        ],
        _count: { assignments: 0 },
      },
    ] as any)

    const res = await handler(baseEvent as any)

    expect(res[0].organizerAssignments).toEqual([
      { editionOrganizerId: 7, user: { id: 70, pseudo: 'orga', nom: 'Dupont', prenom: 'Jean' } },
    ])
    // `assignedVolunteers` reste le seul compte des bénévoles ; c'est le client qui additionne
    // les deux pour connaître les places occupées.
    expect(res[0].assignedVolunteers).toBe(0)
  })
})
