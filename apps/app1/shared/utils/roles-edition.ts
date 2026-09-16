/**
 * Les modules qu'un organisateur peut réellement gérer sur une édition donnée.
 *
 * Un droit vient de DEUX sources, et ne regarder que l'une des deux donne une réponse fausse :
 *
 * - la **convention**, et le droit vaut alors pour toutes ses éditions, y compris celles créées
 *   plus tard — c'est ainsi qu'on équipe un membre permanent de l'équipe ;
 * - l'**édition** elle-même, pour un renfort recruté sur une seule année.
 *
 * La colonne « Rôles » du tableau des organisateurs affiche le résultat des deux. N'afficher que
 * les droits par édition laisserait vide la ligne de quelqu'un qui a tout au niveau convention —
 * exactement l'inverse de ce qu'on veut lire.
 *
 * ⚠️ Ce fichier ne doit rien importer d'autre que la liste des droits : il est chargé tel quel par
 * les tests unitaires, hors Nuxt.
 */
import { EDITION_MODULE_RIGHTS, type EditionModuleRight } from './organizer-rights'

/** Les droits de convention, en clés longues telles que le schéma les porte. */
export interface DroitsDeConvention {
  canManageVolunteers?: boolean | null
  canManageArtists?: boolean | null
  canManageMeals?: boolean | null
  canManageTicketing?: boolean | null
  canManageTasks?: boolean | null
  canManageStock?: boolean | null
  canManageWorkshops?: boolean | null
  canManageFAQ?: boolean | null
  canManageTreasury?: boolean | null
}

/** Les droits accordés sur cette édition seulement. Même forme, autre table. */
export type DroitsDEdition = DroitsDeConvention

/** La clé longue d'un droit de module : `manageMeals` → `canManageMeals`. */
export function cleLongue(module: EditionModuleRight): keyof DroitsDeConvention {
  return `can${module.charAt(0).toUpperCase()}${module.slice(1)}` as keyof DroitsDeConvention
}

/**
 * Les modules gérables, dans l'ordre de `EDITION_MODULE_RIGHTS`.
 *
 * @param convention droits de convention, ou `null` si la personne n'en a aucun
 * @param edition    droits accordés sur cette édition, ou `null` s'il n'y en a pas
 * @param toutPuissant vrai pour qui a tout d'office — l'auteur de la convention, le créateur de
 *                     l'édition. Sans ce cas, leur ligne paraîtrait vide alors qu'ils peuvent
 *                     tout, ce qui est le plus trompeur des affichages.
 */
export function rolesDeLEdition(
  convention: DroitsDeConvention | null | undefined,
  edition: DroitsDEdition | null | undefined,
  toutPuissant = false
): EditionModuleRight[] {
  if (toutPuissant) return [...EDITION_MODULE_RIGHTS]

  return EDITION_MODULE_RIGHTS.filter((module) => {
    const cle = cleLongue(module)
    // L'un OU l'autre : un droit de convention n'a pas besoin d'être redonné sur chaque édition.
    return convention?.[cle] === true || edition?.[cle] === true
  })
}

/**
 * Une couleur par rôle, pour repérer d'un coup d'œil qui partage le même.
 *
 * Neuf teintes tenues à l'écart les unes des autres : c'est toute l'utilité de la colonne, et
 * deux rôles de même couleur la lui retireraient. Un test vérifie qu'aucune n'est partagée.
 *
 * Des hexadécimaux plutôt que des couleurs Nuxt UI : celles-ci n'en offrent que sept, et les
 * détourner de leur sens — `error` pour un rôle qui n'a rien d'une erreur — se lit mal. La
 * pastille les applique comme le fait déjà la colonne des équipes : fond très clair, bordure et
 * texte à pleine teinte, ce qui tient sur fond clair comme sur fond sombre.
 */
export const COULEURS_DES_ROLES: Record<EditionModuleRight, string> = {
  manageVolunteers: '#16a34a', // vert
  manageArtists: '#9333ea', // violet
  manageMeals: '#ea580c', // orange
  manageTicketing: '#2563eb', // bleu
  manageTasks: '#475569', // ardoise
  manageStock: '#ca8a04', // ambre
  manageWorkshops: '#0891b2', // cyan
  manageFAQ: '#db2777', // rose
  manageTreasury: '#b91c1c', // rouge brique
}

/** La couleur d'un rôle, ou une teinte neutre pour un rôle inconnu. */
export function couleurDuRole(role: string): string {
  return COULEURS_DES_ROLES[role as EditionModuleRight] ?? '#6b7280'
}
