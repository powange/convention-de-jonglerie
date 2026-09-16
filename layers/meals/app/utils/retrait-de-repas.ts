/**
 * Comment on retire à quelqu'un le droit à un repas, selon le titre auquel il le tient.
 *
 * Les trois sources n'ont ni la même adresse ni le même corps de requête, et c'est irréductible :
 * un bénévole et un artiste ont chacun une ligne de sélection à modifier, un organisateur n'en a
 * pas — son droit tient à l'absence de refus, et se désigne donc par le repas.
 *
 * ⚠️ **Toujours envoyer `mealId`, même quand `selectionId` suffirait.** `setVolunteerMeals` ouvre
 * sur `if (!selection.mealId) return` : une sélection sans repas est **ignorée en silence**. Le
 * point d'API répond alors 200 avec la liste inchangée — l'écran affichait « Droit au repas
 * retiré » et rien n'avait bougé. C'est exactement le défaut qu'a trouvé l'utilisateur en cliquant
 * « Désactiver » sur la ligne bénévole d'un vendredi soir. Les tests du service ne l'avaient pas vu
 * parce qu'ils passaient tous `mealId`.
 *
 * ⚠️ Ce fichier ne doit rien importer : il est chargé tel quel par les tests unitaires, hors Nuxt.
 */

/** Le titre auquel une personne mange. La billetterie en est absente : un billet ne porte qu'une
 * adresse de courriel, et rien ne permettrait d'en retirer le droit. */
export type SourceDeRepas = 'volunteer' | 'artist' | 'organizer'

/** Un droit à un repas, et de quoi le retirer. Même forme que côté serveur. */
export interface DroitAuRepas {
  source: SourceDeRepas
  mealId: number
  userId: number
  /** `EditionVolunteerApplication.id`, `EditionArtist.id` ou `EditionOrganizer.id` selon la source. */
  roleId: number
  /** `null` pour un organisateur, dont le droit tient à l'absence de refus, pas à une ligne. */
  selectionId: number | null
}

/** Une sélection telle que les trois points d'API l'attendent. */
export interface SelectionARetirer {
  mealId: number
  selectionId?: number
  accepted: false
}

/**
 * L'adresse à appeler pour retirer ces droits.
 *
 * Tous les droits d'un même appel doivent partager la source ET la personne : l'URL porte
 * l'identifiant de rôle, un seul par requête. C'est le cas par construction — l'écran ne groupe
 * jamais que les droits d'une même source d'une même personne.
 */
export function urlDuRetrait(editionId: number, droits: readonly DroitAuRepas[]): string {
  const premier = droits[0]
  if (!premier) return ''
  if (premier.source === 'volunteer') {
    return `/api/editions/${editionId}/volunteers/${premier.roleId}/meals`
  }
  if (premier.source === 'artist') {
    return `/api/editions/${editionId}/artists/${premier.roleId}/meals`
  }
  return `/api/editions/${editionId}/organizers/edition-organizers/${premier.roleId}/meals`
}

/**
 * Le corps de la requête : les sélections à passer à `accepted: false`.
 *
 * `mealId` y figure toujours — voir l'avertissement en tête de fichier. `selectionId` n'accompagne
 * que les droits qui en ont un ; le schéma de l'organisateur l'écarterait de toute façon, zod
 * retirant les clés inconnues sans rien dire.
 */
export function corpsDuRetrait(droits: readonly DroitAuRepas[]): {
  selections: SelectionARetirer[]
} {
  return {
    selections: droits.map((droit) => ({
      mealId: droit.mealId,
      ...(droit.selectionId !== null ? { selectionId: droit.selectionId } : {}),
      accepted: false as const,
    })),
  }
}
