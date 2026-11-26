// Ports du module « artistes » (layers/artists). Le layer consomme ces interfaces pour résoudre les
// données propres au domaine (bloc d'infos artistes porté par l'Edition, catalogue des repas de
// l'événement) sans lire les modèles d'autres modules. Même pattern que les autres modules.
//
// Frontière artistes ↔ repas : les artistes possèdent leurs SÉLECTIONS de repas
// (`ArtistMealSelection`, lues/écrites directement par le layer, y c. la relation `meal` pour le
// détail). En revanche le CATALOGUE des repas activés de l'événement (`VolunteerMeal`) appartient au
// module repas et passe par le port `meals.getEnabledMeals`.

/** Un repas activé du catalogue de l'événement (sous-ensemble utilisé pour la synchro artistes). */
export interface ArtistEditionMeal {
  id: number
  date: Date | string
  mealType: string
  enabled: boolean
  [key: string]: unknown
}

export interface ArtistsEventPort {
  /**
   * Écrit le bloc d'infos artistes propre au domaine (jonglerie : champ `Edition.artistInfo`) et
   * invalide le cache d'édition. Renvoie l'enregistrement mis à jour.
   */
  setArtistInfo(
    editionId: number,
    artistInfo: string | null
  ): Promise<{ id: number; artistInfo: string | null }>

  /**
   * L'édition (ou l'événement) lue par les appels à spectacles : son statut et ses dates, et le nom
   * à afficher — celui de l'édition, à défaut celui de sa convention. `null` si elle n'existe pas.
   */
  lireEdition(editionId: number): Promise<EditionLue | null>

  /**
   * Ce qu'un appel à spectacles sélectionne de son édition pour l'afficher (annuaire public,
   * candidatures d'un artiste, sondage) — un `select` Prisma propre à l'app, puisque l'édition
   * d'app1 et l'événement de Flowvent n'ont pas les mêmes colonnes. À passer ensuite par
   * `editionAffichee`.
   */
  selectionEditionAffichee: Record<string, unknown>

  /**
   * Le filtre Prisma « édition pas encore terminée » (annuaire des appels ouverts). Propre à l'app :
   * la date de fin est obligatoire dans app1, facultative dans Flowvent (un événement sans fin
   * dure sa journée de début).
   */
  filtreEditionsPasTerminees(maintenant: Date): Record<string, unknown>

  /** Ramène une édition lue par `selectionEditionAffichee` à la forme commune affichée. */
  editionAffichee(brute: unknown): EditionAffichee
}

/** L'édition telle que les appels à spectacles la lisent. */
export interface EditionLue {
  id: number
  name: string | null
  status: string
  startDate: Date | null
  endDate: Date | null
  /** Le nom de l'édition, à défaut celui de sa convention. */
  nomAffiche: string
}

/** L'édition telle que les écrans des appels à spectacles l'affichent, dans les deux apps. */
export interface EditionAffichee {
  id: number
  name: string | null
  startDate: Date | null
  endDate: Date | null
  timezone: string | null
  city: string | null
  country: string | null
  imageUrl: string | null
  /** Dans Flowvent, l'événement lui-même (pas de convention). */
  convention: { id: number; name: string; logo: string | null }
}

export interface ArtistsMealsPort {
  /**
   * Catalogue des repas activés de l'événement, triés (date, type) — pour synchroniser les
   * sélections repas d'un artiste. Domaine sans repas : liste vide.
   */
  getEnabledMeals(editionId: number): Promise<ArtistEditionMeal[]>
}

export interface ArtistsPorts {
  event: ArtistsEventPort
  meals: ArtistsMealsPort
}
