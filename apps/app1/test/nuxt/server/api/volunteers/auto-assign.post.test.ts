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

const creneau = (
  id: string,
  teamId: string | null,
  heureDebut: number,
  options: { maxVolunteers?: number; organisateurs?: number; assignments?: unknown[] } = {}
) => ({
  id,
  teamId,
  title: `Créneau ${id}`,
  description: null,
  maxVolunteers: options.maxVolunteers ?? 2,
  startDateTime: new Date(Date.UTC(2026, 7, 1, heureDebut, 0, 0)),
  endDateTime: new Date(Date.UTC(2026, 7, 1, heureDebut + 2, 0, 0)),
  assignments: (options.assignments ?? []) as unknown[],
  _count: { organizerAssignments: options.organisateurs ?? 0 },
})

const CRENEAUX = [
  creneau('creneau-cuisine', 'cuisine', 15),
  creneau('creneau-libre', null, 17),
  // Celui-ci porte déjà une affectation posée à la main : c'est elle que la relance effaçait.
  creneau('creneau-autonome', 'autonome', 15, {
    assignments: [{ userId: 42, source: 'MANUAL' }],
  }),
  creneau('creneau-volant', 'volante', 17),
]

const benevole = (
  applicationId: number,
  userId: number,
  options: {
    disponible?: boolean
    equipes?: string[]
    arrivee?: string
    depart?: string
  } = {}
) => ({
  id: applicationId,
  user: { id: userId, pseudo: `benevole-${userId}`, nom: null, prenom: null },
  teamAssignments: (options.equipes ?? []).map((teamId) => ({
    teamId,
    team: EQUIPES.find((equipe) => equipe.id === teamId),
  })),
  arrivalDateTime: options.arrivee ?? null,
  departureDateTime: options.depart ?? null,
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
  prismaMock.volunteerAssignment.findMany.mockResolvedValue([])
  prismaMock.volunteerAssignment.create.mockResolvedValue({})
  prismaMock.applicationTeamAssignment.deleteMany.mockResolvedValue({ count: 0 })
  prismaMock.applicationTeamAssignment.findMany.mockResolvedValue([])
  prismaMock.applicationTeamAssignment.createMany.mockResolvedValue({ count: 0 })
  prismaMock.volunteerAutoAssignRun.create.mockResolvedValue({ id: 'journal-1' })
  prismaMock.volunteerAutoAssignPlan.create.mockResolvedValue({ id: 'plan-1' })
  prismaMock.volunteerAutoAssignPlan.update.mockResolvedValue({})
  prismaMock.volunteerAutoAssignPlan.findFirst.mockResolvedValue(null)
  prismaMock.volunteerAutoAssignPlan.deleteMany.mockResolvedValue({ count: 0 })
  // Les réglages mémorisés au passage : l'écriture n'est pas attendue par l'endpoint, mais sans
  // ce doublon le `.catch()` porterait sur `undefined` et ferait tomber la requête.
  prismaMock.eventVolunteerSettings.upsert.mockResolvedValue({})
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

/**
 * Le calcul écrivait des centaines de lignes sans rien laisser derrière lui : ni les réglages
 * employés, ni ce qu'il avait effacé. Une relance malheureuse était irrattrapable.
 */
describe('POST …/volunteers/auto-assign — journal du calcul', () => {
  beforeEach(preparerLesMocks)

  const journalEcrit = () => prismaMock.volunteerAutoAssignRun.create.mock.calls.at(-1)[0].data

  it('consigne le calcul appliqué', async () => {
    const reponse = await appliquer('replace-all')

    expect(prismaMock.volunteerAutoAssignRun.create).toHaveBeenCalled()
    expect(reponse.data.journalId).toBe('journal-1')
  })

  it('garde les réglages employés, et le mode', async () => {
    await appliquer('keep-manual')

    const journal = journalEcrit()
    expect(journal.mode).toBe('keep-manual')
    expect(journal.constraints).toBeDefined()
    expect(journal.executedById).toBe(1)
    expect(journal.eventId).toBe(22)
  })

  it('relève les affectations AVANT de les effacer', async () => {
    // C'est la seule fenêtre où l'état antérieur existe encore. Le relevé doit viser exactement
    // la même cible que la suppression, sinon on restaurerait autre chose que ce qu'on a pris.
    prismaMock.volunteerAssignment.findMany.mockResolvedValue([
      {
        timeSlotId: 'creneau-cuisine',
        userId: 99,
        source: 'MANUAL',
        assignedById: 3,
        assignedAt: new Date('2026-07-01T10:00:00.000Z'),
      },
    ])

    await appliquer('replace-all')

    const journal = journalEcrit()
    expect(journal.deletedAssignments).toHaveLength(1)
    expect(journal.deletedCount).toBe(1)
    expect(prismaMock.volunteerAssignment.findMany.mock.calls.at(-1)[0].where).toEqual(
      prismaMock.volunteerAssignment.deleteMany.mock.calls.at(-1)[0].where
    )
  })

  it('n’écrit aucun journal quand ce n’est qu’un aperçu', async () => {
    global.readBody = vi.fn().mockResolvedValue({
      applyAssignments: false,
      constraints: { existingAssignmentsMode: 'replace-all' },
    })

    await handler(evenement as any)

    expect(prismaMock.volunteerAutoAssignRun.create).not.toHaveBeenCalled()
    expect(prismaMock.volunteerAssignment.deleteMany).not.toHaveBeenCalled()
  })
})

/**
 * Un créneau a des places, et un organisateur en occupe une comme un bénévole. Le schéma le dit,
 * `places-creneau.ts` l'écrit, les deux endpoints manuels l'appliquent — l'assignation automatique
 * était le seul chemin d'écriture à l'ignorer, et donc à sur-remplir.
 */
describe('POST …/volunteers/auto-assign — places occupées', () => {
  beforeEach(preparerLesMocks)

  const creneauxProposes = () => {
    const { data } = prismaMock.volunteerAutoAssignRun.create.mock.calls.at(-1)[0]
    return data.createdAssignments.map((a: { timeSlotId: string }) => a.timeSlotId)
  }

  it('ne remplit pas un créneau déjà pourvu par des organisateurs', async () => {
    prismaMock.volunteerTimeSlot.findMany.mockResolvedValue([
      creneau('creneau-plein', 'cuisine', 15, { maxVolunteers: 1, organisateurs: 1 }),
    ])

    await appliquer('replace-all')

    expect(creneauxProposes()).not.toContain('creneau-plein')
  })

  it('remplit la place qui reste à côté d’un organisateur', async () => {
    prismaMock.volunteerTimeSlot.findMany.mockResolvedValue([
      creneau('creneau-mixte', 'cuisine', 15, { maxVolunteers: 2, organisateurs: 1 }),
    ])

    await appliquer('replace-all')

    expect(creneauxProposes()).toContain('creneau-mixte')
    expect(creneauxProposes().filter((id: string) => id === 'creneau-mixte')).toHaveLength(1)
  })
})

/**
 * Un bénévole placé à la main sur un créneau sortait entièrement du calcul : il ne recevait jamais
 * les heures qui lui manquaient. C'est pourtant le cas courant — on pose quelques affectations,
 * puis on lance le calcul pour compléter.
 */
describe('POST …/volunteers/auto-assign — charge déjà en place', () => {
  beforeEach(preparerLesMocks)

  const beneficiaires = () => {
    const { data } = prismaMock.volunteerAutoAssignRun.create.mock.calls.at(-1)[0]
    return data.createdAssignments.map((a: { userId: number }) => a.userId)
  }

  it('complète un bénévole déjà placé à la main', async () => {
    prismaMock.volunteerTimeSlot.findMany.mockResolvedValue([
      creneau('creneau-tenu', 'cuisine', 15, {
        assignments: [{ userId: 10, source: 'MANUAL' }],
      }),
      creneau('creneau-libre', 'cuisine', 19),
    ])

    await appliquer('keep-manual')

    // Sans cette prise en compte, le bénévole 10 était écarté et le second créneau restait vide.
    expect(beneficiaires()).toContain(10)
  })

  it('ne lui redonne pas un créneau qui chevauche celui qu’il tient déjà', async () => {
    prismaMock.volunteerTimeSlot.findMany.mockResolvedValue([
      creneau('creneau-tenu', 'cuisine', 15, {
        assignments: [{ userId: 10, source: 'MANUAL' }],
      }),
      creneau('creneau-chevauchant', 'cuisine', 16),
    ])

    await appliquer('keep-manual')

    const { data } = prismaMock.volunteerAutoAssignRun.create.mock.calls.at(-1)[0]
    expect(
      data.createdAssignments.filter(
        (a: { timeSlotId: string; userId: number }) =>
          a.timeSlotId === 'creneau-chevauchant' && a.userId === 10
      )
    ).toHaveLength(0)
  })
})

/**
 * Les dates d'arrivée et de départ sont renseignées par le bénévole et lues par le module repas.
 * Le planificateur, lui, les ignorait : il pouvait attribuer un créneau du vendredi à quelqu'un
 * qui arrive le samedi.
 */
describe('POST …/volunteers/auto-assign — présence du bénévole', () => {
  beforeEach(preparerLesMocks)

  const beneficiaires = () => {
    const { data } = prismaMock.volunteerAutoAssignRun.create.mock.calls.at(-1)[0]
    return data.createdAssignments.map((a: { userId: number }) => a.userId)
  }

  it('n’affecte rien avant l’arrivée du bénévole', async () => {
    // Les créneaux sont le 1er août ; celui-ci arrive le 2.
    prismaMock.editionVolunteerApplication.findMany.mockResolvedValue([
      benevole(5, 10, { arrivee: '2026-08-02_morning' }),
    ])

    await appliquer('replace-all')

    expect(beneficiaires()).not.toContain(10)
  })

  it('n’affecte rien après son départ', async () => {
    prismaMock.editionVolunteerApplication.findMany.mockResolvedValue([
      benevole(5, 10, { depart: '2026-07-31_evening' }),
    ])

    await appliquer('replace-all')

    expect(beneficiaires()).not.toContain(10)
  })

  it('affecte normalement quand le créneau tombe dans la fenêtre', async () => {
    prismaMock.editionVolunteerApplication.findMany.mockResolvedValue([
      benevole(5, 10, { arrivee: '2026-08-01_morning', depart: '2026-08-02_evening' }),
    ])

    await appliquer('replace-all')

    expect(beneficiaires()).toContain(10)
  })

  it('refuse un créneau que le bénévole ne peut pas tenir jusqu’au bout', async () => {
    // Départ le 1er à midi ; le créneau de 15 h à 17 h UTC commence après son départ.
    prismaMock.editionVolunteerApplication.findMany.mockResolvedValue([
      benevole(5, 10, { depart: '2026-08-01_noon' }),
    ])

    await appliquer('replace-all')

    expect(beneficiaires()).not.toContain(10)
  })

  it('laisse tout ouvert quand rien n’est déclaré', async () => {
    await appliquer('replace-all')

    expect(beneficiaires()).toContain(10)
  })
})

/**
 * Deux organisateurs qui appliquent en même temps lisaient chacun un état que l'autre venait de
 * changer : A efface, B efface, A écrit, B écrit, et les deux plans se mélangent.
 */
describe('POST …/volunteers/auto-assign — applications concurrentes', () => {
  beforeEach(preparerLesMocks)

  it('refuse une seconde application pendant qu’une première écrit', async () => {
    // On retient la transaction le temps de lancer le second appel : c'est exactement la fenêtre
    // que le verrou doit fermer.
    let libere: () => void = () => {}
    const retenue = new Promise<void>((resolve) => {
      libere = resolve
    })

    prismaMock.$transaction.mockImplementationOnce(async (operation: (tx: unknown) => unknown) => {
      await retenue
      return operation(prismaMock)
    })

    const premiere = appliquer('replace-all')
    await new Promise((resolve) => setTimeout(resolve, 0))

    await expect(appliquer('replace-all')).rejects.toBeDefined()

    libere()
    await premiere
  })

  it('rouvre l’édition après une transaction en échec', async () => {
    // Sans `finally`, une transaction qui échoue laissait l'édition verrouillée jusqu'au
    // redémarrage du serveur.
    prismaMock.$transaction.mockRejectedValueOnce(new Error('base indisponible'))

    await expect(appliquer('replace-all')).rejects.toBeDefined()

    // La suivante doit pouvoir passer.
    await expect(appliquer('replace-all')).resolves.toBeDefined()
  })

  it('laisse passer autant d’aperçus qu’on veut', async () => {
    // L'aperçu n'écrit rien : il n'a aucune raison d'être verrouillé.
    const apercu = () => {
      global.readBody = vi.fn().mockResolvedValue({ applyAssignments: false, constraints: {} })
      return handler(evenement as any)
    }

    await expect(Promise.all([apercu(), apercu(), apercu()])).resolves.toHaveLength(3)
  })
})

/**
 * L'aperçu et l'application étaient deux calculs distincts : « Appliquer » relisait la base et
 * relançait l'algorithme. Entre les deux clics, un créneau ajouté ou une affectation posée par un
 * collègue suffisaient à ce que le plan écrit ne soit pas celui qui avait été validé.
 */
describe('POST …/volunteers/auto-assign — le plan validé est celui qui est écrit', () => {
  beforeEach(preparerLesMocks)

  const appliquerLePlan = (planId: string) => {
    global.readBody = vi.fn().mockResolvedValue({
      applyAssignments: true,
      planId,
      constraints: { existingAssignmentsMode: 'replace-all' },
    })
    return handler(evenement as any)
  }

  it('conserve le plan à l’aperçu et rend son identifiant', async () => {
    global.readBody = vi.fn().mockResolvedValue({
      applyAssignments: false,
      constraints: { existingAssignmentsMode: 'replace-all' },
    })

    const reponse = await handler(evenement as any)

    expect(prismaMock.volunteerAutoAssignPlan.create).toHaveBeenCalled()
    expect(reponse.data.planId).toBe('plan-1')
  })

  it('écrit le plan conservé, pas celui qu’il vient de recalculer', async () => {
    // Le plan stocké désigne un créneau que le calcul du moment ne proposerait pas : s'il est
    // écrit, c'est bien le plan validé qui fait foi.
    prismaMock.volunteerAutoAssignPlan.findFirst.mockResolvedValue({
      id: 'plan-1',
      eventId: 22,
      appliedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      fingerprint: 'EMPREINTE',
      assignments: [{ volunteerId: 10, slotId: 'creneau-du-plan', score: 1, confidence: 50 }],
      perimetre: { creneaux: ['creneau-du-plan'], candidatures: [], equipes: [] },
    })
    // L'empreinte du moment doit correspondre : on la reprend telle que l'endpoint la calcule.
    prismaMock.volunteerAutoAssignPlan.findFirst.mockImplementation(async () => ({
      id: 'plan-1',
      eventId: 22,
      appliedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      fingerprint: (prismaMock.volunteerAutoAssignPlan.create.mock.calls.at(-1)?.[0]?.data
        ?.fingerprint ?? null) as string,
      assignments: [{ volunteerId: 10, slotId: 'creneau-du-plan', score: 1, confidence: 50 }],
      perimetre: { creneaux: ['creneau-du-plan'], candidatures: [], equipes: [] },
    }))

    // Un aperçu d'abord, pour disposer de l'empreinte du moment.
    global.readBody = vi.fn().mockResolvedValue({
      applyAssignments: false,
      constraints: { existingAssignmentsMode: 'replace-all' },
    })
    await handler(evenement as any)

    await appliquerLePlan('plan-1')

    const { data } = prismaMock.volunteerAutoAssignRun.create.mock.calls.at(-1)[0]
    expect(data.createdAssignments).toEqual([{ timeSlotId: 'creneau-du-plan', userId: 10 }])
  })

  it('refuse d’appliquer quand le planning a changé depuis l’aperçu', async () => {
    prismaMock.volunteerAutoAssignPlan.findFirst.mockResolvedValue({
      id: 'plan-1',
      eventId: 22,
      appliedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      fingerprint: 'une-empreinte-qui-ne-correspond-plus',
      assignments: [],
      perimetre: { creneaux: [], candidatures: [], equipes: [] },
    })

    await expect(appliquerLePlan('plan-1')).rejects.toBeDefined()
    expect(prismaMock.volunteerAssignment.deleteMany).not.toHaveBeenCalled()
  })

  it('refuse un aperçu trop vieux', async () => {
    prismaMock.volunteerAutoAssignPlan.findFirst.mockResolvedValue({
      id: 'plan-1',
      eventId: 22,
      appliedAt: null,
      expiresAt: new Date(Date.now() - 1000),
      fingerprint: 'peu importe',
      assignments: [],
      perimetre: { creneaux: [], candidatures: [], equipes: [] },
    })

    await expect(appliquerLePlan('plan-1')).rejects.toBeDefined()
  })

  it('refuse d’appliquer deux fois le même aperçu', async () => {
    prismaMock.volunteerAutoAssignPlan.findFirst.mockResolvedValue({
      id: 'plan-1',
      eventId: 22,
      appliedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
      fingerprint: 'peu importe',
      assignments: [],
      perimetre: { creneaux: [], candidatures: [], equipes: [] },
    })

    await expect(appliquerLePlan('plan-1')).rejects.toBeDefined()
  })

  it('refuse un aperçu qui n’existe pas', async () => {
    prismaMock.volunteerAutoAssignPlan.findFirst.mockResolvedValue(null)

    await expect(appliquerLePlan('plan-inconnu')).rejects.toBeDefined()
  })

  it('applique encore sans identifiant d’aperçu', async () => {
    // Compatibilité : un appel écrit avant cette évolution, ou un script qui applique
    // directement, continue de fonctionner.
    await appliquer('replace-all')

    expect(prismaMock.volunteerAutoAssignRun.create).toHaveBeenCalled()
  })
})

/**
 * L'aperçu listait ce qui serait créé, jamais ce qui serait détruit. En mode « tout effacer »,
 * c'était l'information la plus importante de l'écran, et la seule absente.
 */
describe('POST …/volunteers/auto-assign — ce que l’aperçu annonce détruire', () => {
  beforeEach(preparerLesMocks)

  const apercu = (existingAssignmentsMode: string) => {
    global.readBody = vi.fn().mockResolvedValue({
      applyAssignments: false,
      constraints: { existingAssignmentsMode },
    })
    return handler(evenement as any)
  }

  it('annonce les affectations qui seraient effacées, et leur origine', async () => {
    prismaMock.volunteerAssignment.findMany.mockResolvedValue([
      {
        timeSlotId: 'creneau-cuisine',
        userId: 42,
        source: 'MANUAL',
        user: { pseudo: 'bob' },
      },
    ])

    const reponse = await apercu('replace-all')

    expect(reponse.data.suppressionsPrevues).toEqual([
      { timeSlotId: 'creneau-cuisine', userId: 42, source: 'MANUAL', pseudo: 'bob' },
    ])
  })

  it('n’annonce rien à détruire en mode « conserver »', async () => {
    const reponse = await apercu('keep-all')

    expect(reponse.data.suppressionsPrevues).toEqual([])
  })

  it('borne l’annonce aux créneaux soumis au calcul', async () => {
    // Même règle que la suppression elle-même : ce que le calcul n'examine pas, il ne l'efface
    // pas — et n'a donc pas à l'annoncer.
    await apercu('replace-all')

    const where = prismaMock.volunteerAssignment.findMany.mock.calls.at(-1)[0].where
    expect(where.timeSlotId.in).not.toContain('creneau-autonome')
  })

  it('rend des avertissements sous forme de codes traduisibles', async () => {
    const reponse = await apercu('replace-all')

    for (const avertissement of reponse.data.result.warnings) {
      expect(typeof avertissement.code).toBe('string')
      expect(avertissement.code).not.toMatch(/[éàè]/)
    }
  })
})

/**
 * L'application relançait l'algorithme pour produire une réponse dont elle remplaçait aussitôt le
 * contenu par le plan conservé. Sur une édition de deux cents bénévoles, c'était plusieurs
 * secondes de calcul pour rien, à chaque application.
 */
describe('POST …/volunteers/auto-assign — le calcul n’est pas refait pour rien', () => {
  beforeEach(preparerLesMocks)

  const planConserve = (resultat: unknown = null) => ({
    id: 'plan-1',
    eventId: 22,
    appliedAt: null,
    expiresAt: new Date(Date.now() + 60_000),
    fingerprint: 'EMPREINTE',
    assignments: [{ volunteerId: 10, slotId: 'creneau-cuisine', score: 1, confidence: 50 }],
    perimetre: { creneaux: ['creneau-cuisine'], candidatures: [], equipes: [] },
    resultat,
  })

  it('rend le résultat conservé plutôt que d’en recalculer un', async () => {
    const resultatDApercu = {
      assignments: [{ volunteerId: 10, slotId: 'creneau-cuisine', score: 1, confidence: 50 }],
      unassigned: { volunteers: [99], slots: ['creneau-libre'] },
      stats: {
        totalAssignments: 1,
        averageHoursPerVolunteer: 2,
        satisfactionRate: 0.9,
        balanceScore: 1,
      },
      warnings: [{ code: 'unassigned_slots', params: { count: 1 } }],
      recommendations: [],
      refus: { parBenevole: [{ volunteerId: 99, motif: 'indisponible' }], parCreneau: [] },
    }

    prismaMock.volunteerAutoAssignPlan.findFirst.mockImplementation(async () => ({
      ...planConserve(resultatDApercu),
      fingerprint: (prismaMock.volunteerAutoAssignPlan.create.mock.calls.at(-1)?.[0]?.data
        ?.fingerprint ?? null) as string,
    }))

    // Un aperçu d'abord, pour disposer de l'empreinte du moment.
    global.readBody = vi.fn().mockResolvedValue({ applyAssignments: false, constraints: {} })
    await handler(evenement as any)

    global.readBody = vi.fn().mockResolvedValue({
      applyAssignments: true,
      planId: 'plan-1',
      constraints: {},
    })
    const reponse = await handler(evenement as any)

    // Le diagnostic et les avertissements sont ceux de l'aperçu, pas d'un nouveau calcul.
    expect(reponse.data.result.refus.parBenevole).toEqual([
      { volunteerId: 99, motif: 'indisponible' },
    ])
    expect(reponse.data.result.warnings).toEqual([
      { code: 'unassigned_slots', params: { count: 1 } },
    ])
  })

  it('reste utilisable pour un plan conservé avant cette évolution', async () => {
    // `resultat` est nul pour les plans écrits avant l'ajout de la colonne : on rend ce qui a été
    // écrit plutôt que de relancer un calcul de plusieurs secondes pour l'affichage.
    prismaMock.volunteerAutoAssignPlan.findFirst.mockImplementation(async () => ({
      ...planConserve(null),
      fingerprint: (prismaMock.volunteerAutoAssignPlan.create.mock.calls.at(-1)?.[0]?.data
        ?.fingerprint ?? null) as string,
    }))

    global.readBody = vi.fn().mockResolvedValue({ applyAssignments: false, constraints: {} })
    await handler(evenement as any)

    global.readBody = vi.fn().mockResolvedValue({
      applyAssignments: true,
      planId: 'plan-1',
      constraints: {},
    })
    const reponse = await handler(evenement as any)

    expect(reponse.data.result.assignments).toHaveLength(1)
    expect(prismaMock.volunteerAssignment.createMany).toHaveBeenCalled()
  })

  it('conserve le résultat complet au moment de l’aperçu', async () => {
    global.readBody = vi.fn().mockResolvedValue({ applyAssignments: false, constraints: {} })
    await handler(evenement as any)

    const { data } = prismaMock.volunteerAutoAssignPlan.create.mock.calls.at(-1)[0]
    expect(data.resultat).toBeDefined()
    expect(data.resultat.stats).toBeDefined()
  })
})

/**
 * L'empreinte qui protège l'application ne couvrait ni les équipes, ni le rattachement d'un
 * créneau à une équipe. Or le PÉRIMÈTRE du calcul — ce qu'il a le droit d'effacer — en dépend :
 * une équipe volante ou autonome voit ses créneaux écartés.
 *
 * Une équipe basculée en autonome entre l'aperçu et l'application ne changeait donc pas
 * l'empreinte, le plan s'appliquait avec le périmètre de l'aperçu, et effaçait des créneaux que le
 * calcul ne sait plus repeupler. C'est le tout premier bug corrigé sur ce module, rouvert par la
 * garde censée protéger l'application.
 */
describe('POST …/volunteers/auto-assign — l’empreinte couvre les équipes', () => {
  beforeEach(preparerLesMocks)

  const empreinteDuDernierPlan = () =>
    prismaMock.volunteerAutoAssignPlan.create.mock.calls.at(-1)?.[0]?.data?.fingerprint

  const apercu = async () => {
    global.readBody = vi.fn().mockResolvedValue({ applyAssignments: false, constraints: {} })
    await handler(evenement as any)
    return empreinteDuDernierPlan()
  }

  it('change d’empreinte quand une équipe devient autonome', async () => {
    const avant = await apercu()

    prismaMock.volunteerTeam.findMany.mockResolvedValue([
      { id: 'cuisine', name: 'Cuisine', color: '#111111', isAutonomousTeam: true },
      ...EQUIPES.slice(1),
    ])
    const apres = await apercu()

    expect(apres).not.toBe(avant)
  })

  it('change d’empreinte quand une équipe devient volante', async () => {
    const avant = await apercu()

    prismaMock.volunteerTeam.findMany.mockResolvedValue([
      { id: 'cuisine', name: 'Cuisine', color: '#111111', isFloatingTeam: true },
      ...EQUIPES.slice(1),
    ])
    const apres = await apercu()

    expect(apres).not.toBe(avant)
  })

  it('change d’empreinte quand un créneau change d’équipe', async () => {
    const avant = await apercu()

    prismaMock.volunteerTimeSlot.findMany.mockResolvedValue([
      { ...CRENEAUX[0]!, teamId: 'autonome' },
      ...CRENEAUX.slice(1),
    ])
    const apres = await apercu()

    expect(apres).not.toBe(avant)
  })

  it('refuse d’appliquer un plan dont l’équipe a basculé depuis', async () => {
    // Le scénario complet : aperçu, bascule en autonome, puis application.
    const empreinteDApercu = await apercu()

    prismaMock.volunteerAutoAssignPlan.findFirst.mockResolvedValue({
      id: 'plan-1',
      eventId: 22,
      appliedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      fingerprint: empreinteDApercu,
      assignments: [],
      perimetre: { creneaux: ['creneau-cuisine'], candidatures: [], equipes: ['cuisine'] },
      resultat: null,
    })

    prismaMock.volunteerTeam.findMany.mockResolvedValue([
      { id: 'cuisine', name: 'Cuisine', color: '#111111', isAutonomousTeam: true },
      ...EQUIPES.slice(1),
    ])

    global.readBody = vi.fn().mockResolvedValue({
      applyAssignments: true,
      planId: 'plan-1',
      constraints: {},
    })

    await expect(handler(evenement as any)).rejects.toBeDefined()
    // Et surtout : rien n'a été effacé.
    expect(prismaMock.volunteerAssignment.deleteMany).not.toHaveBeenCalled()
  })
})

/**
 * Deux corvées que personne ne fait à la main : garder les réglages de l'édition à jour, et
 * effacer les aperçus dont plus aucun code ne se servira.
 */
describe('POST …/volunteers/auto-assign — ce que le calcul range derrière lui', () => {
  beforeEach(preparerLesMocks)

  it('mémorise sur l’édition les réglages qui viennent de servir', async () => {
    // Enregistrés par le serveur et non par un second appel du navigateur : c'est l'objet déjà
    // validé qui part en base, donc exactement celui qui a produit le résultat.
    global.readBody = vi.fn().mockResolvedValue({
      constraints: { maxHoursPerVolunteer: 5, existingAssignmentsMode: 'keep-all' },
    })

    await handler(evenement as any)

    const [appel] = prismaMock.eventVolunteerSettings.upsert.mock.calls.at(-1)
    expect(appel.where).toEqual({ eventId: 22 })
    expect(appel.update.autoAssignConstraints).toEqual({
      maxHoursPerVolunteer: 5,
      existingAssignmentsMode: 'keep-all',
    })
    // `upsert` et non `update` : une édition qui n'a jamais ouvert ses réglages bénévoles ne doit
    // pas perdre ses contraintes en silence.
    expect(appel.create.eventId).toBe(22)
  })

  it('ne fait pas échouer le calcul quand la mémorisation échoue', async () => {
    // L'organisateur attend son planning, pas la confirmation que ses curseurs sont retenus.
    prismaMock.eventVolunteerSettings.upsert.mockRejectedValue(new Error('base indisponible'))
    global.readBody = vi.fn().mockResolvedValue({ constraints: {} })

    await expect(handler(evenement as any)).resolves.toBeDefined()
  })

  it('efface les aperçus périmés en produisant le suivant', async () => {
    // Chaque aperçu conserve le plan, le périmètre et le résultat complet ; rien ne les effaçait,
    // et un organisateur qui règle ses contraintes en produit une dizaine avant d'en appliquer un.
    global.readBody = vi.fn().mockResolvedValue({ constraints: {} })

    await handler(evenement as any)

    const [appel] = prismaMock.volunteerAutoAssignPlan.deleteMany.mock.calls.at(-1)
    expect(appel.where.expiresAt.lt).toBeInstanceOf(Date)
  })

  it('n’efface rien quand on applique, seulement quand on prévisualise', async () => {
    // Appliquer ne crée pas d'aperçu : il n'y a donc rien à ranger, et le ménage n'a pas à
    // s'inviter dans le chemin qui écrit le planning.
    await appliquer('keep-all')

    expect(prismaMock.volunteerAutoAssignPlan.deleteMany).not.toHaveBeenCalled()
  })
})

/**
 * Le second moteur : la recherche locale, proposée à partir d'un aperçu.
 *
 * Elle ne remplace pas le glouton — elle produit un SECOND plan, à côté du premier, et c'est
 * l'organisateur qui tranche. Ces tests portent sur ce que l'endpoint garantit avant de la lancer.
 */
describe('POST …/volunteers/auto-assign — recherche d’un meilleur plan', () => {
  beforeEach(preparerLesMocks)

  /** L'aperçu conservé, tel que la base le rendra. Son empreinte est celle du calcul courant. */
  const apercuConserve = (empreinte: string, surcharge: Record<string, unknown> = {}) => ({
    id: 'plan-1',
    eventId: 22,
    appliedAt: null,
    expiresAt: new Date(Date.now() + 60_000),
    fingerprint: empreinte,
    ...surcharge,
  })

  /** Un aperçu d'abord, pour connaître l'empreinte courante. */
  const empreinteCourante = async () => {
    global.readBody = vi.fn().mockResolvedValue({ constraints: {} })
    await handler(evenement as any)
    return prismaMock.volunteerAutoAssignPlan.create.mock.calls.at(-1)[0].data.fingerprint
  }

  const chercher = (planId = 'plan-1') => {
    global.readBody = vi.fn().mockResolvedValue({ ameliorerLePlan: true, planId, constraints: {} })
    return handler(evenement as any)
  }

  it('rend un second plan, sans toucher au premier', async () => {
    const empreinte = await empreinteCourante()
    prismaMock.volunteerAutoAssignPlan.findFirst.mockResolvedValue(apercuConserve(empreinte))
    // Le plan amélioré est une NOUVELLE ligne : la base lui donnerait un autre identifiant, et
    // c'est ce qui permet à l'écran de garder les deux. Le mock partagé rend toujours `plan-1`.
    prismaMock.volunteerAutoAssignPlan.create.mockResolvedValue({ id: 'plan-2' })

    const reponse: any = await chercher()

    expect(reponse.data.preview).toBe(true)
    // Les deux identifiants reviennent : l'écran peut mettre les plans côte à côte.
    expect(reponse.data.planInitial).toBe('plan-1')
    expect(reponse.data.planId).toBe('plan-2')
    // Rien n'a été écrit dans le planning.
    expect(prismaMock.volunteerAssignment.deleteMany).not.toHaveBeenCalled()
    expect(prismaMock.volunteerAutoAssignRun.create).not.toHaveBeenCalled()
  })

  it('rend compte de ce que la recherche a fait', async () => {
    const empreinte = await empreinteCourante()
    prismaMock.volunteerAutoAssignPlan.findFirst.mockResolvedValue(apercuConserve(empreinte))

    const reponse: any = await chercher()

    expect(reponse.data.recherche).toMatchObject({
      iterations: expect.any(Number),
      mouvementsRetenus: expect.any(Number),
      budgetEpuise: expect.any(Boolean),
    })
    // La note ne peut pas descendre : c'est la première exigence de l'audit.
    expect(reponse.data.recherche.valeurFinale).toBeGreaterThanOrEqual(
      reponse.data.recherche.valeurDeDepart
    )
  })

  it('refuse de chercher à partir d’un aperçu qui n’existe plus', async () => {
    prismaMock.volunteerAutoAssignPlan.findFirst.mockResolvedValue(null)

    await expect(chercher('plan-inconnu')).rejects.toMatchObject({ statusCode: 404 })
  })

  it('refuse quand le planning a changé depuis l’aperçu', async () => {
    // Même garde que pour l'application : chercher un meilleur plan à partir de données périmées
    // produirait une proposition qui ne correspond plus à rien.
    prismaMock.volunteerAutoAssignPlan.findFirst.mockResolvedValue(
      apercuConserve('une-empreinte-qui-ne-correspond-pas')
    )

    await expect(chercher()).rejects.toMatchObject({ statusCode: 409 })
  })

  it('refuse quand l’aperçu a déjà été appliqué', async () => {
    const empreinte = await empreinteCourante()
    prismaMock.volunteerAutoAssignPlan.findFirst.mockResolvedValue(
      apercuConserve(empreinte, { appliedAt: new Date() })
    )

    await expect(chercher()).rejects.toMatchObject({ statusCode: 409 })
  })

  it('refuse quand l’aperçu a trop vieilli', async () => {
    const empreinte = await empreinteCourante()
    prismaMock.volunteerAutoAssignPlan.findFirst.mockResolvedValue(
      apercuConserve(empreinte, { expiresAt: new Date(Date.now() - 1_000) })
    )

    await expect(chercher()).rejects.toMatchObject({ statusCode: 409 })
  })

  it('ne cherche rien quand on ne le demande pas', async () => {
    global.readBody = vi.fn().mockResolvedValue({ constraints: {} })

    const reponse: any = await handler(evenement as any)

    // Un aperçu ordinaire ne porte pas de trace de recherche : la clé dit quel moteur a parlé.
    expect(reponse.data.recherche).toBeNull()
    expect(reponse.data.planInitial).toBeNull()
  })
})
