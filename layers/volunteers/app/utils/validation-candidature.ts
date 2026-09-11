/**
 * Ce qui manque à une candidature de bénévole pour être envoyée.
 *
 * Dix règles vivaient dans autant de `computed` du formulaire, chacune mêlant trois choses : ce qui
 * est invalide, ce que le serveur a déjà refusé, et ce qu'il convient d'afficher à cet instant
 * selon que le champ a été touché. Seule la première est une règle du domaine ; les deux autres
 * relèvent de l'écran. Elles sont séparées ici — ce module ne dit que ce qui est invalide.
 *
 * L'enjeu n'est pas le découpage. C'est qu'une validation qui dérive se voit tard : le formulaire
 * accepte un envoi que le serveur refuse, ou refuse un envoi que le serveur aurait accepté, et
 * c'est le candidat qui en fait les frais — celui-là même qui ne reviendra pas.
 *
 * ⚠️ Ce fichier ne doit rien importer d'autre qu'un autre util pur : il est chargé tel quel par les
 * tests unitaires, hors Nuxt.
 */

/** Longueur maximale de la motivation, telle que le champ la borne déjà. */
export const MOTIVATION_MAX = 2000

/** Les champs que la validation peut mettre en cause. */
export type ChampCandidature =
  | 'phone'
  | 'firstName'
  | 'lastName'
  | 'motivation'
  | 'availability'
  | 'allergySeverity'
  | 'arrivalDateTime'
  | 'departureDateTime'
  | 'emergencyContactName'
  | 'emergencyContactPhone'

/** Un manquement : le champ en cause, et de quoi composer le message. */
export interface ManquementCandidature {
  champ: ChampCandidature
  /** Clé de traduction — le module ne compose pas de texte, il désigne. */
  cle: string
  params?: Record<string, number | string>
}

/** La saisie, réduite à ce dont les règles ont besoin. */
export interface SaisieCandidature {
  phone?: string | null
  firstName?: string | null
  lastName?: string | null
  motivation?: string | null
  setupAvailability?: boolean
  eventAvailability?: boolean
  teardownAvailability?: boolean
  arrivalDateTime?: string | null
  departureDateTime?: string | null
  allergies?: string | null
  allergySeverity?: string | null
  emergencyContactName?: string | null
  emergencyContactPhone?: string | null
}

/** Ce qui, hors de la saisie, change les règles. */
export interface ReglagesCandidature {
  /** L'organisateur demande le contact d'urgence à tout le monde. */
  askEmergencyContact?: boolean
  /**
   * La sévérité d'allergie déclarée le rend nécessaire.
   *
   * Passée en paramètre plutôt que recalculée ici : quels niveaux l'exigent est décidé une seule
   * fois, par `requiresEmergencyContact`, et en redire la liste ici créerait exactement la
   * duplication que ce module existe pour supprimer.
   */
  severiteExigeUnContact?: boolean
}

const vide = (valeur?: string | null) => !valeur || valeur.trim().length === 0

/**
 * Le contact d'urgence est-il exigé&nbsp;?
 *
 * Deux raisons indépendantes, et il suffit d'une : l'organisateur le demande à tout le monde, ou la
 * sévérité d'allergie déclarée le rend nécessaire. La seconde est la moins évidente et la plus
 * importante — quelqu'un qui annonce une allergie critique sans laisser de numéro met l'équipe dans
 * une situation intenable.
 */
export function contactDUrgenceExige(reglages: ReglagesCandidature = {}): boolean {
  return !!reglages.askEmergencyContact || !!reglages.severiteExigeUnContact
}

/** Au moins une période de présence a-t-elle été cochée&nbsp;? */
export function auMoinsUnePresence(saisie: SaisieCandidature): boolean {
  return !!(saisie.setupAvailability || saisie.eventAvailability || saisie.teardownAvailability)
}

/**
 * Tout ce qui manque, dans l'ordre où le formulaire les présente.
 *
 * L'ordre compte : c'est celui dans lequel les messages remontent, et l'on veut que le premier
 * désigne le premier champ fautif en descendant la page, pas un champ situé plus bas.
 */
export function manquementsDeLaCandidature(
  saisie: SaisieCandidature,
  reglages: ReglagesCandidature = {}
): ManquementCandidature[] {
  const manquements: ManquementCandidature[] = []
  const exigeUnContact = contactDUrgenceExige(reglages)

  if (vide(saisie.phone)) {
    manquements.push({ champ: 'phone', cle: 'validation.phone_required' })
  }
  if (vide(saisie.firstName)) {
    manquements.push({ champ: 'firstName', cle: 'validation.first_name_required' })
  }
  if (vide(saisie.lastName)) {
    manquements.push({ champ: 'lastName', cle: 'validation.last_name_required' })
  }

  // La sévérité n'est exigée que si une allergie est déclarée : la demander à tout le monde
  // ferait répondre « aucune » à une question qui n'était pas posée.
  if (!vide(saisie.allergies) && !saisie.allergySeverity) {
    manquements.push({ champ: 'allergySeverity', cle: 'validation.allergy_severity_required' })
  }

  if (exigeUnContact && vide(saisie.emergencyContactName)) {
    manquements.push({
      champ: 'emergencyContactName',
      cle: 'validation.emergency_contact_name_required',
    })
  }
  if (exigeUnContact && vide(saisie.emergencyContactPhone)) {
    manquements.push({
      champ: 'emergencyContactPhone',
      cle: 'validation.emergency_contact_phone_required',
    })
  }

  if ((saisie.motivation?.length ?? 0) > MOTIVATION_MAX) {
    manquements.push({
      champ: 'motivation',
      cle: 'validation.motivation_too_long',
      params: { max: MOTIVATION_MAX },
    })
  }

  if (!auMoinsUnePresence(saisie)) {
    manquements.push({
      champ: 'availability',
      cle: 'validation.at_least_one_availability_required',
    })
  }

  // La date d'arrivée dès qu'une présence est annoncée ; celle de départ seulement si l'on reste
  // pendant l'événement ou le démontage. Quelqu'un qui ne vient que pour le montage a bien une
  // date d'arrivée, et repart quand il veut.
  if (auMoinsUnePresence(saisie) && vide(saisie.arrivalDateTime)) {
    manquements.push({ champ: 'arrivalDateTime', cle: 'validation.arrival_date_required' })
  }
  if ((saisie.eventAvailability || saisie.teardownAvailability) && vide(saisie.departureDateTime)) {
    manquements.push({ champ: 'departureDateTime', cle: 'validation.departure_date_required' })
  }

  return manquements
}

/** Le manquement portant sur ce champ, s'il y en a un. */
export function manquementDuChamp(
  manquements: ManquementCandidature[],
  champ: ChampCandidature
): ManquementCandidature | undefined {
  return manquements.find((manquement) => manquement.champ === champ)
}

/** La candidature peut-elle être envoyée&nbsp;? */
export function candidatureEnvoyable(
  saisie: SaisieCandidature,
  reglages: ReglagesCandidature = {}
): boolean {
  return manquementsDeLaCandidature(saisie, reglages).length === 0
}
