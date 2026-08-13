/**
 * Lecture et écriture des horaires d'un programme dans le fuseau de l'édition.
 *
 * Un horaire de convention est une heure de lieu : « le gala est à 21 h » signifie 21 h sur place,
 * quel que soit le fuseau de qui consulte le programme. La base, elle, ne stocke que des instants.
 * Il faut donc un fuseau pour passer de l'un à l'autre, et le seul qui convienne est celui de
 * l'édition.
 *
 * Le fuseau de la machine ne convient jamais :
 *
 * - côté serveur, c'est UTC en conteneur — une heure lue « 12:00 » sur un site devenait midi UTC ;
 * - côté navigateur, c'est celui du lecteur — un spectateur en voyage aurait vu le programme
 *   glisser de plusieurs heures pendant son trajet, et un organisateur en déplacement aurait saisi
 *   des horaires faux.
 *
 * Ce module ne dépend ni du réseau ni de la base : il se teste sur des chaînes.
 */

import { DateTime } from 'luxon'

/**
 * Fuseau utilisable, ou `undefined` pour celui de la machine.
 *
 * Une édition peut ne pas déclarer de fuseau — le champ est facultatif, et les éditions anciennes
 * n'en ont pas — et un fuseau enregistré peut être invalide, la valeur venant parfois d'un import.
 *
 * Pour **afficher**, ces deux cas retombent sur la machine plutôt que de refuser : un programme
 * aux heures peut-être décalées reste plus utile qu'une page vide, et l'écart se corrige au
 * rechargement suivant. Pour **écrire**, `versInstant` est plus sévère — voir sa note.
 */
const fuseauUtilisable = (fuseau?: string | null): string | undefined => {
  if (!fuseau) return undefined
  return DateTime.local().setZone(fuseau).isValid ? fuseau : undefined
}

const enDateTime = (instant: string | Date, fuseau?: string | null): DateTime => {
  const zone = fuseauUtilisable(fuseau)
  return instant instanceof Date
    ? DateTime.fromJSDate(instant, { zone })
    : DateTime.fromISO(instant, { zone })
}

/**
 * Instant absolu correspondant à une date-heure locale de l'édition.
 *
 * L'entrée est une heure sans fuseau — `2026-08-01T12:00` ou `2026-08-01T12:00:00`, telle que la
 * rend un champ `datetime-local` ou telle qu'elle est écrite sur le site d'un organisateur. Elle
 * n'est ancrée qu'ici.
 */
export const versInstant = (dateHeureLocale: string, fuseau?: string | null): string => {
  /**
   * Seule fonction stricte du module, et la seule qui écrive : un fuseau annoncé mais inconnu
   * n'autorise pas à retomber sur la machine. L'appelant croit tenir le fuseau de la convention,
   * et enregistrerait un instant faux sans que rien ne le signale — une donnée fausse en base
   * survit longtemps, là où un affichage approximatif disparaît au rechargement. Un fuseau
   * *absent*, lui, reste un cas courant et légitime : l'édition n'en déclare pas encore.
   */
  if (fuseau && !fuseauUtilisable(fuseau)) return ''

  const dt = DateTime.fromISO(dateHeureLocale, { zone: fuseauUtilisable(fuseau) })
  // Une saisie illisible ne doit pas produire une date silencieusement fausse : mieux vaut que
  // l'API refuse une chaîne vide que d'enregistrer un instant inventé.
  //
  // Une heure inexistante — 2 h 30 la nuit où l'on passe de 2 h à 3 h — n'entre pas dans ce cas :
  // luxon la reporte après le saut plutôt que de la refuser, ce qui est le comportement voulu.
  // La nuit inverse, où la même heure survient deux fois, retient la première.
  return dt.isValid ? dt.toUTC().toISO()! : ''
}

/**
 * Date-heure locale `AAAA-MM-JJTHH:MM` d'un instant, pour un champ `datetime-local`.
 *
 * C'est l'opération inverse de `versInstant` : ce que le formulaire réaffiche doit être ce que
 * l'organisateur avait saisi, sans quoi une simple ouverture de la modale suivie d'un
 * enregistrement décalerait l'horaire.
 */
export const versChampLocal = (instant: string | Date, fuseau?: string | null): string => {
  const dt = enDateTime(instant, fuseau)
  return dt.isValid ? dt.toFormat("yyyy-MM-dd'T'HH:mm") : ''
}

/**
 * Journée `AAAA-MM-JJ` à laquelle appartient un instant, dans le fuseau de l'édition.
 *
 * Découper les journées ailleurs que sur place ferait basculer de jour les moments de fin de
 * soirée : une scène ouverte à 23 h se retrouverait au lendemain pour un lecteur situé plus à
 * l'est, et le programme se lirait sur un jour de trop.
 */
export const journeeDans = (instant: string | Date, fuseau?: string | null): string => {
  const dt = enDateTime(instant, fuseau)
  return dt.isValid ? dt.toFormat('yyyy-MM-dd') : ''
}

