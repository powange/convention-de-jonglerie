/**
 * Ce que coûte une ligne de commande, options comprises.
 *
 * Le tarif seul ne suffit pas : une inscription peut porter des options payantes — un repas, un
 * hébergement, un tee-shirt — et c'est la somme qui est due. L'écran affichait cette somme sans
 * jamais la nommer, au milieu du balisage.
 *
 * ⚠️ Les montants sont en **centimes** en base et le restent ici. La mise en forme et la devise
 * sont l'affaire de `money()`. Rendre des euros ferait un total faux d'un facteur cent chez qui
 * réutiliserait cette fonction en croyant bien faire — et un total faux sur de l'argent ne se
 * remarque pas toujours tout de suite.
 *
 * ⚠️ Ce fichier ne doit rien importer : il est chargé tel quel par les tests unitaires, hors Nuxt.
 */

/** Une option retenue sur une ligne, réduite à son prix. */
export interface OptionRetenue {
  amount?: number | null
}

/** Une ligne de commande, réduite à ce qui compose son prix. */
export interface LigneDeCommande {
  amount?: number | null
  selectedOptions?: OptionRetenue[] | null
}

/**
 * Le total d'une ligne, **en centimes**.
 *
 * Un montant absent vaut zéro plutôt que de faire échouer l'affichage : une ligne dont le prix
 * n'est pas encore connu doit se lire, pas casser la page. Le risque inverse — afficher zéro pour
 * une ligne payante — est couvert par le fait que le tarif vient de la base, pas de la saisie.
 */
export function montantTotalDeLaLigne(ligne: LigneDeCommande | null | undefined): number {
  const base = ligne?.amount ?? 0
  const options = (ligne?.selectedOptions ?? []).reduce(
    (somme, option) => somme + (option?.amount ?? 0),
    0
  )

  return base + options
}
