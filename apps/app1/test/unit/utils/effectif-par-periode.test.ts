import { describe, expect, it } from 'vitest'

import {
  chargeParPeriode,
  disponibleSurLaPeriode,
  effectifParPeriode,
} from '../../../app/utils/effectif-par-periode'

/**
 * Dimensionner l'effectif période par période.
 *
 * Le calculateur raisonnait sur l'édition entière, ce qui ne dit rien à qui recrute : monter un
 * chapiteau le jeudi et tenir un bar le samedi ne demandent ni les mêmes personnes ni le même
 * volume. Ces tests fixent le découpage, et surtout ce qui tombe de quel côté.
 */
const bornes = {
  startDate: '2026-09-25T10:00:00Z',
  endDate: '2026-09-27T13:00:00Z',
  setupStartDate: '2026-09-24T00:00:00Z',
  teardownEndDate: '2026-09-28T00:00:00Z',
}

const creneau = (debut: string, fin: string, besoin: number, extra: object = {}) => ({
  id: debut,
  startDateTime: debut,
  endDateTime: fin,
  maxVolunteers: besoin,
  teamId: 'bar',
  assignedVolunteersList: [],
  assignedOrganizersList: [],
  ...extra,
})

const equipes = [{ id: 'bar' }, { id: 'volants', isFloatingTeam: true }]

describe('chargeParPeriode', () => {
  it('range chaque créneau dans sa période', () => {
    const releve = chargeParPeriode(
      [
        creneau('2026-09-24T08:00:00Z', '2026-09-24T12:00:00Z', 2), // montage : 8h
        creneau('2026-09-26T14:00:00Z', '2026-09-26T16:00:00Z', 3), // événement : 6h
        creneau('2026-09-27T15:00:00Z', '2026-09-27T17:00:00Z', 1), // démontage : 2h
      ] as never,
      equipes,
      bornes
    )

    expect(releve.montage.heuresAPourvoir).toBe(8)
    expect(releve.evenement.heuresAPourvoir).toBe(6)
    expect(releve.demontage.heuresAPourvoir).toBe(2)
    expect(releve.hors.creneaux).toBe(0)
  })

  it('classe un créneau à cheval sur la période de son DÉBUT', () => {
    // On se présente pour le prendre au moment où il commence. Le découper le compterait deux
    // fois, et aucune des deux moitiés ne correspondrait à un poste réel.
    const releve = chargeParPeriode(
      [creneau('2026-09-25T09:00:00Z', '2026-09-25T11:00:00Z', 1)] as never,
      equipes,
      bornes
    )

    expect(releve.montage.creneaux).toBe(1)
    expect(releve.evenement.creneaux).toBe(0)
  })

  it('compte à part ce qui ne tombe dans aucune période', () => {
    // Sans vue d'ensemble dans la modale, ces créneaux n'apparaîtraient nulle part : les compter
    // permet de le dire plutôt que de les perdre en silence.
    const releve = chargeParPeriode(
      [creneau('2026-09-20T08:00:00Z', '2026-09-20T10:00:00Z', 2)] as never,
      equipes,
      bornes
    )

    expect(releve.hors.creneaux).toBe(1)
    expect(releve.hors.heuresAPourvoir).toBe(4)
    expect(releve.montage.creneaux).toBe(0)
  })

  it('écarte les heures des équipes volantes et autonomes', () => {
    // Personne d'autre ne viendra les couvrir : les compter ferait paraître la période
    // sous-dotée alors qu'il ne manque rien. Le créneau reste dénombré, ses heures non.
    const releve = chargeParPeriode(
      [creneau('2026-09-26T14:00:00Z', '2026-09-26T16:00:00Z', 3, { teamId: 'volants' })] as never,
      equipes,
      bornes
    )

    expect(releve.evenement.heuresAPourvoir).toBe(0)
    expect(releve.evenement.creneaux).toBe(1)
  })

  it('retranche les heures tenues par les organisateurs, période par période', () => {
    const releve = chargeParPeriode(
      [
        creneau('2026-09-24T08:00:00Z', '2026-09-24T10:00:00Z', 2, {
          assignedOrganizersList: [{ user: { id: 1, pseudo: 'orga' } }],
        }),
      ] as never,
      equipes,
      bornes
    )

    expect(releve.montage.heuresAPourvoir).toBe(4)
    expect(releve.montage.heuresDesOrganisateurs).toBe(2)
    expect(releve.evenement.heuresDesOrganisateurs).toBe(0)
  })

  it('ignore un créneau de durée nulle ou illisible', () => {
    const releve = chargeParPeriode(
      [
        creneau('2026-09-26T14:00:00Z', '2026-09-26T14:00:00Z', 2),
        creneau('n’importe quoi', 'non plus', 2),
      ] as never,
      equipes,
      bornes
    )

    expect(releve.evenement.creneaux).toBe(0)
    expect(releve.hors.creneaux).toBe(0)
  })

  it('n’invente pas de démontage quand l’édition n’en déclare pas', () => {
    // Sans borne de démontage, un créneau postérieur à l'édition ne tombe dans aucune période.
    const releve = chargeParPeriode(
      [creneau('2026-09-27T15:00:00Z', '2026-09-27T17:00:00Z', 1)] as never,
      equipes,
      { startDate: bornes.startDate, endDate: bornes.endDate }
    )

    expect(releve.demontage.creneaux).toBe(0)
    expect(releve.hors.creneaux).toBe(1)
  })
})

