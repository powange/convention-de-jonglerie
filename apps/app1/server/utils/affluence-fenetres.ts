import type { FenetrePresence } from '~~/shared/utils/presence-benevole'

import { fenetreDe } from '~~/shared/utils/presence-benevole'

/**
 * La fenêtre de présence de chaque population, et ce qu'on fait quand elle n'est pas déclarée.
 *
 * Quatre populations franchissent la porte et aucune ne déclare sa présence de la même façon :
 *
 * | population    | ce qu'elle porte                              | renseigné en base   |
 * | ------------- | --------------------------------------------- | ------------------- |
 * | billet        | les dates du TARIF (`presenceFrom/Until`)     | neuf, donc vide     |
 * | bénévole      | `AAAA-MM-JJ_moment`, en texte                 | 192 sur 212         |
 * | artiste       | de vrais instants                             | 35 sur 89           |
 * | organisateur  | `AAAA-MM-JJ_moment`, comme les bénévoles      | neuf, donc vide     |
 *
 * Les replis comptent donc autant que les données : au jour de la mise en ligne, c'est par eux que
 * le graphique dira quelque chose. Chacun est celui que l'utilisateur a choisi, et ils sont écrits
 * ici et nulle part ailleurs pour qu'on puisse les relire d'un coup d'œil.
 */

/** Les bornes de l'édition, telles que le journal des entrées les lit déjà. */
export interface PeriodesEdition {
  /** Début du montage, ou début de l'événement à défaut. */
  montage: number
  /** Début de l'événement proprement dit. */
  debut: number
  /** Fin de l'événement proprement dit. */
  fin: number
  /** Fin du démontage, ou fin de l'événement à défaut. */
  demontage: number
}

/** Ce qu'une borne vaut quand elle est absente : rien, donc aucune limite. */
const instantDe = (date: Date | null | undefined): number | null => (date ? date.getTime() : null)

/**
 * Un détenteur de billet : les dates de son tarif.
 *
 * Repli — choix de l'utilisateur : **toute la durée de l'édition**. C'est ce qui fait que le
 * graphique fonctionne dès la mise en ligne sur les 72 tarifs existants, dont aucun ne porte encore
 * de fenêtre, et qu'il se précise à mesure que les organisateurs les renseignent.
 *
 * `countAsParticipant` ne filtre RIEN ici : un tee-shirt n'amène personne, mais la personne qui
 * l'achète a bien franchi la porte, et son entrée a été validée. C'est le tarif dont la fenêtre est
 * paramétrable qui est réservé aux participants, pas la présence elle-même.
 */
export function fenetreDuBillet(
  tarif: { presenceFrom: Date | null; presenceUntil: Date | null } | null | undefined,
  periodes: PeriodesEdition
): FenetrePresence {
  return {
    arrivee: instantDe(tarif?.presenceFrom) ?? periodes.debut,
    depart: instantDe(tarif?.presenceUntil) ?? periodes.fin,
  }
}

/**
 * Un bénévole : ses dates déclarées, lues par l'util partagé qui sert déjà au planificateur et au
 * module repas.
 *
 * Repli — choix de l'utilisateur : ses **périodes de disponibilité**. Elles sont bien plus souvent
 * renseignées que les dates elles-mêmes (109 montages, 184 événements, 89 démontages sur 212
 * candidatures), et elles disent la même chose en plus gros.
 *
 * La fenêtre s'étend de la première période déclarée à la dernière : quelqu'un de disponible au
 * montage ET au démontage est là du début à la fin, et il n'y a pas lieu de lui inventer une absence
 * au milieu.
 */
export function fenetreDuBenevole(
  candidature: {
    arrivalDateTime?: string | null
    departureDateTime?: string | null
    setupAvailability?: boolean | null
    eventAvailability?: boolean | null
    teardownAvailability?: boolean | null
  },
  periodes: PeriodesEdition,
  fuseau: string | null | undefined
): FenetrePresence {
  const declaree = fenetreDe(candidature, fuseau)

  return {
    arrivee:
      declaree.arrivee ?? (candidature.setupAvailability ? periodes.montage : periodes.debut),
    depart:
      declaree.depart ?? (candidature.teardownAvailability ? periodes.demontage : periodes.fin),
  }
}

/**
 * Un artiste : ses instants d'arrivée et de départ, qu'il déclare lui-même depuis `my-presence`.
 *
 * Repli — choix de l'utilisateur : **l'événement hors montage et démontage**. Un artiste vient pour
 * jouer, pas pour monter le chapiteau.
 */
export function fenetreDeLArtiste(
  artiste: { arrivalDateTime: Date | null; departureDateTime: Date | null },
  periodes: PeriodesEdition
): FenetrePresence {
  return {
    arrivee: instantDe(artiste.arrivalDateTime) ?? periodes.debut,
    depart: instantDe(artiste.departureDateTime) ?? periodes.fin,
  }
}

/**
 * Un organisateur : ses dates déclarées, au **format des bénévoles** et lues par le même util.
 *
 * Elles n'existaient pas avant ce chantier — l'utilisateur a demandé à les ajouter, saisies depuis
 * la modale du tableau des organisateurs.
 *
 * Repli : l'événement hors montage et démontage, comme pour un artiste. Un organisateur est
 * souvent là bien avant et bien après, mais rien ne permet de l'affirmer, et le supposer gonflerait
 * l'affluence des journées de montage d'un nombre inventé.
 */
export function fenetreDeLOrganisateur(
  organisateur: { arrivalDateTime?: string | null; departureDateTime?: string | null },
  periodes: PeriodesEdition,
  fuseau: string | null | undefined
): FenetrePresence {
  const declaree = fenetreDe(organisateur, fuseau)

  return {
    arrivee: declaree.arrivee ?? periodes.debut,
    depart: declaree.depart ?? periodes.fin,
  }
}
