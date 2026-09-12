/**
 * Qui a le droit de voir une édition, selon son statut.
 *
 * Une édition `OFFLINE` est « complète mais désactivée » : ses organisateurs l'ont volontairement
 * retirée de la vue du public. Les trois autres statuts sont publics — `CANCELLED` compris, parce
 * qu'une annulation doit rester lisible par ceux qui avaient prévu de venir.
 *
 * La règle était recopiée à cinq endroits (la liste des éditions, la fiche d'une édition, le
 * sitemap, les éditions d'une convention, la liste des pays) et manquait à un sixième — la route
 * publique des tarifs, qui livrait donc les prix d'une édition cachée à qui connaissait son
 * numéro. Cinq copies ne divergent pas tant qu'on n'y touche pas ; c'est le sixième appel, écrit
 * sans les copies sous les yeux, qui coûte.
 *
 * ⚠️ Ce fichier ne doit rien importer : il est chargé tel quel par les tests unitaires, hors Nuxt.
 */

/** Les statuts d'une édition, tels que l'enum Prisma `EditionStatus` les définit. */
export type StatutEdition = 'PLANNED' | 'PUBLISHED' | 'OFFLINE' | 'CANCELLED'

/**
 * Ce qu'un visiteur sans droit particulier peut voir.
 *
 * Se lit en creux : tout sauf `OFFLINE`. La liste est écrite en clair plutôt que déduite, pour
 * qu'un statut ajouté plus tard à l'enum soit invisible par défaut au lieu de devenir public sans
 * que personne l'ait décidé.
 */
export const STATUTS_VISIBLES_PUBLIQUEMENT = ['PUBLISHED', 'PLANNED', 'CANCELLED'] as const

/**
 * Cette édition est-elle visible d'un visiteur ?
 *
 * Un statut inconnu — une valeur venue d'ailleurs, un enum qui a bougé — répond non : mieux vaut
 * cacher une édition qu'on aurait dû montrer que l'inverse.
 */
export function editionVisiblePubliquement(statut: unknown): boolean {
  return (STATUTS_VISIBLES_PUBLIQUEMENT as readonly unknown[]).includes(statut)
}

/**
 * Le fragment Prisma correspondant, à poser dans un `where`.
 *
 * Volontairement sans paramètre, et c'est le propos : il en avait un — un booléen « voit aussi les
 * éditions cachées » — alimenté sur deux routes publiques par un simple `?includeOffline=true`,
 * sans le moindre contrôle. Une liste ne sait pas qui la demande, et ce n'est pas à elle de le
 * décider.
 *
 * Une vue « mes éditions hors ligne » ne peut donc pas revenir par ici : il lui faudrait
 * `hydrateSession` sur sa route et un contrôle d'appartenance **par édition**, comme le fait
 * `editions/[id]/index.get.ts` — pas un interrupteur global.
 *
 * Rend un tableau neuf à chaque appel : Prisma le reçoit, et un tableau partagé qu'un appelant
 * trierait changerait ce que voient tous les autres.
 */
export function filtreStatutEdition(): { in: StatutEdition[] } {
  return { in: [...STATUTS_VISIBLES_PUBLIQUEMENT] }
}
