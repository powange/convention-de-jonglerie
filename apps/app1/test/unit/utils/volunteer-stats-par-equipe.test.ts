import { describe, expect, it } from 'vitest'

import { calculateVolunteersStatsByTeam } from '../../../app/utils/volunteer-stats'

const benevole = (id: number) => ({ user: { id, pseudo: `b${id}` } })
const organisateur = (id: number) => ({ user: { id, pseudo: `o${id}` } })

/**
 * Un créneau de `heures` heures le jour donné, demandant `besoin` bénévoles,
 * et déjà tenu par ceux listés dans `affectes`.
 */
const creneau = (
  id: string,
  jour: string,
  heures: number,
  teamId: string | null,
  affectes: number[],
  besoin = 1,
  organisateurs: number[] = []
) => ({
  id,
  start: `${jour}T09:00:00.000Z`,
  end: `${jour}T${String(9 + heures).padStart(2, '0')}:00:00.000Z`,
  teamId,
  maxVolunteers: besoin,
  assignedVolunteersList: affectes.map(benevole),
  assignedOrganizersList: organisateurs.map(organisateur),
})

const EQUIPES = [
  { id: 'acc', name: 'Accueil', color: '#ff0000' },
  { id: 'bar', name: 'Bar' },
]

describe('calculateVolunteersStatsByTeam', () => {
  it('compte la charge à couvrir, pas la durée du créneau', () => {
    // Deux heures demandant trois bénévoles pèsent six heures
    const [equipe] = calculateVolunteersStatsByTeam(
      [creneau('1', '2026-08-01', 2, 'acc', [1, 2, 3], 3)],
      EQUIPES
    )

    expect(equipe?.totalHours).toBe(6)
    expect(equipe?.totalSlots).toBe(1)
    expect(equipe?.totalVolunteers).toBe(3)
  })

  it('compte un créneau encore vide, à hauteur de ce qu’il demande', () => {
    // La charge existe dès la création du créneau : elle ne grandit pas au fil des affectations
    const [equipe] = calculateVolunteersStatsByTeam(
      [creneau('1', '2026-08-01', 2, 'acc', [], 3)],
      EQUIPES
    )

    expect(equipe?.totalHours).toBe(6)
    expect(equipe?.totalVolunteers).toBe(0)
  })

  it('ne fait pas varier la charge selon le remplissage', () => {
    const vide = calculateVolunteersStatsByTeam(
      [creneau('1', '2026-08-01', 2, 'acc', [], 3)],
      EQUIPES
    )
    const partiel = calculateVolunteersStatsByTeam(
      [creneau('1', '2026-08-01', 2, 'acc', [1], 3)],
      EQUIPES
    )
    const complet = calculateVolunteersStatsByTeam(
      [creneau('1', '2026-08-01', 2, 'acc', [1, 2, 3], 3)],
      EQUIPES
    )

    expect(vide[0]?.totalHours).toBe(6)
    expect(partiel[0]?.totalHours).toBe(6)
    expect(complet[0]?.totalHours).toBe(6)
  })

  it('ventile par jour et cumule au total', () => {
    const [equipe] = calculateVolunteersStatsByTeam(
      [
        creneau('1', '2026-08-01', 2, 'acc', [1]),
        creneau('2', '2026-08-01', 3, 'acc', [2]),
        creneau('3', '2026-08-02', 1, 'acc', [1]),
      ],
      EQUIPES
    )

    expect(equipe?.totalHours).toBe(6)
    expect(equipe?.dayDetails).toEqual([
      { date: '2026-08-01', hours: 5, coveredHours: 5, volunteers: 2, organizers: 0, slots: 2 },
      { date: '2026-08-02', hours: 1, coveredHours: 1, volunteers: 1, organizers: 0, slots: 1 },
    ])
  })

  it('ne compte un bénévole qu’une fois, même sur plusieurs créneaux', () => {
    const [equipe] = calculateVolunteersStatsByTeam(
      [creneau('1', '2026-08-01', 2, 'acc', [1, 2]), creneau('2', '2026-08-02', 2, 'acc', [1])],
      EQUIPES
    )

    expect(equipe?.totalVolunteers).toBe(2)
  })

  it('regroupe à part les créneaux sans équipe plutôt que de les perdre', () => {
    const equipes = calculateVolunteersStatsByTeam(
      [creneau('1', '2026-08-01', 2, 'acc', [1]), creneau('2', '2026-08-01', 4, null, [2])],
      EQUIPES
    )

    // Les taire ferait mentir le total
    const sansEquipe = equipes.find((e) => e.teamId === null)
    expect(sansEquipe?.teamName).toBe('Sans équipe')
    expect(sansEquipe?.totalHours).toBe(4)
    expect(equipes.reduce((total, e) => total + e.totalHours, 0)).toBe(6)
  })

  it('classe les équipes de la plus chargée à la moins chargée', () => {
    const equipes = calculateVolunteersStatsByTeam(
      [creneau('1', '2026-08-01', 1, 'acc', [1]), creneau('2', '2026-08-01', 5, 'bar', [2])],
      EQUIPES
    )

    expect(equipes.map((e) => e.teamName)).toEqual(['Bar', 'Accueil'])
  })

  it('retient un créneau sans besoin déclaré comme en demandant un', () => {
    const sansBesoin = {
      id: '1',
      start: '2026-08-01T09:00:00.000Z',
      end: '2026-08-01T11:00:00.000Z',
      teamId: 'acc',
      assignedVolunteersList: [],
    }

    // Compter zéro heure ferait disparaître le créneau du dimensionnement
    expect(calculateVolunteersStatsByTeam([sansBesoin], EQUIPES)[0]?.totalHours).toBe(2)
  })

  it('ignore une durée aberrante plutôt que de propager un NaN', () => {
    const aberrant = {
      id: '1',
      start: 'pas une date',
      end: '2026-08-01T10:00:00.000Z',
      teamId: 'acc',
      maxVolunteers: 2,
      assignedVolunteersList: [benevole(1)],
    }

    expect(calculateVolunteersStatsByTeam([aberrant], EQUIPES)).toEqual([])
  })
})

