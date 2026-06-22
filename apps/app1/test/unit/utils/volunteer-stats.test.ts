import { describe, it, expect } from 'vitest'

import {
  calculateVolunteersStats,
  calculateVolunteersStatsByDay,
  calculateVolunteersStatsIndividual,
} from '../../../app/utils/volunteer-stats'
import type { TimeSlotWithAssignments, AcceptedVolunteer } from '../../../app/utils/volunteer-stats'

// --- Helpers de construction de données réalistes ---

const user = (id: number, pseudo: string) => ({ id, pseudo })

const slot = (
  id: number,
  start: string,
  end: string,
  users: Array<{ id: number; pseudo: string }>
): TimeSlotWithAssignments => ({
  id,
  start,
  end,
  assignedVolunteersList: users.map((u) => ({ user: u })),
})

const accepted = (id: number, pseudo: string, status = 'ACCEPTED'): AcceptedVolunteer => ({
  user: user(id, pseudo),
  status,
})

describe('volunteer-stats — agrégation des statistiques bénévoles', () => {
  describe('calculateVolunteersStats', () => {
    it('retourne des stats nulles si aucun bénévole accepté', () => {
      const result = calculateVolunteersStats([], [])
      expect(result).toEqual({
        totalVolunteers: 0,
        totalHours: 0,
        averageHours: 0,
        totalSlots: 0,
      })
    })

    it('retourne des stats nulles même avec des créneaux mais aucun bénévole accepté', () => {
      const slots = [slot(1, '2026-06-16T08:00:00Z', '2026-06-16T12:00:00Z', [user(1, 'alice')])]
      const result = calculateVolunteersStats(slots, [])
      expect(result.totalVolunteers).toBe(0)
      expect(result.totalHours).toBe(0)
      expect(result.totalSlots).toBe(0)
    })

    it('calcule le total des heures et créneaux pour un seul bénévole', () => {
      // 4h le matin + 2h l'après-midi = 6h, 2 créneaux
      const slots = [
        slot(1, '2026-06-16T08:00:00Z', '2026-06-16T12:00:00Z', [user(1, 'alice')]),
        slot(2, '2026-06-16T14:00:00Z', '2026-06-16T16:00:00Z', [user(1, 'alice')]),
      ]
      const result = calculateVolunteersStats(slots, [accepted(1, 'alice')])
      expect(result.totalVolunteers).toBe(1)
      expect(result.totalHours).toBe(6)
      expect(result.totalSlots).toBe(2)
      expect(result.averageHours).toBe(6)
    })

    it('additionne les heures de plusieurs bénévoles sur un même créneau', () => {
      // Créneau de 3h avec 2 bénévoles → 6h cumulées, 2 affectations
      const slots = [
        slot(1, '2026-06-16T09:00:00Z', '2026-06-16T12:00:00Z', [user(1, 'alice'), user(2, 'bob')]),
      ]
      const result = calculateVolunteersStats(slots, [accepted(1, 'alice'), accepted(2, 'bob')])
      expect(result.totalVolunteers).toBe(2)
      expect(result.totalHours).toBe(6)
      expect(result.totalSlots).toBe(2)
      expect(result.averageHours).toBe(3)
    })

    it('calcule la moyenne sur le nombre de bénévoles acceptés (pas seulement ceux affectés)', () => {
      // 1 seul créneau de 4h pour alice, mais 2 bénévoles acceptés (bob n'a pas de créneau)
      const slots = [slot(1, '2026-06-16T08:00:00Z', '2026-06-16T12:00:00Z', [user(1, 'alice')])]
      const result = calculateVolunteersStats(slots, [accepted(1, 'alice'), accepted(2, 'bob')])
      expect(result.totalVolunteers).toBe(2)
      expect(result.totalHours).toBe(4)
      // 4h / 2 bénévoles = 2h en moyenne
      expect(result.averageHours).toBe(2)
    })

    it('ignore les créneaux sans liste de bénévoles affectés', () => {
      const slots: TimeSlotWithAssignments[] = [
        { id: 1, start: '2026-06-16T08:00:00Z', end: '2026-06-16T12:00:00Z' },
        {
          id: 2,
          start: '2026-06-16T13:00:00Z',
          end: '2026-06-16T15:00:00Z',
          assignedVolunteersList: [],
        },
      ]
      const result = calculateVolunteersStats(slots, [accepted(1, 'alice')])
      expect(result.totalHours).toBe(0)
      expect(result.totalSlots).toBe(0)
      // alice reste comptée comme bénévole accepté
      expect(result.totalVolunteers).toBe(1)
    })

    it('gère les durées fractionnaires (créneau de 1h30)', () => {
      const slots = [slot(1, '2026-06-16T08:00:00Z', '2026-06-16T09:30:00Z', [user(1, 'alice')])]
      const result = calculateVolunteersStats(slots, [accepted(1, 'alice')])
      expect(result.totalHours).toBeCloseTo(1.5, 5)
    })
  })

  describe('calculateVolunteersStatsByDay', () => {
    it('retourne un tableau vide sans créneaux', () => {
      expect(calculateVolunteersStatsByDay([])).toEqual([])
    })

    it('ignore les créneaux sans bénévoles affectés', () => {
      const slots: TimeSlotWithAssignments[] = [
        { id: 1, start: '2026-06-16T08:00:00Z', end: '2026-06-16T12:00:00Z' },
        {
          id: 2,
          start: '2026-06-16T13:00:00Z',
          end: '2026-06-16T15:00:00Z',
          assignedVolunteersList: [],
        },
      ]
      expect(calculateVolunteersStatsByDay(slots)).toEqual([])
    })

    it('regroupe les créneaux par jour', () => {
      const slots = [
        slot(1, '2026-06-16T08:00:00Z', '2026-06-16T12:00:00Z', [user(1, 'alice')]),
        slot(2, '2026-06-17T08:00:00Z', '2026-06-17T10:00:00Z', [user(1, 'alice')]),
      ]
      const result = calculateVolunteersStatsByDay(slots)
      expect(result).toHaveLength(2)
      expect(result.map((d) => d.date)).toEqual(['2026-06-16', '2026-06-17'])
    })

    it('trie les jours par ordre chronologique croissant', () => {
      const slots = [
        slot(1, '2026-06-18T08:00:00Z', '2026-06-18T10:00:00Z', [user(1, 'alice')]),
        slot(2, '2026-06-16T08:00:00Z', '2026-06-16T10:00:00Z', [user(1, 'alice')]),
        slot(3, '2026-06-17T08:00:00Z', '2026-06-17T10:00:00Z', [user(1, 'alice')]),
      ]
      const result = calculateVolunteersStatsByDay(slots)
      expect(result.map((d) => d.date)).toEqual(['2026-06-16', '2026-06-17', '2026-06-18'])
    })

    it('cumule les heures par bénévole sur un même jour', () => {
      // alice fait 2 créneaux le même jour : 4h + 2h = 6h, 2 créneaux
      const slots = [
        slot(1, '2026-06-16T08:00:00Z', '2026-06-16T12:00:00Z', [user(1, 'alice')]),
        slot(2, '2026-06-16T14:00:00Z', '2026-06-16T16:00:00Z', [user(1, 'alice')]),
      ]
      const result = calculateVolunteersStatsByDay(slots)
      expect(result).toHaveLength(1)
      const day = result[0]
      expect(day.totalVolunteers).toBe(1)
      expect(day.totalHours).toBe(6)
      expect(day.volunteers).toHaveLength(1)
      expect(day.volunteers[0].hours).toBe(6)
      expect(day.volunteers[0].slots).toBe(2)
      expect(day.volunteers[0].user.pseudo).toBe('alice')
    })

    it('compte distinctement les bénévoles du jour et cumule le total des heures', () => {
      // alice 4h + bob 2h sur le même jour
      const slots = [
        slot(1, '2026-06-16T08:00:00Z', '2026-06-16T12:00:00Z', [user(1, 'alice')]),
        slot(2, '2026-06-16T14:00:00Z', '2026-06-16T16:00:00Z', [user(2, 'bob')]),
      ]
      const result = calculateVolunteersStatsByDay(slots)
      expect(result[0].totalVolunteers).toBe(2)
      expect(result[0].totalHours).toBe(6)
    })

    it('trie les bénévoles du jour par heures décroissantes', () => {
      // bob 4h, alice 1h sur le même jour
      const slots = [
        slot(1, '2026-06-16T08:00:00Z', '2026-06-16T09:00:00Z', [user(1, 'alice')]),
        slot(2, '2026-06-16T10:00:00Z', '2026-06-16T14:00:00Z', [user(2, 'bob')]),
      ]
      const result = calculateVolunteersStatsByDay(slots)
      expect(result[0].volunteers.map((v) => v.user.pseudo)).toEqual(['bob', 'alice'])
      expect(result[0].volunteers[0].hours).toBe(4)
      expect(result[0].volunteers[1].hours).toBe(1)
    })
  })

  describe('calculateVolunteersStatsIndividual', () => {
    it('retourne un tableau vide sans bénévoles ni créneaux', () => {
      expect(calculateVolunteersStatsIndividual([], [])).toEqual([])
    })

    it('inclut les bénévoles acceptés sans aucun créneau avec 0 heures', () => {
      const result = calculateVolunteersStatsIndividual(
        [],
        [accepted(1, 'alice'), accepted(2, 'bob')]
      )
      expect(result).toHaveLength(2)
      result.forEach((v) => {
        expect(v.totalHours).toBe(0)
        expect(v.totalSlots).toBe(0)
        expect(v.dayDetails).toEqual([])
      })
    })

    it('calcule les heures totales et les créneaux par bénévole', () => {
      const slots = [
        slot(1, '2026-06-16T08:00:00Z', '2026-06-16T12:00:00Z', [user(1, 'alice')]),
        slot(2, '2026-06-17T08:00:00Z', '2026-06-17T10:00:00Z', [user(1, 'alice')]),
      ]
      const result = calculateVolunteersStatsIndividual(slots, [accepted(1, 'alice')])
      expect(result).toHaveLength(1)
      expect(result[0].totalHours).toBe(6)
      expect(result[0].totalSlots).toBe(2)
    })

    it('détaille les heures par jour, triées par date croissante', () => {
      const slots = [
        slot(1, '2026-06-17T08:00:00Z', '2026-06-17T10:00:00Z', [user(1, 'alice')]),
        slot(2, '2026-06-16T08:00:00Z', '2026-06-16T12:00:00Z', [user(1, 'alice')]),
      ]
      const result = calculateVolunteersStatsIndividual(slots, [accepted(1, 'alice')])
      const details = result[0].dayDetails!
      expect(details.map((d) => d.date)).toEqual(['2026-06-16', '2026-06-17'])
      expect(details[0]).toMatchObject({ date: '2026-06-16', hours: 4, slots: 1 })
      expect(details[1]).toMatchObject({ date: '2026-06-17', hours: 2, slots: 1 })
    })

    it('inclut un bénévole affecté à un créneau même s’il n’est pas dans la liste des acceptés', () => {
      // charlie n'est pas dans acceptedVolunteers mais est affecté
      const slots = [slot(1, '2026-06-16T08:00:00Z', '2026-06-16T10:00:00Z', [user(3, 'charlie')])]
      const result = calculateVolunteersStatsIndividual(slots, [accepted(1, 'alice')])
      const pseudos = result.map((v) => v.user.pseudo)
      expect(pseudos).toContain('charlie')
      expect(pseudos).toContain('alice')
      const charlie = result.find((v) => v.user.pseudo === 'charlie')!
      expect(charlie.totalHours).toBe(2)
    })

    it('trie par heures décroissantes', () => {
      // bob 5h, alice 1h
      const slots = [
        slot(1, '2026-06-16T08:00:00Z', '2026-06-16T09:00:00Z', [user(1, 'alice')]),
        slot(2, '2026-06-16T10:00:00Z', '2026-06-16T15:00:00Z', [user(2, 'bob')]),
      ]
      const result = calculateVolunteersStatsIndividual(slots, [
        accepted(1, 'alice'),
        accepted(2, 'bob'),
      ])
      expect(result.map((v) => v.user.pseudo)).toEqual(['bob', 'alice'])
    })

    it('départage les bénévoles à égalité d’heures par pseudo (ordre alphabétique)', () => {
      // alice et bob ont tous deux 0 heure → tri alphabétique : alice avant bob
      const result = calculateVolunteersStatsIndividual(
        [],
        [accepted(2, 'bob'), accepted(1, 'alice')]
      )
      expect(result.map((v) => v.user.pseudo)).toEqual(['alice', 'bob'])
    })

    it('ignore les applications sans utilisateur', () => {
      const applications = [{ status: 'ACCEPTED' } as any, accepted(1, 'alice')]
      const result = calculateVolunteersStatsIndividual([], applications)
      expect(result).toHaveLength(1)
      expect(result[0].user.pseudo).toBe('alice')
    })

    it('ne duplique pas un bénévole accepté également présent dans les créneaux', () => {
      const slots = [slot(1, '2026-06-16T08:00:00Z', '2026-06-16T12:00:00Z', [user(1, 'alice')])]
      const result = calculateVolunteersStatsIndividual(slots, [accepted(1, 'alice')])
      expect(result).toHaveLength(1)
      expect(result[0].totalHours).toBe(4)
    })
  })
})
