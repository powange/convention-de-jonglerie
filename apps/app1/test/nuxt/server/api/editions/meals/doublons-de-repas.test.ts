import { describe, it, expect, vi, beforeEach } from 'vitest'

// wrapApiHandler et validateEditionId sont auto-importés (Nitro).
vi.hoisted(() => {
  if (!(globalThis as any).wrapApiHandler) {
    ;(globalThis as any).wrapApiHandler = (handler: any) => handler
  }
  if (!(globalThis as any).validateEditionId) {
    ;(globalThis as any).validateEditionId = (event: any) =>
      parseInt(event?.context?.params?.id, 10)
  }
})

vi.mock('../../../../../../server/utils/auth-utils', () => ({
  requireAuth: vi.fn(() => ({ id: 1 })),
}))

const canManageMealsById = vi.fn(async () => true)
const canManageArtistsById = vi.fn(async () => true)
const canManageEditionVolunteers = vi.fn(async () => true)

vi.mock('../../../../../../server/utils/permissions/edition-permissions', () => ({
  canManageMealsById: (...args: unknown[]) => canManageMealsById(...(args as [])),
  canManageArtistsById: (...args: unknown[]) => canManageArtistsById(...(args as [])),
}))

vi.mock('../../../../../../server/utils/organizer-management', () => ({
  canManageEditionVolunteers: (...args: unknown[]) => canManageEditionVolunteers(...(args as [])),
}))

const listEditionMealRights = vi.fn(async () => [] as any[])

vi.mock('../../../../../../server/meals/ports/registry', () => ({
  useMealsPorts: vi.fn(() => ({
    artists: { listEditionMealRights },
    ticketing: {},
  })),
}))

import doublons from '../../../../../../../../layers/meals/server/api/editions/[id]/meals/duplicates.get'

const prismaMock = (globalThis as any).prisma

const evenement = { context: { params: { id: '21' }, user: { id: 1 } } }

const VENDREDI_SOIR = { id: 7, date: new Date('2026-07-10'), mealType: 'DINNER' }
const SAMEDI_MIDI = { id: 8, date: new Date('2026-07-11'), mealType: 'LUNCH' }

/** Le compte derrière une ligne de rôle, tel que le point d'API le sélectionne. */
const compte = (id: number, nom: string) => ({
  id,
  nom,
  prenom: 'Camille',
  pseudo: null,
  email: `${nom.toLowerCase()}@exemple.fr`,
})

const appeler = async () => (await doublons(evenement as any)).data

describe('doublons de repas : ce que le point d’API demande à la base', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    canManageMealsById.mockResolvedValue(true)
    canManageArtistsById.mockResolvedValue(true)
    canManageEditionVolunteers.mockResolvedValue(true)
    listEditionMealRights.mockResolvedValue([])
    prismaMock.volunteerMeal.findMany.mockResolvedValue([VENDREDI_SOIR, SAMEDI_MIDI])
    prismaMock.volunteerMealSelection.findMany.mockResolvedValue([])
    prismaMock.editionOrganizer.findMany.mockResolvedValue([])
  })

  it('refuse qui ne gère pas les repas', async () => {
    canManageMealsById.mockResolvedValue(false)

    await expect(doublons(evenement as any)).rejects.toMatchObject({ statusCode: 403 })
  })

  it('ne regarde que les repas ACTIVÉS de l’édition', async () => {
    await appeler()

    const requete = prismaMock.volunteerMeal.findMany.mock.calls[0][0]
    expect(requete.where).toMatchObject({ editionId: 21, enabled: true })
  })

  /**
   * ⚠️ L'assertion porte sur la REQUÊTE, pas sur le résultat : un mock rend ce qu'on lui dit,
   * quelle que soit la condition. Retirer le filtre laisserait le test vert.
   *
   * `status: 'ACCEPTED'` n'est pas décoratif : une candidature peut porter des sélections puis
   * être refusée. Elles restent en base, et la personne apparaîtrait ici alors qu'elle n'a plus
   * droit à rien — on irait arbitrer un doublon qui n'existe pas.
   */
  it('ne demande que les sélections acceptées de bénévoles eux-mêmes acceptés', async () => {
    await appeler()

    const requete = prismaMock.volunteerMealSelection.findMany.mock.calls[0][0]
    expect(requete.where).toMatchObject({
      accepted: true,
      volunteer: { eventId: 21, status: 'ACCEPTED' },
    })
  })

  it('passe par le port pour les artistes, avec les repas de l’édition', async () => {
    await appeler()

    expect(listEditionMealRights).toHaveBeenCalledWith(21, [7, 8])
  })
})

