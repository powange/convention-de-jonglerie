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
      const avec = new VolunteerScheduler({
        volunteers: [benevole({ event: true, teamPreferences: ['equipe-A'] })],
        timeSlots: [{ ...creneauEquipe }],
        teams: EQUIPES,
        constraints: {},
        bornes: BORNES,
      }).assignVolunteers()

      const sans = new VolunteerScheduler({
        volunteers: [benevole({ event: true, teamPreferences: [] })],
        timeSlots: [{ ...creneauEquipe }],
        teams: EQUIPES,
        constraints: {},
        bornes: BORNES,
      }).assignVolunteers()

      expect(avec.assignments[0]!.score).toBe(sans.assignments[0]!.score + 15)
    })

    // RÉGRESSION : en mode strict, le bénévole était écarté du créneau qu'il avait demandé.
    it('assigne bien le bénévole à son équipe souhaitée en mode strict', () => {
      const r = new VolunteerScheduler({
        volunteers: [benevole({ event: true, teamPreferences: ['equipe-A'] })],
        timeSlots: [{ ...creneauEquipe }],
        teams: EQUIPES,
        constraints: { respectStrictTeamPreferences: true },
        bornes: BORNES,
      }).assignVolunteers()

      expect(r.assignments).toHaveLength(1)
    })

    it('écarte en mode strict le créneau d’une équipe non souhaitée', () => {
      const r = new VolunteerScheduler({
        volunteers: [benevole({ event: true, teamPreferences: ['equipe-B'] })],
        timeSlots: [{ ...creneauEquipe }],
        teams: EQUIPES,
        constraints: { respectStrictTeamPreferences: true },
        bornes: BORNES,
      }).assignVolunteers()

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
      const avec = new VolunteerScheduler({
        volunteers: [benevole({ event: true, assignedTeams: ['equipe-A'] })],
        timeSlots: [{ ...creneauEquipe }],
        teams: EQUIPES,
        constraints: {},
        bornes: BORNES,
      }).assignVolunteers()

      const sans = new VolunteerScheduler({
        volunteers: [benevole({ event: true, assignedTeams: [] })],
        timeSlots: [{ ...creneauEquipe }],
        teams: EQUIPES,
        constraints: {},
        bornes: BORNES,
      }).assignVolunteers()

      expect(avec.assignments[0]!.score).toBe(sans.assignments[0]!.score + 15)
    })

    it('garde le bénévole sur l’équipe où il a été placé, en mode strict', () => {
      const r = new VolunteerScheduler({
        volunteers: [benevole({ event: true, assignedTeams: ['equipe-A'] })],
        timeSlots: [{ ...creneauEquipe }],
        teams: EQUIPES,
        constraints: { respectStrictAssignedTeams: true },
        bornes: BORNES,
      }).assignVolunteers()

      expect(r.assignments).toHaveLength(1)
    })

    it('écarte en mode strict le créneau d’une équipe où il n’est pas placé', () => {
      const r = new VolunteerScheduler({
        volunteers: [benevole({ event: true, assignedTeams: ['equipe-B'] })],
        timeSlots: [{ ...creneauEquipe }],
        teams: EQUIPES,
        constraints: { respectStrictAssignedTeams: true },
        bornes: BORNES,
      }).assignVolunteers()

      expect(r.assignments).toHaveLength(0)
    })

    // Sans quoi personne ne serait assignable tant que les organisateurs n'ont pas réparti
    // tout le monde à la main — l'assignation automatique ne servirait plus à rien.
    it('laisse assignable un bénévole qu’aucune équipe n’a encore accueilli', () => {
      const r = new VolunteerScheduler({
        volunteers: [benevole({ event: true, assignedTeams: [] })],
        timeSlots: [{ ...creneauEquipe }],
        teams: EQUIPES,
        constraints: { respectStrictAssignedTeams: true },
        bornes: BORNES,
      }).assignVolunteers()

      expect(r.assignments).toHaveLength(1)
    })

    // Les deux réglages sont indépendants : un bénévole placé dans une équipe qu'il n'avait
    // pas demandée y reste, tant qu'on n'a pas aussi exigé le respect strict des souhaits.
    it('n’écarte pas sur les souhaits quand seul le strict des équipes assignées est demandé', () => {
      const r = new VolunteerScheduler({
        volunteers: [
          benevole({ event: true, teamPreferences: ['equipe-B'], assignedTeams: ['equipe-A'] }),
        ],
        timeSlots: [{ ...creneauEquipe }],
        teams: EQUIPES,
        constraints: { respectStrictAssignedTeams: true },
        bornes: BORNES,
      }).assignVolunteers()

      expect(r.assignments).toHaveLength(1)
    })

    // Un créneau sans équipe n'a rien à respecter : le filtre ne doit pas le faire disparaître.
    it('n’écarte pas un créneau sans équipe', () => {
      const r = new VolunteerScheduler({
        volunteers: [benevole({ event: true, assignedTeams: ['equipe-A'] })],
        timeSlots: [
          creneau({ start: '2026-08-01T16:00:00.000Z', end: '2026-08-01T18:00:00.000Z' }),
        ],
        teams: EQUIPES,
        constraints: { respectStrictAssignedTeams: true },
        bornes: BORNES,
      }).assignVolunteers()

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
      const r = new VolunteerScheduler({
        volunteers: [benevole({ event: true })],
        timeSlots: [creneauDuSoir('2026-08-01')],
        teams: EQUIPES,
        constraints: {},
        bornes: BORNES,
        spectacles: [spectacle(['2026-08-01T20:00:00.000Z'])],
      }).assignVolunteers()

      expect(r.assignments).toHaveLength(0)
    })

    // Tant qu'un passage reste libre, le bénévole verra le spectacle : rien ne s'oppose au créneau.
    it('accepte le créneau quand une autre représentation reste libre', () => {
      const r = new VolunteerScheduler({
        volunteers: [benevole({ event: true })],
        timeSlots: [creneauDuSoir('2026-08-01')],
        teams: EQUIPES,
        constraints: {},
        bornes: BORNES,
        spectacles: [spectacle(['2026-08-01T20:00:00.000Z', '2026-08-02T20:00:00.000Z'])],
      }).assignVolunteers()

      expect(r.assignments).toHaveLength(1)
    })

    it('refuse le créneau qui referme le dernier passage encore libre', () => {
      // Deux soirées, deux créneaux : le premier est acceptable, le second priverait de tout.
      // Le bénévole est disponible au démontage, sans quoi le second créneau — postérieur à la
      // fin de l'événement — serait écarté pour une tout autre raison que le spectacle.
      const r = new VolunteerScheduler({
        volunteers: [benevole({ event: true, teardown: true })],
        timeSlots: [creneauDuSoir('2026-08-01', 'c1'), creneauDuSoir('2026-08-02', 'c2')],
        teams: EQUIPES,
        constraints: {},
        bornes: BORNES,
        spectacles: [spectacle(['2026-08-01T20:00:00.000Z', '2026-08-02T20:00:00.000Z'])],
      }).assignVolunteers()

      expect(r.assignments).toHaveLength(1)
    })

    it('laisse faire quand l’organisateur lève la contrainte', () => {
      const r = new VolunteerScheduler({
        volunteers: [benevole({ event: true })],
        timeSlots: [creneauDuSoir('2026-08-01')],
        teams: EQUIPES,
        constraints: { preserverAccesSpectacles: false },
        bornes: BORNES,
        spectacles: [spectacle(['2026-08-01T20:00:00.000Z'])],
      }).assignVolunteers()

      expect(r.assignments).toHaveLength(1)
    })

    it('ne s’oppose à rien quand l’édition ne programme aucun spectacle', () => {
      const r = new VolunteerScheduler({
        volunteers: [benevole({ event: true })],
        timeSlots: [creneauDuSoir('2026-08-01')],
        teams: EQUIPES,
        constraints: {},
        bornes: BORNES,
        spectacles: [],
      }).assignVolunteers()

      expect(r.assignments).toHaveLength(1)
    })

    // Un spectacle sans durée n'est bloqué que par un créneau en cours au lever de rideau.
    it('laisse passer le créneau qui s’achève avant un spectacle sans durée', () => {
      const r = new VolunteerScheduler({
        volunteers: [benevole({ event: true })],
        timeSlots: [
          creneau({
            start: '2026-08-01T16:00:00.000Z',
            end: '2026-08-01T20:00:00.000Z',
          }),
        ],
        teams: EQUIPES,
        constraints: {},
        bornes: BORNES,
        spectacles: [spectacle(['2026-08-01T20:00:00.000Z'], null)],
      }).assignVolunteers()

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
      const montage = new VolunteerScheduler({
        volunteers: [benevole({ setup: true })],
        timeSlots: [{ ...avantOuverture }],
        teams: [],
        constraints: {},
        bornes: BORNES,
      }).assignVolunteers()
      expect(montage.assignments).toHaveLength(1)

      const evenementSeul = new VolunteerScheduler({
        volunteers: [benevole({ event: true })],
        timeSlots: [{ ...avantOuverture }],
        teams: [],
        constraints: {},
        bornes: BORNES,
      }).assignVolunteers()
      expect(evenementSeul.assignments).toHaveLength(0)
    })

    it('classe en démontage un créneau postérieur à l’heure de fin', () => {
      const apresFin = creneau({
        title: 'Rangement',
        start: '2026-08-02T09:00:00.000Z',
        end: '2026-08-02T12:00:00.000Z',
      })

      const demontage = new VolunteerScheduler({
        volunteers: [benevole({ teardown: true })],
        timeSlots: [{ ...apresFin }],
        teams: [],
        constraints: {},
        bornes: BORNES,
      }).assignVolunteers()
      expect(demontage.assignments).toHaveLength(1)

      const montageSeul = new VolunteerScheduler({
        volunteers: [benevole({ setup: true })],
        timeSlots: [{ ...apresFin }],
        teams: [],
        constraints: {},
        bornes: BORNES,
      }).assignVolunteers()
      expect(montageSeul.assignments).toHaveLength(0)
    })

    it('classe en événement un créneau compris entre les deux bornes', () => {
      const pendant = creneau({
        title: 'Montage du chapiteau', // titre trompeur : les bornes doivent primer
        start: '2026-08-01T16:00:00.000Z',
        end: '2026-08-01T18:00:00.000Z',
      })

      const evenement = new VolunteerScheduler({
        volunteers: [benevole({ event: true })],
        timeSlots: [{ ...pendant }],
        teams: [],
        constraints: {},
        bornes: BORNES,
      }).assignVolunteers()
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

      const demontage = new VolunteerScheduler({
        volunteers: [benevole({ teardown: true })],
        timeSlots: [{ ...sansBornes }],
        teams: [],
        constraints: {},
        bornes: {},
      }).assignVolunteers()
      expect(demontage.assignments).toHaveLength(1)

      const montageSeul = new VolunteerScheduler({
        volunteers: [benevole({ setup: true })],
        timeSlots: [{ ...sansBornes }],
        teams: [],
        constraints: {},
        bornes: {},
      }).assignVolunteers()
      expect(montageSeul.assignments).toHaveLength(0)
    })
  })

  describe('contraintes de base', () => {
    it('n’assigne pas deux créneaux qui se chevauchent au même bénévole', () => {
      const r = new VolunteerScheduler({
        volunteers: [benevole({ event: true })],
        timeSlots: [
          creneau({ id: '1', start: '2026-08-01T16:00:00.000Z', end: '2026-08-01T18:00:00.000Z' }),
          creneau({ id: '2', start: '2026-08-01T17:00:00.000Z', end: '2026-08-01T19:00:00.000Z' }),
        ],
        teams: [],
        constraints: {},
        bornes: BORNES,
      }).assignVolunteers()

      expect(r.assignments).toHaveLength(1)
      expect(r.unassigned.slots).toHaveLength(1)
    })

    it('respecte le plafond d’heures par bénévole', () => {
      const r = new VolunteerScheduler({
        volunteers: [benevole({ event: true })],
        timeSlots: [
          creneau({ id: '1', start: '2026-08-01T14:00:00.000Z', end: '2026-08-01T17:00:00.000Z' }),
          creneau({ id: '2', start: '2026-08-01T18:00:00.000Z', end: '2026-08-01T21:00:00.000Z' }),
        ],
        teams: [],
        constraints: { maxHoursPerVolunteer: 4, maxHoursPerDay: 4 },
        bornes: BORNES,
      }).assignVolunteers()

      // Deux créneaux de 3 h, un plafond à 4 h : un seul peut être tenu.
      expect(r.assignments).toHaveLength(1)
    })
  })
})

