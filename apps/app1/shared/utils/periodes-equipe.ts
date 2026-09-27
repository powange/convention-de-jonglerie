/**
 * Les périodes d'une équipe de bénévoles, et leur recoupement avec les disponibilités d'un candidat.
 *
 * Une équipe n'intervient pas forcément sur toute la convention : l'accueil peut n'exister que
 * pendant l'événement, le chantier seulement au montage et au démontage. Le formulaire de
 * candidature ne propose donc, dans les équipes préférées, que celles dont une période recoupe ce
 * que le bénévole vient de cocher.
 *
 * La règle vit ici, et nulle part ailleurs : elle est appliquée par le formulaire pour filtrer la
 * liste, et par le serveur pour refuser un choix hors période. Écrite deux fois, elle divergerait —
 * et c'est le candidat qui en ferait les frais, soit en voyant une équipe qu'il ne peut pas choisir,
 * soit en se faisant refuser un envoi que l'écran autorisait.
 *
 * Le module des repas porte la même notion sous une autre forme (`VolunteerMeal.phases`, un tableau
 * JSON lu par `isVolunteerEligibleForMeal`). On ne l'a pas reprise ici : trois booléens rendent le
 * filtre exprimable en SQL et, surtout, leur `DEFAULT true` remplit les équipes existantes sans
 * rattrapage de données. Le vocabulaire — montage, événement, démontage — reste le même.
 *
 * ⚠️ Ce fichier ne doit rien importer : il est chargé tel quel par les tests unitaires, hors Nuxt.
 */

/** Les trois périodes d'une convention, dans l'ordre chronologique. */
export const PERIODES_BENEVOLAT = ['SETUP', 'EVENT', 'TEARDOWN'] as const

export type PeriodeBenevolat = (typeof PERIODES_BENEVOLAT)[number]

/** Ce qu'une équipe couvre. */
export interface PeriodesDEquipe {
  coversSetup?: boolean | null
  coversEvent?: boolean | null
  coversTeardown?: boolean | null
}

/**
 * Ce qu'un bénévole a annoncé.
 *
 * Nullable en base : une disponibilité jamais renseignée vaut `null`, traitée comme « pas
 * disponible » — comme le fait déjà `isVolunteerEligibleForMeal`.
 */
export interface DisponibilitesDuBenevole {
  setupAvailability?: boolean | null
  eventAvailability?: boolean | null
  teardownAvailability?: boolean | null
}

/** Les périodes réellement couvertes par l'équipe, pour l'affichage comme pour le comptage. */
export function periodesDeLEquipe(equipe: PeriodesDEquipe): PeriodeBenevolat[] {
  const periodes: PeriodeBenevolat[] = []
  if (equipe.coversSetup) periodes.push('SETUP')
  if (equipe.coversEvent) periodes.push('EVENT')
  if (equipe.coversTeardown) periodes.push('TEARDOWN')
  return periodes
}

/**
 * Une équipe couvre-t-elle au moins une période&nbsp;?
 *
 * Aucune n'est un état incohérent — l'équipe ne serait proposée à personne. Les points d'API le
 * refusent ; cette fonction est ce qu'ils appellent, et ce que l'écran de gestion consulte pour
 * empêcher l'enregistrement avant l'aller-retour.
 */
export function equipeCouvreAuMoinsUnePeriode(equipe: PeriodesDEquipe): boolean {
  return periodesDeLEquipe(equipe).length > 0
}

/**
 * L'équipe recoupe-t-elle les disponibilités annoncées&nbsp;?
 *
 * Il suffit d'UNE période commune : quelqu'un qui vient au montage et à l'événement peut préférer
 * une équipe qui n'existe qu'au montage. Exiger que l'équipe soit entièrement couverte par ses
 * disponibilités écarterait au contraire les équipes présentes partout, c'est-à-dire presque
 * toutes — l'inverse de ce qu'on veut.
 */
export function equipeRecoupeLesDisponibilites(
  equipe: PeriodesDEquipe,
  dispos: DisponibilitesDuBenevole
): boolean {
  return (
    (!!equipe.coversSetup && !!dispos.setupAvailability) ||
    (!!equipe.coversEvent && !!dispos.eventAvailability) ||
    (!!equipe.coversTeardown && !!dispos.teardownAvailability)
  )
}

/**
 * Les équipes qu'on peut proposer à ce bénévole.
 *
 * Tant qu'AUCUNE disponibilité n'est cochée, on ne filtre pas : au premier affichage du formulaire
 * la liste serait vide, et le champ disparaîtrait avant même que le candidat ait dit quand il vient.
 * Il le verrait donc apparaître de nulle part — alors que ne rien cocher n'est pas un choix, c'est
 * un formulaire encore vierge.
 */
export function equipesProposables<T extends PeriodesDEquipe>(
  equipes: T[],
  dispos: DisponibilitesDuBenevole
): T[] {
  const aCoche =
    !!dispos.setupAvailability || !!dispos.eventAvailability || !!dispos.teardownAvailability
  if (!aCoche) return equipes

  return equipes.filter((equipe) => equipeRecoupeLesDisponibilites(equipe, dispos))
}
