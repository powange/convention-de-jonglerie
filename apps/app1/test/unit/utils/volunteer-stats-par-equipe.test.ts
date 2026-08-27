import { describe, expect, it } from 'vitest'

import { calculateVolunteersStatsByTeam } from '../../../app/utils/volunteer-stats'

const benevole = (id: number) => ({ user: { id, pseudo: `b${id}` } })

/** Un créneau de `heures` heures le jour donné, tenu par les bénévoles listés. */
const creneau = (
  id: string,
  jour: string,
  heures: number,
  teamId: string | null,
  affectes: number[]
) => ({
  id,
  start: `${jour}T09:00:00.000Z`,
  end: `${jour}T${String(9 + heures).padStart(2, '0')}:00:00.000Z`,
  teamId,
  assignedVolunteersList: affectes.map(benevole),
})

const EQUIPES = [
  { id: 'acc', name: 'Accueil', color: '#ff0000' },
  { id: 'bar', name: 'Bar' },
]

describe('calculateVolunteersStatsByTeam', () => {
  it('compte des heures-bénévole, pas des durées de créneau', () => {
    // Deux heures tenues par trois personnes pèsent six heures-bénévole
    const [equipe] = calculateVolunteersStatsByTeam(
      [creneau('1', '2026-08-01', 2, 'acc', [1, 2, 3])],
      EQUIPES
    )

    expect(equipe?.totalHours).toBe(6)
    expect(equipe?.totalSlots).toBe(1)
    expect(equipe?.totalVolunteers).toBe(3)
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
      { date: '2026-08-01', hours: 5, slots: 2 },
      { date: '2026-08-02', hours: 1, slots: 1 },
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

  it('ignore un créneau sans personne affectée', () => {
    // Sans affectation, aucune heure n'est réellement tenue
    expect(
      calculateVolunteersStatsByTeam([creneau('1', '2026-08-01', 2, 'acc', [])], EQUIPES)
    ).toEqual([])
  })

  it('ignore une durée aberrante plutôt que de propager un NaN', () => {
    const aberrant = {
      id: '1',
      start: 'pas une date',
      end: '2026-08-01T10:00:00.000Z',
      teamId: 'acc',
      assignedVolunteersList: [benevole(1)],
    }

    expect(calculateVolunteersStatsByTeam([aberrant], EQUIPES)).toEqual([])
  })
})