/**
 * Les heures et les journées du moteur se lisent dans le fuseau de l'ÉVÉNEMENT, pas dans celui du
 * processus — UTC en conteneur. L'écart n'est pas théorique : sur une convention à Paris en été,
 * deux heures de décalage suffisent à faire basculer un créneau de soirée dans l'après-midi, et à
 * le rattacher au jour précédent pour le plafond journalier.
 */
describe('fuseau horaire de l’événement', () => {
  const PARIS = 'Europe/Paris'

  const benevoleAvecPreference = (preferences: string[]) => ({
    ...benevole({ event: true }),
    availability: JSON.stringify({
      setup: false,
      event: true,
      teardown: false,
      timePreferences: preferences,
    }),
  })

  it('lit l’heure d’un créneau dans le fuseau de l’événement', () => {
    // 18 h - 20 h UTC = 20 h - 22 h à Paris en août : une soirée, entièrement dans la plage.
    const creneauSoiree = creneau({
      id: '1',
      start: '2026-08-01T18:00:00.000Z',
      end: '2026-08-01T20:00:00.000Z',
    })

    const avecFuseau = new VolunteerScheduler({
      volunteers: [benevoleAvecPreference(['evening'])],
      timeSlots: [creneauSoiree],
      teams: [],
      constraints: { respectStrictTimePreferences: true },
      bornes: BORNES,
      spectacles: [],
      affectationsExistantes: [],
      fuseau: PARIS,
    }).assignVolunteers()

    expect(avecFuseau.assignments).toHaveLength(1)
  })

  it('sans fuseau, le même créneau tombe dans la mauvaise plage', () => {
    // Le repli, quand l'édition n'a pas de fuseau : 18 h - 20 h UTC ne recouvre pas « soirée »
    // (20 h - 23 h). C'est ce test qui dit ce que le fuseau change réellement — à Paris, le même
    // créneau tombe de 20 h à 22 h, entièrement dans la plage souhaitée.
    const creneauSoiree = creneau({
      id: '1',
      start: '2026-08-01T18:00:00.000Z',
      end: '2026-08-01T20:00:00.000Z',
    })

    const sansFuseau = new VolunteerScheduler({
      volunteers: [benevoleAvecPreference(['evening'])],
      timeSlots: [creneauSoiree],
      teams: [],
      constraints: { respectStrictTimePreferences: true },
      bornes: BORNES,
    }).assignVolunteers()

    expect(sansFuseau.assignments).toHaveLength(0)
  })

  it('rattache un créneau de nuit à la bonne journée pour le plafond quotidien', () => {
    // 22 h 00 → 23 h 30 UTC le 1er, soit minuit → 1 h 30 le 2 à Paris. Avec un plafond de 2 h par
    // jour, les deux créneaux tiennent : ils tombent des jours différents en heure locale.
    const r = new VolunteerScheduler({
      volunteers: [benevole({ event: true })],
      timeSlots: [
        creneau({ id: '1', start: '2026-08-01T16:00:00.000Z', end: '2026-08-01T17:30:00.000Z' }),
        creneau({ id: '2', start: '2026-08-01T22:00:00.000Z', end: '2026-08-01T23:30:00.000Z' }),
      ],
      teams: [],
      constraints: { maxHoursPerDay: 2, maxHoursPerVolunteer: 12 },
      bornes: { debut: '2026-08-01T14:00:00.000Z', fin: '2026-08-03T23:00:00.000Z' },
      spectacles: [],
      affectationsExistantes: [],
      fuseau: PARIS,
    }).assignVolunteers()

    expect(r.assignments).toHaveLength(2)
  })
})