/**
 * Heure à laquelle une journée de programme cède la place à la suivante.
 *
 * Trois heures du matin, et non minuit : une scène ouverte qui démarre le vendredi à 00 h 30 est,
 * pour tout le monde sur place, la soirée du jeudi. La ranger au vendredi la ferait apparaître en
 * tête d'une journée qui n'a pas encore commencé, loin des créneaux qu'elle prolonge.
 */
export const HEURE_BASCULE_JOURNEE = 3

/**
 * Journée **de programme** d'un instant, au format `AAAA-MM-JJ`.
 *
 * Distincte de la journée calendaire : tout ce qui commence avant `HEURE_BASCULE_JOURNEE` est
 * rattaché à la veille. C'est le découpage à utiliser partout où un programme se lit par jour ;
 * `journeeDans` reste la date civile, pour ce qui doit dater et non regrouper.
 */
export const journeeDeProgramme = (instant: string | Date, fuseau?: string | null): string => {
  const dt = enDateTime(instant, fuseau)
  return dt.isValid ? dt.minus({ hours: HEURE_BASCULE_JOURNEE }).toFormat('yyyy-MM-dd') : ''
}

/**
 * Instant où s'achève une journée de programme `AAAA-MM-JJ`.
 *
 * C'est `HEURE_BASCULE_JOURNEE` du lendemain : la journée du 6 août court jusqu'à 3 h le 7. Sert à
 * décider qu'un moment est terminé quand il n'annonce pas d'heure de fin.
 */
export const finDeJourneeDeProgramme = (journee: string, fuseau?: string | null): string => {
  const dt = DateTime.fromISO(journee, { zone: fuseauUtilisable(fuseau) })
  return dt.isValid ? dt.plus({ days: 1, hours: HEURE_BASCULE_JOURNEE }).toUTC().toISO()! : ''
}

/**
 * Libellé d'une journée, à partir soit d'une journée `AAAA-MM-JJ`, soit d'un instant.
 *
 * Les deux formes se présentent : les entêtes de la frise portent une journée nue, les bornes de
 * l'édition un instant. Les confondre coûtait un jour : `new Date('2026-08-01')` désigne minuit
 * **en temps universel**, et s'affichait donc au 31 juillet pour un lecteur à l'ouest de
 * Greenwich. Une journée nue n'est ici jamais convertie ; seul un instant l'est, dans le fuseau de
 * l'édition.
 */
export const formaterJournee = (
  journeeOuInstant: string | Date,
  fuseau?: string | null,
  locale = 'fr',
  // L'année est superflue sur une frise, dont toutes les journées appartiennent à la même
  // édition, mais utile là où une date est donnée seule.
  options: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }
): string => {
  const dt =
    typeof journeeOuInstant === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(journeeOuInstant)
      ? DateTime.fromISO(journeeOuInstant)
      : enDateTime(journeeOuInstant, fuseau)
  return dt.isValid ? dt.setLocale(locale).toLocaleString(options) : ''
}

/** Heure `HH:MM` d'un instant, telle qu'elle est vécue sur place. */
export const formaterHeure = (
  instant: string | Date,
  fuseau?: string | null,
  locale = 'fr'
): string => {
  const dt = enDateTime(instant, fuseau)
  return dt.isValid ? dt.setLocale(locale).toLocaleString(DateTime.TIME_SIMPLE) : ''
}

/** Date et heure d'un instant — « 1 août, 12:00 » — dans le fuseau de l'édition. */
export const formaterDateHeure = (
  instant: string | Date,
  fuseau?: string | null,
  locale = 'fr'
): string => {
  const dt = enDateTime(instant, fuseau)
  if (!dt.isValid) return ''
  return dt.setLocale(locale).toLocaleString({
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Abréviation du fuseau à une date donnée — « CEST », « AEDT ».
 *
 * Rendue pour une date précise et non pour le fuseau seul : l'heure d'été en fait changer, et une
 * édition d'octobre peut basculer en cours de route.
 */
export const abreviationFuseau = (
  instant: string | Date,
  fuseau?: string | null,
  locale = 'fr'
): string => {
  const zone = fuseauUtilisable(fuseau)
  if (!zone) return ''
  const dt = enDateTime(instant, zone).setLocale(locale)
  return dt.isValid ? dt.toFormat('ZZZZ') : ''
}

/**
 * Dit si les horaires affichés ne seront pas ceux de la pendule du lecteur.
 *
 * Sert à décider d'un avertissement : montrer « 21:00 » à quelqu'un dont la montre affichera une
 * autre heure au même moment est juste, mais déroutant si rien ne le dit. La comparaison porte sur
 * le décalage à la date considérée, et non sur le nom du fuseau : `Europe/Paris` et
 * `Europe/Amsterdam` sont deux noms de la même heure, et prévenir n'aurait alors aucun sens.
 */
export const differeDuFuseauLecteur = (instant: string | Date, fuseau?: string | null): boolean => {
  const zone = fuseauUtilisable(fuseau)
  if (!zone) return false
  const surPlace = enDateTime(instant, zone)
  if (!surPlace.isValid) return false
  return surPlace.offset !== surPlace.setZone('local').offset
}
