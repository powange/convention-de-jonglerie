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

/** Ce que voit qui a le droit de voir les éditions cachées : tout, `OFFLINE` compris. */
export const TOUS_LES_STATUTS_DEDITION = ['PUBLISHED', 'OFFLINE', 'PLANNED', 'CANCELLED'] as const

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
 * `voitLesEditionsCachees` n'est pas « est connecté » : la connexion ne donne aucun droit ici.
 * C'est à l'appelant de dire s'il a vérifié quelque chose.
 */
export function filtreStatutEdition(voitLesEditionsCachees = false): { in: StatutEdition[] } {
  return {
    in: [...(voitLesEditionsCachees ? TOUS_LES_STATUTS_DEDITION : STATUTS_VISIBLES_PUBLIQUEMENT)],
  }
}