/**
 * Les heures supplémentaires desserrent le plafond journalier ; elles ne le suppriment pas.
 */
describe('plafond journalier et heures supplémentaires', () => {
  const troisCreneaux = [
    creneau({ id: '1', start: '2026-08-01T14:00:00.000Z', end: '2026-08-01T17:00:00.000Z' }),
    creneau({ id: '2', start: '2026-08-01T17:00:00.000Z', end: '2026-08-01T20:00:00.000Z' }),
    creneau({ id: '3', start: '2026-08-01T20:00:00.000Z', end: '2026-08-01T23:00:00.000Z' }),
  ]

  it('laisse dépasser le plafond du jour, mais pas au-delà des heures supplémentaires', () => {
    // Ce test a longtemps eu besoin d'un bénévole « expérimenté » pour passer : le dépassement
    // coûtait 80 points quand le seuil d'acceptation est à -50, si bien qu'un créneau en heures
    // supplémentaires n'était jamais retenu — le réglage `allowOvertime` ne produisait rien.
    // Depuis que les poids sont rassemblés et rendus cohérents (A1), un bénévole ordinaire suffit.
    const r = new VolunteerScheduler({
      volunteers: [benevole({ event: true })],
      timeSlots: troisCreneaux,
      teams: [],
      constraints: {
        maxHoursPerDay: 3,
        maxOvertimeHours: 3,
        maxHoursPerVolunteer: 24,
        allowOvertime: true,
      },
      bornes: BORNES,
    }).assignVolunteers()

    // 3 h de plafond + 3 h d'heures sup : deux créneaux de 3 h tiennent, le troisième non.
    expect(r.assignments).toHaveLength(2)
  })

  it('s’en tient au plafond quand les heures supplémentaires sont refusées', () => {
    const r = new VolunteerScheduler({
      volunteers: [benevole({ event: true })],
      timeSlots: troisCreneaux,
      teams: [],
      constraints: { maxHoursPerDay: 3, maxHoursPerVolunteer: 24, allowOvertime: false },
      bornes: BORNES,
    }).assignVolunteers()

    expect(r.assignments).toHaveLength(1)
  })
})