describe('doublons de repas : ce qu’il en conclut', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    canManageMealsById.mockResolvedValue(true)
    canManageArtistsById.mockResolvedValue(true)
    canManageEditionVolunteers.mockResolvedValue(true)
    listEditionMealRights.mockResolvedValue([])
    prismaMock.volunteerMeal.findMany.mockResolvedValue([VENDREDI_SOIR, SAMEDI_MIDI])
    prismaMock.volunteerMealSelection.findMany.mockResolvedValue([])
    prismaMock.editionOrganizer.findMany.mockResolvedValue([])
  })

  it('signale la personne à la fois bénévole et organisatrice', async () => {
    prismaMock.volunteerMealSelection.findMany.mockResolvedValue([
      { id: 500, mealId: 7, volunteerId: 30, volunteer: { user: compte(7, 'Durand') } },
    ])
    prismaMock.editionOrganizer.findMany.mockResolvedValue([
      { id: 60, mealSelections: [], organizer: { user: compte(7, 'Durand') } },
    ])

    const data = await appeler()

    expect(data.personnes).toHaveLength(1)
    expect(data.personnes[0].userId).toBe(7)
    // Le vendredi soir seulement : l'organisateur a aussi le samedi midi, mais pas la bénévole.
    expect(data.personnes[0].repas.map((r: any) => r.mealId)).toEqual([7])
    expect(data.personnes[0].sources).toEqual([
      { source: 'organizer', nbRepas: 1 },
      { source: 'volunteer', nbRepas: 1 },
    ])
  })

  /**
   * Le droit d'un organisateur n'est pas matérialisé : il a TOUS les repas de l'édition, et seules
   * les exceptions sont stockées. C'est ce qui fait que le cumul organisateur + bénévole met la
   * personne en doublon sur chacun de ses repas — et c'est aussi ce qui doit cesser dès qu'un
   * repas lui a été décoché.
   */
  it('n’ouvre aucun droit d’organisateur sur un repas décoché', async () => {
    prismaMock.volunteerMealSelection.findMany.mockResolvedValue([
      { id: 500, mealId: 7, volunteerId: 30, volunteer: { user: compte(7, 'Durand') } },
    ])
    prismaMock.editionOrganizer.findMany.mockResolvedValue([
      {
        id: 60,
        mealSelections: [{ mealId: 7, accepted: false }],
        organizer: { user: compte(7, 'Durand') },
      },
    ])

    const data = await appeler()

    expect(data.personnes).toEqual([])
  })

  it('donne de quoi retirer chaque droit, y compris celui sans ligne à modifier', async () => {
    prismaMock.volunteerMealSelection.findMany.mockResolvedValue([
      { id: 500, mealId: 7, volunteerId: 30, volunteer: { user: compte(7, 'Durand') } },
    ])
    prismaMock.editionOrganizer.findMany.mockResolvedValue([
      { id: 60, mealSelections: [], organizer: { user: compte(7, 'Durand') } },
    ])

    const data = await appeler()

    const droits = data.personnes[0].repas[0].droits
    expect(droits).toContainEqual({
      source: 'volunteer',
      mealId: 7,
      userId: 7,
      roleId: 30,
      selectionId: 500,
    })
    // L'organisateur se désigne par son repas : il n'y a pas de ligne à modifier tant qu'il
    // n'a rien refusé.
    expect(droits).toContainEqual({
      source: 'organizer',
      mealId: 7,
      userId: 7,
      roleId: 60,
      selectionId: null,
    })
  })

  it('reconnaît un cumul artiste et bénévole via le port', async () => {
    prismaMock.volunteerMealSelection.findMany.mockResolvedValue([
      { id: 500, mealId: 8, volunteerId: 30, volunteer: { user: compte(9, 'Martin') } },
    ])
    listEditionMealRights.mockResolvedValue([
      {
        mealId: 8,
        selectionId: 900,
        artistId: 40,
        userId: 9,
        nom: 'Martin',
        prenom: 'Camille',
        pseudo: null,
        email: 'martin@exemple.fr',
      },
    ])

    const data = await appeler()

    expect(data.personnes).toHaveLength(1)
    expect(data.personnes[0].sources.map((s: any) => s.source).sort()).toEqual([
      'artist',
      'volunteer',
    ])
  })

  it('ne retient pas deux titres portant sur des repas différents', async () => {
    prismaMock.volunteerMealSelection.findMany.mockResolvedValue([
      { id: 500, mealId: 7, volunteerId: 30, volunteer: { user: compte(9, 'Martin') } },
    ])
    listEditionMealRights.mockResolvedValue([
      {
        mealId: 8,
        selectionId: 900,
        artistId: 40,
        userId: 9,
        nom: 'Martin',
        prenom: 'Camille',
        pseudo: null,
        email: 'martin@exemple.fr',
      },
    ])

    const data = await appeler()

    expect(data.personnes).toEqual([])
  })
})

/**
 * Trois autorisations indépendantes gouvernent les trois retraits. L'écran est gardé par celle des
 * repas ; sans ce relevé il afficherait des boutons qui répondent 403 au clic, sur une page que
 * l'utilisateur a pourtant le droit d'ouvrir.
 */
describe('doublons de repas : ce que l’appelant a le droit de retirer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    canManageMealsById.mockResolvedValue(true)
    listEditionMealRights.mockResolvedValue([])
    prismaMock.volunteerMeal.findMany.mockResolvedValue([VENDREDI_SOIR])
    prismaMock.volunteerMealSelection.findMany.mockResolvedValue([])
    prismaMock.editionOrganizer.findMany.mockResolvedValue([])
  })

  it('relève chaque droit séparément', async () => {
    canManageArtistsById.mockResolvedValue(false)
    canManageEditionVolunteers.mockResolvedValue(true)

    const data = await appeler()

    expect(data.permissions).toEqual({ volunteer: true, artist: false, organizer: true })
  })

  it('tient le droit « organisateur » pour acquis, la page l’exigeant déjà', async () => {
    canManageArtistsById.mockResolvedValue(false)
    canManageEditionVolunteers.mockResolvedValue(false)

    const data = await appeler()

    expect(data.permissions.organizer).toBe(true)
  })
})
