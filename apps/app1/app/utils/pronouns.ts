/**
 * Pronoms utilisateur.
 *
 * Les **valeurs** stockées sont neutres (langue-indépendantes) ; le **libellé**
 * affiché est traduit via i18n (`profile.pronouns_options.<value>`).
 * Ex. la valeur `she` s'affiche « elle » en français, « she » en anglais, etc.
 */
export const USER_PRONOUNS = ['she', 'he', 'they'] as const

export type UserPronoun = (typeof USER_PRONOUNS)[number]

/**
 * Valeur sentinelle pour « non renseigné » dans le `USelect` (Reka UI interdit
 * la valeur vide `''` comme option). Convertie en `''`/null au stockage.
 */
export const PRONOUN_NONE = 'none'

/** Vrai si la valeur est un pronom valide (ou vide = non renseigné). */
export function isValidPronoun(value: unknown): boolean {
  return value === '' || value === null || USER_PRONOUNS.includes(value as UserPronoun)
}

/**
 * Retourne le libellé traduit d'un pronom, ou `''` si non renseigné/invalide.
 * Ex. `she` → « elle » (fr). Nécessite la fonction `t` de `useI18n()`.
 */
export function formatPronoun(
  pronouns: string | null | undefined,
  t: (key: string) => string
): string {
  if (!pronouns || pronouns === PRONOUN_NONE || !USER_PRONOUNS.includes(pronouns as UserPronoun)) {
    return ''
  }
  return t(`profile.pronouns_options.${pronouns}`)
}

/**
 * Formate le nom complet d'un utilisateur en y ajoutant le pronom entre
 * parenthèses lorsqu'il est renseigné, ex. « Jean Dupont (il) ».
 * Si le pronom est absent, retourne simplement « Prénom Nom ».
 */
export function formatUserFullName(
  user:
    | { prenom?: string | null; nom?: string | null; pronouns?: string | null }
    | null
    | undefined,
  t: (key: string) => string
): string {
  if (!user) return ''
  const name = [user.prenom, user.nom].filter(Boolean).join(' ').trim()
  const pronoun = formatPronoun(user.pronouns, t)
  if (!pronoun) return name
  return name ? `${name} (${pronoun})` : `(${pronoun})`
}
