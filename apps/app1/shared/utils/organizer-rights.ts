/**
 * Source unique des droits d'organisateur.
 *
 * Ces listes étaient auparavant recopiées à la main dans les types, le formulaire de droits,
 * le store, le menu de gestion et le guide. Rien ne reliait ces copies entre elles : quand
 * Workshops, FAQ, Tâches et Stock ont été ajoutés au schéma, plusieurs sont restées en arrière
 * — les types `OrganizerRights` et `OrganizerPerEditionRights` en oubliaient encore deux, et le
 * guide documentait deux droits qui n'ont jamais existé.
 *
 * Tout ce qui énumère des droits doit désormais dériver d'ici. Un test unitaire
 * (test/unit/guide/permissions-sync.test.ts) vérifie que ces listes correspondent exactement
 * aux champs du schéma Prisma.
 */

/**
 * Droits au niveau convention, valables sur toutes ses éditions.
 *
 * Clés courtes, telles que l'API les expose dans `rights` — le schéma Prisma les préfixe de
 * `can` (`manageFAQ` ↔ `canManageFAQ`).
 */
export const CONVENTION_RIGHTS = [
  'editConvention',
  'deleteConvention',
  'manageOrganizers',
  'addEdition',
  'editAllEditions',
  'deleteAllEditions',
  'manageVolunteers',
  'manageArtists',
  'manageMeals',
  'manageTicketing',
  'manageTasks',
  'manageStock',
  'manageWorkshops',
  'manageFAQ',
] as const

export type ConventionRight = (typeof CONVENTION_RIGHTS)[number]

/**
 * Droits attribuables édition par édition.
 *
 * Clés longues `canX`, telles que l'API les expose dans `perEditionRights` — contrairement aux
 * droits de convention, qui sont exposés en clés courtes.
 */
export const EDITION_RIGHTS = [
  'canEdit',
  'canDelete',
  'canManageVolunteers',
  'canManageArtists',
  'canManageMeals',
  'canManageTicketing',
  'canManageTasks',
  'canManageStock',
  'canManageWorkshops',
  'canManageFAQ',
] as const

export type EditionRight = (typeof EDITION_RIGHTS)[number]

/**
 * Droits « métier » d'une édition : les modules, à l'exclusion de `canEdit` et `canDelete` qui
 * portent sur la fiche de l'édition elle-même.
 *
 * Exprimés en clé courte, car c'est sous cette forme qu'ils apparaissent dans les droits de
 * convention (`rights.manageFAQ`), le pendant par édition étant `canManageFAQ`.
 *
 * Tous obéissent à la même règle d'accès : le store en dérive ses huit méthodes, et un test
 * vérifie qu'aucun n'est oublié.
 */
export const EDITION_MODULE_RIGHTS = [
  'manageVolunteers',
  'manageArtists',
  'manageMeals',
  'manageTicketing',
  'manageTasks',
  'manageStock',
  'manageWorkshops',
  'manageFAQ',
] as const

export type EditionModuleRight = (typeof EDITION_MODULE_RIGHTS)[number]

/** Droits de convention d'un organisateur, tous optionnels. */
export type OrganizerConventionRights = Partial<Record<ConventionRight, boolean>>

/** Droits d'un organisateur sur une édition donnée, tous optionnels. */
export type OrganizerEditionRights = Partial<Record<EditionRight, boolean>>

/** Clé i18n du libellé d'un droit, commune aux deux niveaux (`permissions.manageFAQ`). */
export const rightLabelKey = (right: ConventionRight | EditionRight): string => {
  // Les droits d'édition portent le préfixe `can` que les libellés n'ont pas.
  const short = right.startsWith('can') ? right.charAt(3).toLowerCase() + right.slice(4) : right
  return `permissions.${short}`
}