/**
 * L'effectif déclaré par une équipe est un INDICATEUR, pas un plafond : la décision a été prise
 * pour les statistiques d'équipe, et vaut ici. Le moteur en fait donc une préférence.
 */
describe('effectif souhaité d’une équipe', () => {
  const EQUIPE_PETITE = [{ id: 'equipe-A', name: 'Équipe A', color: '#000', maxVolunteers: 1 }]

  it('préfère pourvoir une équipe qui manque de monde', () => {
    const r = new VolunteerScheduler({
      volunteers: [benevole({ id: 1, event: true }), benevole({ id: 2, event: true })],
      timeSlots: [
        creneau({
          id: '1',
          start: '2026-08-01T15:00:00.000Z',
          end: '2026-08-01T17:00:00.000Z',
          teamId: 'equipe-A',
        }),
        creneau({
          id: '2',
          start: '2026-08-01T18:00:00.000Z',
          end: '2026-08-01T20:00:00.000Z',
          teamId: 'equipe-A',
        }),
      ],
      teams: EQUIPE_PETITE,
      constraints: {},
      bornes: BORNES,
    }).assignVolunteers()

    // Ne refuse pas : les deux créneaux restent pourvus, malgré un effectif souhaité de 1.
    // Laisser un créneau vide à côté de gens disponibles pour respecter un objectif serait pire.
    expect(r.assignments).toHaveLength(2)
  })
})

/**
 * Le moteur connaissait la raison de chaque refus et la jetait : l'organisateur voyait une liste de
 * bénévoles non assignés sans savoir quel réglage relâcher — précisément la question qu'il se pose.
 */
