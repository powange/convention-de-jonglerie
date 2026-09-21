/**
 * Lecture d'une date de validité de tarif, quelle que soit la forme reçue.
 *
 * Un client peut en envoyer deux :
 *
 * - un **instant daté** (`2026-10-01T21:00:00.000Z`), ce que fait le client courant, qui ancre
 *   l'heure sur le fuseau de l'édition avant de l'envoyer ;
 * - une **heure murale nue** (`2026-10-01T23:00`), ce que rend un sélecteur de date et ce que
 *   continue d'envoyer une page ouverte AVANT le déploiement qui a durci le point d'API.
 *
 * Refuser la seconde a cassé l'enregistrement pour toute personne qui n'avait pas rechargé sa
 * page, sur un « Invalid ISO datetime » incompréhensible. Une page déjà ouverte ne se met pas à
 * jour toute seule : durcir un contrat côté serveur sans accepter l'ancienne forme casse
 * silencieusement les clients en cours d'utilisation.
 *
 * L'heure nue est donc ancrée ici, dans le fuseau de l'**édition**. Jamais dans celui du
 * processus : le serveur tourne en UTC en conteneur, et c'est précisément ce que faisait le
 * `z.coerce.date()` d'origine — « 23:00 » devenait 23 h UTC, soit 1 h du matin à Paris.
 *
 * Ce module ne dépend ni du réseau ni de la base : il se teste sur des chaînes.
 */

import { versInstant } from './fuseau-edition'

/**
 * Une heure murale nue, telle que la rend un sélecteur de date : sans fuseau, ni `Z`, ni décalage.
 * La partie horaire et les secondes sont facultatives — `UiDateField` ne rend que la journée.
 */
export const HEURE_MURALE_NUE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?)?$/

/**
 * Vrai si la chaîne est une des deux formes acceptées.
 *
 * Sert à refuser à l'entrée du point d'API plutôt que de laisser `instantDeValidite` rendre
 * `null` : perdre une date de validité sans rien dire est pire que refuser l'enregistrement.
 */
export const estUneDateDeValiditeLisible = (valeur: string): boolean => {
  // La forme ne suffit pas : `2026-13-45` n'aligne que des chiffres au bon endroit. Sans cette
  // vérification, une date impossible passait la validation puis devenait `null` en base — le
  // tarif perdait sa limite et restait vendable pour toujours, sans un message nulle part.
  //
  // Le fuseau ne joue aucun rôle ici : une date lisible l'est dans tous les fuseaux. On passe
  // donc `null`, et c'est le MÊME analyseur que celui qui fera le travail ensuite.
  if (HEURE_MURALE_NUE.test(valeur)) return versInstant(valeur, null) !== ''

  return !Number.isNaN(new Date(valeur).getTime())
}

/**
 * L'instant à enregistrer, à partir de l'une ou l'autre forme.
 *
 * Rend `null` plutôt qu'une date inventée si l'ancrage échoue — fuseau annoncé mais inconnu,
 * saisie illisible. Voir la note de `versInstant` : une donnée fausse en base survit longtemps,
 * là où un refus se voit tout de suite.
 */
export function instantDeValidite(
  valeur: string | null | undefined,
  fuseauEdition: string | null
): Date | null {
  if (!valeur) return null

  if (HEURE_MURALE_NUE.test(valeur)) {
    const ancre = versInstant(valeur, fuseauEdition)
    return ancre ? new Date(ancre) : null
  }

  const date = new Date(valeur)
  return Number.isNaN(date.getTime()) ? null : date
}
