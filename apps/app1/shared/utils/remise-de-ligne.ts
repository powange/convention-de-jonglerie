/**
 * La remise accordée après coup sur une ligne de commande.
 *
 * ⚠️ UNE REMISE N'EST PAS UNE ANNULATION, et c'est toute la raison d'être de ce module. Un billet
 * annulé ne donne plus droit à rien et son montant quitte entièrement l'encaissé. Un billet
 * REMIS reste vivant — entrée, repas, articles à remettre, quotas, tout est inchangé — et seule
 * une partie du prix repart.
 *
 * ⚠️ CONSÉQUENCE : LA TRÉSORERIE DOIT LA VOIR. Le remboursement d'une annulation, lui, n'a aucun
 * effet comptable, parce que l'annulation a déjà tout retiré avant lui. Rien n'a été retiré d'un
 * billet vivant : une remise invisible laisserait l'encaissé au prix plein et le ferait mentir du
 * montant rendu — sans erreur, sans alerte, et le compte ne tomberait qu'au bilan.
 *
 * ⚠️ TOUT EST EN CENTIMES et le reste. La mise en forme est l'affaire de `money()`. Rendre des
 * euros ferait un total faux d'un facteur cent chez qui réutiliserait ces fonctions en croyant
 * bien faire, et un total faux sur de l'argent ne se remarque pas toujours tout de suite.
 */

/** Une option retenue sur une ligne, réduite à son prix. */
export interface OptionDeLigne {
  amount?: number | null
}

/** Une ligne de commande, réduite à ce qui compose son prix. */
export interface LigneAvecRemise {
  amount?: number | null
  selectedOptions?: ReadonlyArray<OptionDeLigne> | null
  /** La remise accordée, en centimes. Absente ou `0` : pas de remise. */
  discountAmount?: number | null
}

/** Le prix affiché d'une ligne, options comprises, AVANT remise. */
export function montantBrutDeLaLigne(ligne: LigneAvecRemise | null | undefined): number {
  const base = ligne?.amount ?? 0
  const options = (ligne?.selectedOptions ?? []).reduce(
    (somme, option) => somme + (option?.amount ?? 0),
    0
  )

  return base + options
}

/**
 * La remise réellement applicable à cette ligne.
 *
 * ⚠️ PLAFONNÉE AU PRIX, ET JAMAIS NÉGATIVE. Une remise supérieure au prix produirait un net
 * négatif : la ligne ferait alors *gagner* de l'argent à l'encaissé, et un total qui monte quand
 * on rend de l'argent est le genre d'erreur qu'on ne cherche pas là où elle est. Le point d'API
 * refuse déjà ces montants ; ce plafond protège les lignes déjà en base si la règle changeait, et
 * les options retirées d'un billet après coup, qui peuvent faire baisser le prix sous une remise
 * accordée hier.
 */
export function remiseDeLaLigne(ligne: LigneAvecRemise | null | undefined): number {
  const remise = ligne?.discountAmount ?? 0
  if (remise <= 0) return 0

  return Math.min(remise, montantBrutDeLaLigne(ligne))
}

/** Ce que la ligne rapporte réellement : son prix moins la remise. Jamais négatif. */
export function montantNetDeLaLigne(ligne: LigneAvecRemise | null | undefined): number {
  return montantBrutDeLaLigne(ligne) - remiseDeLaLigne(ligne)
}

/** Cette ligne porte-t-elle une remise ? Sert à l'affichage, qui ne montre le détail que si oui. */
export function aUneRemise(ligne: LigneAvecRemise | null | undefined): boolean {
  return remiseDeLaLigne(ligne) > 0
}
