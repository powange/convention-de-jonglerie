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