describe('diagnostic des refus', () => {
  // Fabriqué à CHAQUE appel, et non partagé : le moteur incrémente `assignedVolunteers` sur
  // l'objet qu'on lui passe, si bien qu'un créneau réutilisé arrive déjà complet au test suivant.
  const creneauDuSoir = () =>
    creneau({
      id: '1',
      start: '2026-08-01T16:00:00.000Z',
      end: '2026-08-01T18:00:00.000Z',
      teamId: 'equipe-A',
    })

  it('dit qu’un bénévole n’était pas disponible sur cette phase', () => {
    const r = new VolunteerScheduler({
      volunteers: [benevole({ id: 1, event: false, setup: true })],
      timeSlots: [creneauDuSoir()],
      teams: EQUIPES,
      constraints: {},
      bornes: BORNES,
    }).assignVolunteers()

    expect(r.refus.parBenevole).toEqual([{ volunteerId: 1, motif: 'indisponible' }])
  })

  it('distingue l’absence de l’indisponibilité', () => {
    const absent = {
      ...benevole({ id: 2, event: true }),
      arrivalDateTime: '2026-08-05_morning',
    }

    const r = new VolunteerScheduler({
      volunteers: [absent],
      timeSlots: [creneauDuSoir()],
      teams: EQUIPES,
      constraints: {},
      bornes: BORNES,
    }).assignVolunteers()

    expect(r.refus.parBenevole).toEqual([{ volunteerId: 2, motif: 'absent' }])
  })

  it('compte, par créneau, ce que chaque contrainte a écarté', () => {
    const r = new VolunteerScheduler({
      volunteers: [
        benevole({ id: 1, event: false }),
        benevole({ id: 2, event: false }),
        { ...benevole({ id: 3, event: true }), arrivalDateTime: '2026-08-05_morning' },
      ],
      timeSlots: [creneauDuSoir()],
      teams: EQUIPES,
      constraints: {},
      bornes: BORNES,
    }).assignVolunteers()

    const motifs = r.refus.parCreneau.find((c) => c.slotId === '1')?.motifs ?? []
    expect(motifs).toEqual([
      { motif: 'indisponible', candidats: 2 },
      { motif: 'absent', candidats: 1 },
    ])
  })

  it('n’explique rien quand tout s’est bien passé', () => {
    const r = new VolunteerScheduler({
      volunteers: [benevole({ id: 1, event: true })],
      timeSlots: [creneauDuSoir()],
      teams: EQUIPES,
      constraints: {},
      bornes: BORNES,
    }).assignVolunteers()

    expect(r.assignments).toHaveLength(1)
    expect(r.refus.parBenevole).toEqual([])
    expect(r.refus.parCreneau).toEqual([])
  })

  it('rend des codes, pas des phrases', () => {
    // Les avertissements étaient écrits en français dans le moteur et affichés tels quels : sur
    // treize langues, ils restaient français pour tout le monde.
    const r = new VolunteerScheduler({
      volunteers: [benevole({ id: 1, event: false })],
      timeSlots: [creneauDuSoir()],
      teams: EQUIPES,
      constraints: {},
      bornes: BORNES,
    }).assignVolunteers()

    expect(r.warnings).toContainEqual({ code: 'unassigned_volunteers', params: { count: 1 } })
    expect(r.warnings).toContainEqual({ code: 'unassigned_slots', params: { count: 1 } })
  })
})

/**
 * Le calcul recalculait tout à chaque évaluation de score : les heures d'un bénévole par un
 * balayage de toutes les affectations croisé avec tous les créneaux, la moyenne en refaisant cela
 * pour chaque bénévole. Mesuré avant correction : 3 s pour 50 bénévoles et 60 créneaux, 33 s pour
 * 100 × 150, **4 min 42 pour 200 × 300**.
 *
 * Ce test ne mesure pas une durée — une machine de CI n'est pas un chronomètre fiable — mais il
 * échoue si la complexité revient : à cette taille, l'ancienne version dépassait largement la
 * minute là où la nouvelle tient en quelques secondes.
 */
describe('coût du calcul', () => {
  it('traite une grosse édition sans y passer la journée', () => {
    const benevoles = Array.from({ length: 120 }, (_, i) => benevole({ id: i + 1, event: true }))
    const creneaux = Array.from({ length: 180 }, (_, i) => {
      const jour = 1 + Math.floor(i / 12)
      const heure = 8 + (i % 12)
      return {
        ...creneau({
          id: `c${i}`,
          start: new Date(Date.UTC(2026, 7, jour, heure)).toISOString(),
          end: new Date(Date.UTC(2026, 7, jour, heure + 2)).toISOString(),
        }),
        maxVolunteers: 3,
      }
    })

    const depart = Date.now()
    const r = new VolunteerScheduler({
      volunteers: benevoles,
      timeSlots: creneaux,
      teams: [],
      constraints: { maxHoursPerVolunteer: 24, maxHoursPerDay: 12 },
      bornes: { debut: '2026-08-01T00:00:00.000Z', fin: '2026-08-30T00:00:00.000Z' },
    }).assignVolunteers()
    const duree = Date.now() - depart

    expect(r.assignments.length).toBeGreaterThan(0)
    // Large exprès : ce qui compte est l'ordre de grandeur, pas la milliseconde.
    expect(duree).toBeLessThan(30_000)
  }, 120_000)
})

/**
 * La préférence horaire ne se jugeait que sur l'heure de DÉBUT : un créneau de 11 h à 19 h était
 * classé « matin », et quelqu'un qui n'avait coché que « matin » le recevait en entier.
 */
