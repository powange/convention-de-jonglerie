import { describe, expect, it } from 'vitest'

import {
  detteDeCommande,
  montantARembourser,
} from '../../../server/utils/ticketing/remboursement-du'

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

  describe('les options payées avec le billet', () => {
    it('sont dues avec lui', () => {
      expect(
        montantARembourser(billet({ amount: 2000, selectedOptions: [{ amount: 1300 }] }))
      ).toBe(3300)
    })

    it('rendent un billet gratuit dû — le cas de la commande 302, édition 9', () => {
      // Billet à 0 €, deux options à 13 € et 6 € : l'ancienne règle annonçait « 0 € dû ».
      expect(
        montantARembourser(
          billet({ amount: 0, selectedOptions: [{ amount: 1300 }, { amount: 600 }] })
        )
      ).toBe(1900)
    })

    it('comptent zéro pour une option gratuite', () => {
      expect(
        montantARembourser(billet({ amount: 1200, selectedOptions: [{ amount: null }] }))
      ).toBe(1200)
    })
  })
})

/**
 * La dette d'une COMMANDE, et non d'un billet.
 *
 * ⚠️ CE QUI A ÉTÉ SIGNALÉ. Au contrôle d'accès, la commande 937 de la base de développement
 * affichait « 34 € à rembourser » alors qu'elle en devait 58 : les quatre repas annulés restaient
 * dus et rien ne les annonçait. Le guichet rend l'argent UNE fois, à la personne en face — il doit
 * donc voir le total de la commande.
 *
 * 🔬 LES DEUX CAS SONT CEUX DE LA BASE, relevés avant d'écrire la règle. C'est ce qui distingue
 * une garde utile d'une garde inventée.
 */
describe('detteDeCommande', () => {
  const COMMANDE_REGLEE_AU_GUICHET = { status: 'Onsite', paymentMethod: 'cash' }

  const ligne = (
    id: number,
    amount: number,
    firstName: string | null,
    lastName: string | null,
    extra: { state?: string; refunded?: boolean; name?: string } = {}
  ) => ({
    id,
    name: extra.name ?? `Ligne ${id}`,
    amount,
    firstName,
    lastName,
    state: extra.state ?? 'Canceled',
    refunded: extra.refunded ?? false,
  })

  it('totalise toute la commande — le cas 937, un titulaire et ses repas', () => {
    const dette = detteDeCommande(
      [
        ligne(1451, 3400, 'Anne Claire', 'Durand'),
        ligne(1452, 600, 'Anonyme', 'Anonyme'),
        ligne(1453, 600, 'Anonyme', 'Anonyme'),
        ligne(1454, 600, 'Anonyme', 'Anonyme'),
        ligne(1455, 600, 'Anonyme', 'Anonyme'),
      ],
      COMMANDE_REGLEE_AU_GUICHET
    )

    // 🔬 58 € et non 34 : c'est tout le défaut signalé.
    expect(dette.total).toBe(5800)
    expect(dette.lignes).toHaveLength(5)
    // Les lignes non nommées ne sont pas des personnes : le total se rend en une fois.
    expect(dette.nomsMultiples).toBe(false)
  })

  it('signale une commande à plusieurs titulaires — le cas 686, trois t-shirts', () => {
    const dette = detteDeCommande(
      [
        ligne(1087, 1800, 'Virgil', 'SORMAIL'),
        ligne(1089, 1800, 'Eloïne', 'SORMAIL'),
        ligne(1090, 1800, 'MaryLou', 'LE ROUX'),
      ],
      COMMANDE_REGLEE_AU_GUICHET
    )

    expect(dette.total).toBe(5400)
    // ⚠️ Sans ce drapeau, qui présente un des trois billets repartirait avec l'argent des deux
    // autres. Ces trois lignes partagent pourtant le même e-mail — celui du payeur.
    expect(dette.nomsMultiples).toBe(true)
  })

  it('ne compte ni les billets valides, ni ceux déjà remboursés', () => {
    const dette = detteDeCommande(
      [
        ligne(1, 3400, 'Anne Claire', 'Durand'),
        ligne(2, 600, 'Anne Claire', 'Durand', { state: 'Processed' }),
        ligne(3, 600, 'Anne Claire', 'Durand', { refunded: true }),
      ],
      COMMANDE_REGLEE_AU_GUICHET
    )

    expect(dette.total).toBe(3400)
    expect(dette.lignes.map((l) => l.id)).toEqual([1])
  })

  it('compte les options de chaque ligne, dans le total ET dans le détail', () => {
    const dette = detteDeCommande(
      [
        { ...ligne(1, 0, 'Anne Claire', 'Durand'), selectedOptions: [{ amount: 1300 }] },
        ligne(2, 600, 'Anonyme', 'Anonyme'),
      ],
      COMMANDE_REGLEE_AU_GUICHET
    )

    expect(dette.total).toBe(1900)
    expect(dette.lignes.map((l) => l.amount)).toEqual([1300, 600])
  })

  it('ne doit rien sur une commande jamais réglée', () => {
    // Un participant ajouté au guichet sans moyen de paiement part en `Pending` : l'argent n'est
    // jamais entré, il n'y a donc rien à rendre.
    const dette = detteDeCommande([ligne(1, 3400, 'Anne Claire', 'Durand')], {
      status: 'Pending',
      paymentMethod: null,
    })

    expect(dette.total).toBe(0)
    expect(dette.lignes).toEqual([])
    expect(dette.nomsMultiples).toBe(false)
  })
})
