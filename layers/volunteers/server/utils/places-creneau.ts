/**
 * Reste-t-il une place sur un créneau de bénévolat ?
 *
 * Le calcul était juste mais écrit deux fois, et surtout relevé loin de l'écriture qu'il autorise :
 * le contrôle à une ligne, la création à une autre, sans transaction entre les deux. Deux requêtes
 * simultanées lisaient le même total, le trouvaient toutes deux acceptable, et créaient toutes deux
 * leur affectation. Le cas n'a rien de théorique : deux organisateurs qui remplissent le planning à
 * deux, la veille de l'événement, cliquent en même temps.
 *
 * La contrainte d'unicité en base empêche qu'une même personne soit affectée deux fois ; elle
 * n'empêche pas deux personnes différentes de prendre la même dernière place.
 *
 * ⚠️ Ce fichier ne doit rien importer : il est chargé tel quel par les tests unitaires, hors Nuxt.
 */

/** Ce qu'occupe un créneau, tel que le décompte de la base le rend. */
export interface OccupationCreneau {
  /** Le nombre de personnes que le créneau accueille. */
  maxVolunteers: number
  _count: {
    /** Les bénévoles affectés. */
    assignments: number
    /**
     * Les organisateurs affectés.
     *
     * Comptés avec les bénévoles, et non à part : un organisateur occupe une place comme un
     * autre. C'est une décision prise et écrite dans le schéma — l'ignorer ici laisserait
     * s'ajouter quelqu'un de trop sur un créneau déjà pourvu.
     */
    organizerAssignments: number
  }
}

/** Combien de personnes tiennent déjà ce créneau, tous titres confondus. */
export function placesOccupees(creneau: OccupationCreneau): number {
  return creneau._count.assignments + creneau._count.organizerAssignments
}

/** Combien de places restent, jamais négatif — un créneau déjà en dépassement en offre zéro. */
export function placesRestantes(creneau: OccupationCreneau): number {
  return Math.max(0, creneau.maxVolunteers - placesOccupees(creneau))
}

/**
 * Peut-on encore affecter quelqu'un ?
 *
 * La comparaison est `>=` et non `>` : un créneau exactement plein n'accepte plus personne. Écrit
 * ici une fois pour les deux endpoints d'affectation, qui se partagent le même plafond — n'en
 * corriger qu'un laisserait la course ouverte entre un bénévole et un organisateur.
 */
export function resteUnePlace(creneau: OccupationCreneau): boolean {
  return placesOccupees(creneau) < creneau.maxVolunteers
}

/** Le message rendu quand il n'y a plus de place, identique sur les deux chemins. */
export const CRENEAU_COMPLET = 'Ce créneau est déjà complet'