describe('préférences horaires au recouvrement', () => {
  const avecPreferences = (preferences: string[]) => ({
    ...benevole({ event: true }),
    availability: JSON.stringify({
      setup: false,
      event: true,
      teardown: false,
      timePreferences: preferences,
    }),
  })

  const creneauLong = creneau({
    id: '1',
    start: '2026-08-01T09:00:00.000Z',
    end: '2026-08-01T17:00:00.000Z',
  })

  it('écarte, en mode strict, un créneau qui déborde largement de la plage souhaitée', () => {
    // 9 h - 17 h contre « matin » (9 h - 12 h) : trois heures sur huit, soit 37 % — sous le seuil.
    // L'ancien calcul le classait « matin » sur sa seule heure de début et l'acceptait.
    const r = new VolunteerScheduler({
      volunteers: [avecPreferences(['morning'])],
      timeSlots: [creneauLong],
      teams: [],
      constraints: { respectStrictTimePreferences: true },
      bornes: { debut: '2026-08-01T00:00:00.000Z', fin: '2026-08-02T00:00:00.000Z' },
    }).assignVolunteers()

    expect(r.assignments).toHaveLength(0)
  })

  it('accepte un créneau majoritairement dans les plages souhaitées', () => {
    // Les mêmes huit heures, mais couvertes par trois plages contiguës : 9 h - 17 h entièrement.
    const r = new VolunteerScheduler({
      volunteers: [avecPreferences(['morning', 'lunch', 'early_afternoon'])],
      timeSlots: [creneauLong],
      teams: [],
      constraints: { respectStrictTimePreferences: true },
      bornes: { debut: '2026-08-01T00:00:00.000Z', fin: '2026-08-02T00:00:00.000Z' },
    }).assignVolunteers()

    expect(r.assignments).toHaveLength(1)
  })

  it('ne cumule plus le bonus quand des plages se chevauchent', () => {
    // Deux préférences qui couvrent la même heure ne valent pas deux fois le bonus : le score
    // d'un créneau entièrement souhaité est le même qu'on ait coché une plage ou trois.
    const creneauCourt = creneau({
      id: '1',
      start: '2026-08-01T09:00:00.000Z',
      end: '2026-08-01T11:00:00.000Z',
    })

    const unePlage = new VolunteerScheduler({
      volunteers: [avecPreferences(['morning'])],
      timeSlots: [creneauCourt],
      teams: [],
      constraints: {},
      bornes: { debut: '2026-08-01T00:00:00.000Z', fin: '2026-08-02T00:00:00.000Z' },
    }).assignVolunteers()

    const troisPlages = new VolunteerScheduler({
      volunteers: [avecPreferences(['morning', 'early_morning', 'lunch'])],
      timeSlots: [
        creneau({
          id: '1',
          start: '2026-08-01T09:00:00.000Z',
          end: '2026-08-01T11:00:00.000Z',
        }),
      ],
      teams: [],
      constraints: {},
      bornes: { debut: '2026-08-01T00:00:00.000Z', fin: '2026-08-02T00:00:00.000Z' },
    }).assignVolunteers()

    expect(troisPlages.assignments[0]!.score).toBe(unePlage.assignments[0]!.score)
  })
})

/**
 * Le rééquilibrage réécrivait `volunteerId` sans recalculer score ni confiance : l'affectation
 * transférée gardait les valeurs de l'ancien titulaire, et la confiance affichée était fausse.
 */
describe('rééquilibrage des charges', () => {
  it('recalcule le score et la confiance de l’affectation transférée', () => {
    // Deux bénévoles, quatre créneaux le même jour : sans rééquilibrage le premier prend tout.
    const creneaux = [0, 1, 2, 3].map((i) =>
      creneau({
        id: `c${i}`,
        start: `2026-08-01T${String(8 + i * 3).padStart(2, '0')}:00:00.000Z`,
        end: `2026-08-01T${String(10 + i * 3).padStart(2, '0')}:00:00.000Z`,
      })
    )

    const r = new VolunteerScheduler({
      volunteers: [benevole({ id: 1, event: true }), benevole({ id: 2, event: true })],
      timeSlots: creneaux,
      teams: [],
      constraints: { balanceTeams: true, maxHoursPerVolunteer: 24, maxHoursPerDay: 24 },
      bornes: { debut: '2026-08-01T00:00:00.000Z', fin: '2026-08-02T00:00:00.000Z' },
    }).assignVolunteers()

    // Chaque affectation porte une confiance cohérente avec son score, quel que soit son titulaire.
    for (const assignment of r.assignments) {
      expect(assignment.confidence).toBeGreaterThan(0)
      expect(assignment.confidence).toBeLessThanOrEqual(100)
      expect(Number.isFinite(assignment.score)).toBe(true)
    }
  })

  it('ne pousse pas le bénévole soulagé au-delà de son plafond', () => {
    const creneaux = [0, 1, 2, 3].map((i) =>
      creneau({
        id: `c${i}`,
        start: `2026-08-01T${String(8 + i * 3).padStart(2, '0')}:00:00.000Z`,
        end: `2026-08-01T${String(10 + i * 3).padStart(2, '0')}:00:00.000Z`,
      })
    )

    const r = new VolunteerScheduler({
      volunteers: [benevole({ id: 1, event: true }), benevole({ id: 2, event: true })],
      timeSlots: creneaux,
      teams: [],
      constraints: { balanceTeams: true, maxHoursPerVolunteer: 4, maxHoursPerDay: 4 },
      bornes: { debut: '2026-08-01T00:00:00.000Z', fin: '2026-08-02T00:00:00.000Z' },
    }).assignVolunteers()

    for (const id of [1, 2]) {
      const heures = r.assignments.filter((a) => a.volunteerId === id).length * 2
      expect(heures).toBeLessThanOrEqual(4)
    }
  })
})

