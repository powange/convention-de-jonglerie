import { describe, expect, it } from 'vitest'

import { montantARembourser } from '../../../server/utils/ticketing/remboursement-du'

/**
 * « Doit-on encore de l'argent à qui présente ce billet ? »
 *
 * La question se pose au guichet, devant la personne, et se trompe dans les deux sens : réclamer
 * un remboursement qu'on ne doit pas, ou taire une dette réelle. Les deux erreurs sont
 * silencieuses — un montant faux reste un montant plausible.
 *
 * Le cas qui a fait écrire cette fonction est le dernier de ce fichier : **annuler une commande
 * remplace son statut « payée » par « annulée »**, et le seul signal qui survit est le moyen de
 * paiement. Une première version, écrite dans le composant, ne regardait que le statut et cachait
 * donc la somme due exactement dans le cas où on venait d'annuler la commande.
 */
describe('montantARembourser', () => {
  const billet = (surcharge: Record<string, unknown> = {}) => ({
    state: 'Canceled',
    refunded: false,
    amount: 5000,
    order: { status: 'Onsite', paymentMethod: 'cash' },
    ...surcharge,
  })

  describe('on doit de l’argent', () => {
    it('billet annulé, réglé au guichet, pas encore remboursé', () => {
      expect(montantARembourser(billet())).toBe(5000)
    })

    it('billet annulé d’une commande importée, payée sans moyen de paiement enregistré', () => {
      expect(
        montantARembourser(billet({ order: { status: 'Processed', paymentMethod: null } }))
      ).toBe(5000)
    })

    it('billet dont l’état d’annulation vient du fournisseur', () => {
      // `Refunded` n'apparaît sur aucune ligne aujourd'hui, mais fait partie du vocabulaire
      // d'annulation que la porte applique déjà : les deux endroits répondent pareil.
      expect(montantARembourser(billet({ state: 'Refunded' }))).toBe(5000)
    })
  })

  describe('on ne doit rien', () => {
    it('le billet n’est pas annulé', () => {
      expect(montantARembourser(billet({ state: 'Processed' }))).toBeNull()
    })

    it('l’argent a déjà été rendu', () => {
      expect(montantARembourser(billet({ refunded: true }))).toBeNull()
    })

    it('le billet n’a jamais été réglé', () => {
      // Un participant ajouté au guichet sans moyen de paiement part en `Pending` : rien n'est
      // entré, donc rien ne sort.
      expect(
        montantARembourser(billet({ order: { status: 'Pending', paymentMethod: null } }))
      ).toBeNull()
    })
  })

  describe('le piège de la commande annulée', () => {
    it('reconnaît une commande réglée dont l’annulation a effacé le statut', () => {
      // Annuler la commande écrit `Refunded` par-dessus `Onsite` : son statut ne dit plus qu'elle
      // a été payée. Seul le moyen de paiement en témoigne encore — et sans lui, la somme due
      // disparaissait de l'écran au moment même où elle devenait exigible.
      expect(
        montantARembourser(billet({ order: { status: 'Refunded', paymentMethod: 'card' } }))
      ).toBe(5000)
    })

    it('ne réclame rien pour une commande annulée qui n’avait jamais été payée', () => {
      expect(
        montantARembourser(billet({ order: { status: 'Refunded', paymentMethod: null } }))
      ).toBeNull()
    })
  })

  it('rend le montant du BILLET, pas celui de la commande', () => {
    // Un tiers des commandes portent plusieurs billets : rendre le total de la commande à qui
    // présente l'un d'eux rembourserait les autres au passage.
    expect(montantARembourser(billet({ amount: 1200 }))).toBe(1200)
  })
})
