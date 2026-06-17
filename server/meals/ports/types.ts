// Ports du module repas (server/meals). Le layer meals (layers/meals) consomme ces interfaces pour
// accéder aux modules externes (artistes, billetterie) sans lire leurs modèles directement. L'app
// jonglerie les câble (default-binding) ; une 2ᵉ app sans artistes/billetterie fournit des no-op.
// Même pattern que server/volunteers/ports, mais propre au module repas.

/** Participant artiste d'un repas (vue participants). */
export interface MealArtistParticipant {
  userId: number | null
  nom: string | null
  prenom: string | null
  pseudo: string | null
  email: string | null
  phone: string | null
  dietaryPreference: string | null
  allergies: string | null
  allergySeverity: string | null
  afterShow: boolean
}

/**
 * Sélection de repas d'un artiste (vue recherche / pending / stats). Inclut **toutes** les
 * sélections du repas (pas seulement `accepted`), comportement des endpoints search/pending/stats.
 */
export interface MealArtistSelectionRow {
  selectionId: number
  userId: number | null
  nom: string | null
  prenom: string | null
  pseudo: string | null
  email: string | null
  phone: string | null
  consumedAt: Date | null
}

/** Résultat d'une (dé)validation de consommation. */
export type MealConsumptionResult = { ok: true } | { ok: false; reason: 'not_found' | 'already' }

/**
 * Accès au module **artistes** depuis le module repas. Jonglerie : `EditionArtist` +
 * `ArtistMealSelection`. Domaine sans artistes : `getMealParticipants`/`listMealSelections` → vide,
 * `markConsumed`/`cancelConsumed` → `{ ok: false, reason: 'not_found' }`.
 */
export interface MealsArtistsPort {
  /** Participants artistes acceptés par repas (clé = mealId). */
  getMealParticipants(mealIds: number[]): Promise<Record<number, MealArtistParticipant[]>>
  /** Sélections artistes acceptées d'un repas (recherche / pending / comptage). */
  listMealSelections(editionId: number, mealId: number): Promise<MealArtistSelectionRow[]>
  /** Marque la consommation (atomique : ne valide que si non déjà consommé). */
  markConsumed(
    editionId: number,
    mealId: number,
    selectionId: number,
    at: Date
  ): Promise<MealConsumptionResult>
  /** Annule la consommation d'une sélection artiste. */
  cancelConsumed(
    editionId: number,
    mealId: number,
    selectionId: number
  ): Promise<MealConsumptionResult>
}

export interface MealsPorts {
  artists: MealsArtistsPort
}
