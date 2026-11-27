/**
 * Qui peut ENTRER dans la gestion d'un événement Flowvent — contrat d'hôte des layers (la FAQ
 * l'appelle pour laisser un organisateur prévisualiser une FAQ dont la page n'est pas publique).
 *
 * Dans Flowvent, entrer, c'est voir l'événement : propriétaire, organisateur déclaré ou
 * administrateur (`droitsSurEvenement`, déjà calculés sur l'édition chargée). Le droit de MODIFIER
 * reste à vérifier à part par l'appelant (`canManageFAQ`…).
 */
import type { EditionWithPermissions } from './edition-permissions'

export async function aAccesGestionEdition(
  edition: EditionWithPermissions,
  user: { id: number }
): Promise<boolean> {
  return edition.pourUtilisateur === user.id && edition.droits.voir
}
