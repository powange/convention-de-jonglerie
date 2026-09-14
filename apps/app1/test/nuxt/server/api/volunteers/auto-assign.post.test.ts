import { describe, it, expect, beforeEach, vi } from 'vitest'

const mockCanManage = vi.hoisted(() => vi.fn())
const mockGetShowSchedule = vi.hoisted(() => vi.fn())

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

vi.mock('#server/utils/prisma-select-helpers', () => ({
  userWithNameSelect: { id: true, pseudo: true, nom: true, prenom: true },
}))

vi.mock('#server/volunteers/ports/registry', () => ({
  useVolunteerPorts: () => ({
    organizers: { canManage: mockCanManage },
    artists: { getShowSchedule: mockGetShowSchedule },
  }),
}))

import handler from '../../../../../../../layers/volunteers/server/api/editions/[id]/volunteers/auto-assign.post'
import { global } from '../../../globales-nitro'

const prismaMock = (globalThis as any).prisma

const evenement = { context: { params: { id: '22' }, user: { id: 1 } } }

const EQUIPES = [
  { id: 'cuisine', name: 'Cuisine', color: '#111111' },
  { id: 'autonome', name: 'Accueil autonome', color: '#222222', isAutonomousTeam: true },
  { id: 'volante', name: 'Volants', color: '#333333', isFloatingTeam: true },
]

const creneau = (id: string, teamId: string | null, heureDebut: number) => ({
  id,
  teamId,
  title: `Créneau ${id}`,
  description: null,
  maxVolunteers: 2,
  startDateTime: new Date(Date.UTC(2026, 7, 1, heureDebut, 0, 0)),
  endDateTime: new Date(Date.UTC(2026, 7, 1, heureDebut + 2, 0, 0)),
  assignments: [] as unknown[],
})

const CRENEAUX = [
  creneau('creneau-cuisine', 'cuisine', 15),
  creneau('creneau-libre', null, 17),
  // Celui-ci porte déjà une affectation posée à la main : c'est elle que la relance effaçait.
  {
    ...creneau('creneau-autonome', 'autonome', 15),
    assignments: [{ id: 'aff-autonome', source: 'MANUAL', user: { id: 42 } }],
  },
  creneau('creneau-volant', 'volante', 17),
]

const benevole = (
  applicationId: number,
  userId: number,
  options: { disponible?: boolean; equipes?: string[] } = {}
) => ({
  id: applicationId,
  user: { id: userId, pseudo: `benevole-${userId}`, nom: null, prenom: null },
  teamAssignments: (options.equipes ?? []).map((teamId) => ({
    teamId,
    team: EQUIPES.find((equipe) => equipe.id === teamId),
  })),
  setupAvailability: false,
  teardownAvailability: false,
  eventAvailability: options.disponible ?? true,
  timePreferences: null,
  teamPreferences: [],
  hasExperience: false,
  experienceDetails: null,
  motivation: '',
  userSnapshotPhone: null,
})

const preparerLesMocks = () => {
  vi.clearAllMocks()
  mockCanManage.mockResolvedValue(true)
  mockGetShowSchedule.mockResolvedValue([])

  prismaMock.event.findUnique.mockResolvedValue({
    id: 22,
    startDate: new Date(Date.UTC(2026, 7, 1, 14, 0, 0)),
    endDate: new Date(Date.UTC(2026, 7, 2, 23, 0, 0)),
  })
  prismaMock.editionVolunteerApplication.findMany.mockResolvedValue([benevole(5, 10)])
  prismaMock.volunteerTimeSlot.findMany.mockResolvedValue(CRENEAUX)
  prismaMock.volunteerTeam.findMany.mockResolvedValue(EQUIPES)

  prismaMock.volunteerAssignment.deleteMany.mockResolvedValue({ count: 0 })
  prismaMock.volunteerAssignment.findFirst.mockResolvedValue(null)
  prismaMock.volunteerAssignment.create.mockResolvedValue({})
  prismaMock.applicationTeamAssignment.deleteMany.mockResolvedValue({ count: 0 })
  prismaMock.applicationTeamAssignment.createMany.mockResolvedValue({ count: 0 })
}

const appliquer = (existingAssignmentsMode: string) => {
  global.readBody = vi.fn().mockResolvedValue({
    applyAssignments: true,
    constraints: { existingAssignmentsMode },
  })
  return handler(evenement as any)
}

const dernierEffacement = (modele: 'volunteerAssignment' | 'applicationTeamAssignment') =>
  prismaMock[modele].deleteMany.mock.calls.at(-1)[0].where

/**
 * Une équipe autonome ou volante s'organise à la main : le calcul écarte ses créneaux, et ne les
 * remplira donc jamais. Il ne doit pas non plus les vider — c'est tout l'objet de ce fichier.
 *
 * La suppression portait sur l'édition entière (`timeSlot: { eventId }`) alors que le filtre des
 * candidats venait d'écarter ces créneaux : un « tout effacer et recalculer » détruisait
 * définitivement le planning de ces équipes.
 */
