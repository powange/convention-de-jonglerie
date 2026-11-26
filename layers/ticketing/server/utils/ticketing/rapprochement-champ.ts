/**
 * « Cette réponse d'un billet désigne-t-elle ce champ personnalisé ? »
 *
 * Le billet fige un instantané JSON de ses réponses au moment de l'achat. Le rapprocher du champ
 * par son LIBELLÉ paraît naturel — et détache tous les billets déjà vendus dès qu'on renomme le
 * champ, ne serait-ce que pour corriger une faute. La jauge baisse alors sans explication, et
 * l'article à remettre cesse d'être dû, sans que rien ne le signale.
 *
 * L'instantané porte pourtant de quoi identifier le champ, et de DEUX façons distinctes qu'il ne
 * faut surtout pas confondre :
 *
 * 1. `customFieldId` — l'identifiant INTERNE, écrit par les saisies faites ici ;
 * 2. `id` — l'identifiant du champ CHEZ LE FOURNISSEUR (`helloAssoCustomFieldId`), écrit par les
 *    imports d'une billetterie externe ;
 * 3. `name` — le libellé, seul repli pour les billets antérieurs qui ne portent ni l'un ni
 *    l'autre.
 *
 * Les deux premiers vivent dans des espaces d'identifiants **sans rapport** : rapprocher l'un de
 * l'autre ferait correspondre des champs étrangers. D'où deux comparaisons distinctes, jamais une
 * seule — et un identifiant présent est TOUJOURS décisif, y compris pour refuser : si l'instantané
 * dit « champ nº 12 » et que le champ visé est le nº 8, le libellé n'a pas à les réconcilier.
 *
 * Fonction pure, sans accès à la base : c'est ce qui la rend testable seule, et ce qui permet aux
 * deux appelants — le décompte des quotas et le calcul des articles à remettre — de partager
 * exactement la même règle. Ils la recopiaient, et l'un des deux avait déjà divergé.
 */

/** Le champ tel que la configuration le connaît. */
export interface ChampPersonnaliseVise {
  id: number
  label: string
  /** `null` quand le champ a été créé ici, sans billetterie externe. */
  helloAssoCustomFieldId?: number | null
}

/** Une réponse telle que l'instantané du billet la porte. */
export interface ReponseDeBillet {
  customFieldId?: unknown
  id?: unknown
  name?: unknown
}

export function reponseDesigneLeChamp(
  reponse: ReponseDeBillet,
  champ: ChampPersonnaliseVise
): boolean {
  if (typeof reponse.customFieldId === 'number') {
    return reponse.customFieldId === champ.id
  }

  if (typeof reponse.id === 'number') {
    // Sans identifiant fournisseur du côté du champ, il n'y a rien à comparer : un champ créé ici
    // ne peut pas correspondre à l'identifiant d'une billetterie externe.
    return champ.helloAssoCustomFieldId != null && reponse.id === champ.helloAssoCustomFieldId
  }

  return reponse.name === champ.label
}
