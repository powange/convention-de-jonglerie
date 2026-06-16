// DTO du module repas. Partagés par le service (server/meals) et le contrat du port
// (server/volunteers/ports/types.ts → MealsPort). `phases` est typé `unknown` car porté en `Json`
// côté Prisma (le front le consomme comme un tableau de chaînes).

/** Liaison repas ↔ article à remettre (junction VolunteerMealHandoutItem). */
export interface MealHandoutLink {
  id: number
  mealId: number
  handoutItemId: number
}

/** Définition de repas d'une édition (vue organisateur), avec ses liaisons d'articles. */
export interface EditionMealRecord {
  id: number
  editionId: number
  date: Date
  mealType: string
  enabled: boolean
  phases: unknown
  handoutItems: MealHandoutLink[]
}

/** Vue d'un repas pour un bénévole (sélection + éligibilité éventuelle). */
export interface VolunteerMealView {
  id: number
  date: Date
  mealType: string
  phases: unknown
  selectionId: number | null | undefined
  accepted: boolean
  eligible?: boolean
}

/** Bascule d'activation d'un repas (pour piloter les sélections artistes en aval). */
export interface MealToggle {
  mealId: number
  date: Date
  mealType: string
  enabled: boolean
}

/** Entrée de mise à jour d'un repas (config + articles à remettre). */
export interface MealUpdateInput {
  id: number
  enabled?: boolean
  phases?: string[]
  handoutItemIds?: number[]
}

/** Participant bénévole d'un repas (catering). */
export interface MealVolunteerParticipant {
  nom: string | null
  prenom: string | null
  email: string | null
  phone: string | null
  dietaryPreference: string | null
  allergies: string | null
  allergySeverity: string | null
  emergencyContactName: string | null
  emergencyContactPhone: string | null
}

/** Repas (activé) d'une date avec ses participants bénévoles acceptés (catering). */
export interface CateringMeal {
  id: number
  mealType: string
  phases: unknown
  volunteers: MealVolunteerParticipant[]
}
