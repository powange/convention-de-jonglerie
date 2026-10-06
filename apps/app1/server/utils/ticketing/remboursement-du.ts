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
import { remiseDeLaLigne } from '~~/shared/utils/remise-de-ligne'

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
  /** La remise accordée sur ce billet, en centimes. Absente ou `0` : aucune. */
  discountAmount?: number | null
  /** La remise a-t-elle déjà été rendue ? Distinct de `refunded`, voir `montantARembourser`. */
  discountPaidBack?: boolean | null
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
  /*
   * Rien n'est dû sur une commande jamais réglée : un participant ajouté au guichet sans moyen de
   * paiement part en `Pending`, et 22 commandes de la production sont dans ce cas. Une remise y
   * réduit ce qui reste à payer — aucun argent n'a à sortir.
   */
  if (!commandeReglee(billet.order)) return null

  const remise = remiseDeLaLigne(billet)
  const remiseEncoreDue = remise > 0 && !billet.discountPaidBack

  /*
   * ─── BILLET VIVANT ───────────────────────────────────────────────────────────────────────
   *
   * Il donne toujours droit d'entrée : on ne doit que la REMISE, et seulement tant qu'elle n'a pas
   * été rendue.
   */
  if (!(ETATS_DE_BILLET_ANNULE as readonly string[]).includes(billet.state)) {
    return remiseEncoreDue ? remise : null
  }

  /*
   * ─── BILLET ANNULÉ ───────────────────────────────────────────────────────────────────────
   *
   * On doit le prix ENTIER… moins la remise DÉJÀ RENDUE.
   *
   * ⚠️ C'EST TOUT L'INTÉRÊT DE DEUX CASES DISTINCTES. Un billet à 20 € sur lequel on a rendu 5 € de
   * remise, puis qu'on annule, ne doit plus que 15 € : les 5 € sont déjà sortis de la caisse. Avec
   * une case unique, rien ne dirait laquelle des deux sommes a été rendue, et le guichet
   * annoncerait 20 € — cinq de trop, sur un geste qu'on fait en espèces et qu'on ne rattrape pas.
   *
   * 📍 Une remise NON encore rendue ne se soustrait pas : elle est comprise dans le prix entier
   * qu'on s'apprête à rendre. La soustraire ferait l'erreur inverse, et la personne repartirait
   * avec cinq euros de moins que ce qu'elle a versé.
   */
  if (billet.refunded) return null

  const du = prixAvecOptions(billet) - (billet.discountPaidBack ? remise : 0)
  return du > 0 ? du : null
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
 *
 * ⚠️ DEUX DETTES, ET NON UNE. Un billet ANNULÉ doit son prix entier ; un billet VIVANT doit la
 * REMISE qu'on lui a accordée sans encore la rendre. Ne garder que la première laisserait une
 * dette invisible au guichet — et c'est exactement ce que ce filtre existe pour empêcher.
 *
 * 📍 Jumeau de `montantARembourser` : l'un répond sur un objet chargé, l'autre se pose dans un
 * `where`. Le fichier répète qu'une règle écrite deux fois finit par ne plus dire la même chose ;
 * ils restent donc côte à côte, et les tests les comparent sur les mêmes cas.
 */
export function billetARembourser() {
  return {
    order: COMMANDE_REGLEE,
    OR: [
      // Billet annulé dont le prix n'a pas été rendu.
      { state: { in: [...ETATS_DE_BILLET_ANNULE] }, refunded: false },
      // Billet vivant portant une remise qu'on n'a pas encore rendue.
      {
        state: { notIn: [...ETATS_DE_BILLET_ANNULE] },
        discountAmount: { gt: 0 },
        discountPaidBack: false,
      },
    ],
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
  /*
   * Le montant dû de chaque ligne, options comprises — celui que `montantARembourser` annonce pour
   * le billet scanné, sans quoi la ligne et sa commande donneraient deux sommes.
   *
   * ⚠️ LES CHAMPS DE REMISE NE SONT PAS PASSÉS, ET C'EST VOULU — ne pas « corriger » cet oubli
   * apparent. Ce total sert au geste « solder toute la commande », qui n'écrit QUE sur les lignes
   * annulées. Y faire entrer une remise annoncerait une somme qu'un seul clic ne solderait pas :
   * on rendrait l'argent, la dette resterait, et on la rendrait encore le lendemain.
   *
   * 📍 La dette d'une remise s'annonce donc au niveau du BILLET, et c'est `sommeDueAuGuichet` qui
   * lui donne la précédence à l'écran.
   */
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
