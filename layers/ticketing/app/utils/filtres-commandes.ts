/**
 * Les filtres de l'écran des commandes : ce qu'on envoie à l'API, combien sont actifs, et à quoi
 * ressemble « aucun filtre ».
 *
 * Ces trois réponses vivaient dans `orders.vue`, à trois endroits distincts — `loadOrders` les
 * composait, `activeFiltersCount` les comptait, `resetFilters` les remettait à zéro — et chacun
 * énumérait la liste des filtres à la main. Ajouter un filtre demandait donc de penser aux trois.
 * Oublier le deuxième fait mentir la pastille du bouton ; oublier le troisième laisse un filtre
 * actif après une réinitialisation, sans rien à l'écran pour le dire.
 *
 * Ce dépôt a déjà payé cette forme-là deux fois : #372, où la composition des filtres des
 * candidatures était écrite une fois pour la liste et une fois pour l'export, et #375, où les
 * filtres du planning l'étaient une fois pour l'écran et une fois pour l'impression. À chaque fois,
 * les copies ont fini par diverger et l'écart s'est vu sur un livrable, pas sur l'écran.
 *
 * D'où une seule description ici, dont les trois réponses découlent.
 *
 * ⚠️ Ce fichier ne doit rien importer : il est chargé tel quel par les tests unitaires, hors Nuxt.
 */

/** Un filtre sur un champ personnalisé, tel que l'écran le construit. */
export interface FiltreChampPersonnalise {
  name: string
  value: string
}

/** Le type d'une ligne de commande. */
export type TypeDeLigne = 'Registration' | 'Donation' | 'Membership' | 'Payment'

/** Un moyen de paiement, `pending` et `unknown` compris — ce sont des états, pas des moyens. */
export type MoyenDePaiement = 'cash' | 'card' | 'check' | 'pending' | 'unknown'

/** L'état des contrôles de filtrage, tel que l'écran le tient. */
export interface FiltresCommandes {
  tarifs: number[]
  options: number[]
  /** `all` n'est pas un filtre : c'est l'absence de filtre sur ce critère. */
  statutEntree: 'all' | 'validated' | 'not_validated'
  moyensDePaiement: MoyenDePaiement[]
  typesDeLigne: TypeDeLigne[]
  champsPersonnalises: FiltreChampPersonnalise[]
  /** Comment combiner les filtres de champs personnalisés. Sans eux, il ne filtre rien. */
  modeChampsPersonnalises: 'and' | 'or'
}

/** L'état « aucun filtre », celui sur lequel la réinitialisation doit retomber. */
export function filtresVides(): FiltresCommandes {
  return {
    tarifs: [],
    options: [],
    statutEntree: 'all',
    moyensDePaiement: [],
    typesDeLigne: [],
    champsPersonnalises: [],
    modeChampsPersonnalises: 'and',
  }
}

/**
 * Ce que l'API reçoit.
 *
 * Les listes vides deviennent `undefined` plutôt que `[]`, et `all` disparaît : côté serveur, un
 * tableau vide et une absence ne se valent pas toujours, et envoyer `all` reviendrait à demander
 * un filtrage sur « tous les statuts ».
 */
export function requeteDesFiltres(filtres: FiltresCommandes): {
  tierIds?: number[]
  optionIds?: number[]
  entryStatus: 'all' | 'validated' | 'not_validated'
  paymentMethods?: MoyenDePaiement[]
  itemTypes?: TypeDeLigne[]
  customFieldFilters?: FiltreChampPersonnalise[]
  customFieldFilterMode: 'and' | 'or'
} {
  const siRempli = <T>(liste: T[]): T[] | undefined => (liste.length > 0 ? liste : undefined)

  return {
    tierIds: siRempli(filtres.tarifs),
    optionIds: siRempli(filtres.options),
    entryStatus: filtres.statutEntree,
    paymentMethods: siRempli(filtres.moyensDePaiement),
    itemTypes: siRempli(filtres.typesDeLigne),
    customFieldFilters: siRempli(filtres.champsPersonnalises),
    customFieldFilterMode: filtres.modeChampsPersonnalises,
  }
}

/**
 * Combien de filtres sont actifs — le nombre affiché sur la pastille du bouton.
 *
 * Les filtres à choix multiple comptent pour autant de valeurs retenues, et non pour un : deux
 * tarifs cochés, c'est deux restrictions, et c'est ce que l'utilisateur voit dans le panneau.
 * `statutEntree` compte pour un dès qu'il quitte `all`.
 *
 * Le mode de combinaison des champs personnalisés ne compte pas : seul, il ne restreint rien.
 */
export function nombreDeFiltresActifs(filtres: FiltresCommandes): number {
  return (
    filtres.tarifs.length +
    filtres.options.length +
    (filtres.statutEntree === 'all' ? 0 : 1) +
    filtres.moyensDePaiement.length +
    filtres.typesDeLigne.length +
    filtres.champsPersonnalises.length
  )
}

/**
 * Y a-t-il au moins un filtre&nbsp;? Dérivé du décompte, pour qu'une réponse ne puisse pas
 * contredire l'autre.
 */
export function desFiltresSontActifs(filtres: FiltresCommandes): boolean {
  return nombreDeFiltresActifs(filtres) > 0
}