/**
 * Les organisateurs tiennent des créneaux comme les bénévoles, et une équipe se lit mieux en
 * « 3 bénévoles et 1 organisateur » qu'en « 4 personnes » : le second tairait qui l'on peut
 * encore solliciter.
 */
describe('calculateVolunteersStatsByTeam — organisateurs', () => {
  it('compte les organisateurs à part des bénévoles', () => {
    const stats = calculateVolunteersStatsByTeam(
      [creneau('c1', '2026-10-02', 2, 'acc', [1, 2], 4, [50])],
      EQUIPES
    )

    expect(stats[0]!.totalVolunteers).toBe(2)
    expect(stats[0]!.totalOrganizers).toBe(1)
  })

  it("compte les heures d'un organisateur dans les heures pourvues", () => {
    // Un créneau de 2h demandant 4 places, tenu par 2 bénévoles et 1 organisateur : 6h
    // pourvues sur 8h à pourvoir.
    const stats = calculateVolunteersStatsByTeam(
      [creneau('c1', '2026-10-02', 2, 'acc', [1, 2], 4, [50])],
      EQUIPES
    )

    expect(stats[0]!.coveredHours).toBe(6)
    expect(stats[0]!.totalHours).toBe(8)
  })

  it('rend une équipe tenue par les seuls organisateurs', () => {
    const stats = calculateVolunteersStatsByTeam(
      [creneau('c1', '2026-10-02', 3, 'bar', [], 2, [50, 51])],
      EQUIPES
    )

    expect(stats[0]!.totalVolunteers).toBe(0)
    expect(stats[0]!.totalOrganizers).toBe(2)
    expect(stats[0]!.coveredHours).toBe(6)
  })

  it('laisse les heures pourvues à zéro sur un créneau sans personne', () => {
    // La charge existe dès la création du créneau ; ce qui est tenu, non.
    const stats = calculateVolunteersStatsByTeam(
      [creneau('c1', '2026-10-02', 2, 'acc', [], 3)],
      EQUIPES
    )

    expect(stats[0]!.totalHours).toBe(6)
    expect(stats[0]!.coveredHours).toBe(0)
  })

  it('ne compte qu’une fois quelqu’un présent sur deux créneaux de l’équipe', () => {
    const stats = calculateVolunteersStatsByTeam(
      [
        creneau('c1', '2026-10-02', 2, 'acc', [], 1, [50]),
        creneau('c2', '2026-10-03', 2, 'acc', [], 1, [50]),
      ],
      EQUIPES
    )

    expect(stats[0]!.totalOrganizers).toBe(1)
    expect(stats[0]!.coveredHours).toBe(4)
  })

  it('détaille chaque jour comme l’équipe entière', () => {
    // Deux créneaux le même jour, l'un tenu par un bénévole, l'autre par un organisateur.
    const stats = calculateVolunteersStatsByTeam(
      [
        creneau('c1', '2026-10-02', 2, 'acc', [1], 2),
        creneau('c2', '2026-10-02', 1, 'acc', [], 1, [50]),
      ],
      EQUIPES
    )

    expect(stats[0]!.dayDetails).toEqual([
      {
        date: '2026-10-02',
        hours: 5, // 2h × 2 places + 1h × 1 place
        coveredHours: 3, // 2h tenues + 1h tenue
        volunteers: 1,
        organizers: 1,
        slots: 2,
      },
    ])
  })

  it('ne compte qu’une fois par jour quelqu’un présent sur deux créneaux', () => {
    const stats = calculateVolunteersStatsByTeam(
      [
        creneau('c1', '2026-10-02', 2, 'acc', [1], 1),
        creneau('c2', '2026-10-02', 2, 'acc', [1], 1),
      ],
      EQUIPES
    )

    expect(stats[0]!.dayDetails[0]!.volunteers).toBe(1)
    expect(stats[0]!.dayDetails[0]!.coveredHours).toBe(4)
  })
})
