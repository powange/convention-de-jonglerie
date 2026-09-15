/**
 * Dimensionner l'effectif période par période : montage, événement, démontage.
 *
 * Un besoin global ne dit pas grand-chose à qui recrute : on ne cherche pas les mêmes personnes
 * pour monter un chapiteau le jeudi et pour tenir un bar le samedi soir, et le volume attendu de
 * chacun n'a rien de comparable. Le calcul se fait donc trois fois, sur trois sous-ensembles.
 *
 * Les bornes et la règle de découpage viennent de `presence-edition`, qui les tranche déjà pour
 * la géolocalisation : une seconde définition des périodes finirait par en contredire la première.
 */
import {
  equipesDe,
  personnesDuCreneau,
  type AcceptedVolunteer,
  type TimeSlotWithAssignments,
} from './volunteer-stats'

import { estEquipeHorsCharge, estHorsDesComptes } from '~~/shared/utils/benevoles-volants'
import {
  periodeEdition,
  type BornesEditionPresence,
  type PeriodeEdition,
} from '~~/shared/utils/presence-edition'

/** Les trois périodes, dans l'ordre où elles se vivent. */
export const PERIODES: PeriodeEdition[] = ['montage', 'evenement', 'demontage']

/** Ce qu'il faut savoir pour dimensionner une période. */
export interface ChargeDePeriode {
  /** Durée × places demandées, hors équipes volantes et autonomes. */
  heuresAPourvoir: number
  /** Heures déjà tenues par des organisateurs, qui se retranchent du besoin. */
  heuresDesOrganisateurs: number
  creneaux: number
}

const vide = (): ChargeDePeriode => ({
  heuresAPourvoir: 0,
  heuresDesOrganisateurs: 0,
  creneaux: 0,
})

/** Le relevé complet, avec ce qui ne tombe dans aucune période. */
export interface ChargeParPeriode extends Record<PeriodeEdition, ChargeDePeriode> {
  /**
   * Créneaux hors des trois périodes.
   *
   * La modale n'ayant plus de vue d'ensemble, ils n'apparaîtraient nulle part : on les compte à
   * part pour pouvoir le DIRE, plutôt que de les laisser disparaître en silence.
   */
  hors: ChargeDePeriode
}

/**
 * La charge de chaque période.
 *
 * @param creneaux les créneaux de l'édition, dans leur forme convertie pour le planning
 * @param equipes  pour écarter les équipes volantes et autonomes, dont les créneaux ne sont à
 *                 pourvoir par personne d'autre
 * @param bornes   dates de l'édition, montage et démontage compris
 */
export function chargeParPeriode(
  creneaux: TimeSlotWithAssignments[],
  equipes: Array<{ id: string; isFloatingTeam?: boolean; isAutonomousTeam?: boolean }>,
  bornes: BornesEditionPresence
): ChargeParPeriode {
  const horsCharge = new Set(equipes.filter(estEquipeHorsCharge).map((equipe) => equipe.id))

  const releve: ChargeParPeriode = {
    montage: vide(),
    evenement: vide(),
    demontage: vide(),
    hors: vide(),
  }

  for (const creneau of creneaux) {
    const debut = new Date(creneau.start)
    const fin = new Date(creneau.end)
    const duree = (fin.getTime() - debut.getTime()) / (1000 * 60 * 60)
    if (!Number.isFinite(duree) || duree <= 0) continue

    // La période se lit sur le DÉBUT du créneau : un créneau à cheval appartient à la période où
    // l'on se présente pour le prendre. Le découper le ferait compter deux fois.
    const periode = periodeEdition(debut, bornes)
    const cible = periode ? releve[periode] : releve.hors

    cible.creneaux += 1

    const teamId = creneau.teamId as string | null | undefined
    if (!teamId || !horsCharge.has(teamId)) {
      const besoin = Math.max(1, Number(creneau.maxVolunteers) || 1)
      cible.heuresAPourvoir += duree * besoin
    }

    const organisateurs = personnesDuCreneau(creneau).filter((p) => p.estOrganisateur).length
    if (organisateurs > 0) cible.heuresDesOrganisateurs += duree * organisateurs
  }

  return releve
}

/** Ce qu'il faut connaître d'une candidature pour savoir quand elle est disponible. */
export interface CandidaturePourPeriode {
  setupAvailability?: boolean | null
  eventAvailability?: boolean | null
  teardownAvailability?: boolean | null
}

/**
 * Cette candidature couvre-t-elle cette période&nbsp;?
 *
 * Seul un `false` explicite exclut. Une déclaration absente — l'organisateur n'a pas posé la
 * question dans son formulaire — ne doit pas rétrécir l'effectif : on ne sait pas, et supposer
 * l'indisponibilité ferait conclure à un manque qui n'existe peut-être pas.
 */
export function disponibleSurLaPeriode(
  candidature: CandidaturePourPeriode,
  periode: PeriodeEdition
): boolean {
  const declaration =
    periode === 'montage'
      ? candidature.setupAvailability
      : periode === 'demontage'
        ? candidature.teardownAvailability
        : candidature.eventAvailability

  return declaration !== false
}

/** Ce qu'une période demande, et de qui elle dispose. */
export interface EffectifDePeriode extends ChargeDePeriode {
  /** Acceptés s'étant déclarés disponibles sur cette période, volants exclus. */
  benevolesAcceptes: number
}

/** Le relevé prêt à afficher, période par période. */
export interface EffectifParPeriode extends Record<PeriodeEdition, EffectifDePeriode> {
  hors: ChargeDePeriode
}

/**
 * Le dimensionnement de chaque période : ce qu'il y a à pourvoir, et qui peut le pourvoir.
 *
 * Les volants sont écartés de l'effectif comme partout ailleurs : sans créneau par construction,
 * les compter ferait croire à une réserve de bras qui n'en est pas une.
 */
export function effectifParPeriode(
  creneaux: TimeSlotWithAssignments[],
  equipes: Array<{ id: string; isFloatingTeam?: boolean; isAutonomousTeam?: boolean }>,
  bornes: BornesEditionPresence,
  acceptes: AcceptedVolunteer[] = []
): EffectifParPeriode {
  const charge = chargeParPeriode(creneaux, equipes, bornes)
  const comptes = acceptes.filter((candidature) => !estHorsDesComptes(equipesDe(candidature)))

  const pour = (periode: PeriodeEdition): EffectifDePeriode => ({
    ...charge[periode],
    benevolesAcceptes: comptes.filter((candidature) =>
      disponibleSurLaPeriode(candidature as CandidaturePourPeriode, periode)
    ).length,
  })

  return {
    montage: pour('montage'),
    evenement: pour('evenement'),
    demontage: pour('demontage'),
    hors: charge.hors,
  }
}
