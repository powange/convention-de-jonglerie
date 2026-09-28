/**
 * « Doit-on encore de l'argent à qui présente ce billet ? »
 *
 * La question se pose au guichet, face à la personne, et elle n'a de réponse simple qu'ici : trois
 * conditions doivent tenir ensemble, et en oublier une fait réclamer de l'argent qu'on ne doit pas
 * — ou taire une dette réelle.
 *
 * ⚠️ Ce fichier ne doit rien importer d'autre que ses voisins de `ticketing/` : il est chargé tel
 * quel par les tests unitaires, hors Nuxt.
 */

import { ETATS_DE_BILLET_ANNULE } from './billets-qui-comptent'

export interface BilletPourRemboursement {
  state: string
  refunded: boolean
  amount: number
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
  return billet.amount
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
