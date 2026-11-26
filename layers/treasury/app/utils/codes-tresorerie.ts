/**
 * Quels codes d'imputation proposer sur une ligne de trésorerie.
 *
 * La règle vit ici, et non dans les composants, parce qu'elle est appliquée à **deux endroits** :
 * le select de chaque ligne sur la page de trésorerie, et celui du formulaire d'ajout. Elle y
 * était d'abord écrite deux fois — et n'ayant filtré qu'un des deux selects, j'ai livré une
 * moitié de fonctionnalité qui paraissait complète.
 */

export type SensDeLigne = 'EXPENSE' | 'INCOME'

/** Le minimum qu'un code doit porter pour être trié. */
export interface CodeTriable {
  id: number
  code: string
}

/**
 * Le chiffre de tête qui marque le sens, dans le plan comptable français : 6 pour une charge,
 * 7 pour un produit.
 *
 * Rien n'enregistre ce sens sur le code lui-même — c'est une déduction, et elle ne vaut que pour
 * cette numérotation. Un code saisi librement (« REPAS », « A1 ») n'est donc classé nulle part,
 * ce que la recherche ci-dessous rattrape.
 */
const CHIFFRE_DU_SENS: Record<SensDeLigne, string> = {
  EXPENSE: '6',
  INCOME: '7',
}

export interface OptionsCodesProposes {
  sens: SensDeLigne
  /** Terme tapé dans le select. Non vide, il ouvre la liste à tous les codes. */
  recherche?: string
  /** Code déjà posé sur la ligne, à ne jamais retirer de la liste. */
  codeCourantId?: number | null
}

/**
 * Trois règles qui se superposent, dans cet ordre :
 *
 * 1. **Au repos**, seuls les codes du sens de la ligne sont proposés. La liste reste courte et
 *    juste dans la quasi-totalité des cas.
 * 2. **Dès qu'on cherche**, elle s'ouvre à tous les codes de l'édition. C'est ce qui rend les
 *    codes maison atteignables : la restriction guide, elle n'enferme pas.
 * 3. **Le code déjà posé** sur la ligne reste présent en toutes circonstances. Le retirer
 *    afficherait un champ vide sur une ligne qui porte pourtant une imputation, et le premier
 *    clic l'effacerait sans que personne l'ait voulu.
 *
 * L'ordre d'origine des codes est conservé, sauf pour le code courant rapatrié en tête quand il
 * ne figurait pas dans la sélection.
 */
export function codesProposes<T extends CodeTriable>(
  codes: T[],
  { sens, recherche = '', codeCourantId = null }: OptionsCodesProposes
): T[] {
  const base = recherche.trim()
    ? codes
    : codes.filter((c) => c.code.startsWith(CHIFFRE_DU_SENS[sens]))

  if (codeCourantId === null) return base
  if (base.some((c) => c.id === codeCourantId)) return base

  const courant = codes.find((c) => c.id === codeCourantId)
  return courant ? [courant, ...base] : base
}