describe('disponibleSurLaPeriode', () => {
  it('lit la déclaration de la période demandée', () => {
    const candidature = {
      setupAvailability: true,
      eventAvailability: false,
      teardownAvailability: true,
    }

    expect(disponibleSurLaPeriode(candidature, 'montage')).toBe(true)
    expect(disponibleSurLaPeriode(candidature, 'evenement')).toBe(false)
    expect(disponibleSurLaPeriode(candidature, 'demontage')).toBe(true)
  })

  it('compte la personne quand la question n’a pas été posée', () => {
    // Un formulaire qui ne demande pas les disponibilités de montage laisse le champ vide. En
    // déduire une indisponibilité ferait conclure à un manque d'effectif imaginaire.
    expect(disponibleSurLaPeriode({}, 'montage')).toBe(true)
    expect(disponibleSurLaPeriode({ setupAvailability: null }, 'montage')).toBe(true)
  })

  it('n’exclut que sur un refus explicite', () => {
    expect(disponibleSurLaPeriode({ teardownAvailability: false }, 'demontage')).toBe(false)
  })
})

/**
 * Qui compte dans l'effectif disponible d'une période.
 *
 * Le besoin écarte DÉJÀ les créneaux des équipes volantes et autonomes. Garder leurs membres dans
 * l'effectif reviendrait à compter des bras qui ne couvriront jamais ces heures-là — et donc à
 * sous-estimer le manque, ce qui est la pire erreur pour un outil de recrutement.
 */
const candidature = (id: number, equipes: Array<Record<string, boolean>>) => ({
  id,
  status: 'ACCEPTED',
  eventAvailability: true,
  teamAssignments: equipes.map((team) => ({ team })),
})

const effectifEvenement = (acceptes: unknown[]) =>
  effectifParPeriode([], [], bornes, acceptes as never).evenement.benevolesAcceptes

describe('effectifParPeriode — qui compte', () => {
  it('compte un bénévole ordinaire', () => {
    expect(effectifEvenement([candidature(1, [{}])])).toBe(1)
  })

  it('ÉCARTE un bénévole seulement volant', () => {
    expect(effectifEvenement([candidature(1, [{ isFloatingTeam: true }])])).toBe(0)
  })

  it('ÉCARTE un bénévole seulement dans des équipes autonomes', () => {
    // Le défaut corrigé : ses heures se décident dans son équipe, et l'assignation automatique ne
    // lui donnera rien ailleurs. Le compter gonflait l'effectif disponible.
    expect(effectifEvenement([candidature(1, [{ isAutonomousTeam: true }])])).toBe(0)
  })

  it('écarte celui dont TOUTES les équipes sont autonomes, même plusieurs', () => {
    expect(
      effectifEvenement([candidature(1, [{ isAutonomousTeam: true }, { isAutonomousTeam: true }])])
    ).toBe(0)
  })

  it('COMPTE celui qui a aussi une équipe ordinaire', () => {
    // La double appartenance annule la réserve : le rattacher à une seconde équipe, c'est avoir
    // décidé de le partager.
    expect(effectifEvenement([candidature(1, [{ isAutonomousTeam: true }, {}])])).toBe(1)
    expect(effectifEvenement([candidature(1, [{ isFloatingTeam: true }, {}])])).toBe(1)
  })

  it('compte un accepté sans aucune équipe', () => {
    // C'est précisément celui que l'assignation automatique doit placer.
    expect(effectifEvenement([candidature(1, [])])).toBe(1)
  })
})
