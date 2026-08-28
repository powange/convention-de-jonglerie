import { describe, it, expect } from 'vitest'

import { VolunteerScheduler } from '../../../server/utils/volunteer-scheduler'

import type { BornesEvenement } from '../../../server/utils/volunteer-scheduler'

// L'édition se tient le 1er août, de 14 h à 23 h (heures UTC pour rester lisible).
const DEBUT = '2026-08-01T14:00:00.000Z'
const FIN = '2026-08-01T23:00:00.000Z'
const BORNES: BornesEvenement = { debut: DEBUT, fin: FIN }

const benevole = (options: {
  id?: number
  setup?: boolean
  event?: boolean
  teardown?: boolean
  teamPreferences?: string[]
  assignedTeams?: string[]
}) => ({
  id: options.id ?? 1,
  user: { id: options.id ?? 1, pseudo: `benevole-${options.id ?? 1}` },
  availability: JSON.stringify({
    setup: options.setup ?? false,
    event: options.event ?? false,
    teardown: options.teardown ?? false,
    timePreferences: null,
  }),
  experience: '',
  motivation: '',
  teamPreferences: options.teamPreferences ?? [],
  assignedTeams: options.assignedTeams ?? [],
})

const creneau = (options: {
  id?: string
  title?: string
  start: string
  end: string
  teamId?: string
}) => ({
  id: options.id ?? '1',
  title: options.title ?? 'Créneau',
  start: options.start,
  end: options.end,
  teamId: options.teamId,
  maxVolunteers: 1,
  assignedVolunteers: 0,
})

const EQUIPES = [{ id: 'equipe-A', name: 'Équipe A', color: '#000' }]

