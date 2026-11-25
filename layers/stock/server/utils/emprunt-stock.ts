/**
 * L'enchaînement d'un emprunt de matériel.
 *
 * Sorti de `stock-helpers` parce que ce dernier tire des alias `#server` que le projet de tests
 * unitaires ne résout pas : une règle qu'on ne peut pas éprouver isolément finit par n'être
 * éprouvée nulle part.
 */
/** Les deux dates qui jalonnent un emprunt externe. */
export interface JalonsEmprunt {
  pickedUpAt: Date | string | null
  returnedAt: Date | string | null
}

/**
 * Un emprunt se déroule dans l'ordre : on va chercher le matériel, puis on le rapporte.
 *
 * Marquer un retour sans récupération laisserait une fiche qui affirme deux choses
 * contradictoires — « jamais allé le chercher » et « rendu ». La règle vaut dans les deux sens :
 * elle interdit aussi d'annuler la récupération d'un matériel déjà rendu.
 *
 * Rend le message à opposer, ou `null` si l'enchaînement tient. Les valeurs non fournies dans la
 * demande sont celles déjà en base : c'est l'état APRÈS écriture qui est jugé, sans quoi une
 * requête posant les deux dates d'un coup serait refusée à tort.
 */
export function erreurOrdreEmprunt(
  actuel: JalonsEmprunt,
  demande: Partial<JalonsEmprunt>
): string | null {
  const pickedUpAt = demande.pickedUpAt !== undefined ? demande.pickedUpAt : actuel.pickedUpAt
  const returnedAt = demande.returnedAt !== undefined ? demande.returnedAt : actuel.returnedAt

  if (returnedAt && !pickedUpAt) {
    return "Le matériel doit d'abord être marqué comme récupéré"
  }
  return null
}
