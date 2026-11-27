/**
 * L'application d'UN événement installée sur un téléphone (cf. server/utils/application-evenement.ts).
 *
 * ⚠️ Ce fichier se suffit à lui-même (aucun import) : un test d'app1 le transpile et l'exécute
 * tel quel (apps/app1/test/unit/utils/flowvent-application-evenement.test.ts).
 */

/** Clé, en `sessionStorage`, de l'événement dont l'application est ouverte dans cette fenêtre. */
export const CLE_APPLICATION_EVENEMENT = 'flowvent-application-evenement'

/**
 * L'identifiant de l'événement d'une adresse `/events/<ref>/…`, ou `null` hors d'un événement.
 * `/events/new` (la création) n'en est pas un.
 */
export function evenementDuChemin(chemin: string): string | null {
  const m = /^\/events\/([^/?#]+)(?:[/?#]|$)/.exec(chemin)
  if (!m || m[1] === 'new') return null
  return decodeURIComponent(m[1]!)
}