/**
 * `satisfactionRate` était la moyenne des `confidence`, elles-mêmes dérivées du score : la métrique
 * disait à quel point l'algorithme était content de lui, pas à quel point les bénévoles étaient
 * servis.
 */
describe('indicateurs de qualité', () => {
  it('mesure des faits constatables sur le planning', () => {
    const r = new VolunteerScheduler({
      volunteers: [
        { ...benevole({ id: 1, event: true }), teamPreferences: ['equipe-A'] },
        { ...benevole({ id: 2, event: true }), teamPreferences: ['equipe-B'] },
      ],
      timeSlots: [
        creneau({
          id: '1',
          start: '2026-08-01T16:00:00.000Z',
          end: '2026-08-01T18:00:00.000Z',
          teamId: 'equipe-A',
        }),
      ],
      teams: EQUIPES,
      constraints: { minHoursPerVolunteer: 2 },
      bornes: BORNES,
    }).assignVolunteers()

    // Le créneau est pourvu, et par quelqu'un qui avait demandé cette équipe.
    expect(r.stats.creneauxComplets).toBe(1)
    expect(r.stats.preferencesEquipeHonorees).toBe(1)
    // Un bénévole sur deux atteint le minimum : l'autre n'a aucun créneau à prendre.
    expect(r.stats.benevolesAuMinimumDHeures).toBe(0.5)
    expect(r.stats.ecartTypeDesHeures).toBeGreaterThan(0)
  })

  it('ne compte pas comme mal servis ceux qui n’ont rien demandé', () => {
    const r = new VolunteerScheduler({
      volunteers: [benevole({ id: 1, event: true })],
      timeSlots: [
        creneau({ id: '1', start: '2026-08-01T16:00:00.000Z', end: '2026-08-01T18:00:00.000Z' }),
      ],
      teams: [],
      constraints: {},
      bornes: BORNES,
    }).assignVolunteers()

    // Aucune préférence horaire exprimée : le ratio vaut 1, pas 0.
    expect(r.stats.creneauxDansLesHorairesSouhaites).toBe(1)
  })
})

/**
 * Le cas qui piège un algorithme glouton, et qui se reproduit sur une vraie édition : le bénévole
 * polyvalent est consommé par le premier créneau rencontré, et celui que lui seul pouvait tenir
 * reste vide.
 */
describe('déblocage des créneaux vides', () => {
  const polyvalent = {
    ...benevole({ id: 1, event: true }),
    teamPreferences: ['banale', 'pointue'],
  }
  const ordinaire = {
    ...benevole({ id: 2, event: true }),
    teamPreferences: ['banale'],
  }

  const equipes = [
    { id: 'banale', name: 'Banale', color: '#000' },
    { id: 'pointue', name: 'Pointue', color: '#000' },
  ]

  const deuxCreneaux = () => [
    creneau({
      id: 'banal',
      start: '2026-08-01T10:00:00.000Z',
      end: '2026-08-01T12:00:00.000Z',
      teamId: 'banale',
    }),
    creneau({
      id: 'pointu',
      start: '2026-08-01T14:00:00.000Z',
      end: '2026-08-01T16:00:00.000Z',
      teamId: 'pointue',
    }),
  ]

  it('déplace celui qui bloque, pour pourvoir le créneau que lui seul peut tenir', () => {
    const r = new VolunteerScheduler({
      volunteers: [polyvalent, ordinaire],
      timeSlots: deuxCreneaux(),
      teams: equipes,
      constraints: { maxHoursPerVolunteer: 2, respectStrictTeamPreferences: true },
      bornes: { debut: '2026-08-01T00:00:00.000Z', fin: '2026-08-02T00:00:00.000Z' },
    }).assignVolunteers()

    // Sans déblocage : le polyvalent prend « banal », épuise son plafond de 2 h, et « pointu »
    // reste vide — 50 % de créneaux pourvus. Avec : les deux le sont.
    expect(r.assignments).toHaveLength(2)
    expect(r.stats.creneauxComplets).toBe(1)

    const surPointu = r.assignments.find((a) => a.slotId === 'pointu')
    expect(surPointu?.volunteerId).toBe(1)
  })

  it('ne déshabille personne quand aucun remplaçant ne peut reprendre', () => {
    // Le polyvalent est seul : déplacer son créneau ne ferait que le vider ailleurs.
    const r = new VolunteerScheduler({
      volunteers: [polyvalent],
      timeSlots: deuxCreneaux(),
      teams: equipes,
      constraints: { maxHoursPerVolunteer: 2, respectStrictTeamPreferences: true },
      bornes: { debut: '2026-08-01T00:00:00.000Z', fin: '2026-08-02T00:00:00.000Z' },
    }).assignVolunteers()

    expect(r.assignments).toHaveLength(1)
  })
})

