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

/**
 * Un moyen de paiement.
 *
 * `unknown` en fait partie : c'est une commande payée dont le moyen n'a pas été renseigné, donc
 * bien une réponse à « comment a-t-elle été réglée ». En revanche `pending` n'y est plus — « en
 * attente de paiement » est un STATUT, et il se filtre désormais comme tel. Il se trouvait ici
 * faute d'un filtre de statut, et les deux listes se contredisaient à l'écran : on choisissait un
 * état dans un menu qui annonçait des moyens.
 */
export type MoyenDePaiement = 'cash' | 'card' | 'check' | 'unknown'

/**
 * Le statut d'une commande.
 *
 * ⚠️ `Refunded` signifie « **annulée** », pas « remboursée » : le nom vient des prestataires de
 * paiement, l'écran dit « Annulée ». C'est la même confusion que `commande-annulee.ts` documente,
 * et la raison pour laquelle ce littéral ne doit pas se promener dans un composant.
 *
 * Le champ est une `String` libre en base (`TicketingOrder.status`) : cette liste est celle que
 * le code écrit réellement, pas une contrainte du schéma. Si une valeur inconnue apparaissait en
 * base, elle ne serait simplement jamais retenue par ce filtre.
 */
export type StatutCommande = 'Pending' | 'Onsite' | 'Processed' | 'Refunded'

/** L'état des contrôles de filtrage, tel que l'écran le tient. */
export interface FiltresCommandes {
  tarifs: number[]
  options: number[]
  /** `all` n'est pas un filtre : c'est l'absence de filtre sur ce critère. */
  statutEntree: 'all' | 'validated' | 'not_validated'
  /**
   * Les statuts de commande retenus. Vide = tous.
   *
   * Y compris les commandes annulées, qui restent visibles par défaut : les masquer d'office
   * ferait disparaître des lignes de l'écran sans que rien ne le signale, et fausserait les
   * totaux de quiconque compte à l'œil.
   */
  statuts: StatutCommande[]
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
    statuts: [],
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
  statuses?: StatutCommande[]
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
    statuses: siRempli(filtres.statuts),
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
    filtres.statuts.length +
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

/**
 * Les valeurs admises pour chaque critère à choix fermé.
 *
 * L'URL est saisissable à la main et se transmet par courriel : ce qu'on y relit n'est pas de la
 * donnée de confiance. Une valeur inconnue est écartée plutôt que retenue — sans quoi elle
 * partirait à l'API, qui la rejetterait, et l'écran afficherait une liste vide sans que rien
 * n'explique pourquoi.
 */
const VALEURS_ADMISES = {
  statuts: ['Pending', 'Onsite', 'Processed', 'Refunded'],
  moyensDePaiement: ['cash', 'card', 'check', 'unknown'],
  typesDeLigne: ['Registration', 'Donation', 'Membership', 'Payment'],
  statutEntree: ['all', 'validated', 'not_validated'],
} as const

/**
 * Les filtres, tels qu'ils s'écrivent dans l'URL.
 *
 * Mêmes noms de paramètres que ceux envoyés à l'API : un seul vocabulaire pour les deux, sans quoi
 * il faudrait tenir deux traductions à jour et se souvenir de laquelle on parle.
 *
 * Ce qui ne restreint rien n'est pas écrit : un écran sans filtre a une URL nue. C'est ce qui rend
 * l'adresse lisible, et ce qui permet de voir d'un coup d'œil ce qui est actif.
 */
export function parametresDUrl(filtres: FiltresCommandes): Record<string, string> {
  const parametres: Record<string, string> = {}

  const liste = (cle: string, valeurs: readonly (string | number)[]) => {
    if (valeurs.length > 0) parametres[cle] = valeurs.join(',')
  }

  liste('tierIds', filtres.tarifs)
  liste('optionIds', filtres.options)
  liste('statuses', filtres.statuts)
  liste('paymentMethods', filtres.moyensDePaiement)
  liste('itemTypes', filtres.typesDeLigne)

  if (filtres.statutEntree !== 'all') parametres.entryStatus = filtres.statutEntree

  if (filtres.champsPersonnalises.length > 0) {
    parametres.customFieldFilters = JSON.stringify(filtres.champsPersonnalises)
    // Le mode ne veut rien dire sans champ à combiner : l'écrire seul encombrerait l'URL d'un
    // paramètre sans effet, et donnerait à croire qu'un filtre est actif.
    if (filtres.modeChampsPersonnalises === 'or') parametres.customFieldFilterMode = 'or'
  }

  return parametres
}

/**
 * Les filtres relus depuis l'URL.
 *
 * Tout ce qui n'est pas reconnu retombe sur l'état « aucun filtre » du critère concerné, jamais
 * sur une erreur : une adresse tronquée ou vieillie doit ouvrir un écran utilisable, pas une page
 * en échec.
 */
export function filtresDepuisUrl(query: Record<string, unknown>): FiltresCommandes {
  const texte = (cle: string): string => (typeof query[cle] === 'string' ? query[cle] : '')

  const retenues = <T extends string>(cle: string, admises: readonly T[]): T[] =>
    texte(cle)
      .split(',')
      .filter((valeur): valeur is T => (admises as readonly string[]).includes(valeur))

  // Les identifiants de tarifs et d'options : seuls des entiers positifs ont un sens.
  const identifiants = (cle: string): number[] =>
    texte(cle)
      .split(',')
      .map((valeur) => Number(valeur))
      .filter((nombre) => Number.isInteger(nombre) && nombre > 0)

  const champsPersonnalises: FiltreChampPersonnalise[] = []
  try {
    const analyse: unknown = JSON.parse(texte('customFieldFilters') || '[]')
    if (Array.isArray(analyse)) {
      for (const champ of analyse)
        if (
          champ &&
          typeof champ === 'object' &&
          typeof (champ as FiltreChampPersonnalise).name === 'string' &&
          typeof (champ as FiltreChampPersonnalise).value === 'string'
        )
          champsPersonnalises.push({
            name: (champ as FiltreChampPersonnalise).name,
            value: (champ as FiltreChampPersonnalise).value,
          })
    }
  } catch {
    // Un JSON abîmé vaut « aucun filtre de champ personnalisé ».
  }

  const statutEntree = retenues('entryStatus', VALEURS_ADMISES.statutEntree)[0] ?? 'all'

  return {
    tarifs: identifiants('tierIds'),
    options: identifiants('optionIds'),
    statutEntree,
    statuts: retenues('statuses', VALEURS_ADMISES.statuts),
    moyensDePaiement: retenues('paymentMethods', VALEURS_ADMISES.moyensDePaiement),
    typesDeLigne: retenues('itemTypes', VALEURS_ADMISES.typesDeLigne),
    champsPersonnalises,
    modeChampsPersonnalises: texte('customFieldFilterMode') === 'or' ? 'or' : 'and',
  }
}