describe('POST …/volunteers/auto-assign — portée de la suppression des créneaux', () => {
  beforeEach(preparerLesMocks)

  it('n’efface, en tout effacer, que les créneaux soumis au calcul', async () => {
    await appliquer('replace-all')

    expect(dernierEffacement('volunteerAssignment').timeSlotId.in).toEqual(
      expect.arrayContaining(['creneau-cuisine', 'creneau-libre'])
    )
  })

  it('épargne le créneau d’une équipe autonome, qu’il ne saurait pas recréer', async () => {
    await appliquer('replace-all')

    expect(dernierEffacement('volunteerAssignment').timeSlotId.in).not.toContain('creneau-autonome')
  })

  it('épargne le créneau d’une équipe volante', async () => {
    await appliquer('replace-all')

    expect(dernierEffacement('volunteerAssignment').timeSlotId.in).not.toContain('creneau-volant')
  })

  it('ne vise plus l’édition entière', async () => {
    // La forme d'origine : `where: { timeSlot: { eventId } }`. Sans cette assertion, y revenir
    // repasserait au vert — les trois tests ci-dessus ne regardent que le contenu de la liste.
    await appliquer('replace-all')

    expect(dernierEffacement('volunteerAssignment').timeSlot).toBeUndefined()
  })

  it('borne aussi la suppression du mode « garder le manuel »', async () => {
    await appliquer('keep-manual')

    const where = dernierEffacement('volunteerAssignment')
    expect(where.source).toBe('AUTO')
    expect(where.timeSlotId.in).not.toContain('creneau-autonome')
  })

  it('n’efface rien du tout en mode « conserver »', async () => {
    await appliquer('keep-all')

    expect(prismaMock.volunteerAssignment.deleteMany).not.toHaveBeenCalled()
  })
})

/**
 * Le rattachement à une équipe est une décision, souvent humaine, et rien ne la reconstruit.
 *
 * Le mode « tout effacer » les emportait toutes, faute de pouvoir distinguer celles qu'un calcul
 * avait posées — et seulement pour les bénévoles ayant reçu un créneau d'équipe, si bien que deux
 * bénévoles dans la même situation s'en tiraient différemment.
 */
describe('POST …/volunteers/auto-assign — origine des rattachements d’équipe', () => {
  beforeEach(preparerLesMocks)

  it('n’efface que les rattachements posés par un calcul', async () => {
    await appliquer('replace-all')

    expect(dernierEffacement('applicationTeamAssignment').source).toBe('AUTO')
  })

  it('épargne les équipes que le calcul ne pourvoit pas', async () => {
    // Sortir un bénévole de son équipe volante le rendrait planifiable : l'inverse du réglage.
    await appliquer('replace-all')

    const equipes = dernierEffacement('applicationTeamAssignment').teamId.in
    expect(equipes).toContain('cuisine')
    expect(equipes).not.toContain('volante')
    expect(equipes).not.toContain('autonome')
  })

  it('traite tous les bénévoles soumis, pas seulement ceux qui ont reçu un créneau', async () => {
    // Le bénévole 11 n'est disponible sur aucune phase : le calcul ne lui donnera rien. Il doit
    // pourtant voir ses rattachements automatiques nettoyés comme les autres — sans quoi l'état
    // final dépend de ce que le calcul a bien voulu distribuer.
    prismaMock.editionVolunteerApplication.findMany.mockResolvedValue([
      benevole(5, 10),
      benevole(6, 11, { disponible: false }),
    ])

    await appliquer('replace-all')

    expect(dernierEffacement('applicationTeamAssignment').applicationId.in).toEqual(
      expect.arrayContaining([5, 6])
    )
  })

  it('écarte le bénévole que le calcul ne regarde pas', async () => {
    // Celui-ci n'est QUE volant : il est hors assignation automatique, donc hors de portée de la
    // suppression aussi.
    prismaMock.editionVolunteerApplication.findMany.mockResolvedValue([
      benevole(5, 10),
      benevole(7, 12, { equipes: ['volante'] }),
    ])

    await appliquer('replace-all')

    expect(dernierEffacement('applicationTeamAssignment').applicationId.in).not.toContain(7)
  })

  it('crée les nouveaux rattachements en les marquant automatiques', async () => {
    await appliquer('replace-all')

    const [{ data, skipDuplicates }] =
      prismaMock.applicationTeamAssignment.createMany.mock.calls.at(-1)
    expect(skipDuplicates).toBe(true)
    expect(data.length).toBeGreaterThan(0)
    expect(data.every((ligne: { source: string }) => ligne.source === 'AUTO')).toBe(true)
  })

  it('ne touche à aucun rattachement dans les deux autres modes', async () => {
    await appliquer('keep-manual')
    expect(prismaMock.applicationTeamAssignment.deleteMany).not.toHaveBeenCalled()

    await appliquer('keep-all')
    expect(prismaMock.applicationTeamAssignment.deleteMany).not.toHaveBeenCalled()
  })
})