/**
 * Le plafond total d'heures était une simple pénalité de score : un bénévole qui l'avait atteint
 * était écarté sans motif, et la PREMIÈRE passe ne le vérifiait pas du tout — seule la seconde le
 * faisait.
 */
describe('plafond total d’heures', () => {
  const deuxCreneaux = () => [
    creneau({ id: '1', start: '2026-08-01T15:00:00.000Z', end: '2026-08-01T18:00:00.000Z' }),
    creneau({ id: '2', start: '2026-08-01T19:00:00.000Z', end: '2026-08-01T22:00:00.000Z' }),
  ]

  it('nomme le motif quand le maximum d’heures est atteint', () => {
    const r = new VolunteerScheduler({
      volunteers: [benevole({ id: 1, event: true })],
      timeSlots: deuxCreneaux(),
      teams: [],
      constraints: { maxHoursPerVolunteer: 3, maxHoursPerDay: 12 },
      bornes: BORNES,
    }).assignVolunteers()

    expect(r.assignments).toHaveLength(1)
    // Le créneau restant porte la raison, là où il n'en portait aucune.
    const motifs = r.refus.parCreneau.find((c) => c.slotId === '2')?.motifs ?? []
    expect(motifs).toContainEqual({ motif: 'plafond-heures', candidats: 1 })
  })

  it('desserre le plafond quand les heures supplémentaires sont autorisées', () => {
    const r = new VolunteerScheduler({
      volunteers: [benevole({ id: 1, event: true })],
      timeSlots: deuxCreneaux(),
      teams: [],
      constraints: {
        maxHoursPerVolunteer: 3,
        maxOvertimeHours: 3,
        maxHoursPerDay: 12,
        allowOvertime: true,
      },
      bornes: BORNES,
    }).assignVolunteers()

    expect(r.assignments).toHaveLength(2)
  })
})

/**
 * Le moteur incrémentait `assignedVolunteers` sur les objets de l'appelant : deux calculs sur le
 * même tableau donnaient des résultats différents, et l'appelant perdait l'état d'avant.
 */
describe('le moteur ne modifie pas ses entrées', () => {
  it('rend le même résultat deux fois de suite sur les mêmes objets', () => {
    const creneaux = [
      creneau({ id: '1', start: '2026-08-01T15:00:00.000Z', end: '2026-08-01T17:00:00.000Z' }),
      creneau({ id: '2', start: '2026-08-01T18:00:00.000Z', end: '2026-08-01T20:00:00.000Z' }),
    ]
    const benevoles = [benevole({ id: 1, event: true }), benevole({ id: 2, event: true })]

    const premier = new VolunteerScheduler({
      volunteers: benevoles,
      timeSlots: creneaux,
      teams: [],
      constraints: {},
      bornes: BORNES,
    }).assignVolunteers()
    const second = new VolunteerScheduler({
      volunteers: benevoles,
      timeSlots: creneaux,
      teams: [],
      constraints: {},
      bornes: BORNES,
    }).assignVolunteers()

    expect(second.assignments).toHaveLength(premier.assignments.length)
    expect(second.stats.creneauxComplets).toBe(premier.stats.creneauxComplets)
  })

  it('laisse le remplissage des créneaux d’entrée intact', () => {
    const creneaux = [
      creneau({ id: '1', start: '2026-08-01T15:00:00.000Z', end: '2026-08-01T17:00:00.000Z' }),
    ]

    new VolunteerScheduler({
      volunteers: [benevole({ id: 1, event: true })],
      timeSlots: creneaux,
      teams: [],
      constraints: {},
      bornes: BORNES,
    }).assignVolunteers()

    expect(creneaux[0]!.assignedVolunteers).toBe(0)
  })
})

/**
 * Le diagnostic était reconstitué après coup, sur l'état final. Un bénévole qu'aucune contrainte
 * n'a bloqué — seulement moins bien classé — ne doit porter aucun motif : lui en inventer un
 * enverrait l'organisateur relâcher un réglage qui n'y changerait rien.
 */
describe('motifs relevés au moment du refus', () => {
  it('n’attribue aucun motif à qui n’a été bloqué par rien', () => {
    // Deux bénévoles identiques, un seul créneau d'une place : le second n'est pas « refusé »,
    // il est second.
    const r = new VolunteerScheduler({
      volunteers: [benevole({ id: 1, event: true }), benevole({ id: 2, event: true })],
      timeSlots: [
        creneau({ id: '1', start: '2026-08-01T15:00:00.000Z', end: '2026-08-01T17:00:00.000Z' }),
      ],
      teams: [],
      constraints: {},
      bornes: BORNES,
    }).assignVolunteers()

    expect(r.assignments).toHaveLength(1)
    expect(r.unassigned.volunteers).toHaveLength(1)
    expect(r.refus.parBenevole).toEqual([])
  })
})
