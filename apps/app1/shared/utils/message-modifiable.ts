/**
 * Jusqu'à quand l'auteur d'un message de la messagerie peut encore le modifier.
 *
 * Passé ce délai, le message est figé : on ne réécrit pas un message auquel les autres ont
 * peut-être déjà répondu, ce qui ferait dire à leurs réponses autre chose que ce qu'elles
 * disaient. La suppression, elle, reste possible à tout moment — elle se voit, puisque le
 * message est remplacé par « Message supprimé ».
 *
 * La règle vit ici pour que le serveur et l'écran l'appliquent à l'identique : l'écran cache
 * « Modifier » une fois le délai passé, le serveur refuse la modification. L'écran seul se
 * contournerait en appelant l'API.
 *
 * ⚠️ Ce fichier ne doit rien importer : il est chargé tel quel par les tests unitaires, hors Nuxt.
 */

/** Le délai de modification, en minutes après l'envoi. */
export const DELAI_MODIFICATION_MESSAGE_MINUTES = 15

/** Le message envoyé à `envoyeLe` peut-il encore être modifié à l'instant `maintenant` ? */
export function messageEncoreModifiable(
  envoyeLe: Date | string,
  maintenant: Date = new Date()
): boolean {
  const ecoule = maintenant.getTime() - new Date(envoyeLe).getTime()
  return ecoule < DELAI_MODIFICATION_MESSAGE_MINUTES * 60 * 1000
}
