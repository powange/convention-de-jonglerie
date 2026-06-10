/**
 * Pronoms utilisateur.
 *
 * Les **valeurs** stockées sont neutres (langue-indépendantes) ; le **libellé**
 * affiché est traduit via i18n (`profile.pronouns_options.<value>`).
 * Ex. la valeur `she` s'affiche « elle » en français, « she » en anglais, etc.
 */
export const USER_PRONOUNS = ['she', 'he', 'they'] as const

export type UserPronoun = (typeof USER_PRONOUNS)[number]

/** Vrai si la valeur est un pronom valide (ou vide = non renseigné). */
export function isValidPronoun(value: unknown): boolean {
  return value === '' || value === null || USER_PRONOUNS.includes(value as UserPronoun)
}
