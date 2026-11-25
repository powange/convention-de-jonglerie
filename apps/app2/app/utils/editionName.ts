/**
 * Nom à afficher pour un événement — contrat d'hôte de l'interface du layer bénévoles. App1
 * compose « Convention - Édition » ; un événement Flowvent n'a que son nom.
 */
export function getEditionDisplayName(
  edition: { name?: string | null } | null | undefined
): string {
  return edition?.name ?? ''
}
