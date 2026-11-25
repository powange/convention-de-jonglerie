/**
 * Flowvent n'a pas de module repas : personne ne les gère. Contrat d'hôte du layer bénévoles
 * (ses routes de repas ne sont pas exposées par l'interface de Flowvent).
 */
export async function canManageMealsById(
  _eventId: number,
  _userId: number,
  _event?: unknown
): Promise<boolean> {
  return false
}