describe('VolunteerScheduler', () => {
  describe('préférences d’équipe', () => {
    // Les préférences sont une liste d'identifiants (z.array(z.string())). Les lire comme des
    // objets `{ teamId }` ne trouvait jamais de correspondance.
    const creneauEquipe = creneau({
      start: '2026-08-01T16:00:00.000Z',
      end: '2026-08-01T18:00:00.000Z',
      teamId: 'equipe-A',
    })

    it('accorde le bonus quand le créneau relève d’une équipe souhaitée', () => {
      const avec = new VolunteerScheduler(
        [benevole({ event: true, teamPreferences: ['equipe-A'] })],
        [{ ...creneauEquipe }],
        EQUIPES,
        {},
        BORNES
      ).assignVolunteers()

      const sans = new VolunteerScheduler(
        [benevole({ event: true, teamPreferences: [] })],
        [{ ...creneauEquipe }],
        EQUIPES,
        {},
        BORNES
      ).assignVolunteers()

      expect(avec.assignments[0]!.score).toBe(sans.assignments[0]!.score + 15)
    })

    // RÉGRESSION : en mode strict, le bénévole était écarté du créneau qu'il avait demandé.
    it('assigne bien le bénévole à son équipe souhaitée en mode strict', () => {
      const r = new VolunteerScheduler(
        [benevole({ event: true, teamPreferences: ['equipe-A'] })],
        [{ ...creneauEquipe }],
        EQUIPES,
        { respectStrictTeamPreferences: true },
        BORNES
      ).assignVolunteers()

      expect(r.assignments).toHaveLength(1)
    })

    it('écarte en mode strict le créneau d’une équipe non souhaitée', () => {
      const r = new VolunteerScheduler(
        [benevole({ event: true, teamPreferences: ['equipe-B'] })],
        [{ ...creneauEquipe }],
        EQUIPES,
        { respectStrictTeamPreferences: true },
        BORNES
      ).assignVolunteers()

      expect(r.assignments).toHaveLength(0)
    })
  })

  describe('équipes assignées', () => {
    // Le pendant des préférences, du côté de la décision : ce que les organisateurs ont
    // déjà tranché en plaçant le bénévole dans une équipe.
    const creneauEquipe = creneau({
      start: '2026-08-01T16:00:00.000Z',
      end: '2026-08-01T18:00:00.000Z',
      teamId: 'equipe-A',
    })

    it('accorde le bonus quand le créneau relève d’une équipe assignée', () => {
      const avec = new VolunteerScheduler(
        [benevole({ event: true, assignedTeams: ['equipe-A'] })],
        [{ ...creneauEquipe }],
        EQUIPES,
        {},
        BORNES
      ).assignVolunteers()

      const sans = new VolunteerScheduler(
        [benevole({ event: true, assignedTeams: [] })],
        [{ ...creneauEquipe }],
        EQUIPES,
        {},
        BORNES
      ).assignVolunteers()

      expect(avec.assignments[0]!.score).toBe(sans.assignments[0]!.score + 15)
    })

    it('garde le bénévole sur l’équipe où il a été placé, en mode strict', () => {
      const r = new VolunteerScheduler(
        [benevole({ event: true, assignedTeams: ['equipe-A'] })],
        [{ ...creneauEquipe }],
        EQUIPES,
        { respectStrictAssignedTeams: true },
        BORNES
      ).assignVolunteers()

      expect(r.assignments).toHaveLength(1)
    })

    it('écarte en mode strict le créneau d’une équipe où il n’est pas placé', () => {
      const r = new VolunteerScheduler(
        [benevole({ event: true, assignedTeams: ['equipe-B'] })],
        [{ ...creneauEquipe }],
        EQUIPES,
        { respectStrictAssignedTeams: true },
        BORNES
      ).assignVolunteers()

      expect(r.assignments).toHaveLength(0)
    })

    // Sans quoi personne ne serait assignable tant que les organisateurs n'ont pas réparti
    // tout le monde à la main — l'assignation automatique ne servirait plus à rien.
    it('laisse assignable un bénévole qu’aucune équipe n’a encore accueilli', () => {
      const r = new VolunteerScheduler(
        [benevole({ event: true, assignedTeams: [] })],
        [{ ...creneauEquipe }],
        EQUIPES,
        { respectStrictAssignedTeams: true },
        BORNES
      ).assignVolunteers()

      expect(r.assignments).toHaveLength(1)
    })

    // Les deux réglages sont indépendants : un bénévole placé dans une équipe qu'il n'avait
    // pas demandée y reste, tant qu'on n'a pas aussi exigé le respect strict des souhaits.
    it('n’écarte pas sur les souhaits quand seul le strict des équipes assignées est demandé', () => {
      const r = new VolunteerScheduler(
        [benevole({ event: true, teamPreferences: ['equipe-B'], assignedTeams: ['equipe-A'] })],
        [{ ...creneauEquipe }],
        EQUIPES,
        { respectStrictAssignedTeams: true },
        BORNES
      ).assignVolunteers()

      expect(r.assignments).toHaveLength(1)
    })

    // Un créneau sans équipe n'a rien à respecter : le filtre ne doit pas le faire disparaître.
    it('n’écarte pas un créneau sans équipe', () => {
      const r = new VolunteerScheduler(
        [benevole({ event: true, assignedTeams: ['equipe-A'] })],
        [creneau({ start: '2026-08-01T16:00:00.000Z', end: '2026-08-01T18:00:00.000Z' })],
        EQUIPES,
        { respectStrictAssignedTeams: true },
        BORNES
      ).assignVolunteers()

      expect(r.assignments).toHaveLength(1)
    })
  })

  describe('accès aux spectacles', () => {
    // Le spectacle se joue de 20 h à 21 h 30 ; le créneau du soir le recouvre.
    const spectacle = (passages: string[], duree: number | null = 90) => ({
      id: 1,
      title: 'Gala',
      durationMinutes: duree,
      performances: passages.map((startDateTime) => ({ startDateTime })),
    })

    const creneauDuSoir = (jour: string, id = '1') =>
      creneau({
        id,
        start: `${jour}T19:00:00.000Z`,
        end: `${jour}T22:00:00.000Z`,
      })

    it('refuse le créneau qui referme l’unique représentation', () => {
      const r = new VolunteerScheduler(
        [benevole({ event: true })],
        [creneauDuSoir('2026-08-01')],
        EQUIPES,
        {},
        BORNES,
        [spectacle(['2026-08-01T20:00:00.000Z'])]
      ).assignVolunteers()

      expect(r.assignments).toHaveLength(0)
    })

    // Tant qu'un passage reste libre, le bénévole verra le spectacle : rien ne s'oppose au créneau.
    it('accepte le créneau quand une autre représentation reste libre', () => {
      const r = new VolunteerScheduler(
        [benevole({ event: true })],
        [creneauDuSoir('2026-08-01')],
        EQUIPES,
        {},
        BORNES,
        [spectacle(['2026-08-01T20:00:00.000Z', '2026-08-02T20:00:00.000Z'])]
      ).assignVolunteers()

      expect(r.assignments).toHaveLength(1)
    })

    it('refuse le créneau qui referme le dernier passage encore libre', () => {
      // Deux soirées, deux créneaux : le premier est acceptable, le second priverait de tout.
      // Le bénévole est disponible au démontage, sans quoi le second créneau — postérieur à la
      // fin de l'événement — serait écarté pour une tout autre raison que le spectacle.
      const r = new VolunteerScheduler(
        [benevole({ event: true, teardown: true })],
        [creneauDuSoir('2026-08-01', 'c1'), creneauDuSoir('2026-08-02', 'c2')],
        EQUIPES,
        {},
        BORNES,
        [spectacle(['2026-08-01T20:00:00.000Z', '2026-08-02T20:00:00.000Z'])]
      ).assignVolunteers()

      expect(r.assignments).toHaveLength(1)
    })

    it('laisse faire quand l’organisateur lève la contrainte', () => {
      const r = new VolunteerScheduler(
        [benevole({ event: true })],
        [creneauDuSoir('2026-08-01')],
        EQUIPES,
        { preserverAccesSpectacles: false },
        BORNES,
        [spectacle(['2026-08-01T20:00:00.000Z'])]
      ).assignVolunteers()

      expect(r.assignments).toHaveLength(1)
    })

    it('ne s’oppose à rien quand l’édition ne programme aucun spectacle', () => {
      const r = new VolunteerScheduler(
        [benevole({ event: true })],
        [creneauDuSoir('2026-08-01')],
        EQUIPES,
        {},
        BORNES,
        []
      ).assignVolunteers()

      expect(r.assignments).toHaveLength(1)
    })

    // Un spectacle sans durée n'est bloqué que par un créneau en cours au lever de rideau.
    it('laisse passer le créneau qui s’achève avant un spectacle sans durée', () => {
      const r = new VolunteerScheduler(
        [benevole({ event: true })],
        [
          creneau({
            start: '2026-08-01T16:00:00.000Z',
            end: '2026-08-01T20:00:00.000Z',
          }),
        ],
        EQUIPES,
        {},
        BORNES,
        [spectacle(['2026-08-01T20:00:00.000Z'], null)]
      ).assignVolunteers()

      expect(r.assignments).toHaveLength(1)
    })
  })

  describe('montage, événement et démontage', () => {
    // Un créneau le matin du jour d'ouverture, avant l'heure de début : c'est du montage,
    // quel que soit son titre. La comparaison porte sur l'instant, pas sur le jour.
    const avantOuverture = creneau({
      title: 'Préparation du site',
      start: '2026-08-01T09:00:00.000Z',
      end: '2026-08-01T12:00:00.000Z',
    })

    it('classe en montage un créneau antérieur à l’heure d’ouverture, le jour même', () => {
      const montage = new VolunteerScheduler(
        [benevole({ setup: true })],
        [{ ...avantOuverture }],
        [],
        {},
        BORNES
      ).assignVolunteers()
      expect(montage.assignments).toHaveLength(1)

      const evenementSeul = new VolunteerScheduler(
        [benevole({ event: true })],
        [{ ...avantOuverture }],
        [],
        {},
        BORNES
      ).assignVolunteers()
      expect(evenementSeul.assignments).toHaveLength(0)
    })

    it('classe en démontage un créneau postérieur à l’heure de fin', () => {
      const apresFin = creneau({
        title: 'Rangement',
        start: '2026-08-02T09:00:00.000Z',
        end: '2026-08-02T12:00:00.000Z',
      })

      const demontage = new VolunteerScheduler(
        [benevole({ teardown: true })],
        [{ ...apresFin }],
        [],
        {},
        BORNES
      ).assignVolunteers()
      expect(demontage.assignments).toHaveLength(1)

      const montageSeul = new VolunteerScheduler(
        [benevole({ setup: true })],
        [{ ...apresFin }],
        [],
        {},
        BORNES
      ).assignVolunteers()
      expect(montageSeul.assignments).toHaveLength(0)
    })

    it('classe en événement un créneau compris entre les deux bornes', () => {
      const pendant = creneau({
        title: 'Montage du chapiteau', // titre trompeur : les bornes doivent primer
        start: '2026-08-01T16:00:00.000Z',
        end: '2026-08-01T18:00:00.000Z',
      })

      const evenement = new VolunteerScheduler(
        [benevole({ event: true })],
        [{ ...pendant }],
        [],
        {},
        BORNES
      ).assignVolunteers()
      expect(evenement.assignments).toHaveLength(1)
    })

    // RÉGRESSION : « démontage » contient « montage ». Sans bornes, l'ordre des tests décidait,
    // et tout créneau de démontage était pris pour du montage.
    it('sans bornes, reconnaît le démontage malgré « montage » contenu dans le mot', () => {
      const sansBornes = creneau({
        title: 'Démontage',
        start: '2026-08-03T09:00:00.000Z',
        end: '2026-08-03T12:00:00.000Z',
      })

      const demontage = new VolunteerScheduler(
        [benevole({ teardown: true })],
        [{ ...sansBornes }],
        [],
        {},
        {}
      ).assignVolunteers()
      expect(demontage.assignments).toHaveLength(1)

      const montageSeul = new VolunteerScheduler(
        [benevole({ setup: true })],
        [{ ...sansBornes }],
        [],
        {},
        {}
      ).assignVolunteers()
      expect(montageSeul.assignments).toHaveLength(0)
    })
  })

  describe('contraintes de base', () => {
    it('n’assigne pas deux créneaux qui se chevauchent au même bénévole', () => {
      const r = new VolunteerScheduler(
        [benevole({ event: true })],
        [
          creneau({ id: '1', start: '2026-08-01T16:00:00.000Z', end: '2026-08-01T18:00:00.000Z' }),
          creneau({ id: '2', start: '2026-08-01T17:00:00.000Z', end: '2026-08-01T19:00:00.000Z' }),
        ],
        [],
        {},
        BORNES
      ).assignVolunteers()

      expect(r.assignments).toHaveLength(1)
      expect(r.unassigned.slots).toHaveLength(1)
    })

    it('respecte le plafond d’heures par bénévole', () => {
      const r = new VolunteerScheduler(
        [benevole({ event: true })],
        [
          creneau({ id: '1', start: '2026-08-01T14:00:00.000Z', end: '2026-08-01T17:00:00.000Z' }),
          creneau({ id: '2', start: '2026-08-01T18:00:00.000Z', end: '2026-08-01T21:00:00.000Z' }),
        ],
        [],
        { maxHoursPerVolunteer: 4, maxHoursPerDay: 4 },
        BORNES
      ).assignVolunteers()

      // Deux créneaux de 3 h, un plafond à 4 h : un seul peut être tenu.
      expect(r.assignments).toHaveLength(1)
    })
  })
})
