/**
 * « Doit-on encore de l'argent à qui présente ce billet ? »
 *
 * La question se pose au guichet, face à la personne, et elle n'a de réponse simple qu'ici : trois
 * conditions doivent tenir ensemble, et en oublier une fait réclamer de l'argent qu'on ne doit pas
 * — ou taire une dette réelle.
 *
 * ⚠️ Ce fichier ne doit importer que ses voisins de `ticketing/` et `~~/shared/utils` : il est
 * chargé tel quel par les tests unitaires, hors Nuxt.
 */

import { ETATS_DE_BILLET_ANNULE } from './billets-qui-comptent'

import { ligneSansTitulaire } from '~~/shared/utils/participant-anonyme'

export interface BilletPourRemboursement {
  state: string
  refunded: boolean
  /** Le prix du billet SEUL. Ses options s'y ajoutent, voir `selectedOptions`. */
  amount: number
  /**
   * Les options payées avec ce billet, et rendues avec lui.
   *
   * ⚠️ Sans elles, la dette ne comptait que le prix du billet : un billet gratuit dont seules les
   * options avaient été payées s'annonçait « 0 € dû » au guichet, et un billet à 20 € portant un
   * repas à 13 € en annonçait 20. Le prix d'une option ne vit nulle part ailleurs — ni dans la
   * ligne, ni dans ce que le guichet lisait. Facultatif pour que l'absence se lise « aucune ».
   */
  selectedOptions?: ReadonlyArray<{ amount: number | null }> | null
  order: {
    status: string
    /** `null` sur une commande jamais réglée, et sur les commandes importées. */
    paymentMethod: string | null
  }
}

/**
 * La commande a-t-elle été réglée ?
 *
 * Deux signaux, et il en faut deux — c'est le piège de cette fonction.
 *
 * Le statut dit « payée » (`Processed`, `Onsite`) tant que la commande est vivante. Mais
 * **l'annuler le remplace par `Refunded`**, et l'information disparaît : une commande réglée puis
 * annulée ne se distingue plus, par son seul statut, d'une commande qui n'a jamais été payée.
 *
 * Le moyen de paiement, lui, survit à l'annulation. Il est renseigné dès qu'on encaisse au
 * guichet, et c'est ce qui rattrape le cas ci-dessus. Il reste `null` sur les commandes importées,
 * que leur statut suffit à qualifier.
 */
function commandeReglee(order: BilletPourRemboursement['order']): boolean {
  if (order.paymentMethod !== null) return true
  return order.status === 'Processed' || order.status === 'Onsite'
}

/**
 * Le montant dû pour ce billet, ou `null` quand on ne doit rien.
 *
 * On ne doit rien dans trois cas : le billet n'est pas annulé — il donne toujours droit d'entrée —,
 * l'argent a déjà été rendu, ou il n'est jamais entré (un participant ajouté au guichet sans moyen
 * de paiement part en `Pending`, et 22 commandes de la production sont dans ce cas).
 */
export function montantARembourser(billet: BilletPourRemboursement): number | null {
  if (!(ETATS_DE_BILLET_ANNULE as readonly string[]).includes(billet.state)) return null
  if (billet.refunded) return null
  if (!commandeReglee(billet.order)) return null
  return prixAvecOptions(billet)
}

/** Ce qu'a coûté un billet, options comprises, en centimes. */
function prixAvecOptions(billet: Pick<BilletPourRemboursement, 'amount' | 'selectedOptions'>) {
  return (
    billet.amount +
    (billet.selectedOptions ?? []).reduce((somme, option) => somme + (option.amount ?? 0), 0)
  )
}

/**
 * Les états de commande qui valent « elle a été réglée », côté requête.
 *
 * Jumeau de `commandeReglee` ci-dessus : l'un répond sur un objet déjà chargé, l'autre se pose
 * dans un `where`. Ils vivent côte à côte pour qu'on ne puisse pas corriger l'un en oubliant
 * l'autre — c'est la règle qui compte, pas sa forme.
 */
const COMMANDE_REGLEE = {
  OR: [{ paymentMethod: { not: null } }, { status: { in: ['Processed', 'Onsite'] } }],
} as const

/**
 * Le fragment de `where` qui désigne un billet **dont on doit encore l'argent**.
 *
 * À poser sur `TicketingOrderItem`. Répond exactement à ce que `montantARembourser` rend non nul,
 * et sert le filtre « à rembourser » de la liste des commandes.
 */
export function billetARembourser() {
  return {
    state: { in: [...ETATS_DE_BILLET_ANNULE] },
    refunded: false,
    order: COMMANDE_REGLEE,
  }
}

/** Une ligne de commande dont on doit encore l'argent. */
export interface LigneDueDeCommande {
  id: number
  name: string | null
  /** En sortie : ce qui est dû pour la ligne, options comprises. */
  amount: number
  firstName: string | null
  lastName: string | null
}

export interface DetteDeCommande {
  /** Somme due pour toute la commande, en centimes. */
  total: number
  /** Le détail, pour que le guichet voie ce qu'il solde. */
  lignes: LigneDueDeCommande[]
  /**
   * Les lignes dues concernent-elles PLUSIEURS personnes ?
   *
   * ⚠️ C'EST LA GARDE QUI ÉVITE DE RENDRE L'ARGENT D'UN TIERS. Une commande groupée paie pour
   * plusieurs participants nommés — mesuré sur la base de développement : la commande 686 porte
   * trois t-shirts à trois noms distincts, sous un même e-mail de payeur. Rendre « toute la
   * commande » à qui présente un de ces billets donnerait à une personne l'argent des autres.
   *
   * 📍 Les lignes NON NOMMÉES ne comptent pas comme des personnes : ce sont les repas et options
   * rattachés à la commande, que l'ajout au guichet remplit avec un nom de remplissage. C'est
   * exactement le cas de la commande 937 — un titulaire, quatre repas — où le total doit bien
   * être rendu en une fois.
   */
  nomsMultiples: boolean
}

/**
 * Tout ce que la commande d'un billet doit encore, et à combien de personnes.
 *
 * Le guichet rend l'argent UNE fois, à la personne en face : afficher la seule ligne scannée lui
 * faisait rendre 34 € sur une commande qui en devait 58 — quatre repas annulés restaient dus, sans
 * que rien ne les annonce. Signalé sur la base de développement, commande 937.
 */
export function detteDeCommande(
  lignes: Array<
    LigneDueDeCommande & Pick<BilletPourRemboursement, 'state' | 'refunded' | 'selectedOptions'>
  >,
  order: BilletPourRemboursement['order']
): DetteDeCommande {
  // Le montant dû de chaque ligne, options comprises — celui que `montantARembourser` annonce
  // pour le billet scanné, sans quoi la ligne et sa commande donneraient deux sommes.
  const dues = lignes.flatMap((ligne) => {
    const du = montantARembourser({
      state: ligne.state,
      refunded: ligne.refunded,
      amount: ligne.amount,
      selectedOptions: ligne.selectedOptions,
      order,
    })
    return du === null ? [] : [{ ...ligne, amount: du }]
  })

  const titulaires = new Set(
    dues
      .filter((ligne) => !ligneSansTitulaire(ligne))
      .map((ligne) => `${(ligne.firstName ?? '').trim()}|${(ligne.lastName ?? '').trim()}`)
  )

  return {
    total: dues.reduce((somme, ligne) => somme + ligne.amount, 0),
    lignes: dues.map(({ id, name, amount, firstName, lastName }) => ({
      id,
      name,
      amount,
      firstName,
      lastName,
    })),
    nomsMultiples: titulaires.size > 1,
  }
}
