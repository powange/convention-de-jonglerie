import { describe, expect, it } from 'vitest'

import {
  billetAnnule,
  estUnBilletAnnule,
  ETATS_DE_BILLET_ANNULE,
  billetsQuiComptent,
  lignesQuiDonnentAcces,
  TYPES_SANS_DROIT_D_ENTREE,
} from '../../../server/utils/ticketing/billets-qui-comptent'

/**
 * Le vocabulaire des billets, et les fragments de `where` qui en découlent.
 *
 * Ces fonctions ne calculent rien : elles rendent des objets que Prisma interprète. Les tester,
 * c'est donc figer **la forme** de ces objets — ce qui n'a l'air de rien jusqu'au jour où l'un
 * d'eux est étalé dans un `where` qui porte déjà une clé du même nom, et disparaît sans bruit.
 * C'est arrivé en écrivant `lignesQuiDonnentAcces` : son `OR` écrasait celui de la recherche par
 * nom, et le filtre ne servait plus à rien.
 */
describe('billetsQuiComptent', () => {
  it('exige un état vivant ET une commande non remboursée', () => {
    // Les deux conditions vivent à des niveaux différents du `where`. N'en poser qu'une était le
    // défaut des quotas : ils comptaient l'état de la ligne sans regarder sa commande, et les deux
    // commandes remboursées de la production gardaient leur place.
    expect(billetsQuiComptent(22)).toEqual({
      state: { in: ['Processed', 'Pending'] },
      order: { editionId: 22, status: { not: 'Refunded' } },
    })
  })

  it('rend un objet neuf à chaque appel', () => {
    // Un fragment partagé qu'un appelant modifierait changerait ce que voient tous les autres.
    const premier = billetsQuiComptent(1)
    const second = billetsQuiComptent(1)

    expect(premier).not.toBe(second)
    expect(premier.state.in).not.toBe(second.state.in)
  })
})

describe('billetAnnule', () => {
  it('couvre les deux façons de perdre son droit d’entrée', () => {
    // La ligne annulée, ou la commande entière remboursée. La garde d'origine ne connaissait que
    // la seconde, et une valeur inexistante pour la première : quatre billets annulés de la
    // production se validaient comme des billets ordinaires.
    expect(billetAnnule()).toEqual({
      OR: [{ state: { in: ['Canceled', 'Refunded'] } }, { order: { status: 'Refunded' } }],
    })
  })
})

describe('lignesQuiDonnentAcces', () => {
  it('écarte le don, l’adhésion et le paiement', () => {
    expect(TYPES_SANS_DROIT_D_ENTREE).toEqual(['Donation', 'Membership', 'Payment'])
  })

  it('laisse passer une ligne sans type', () => {
    // `type` est NULLABLE, et `NOT IN` écarte les `NULL` en SQL. Sans cette branche, une ligne
    // importée sans type disparaîtrait du guichet — et à la porte, le doute doit profiter au
    // porteur du billet.
    expect(lignesQuiDonnentAcces()).toEqual({
      OR: [{ type: null }, { type: { notIn: ['Donation', 'Membership', 'Payment'] } }],
    })
  })

  it('porte un `OR`, donc se compose sous `AND`', () => {
    // Le test qui dit pourquoi les appelants écrivent `AND: [lignesQuiDonnentAcces()]` : étalé à
    // côté d'un autre `OR` — celui d'une recherche par nom —, ce fragment en écraserait un des
    // deux, et le filtre s'évanouirait sans que rien n'échoue.
    expect(Object.keys(lignesQuiDonnentAcces())).toEqual(['OR'])
  })
})

/**
 * Le même vocabulaire, côté DONNÉES — constat B8.
 *
 * ## ⚠️ POURQUOI DEUX FORMES DE LA MÊME RÈGLE
 *
 * `billetAnnule()` rend un fragment de `where` : il sert à ne PAS charger ces billets.
 * `estUnBilletAnnule` juge une ligne qu'on a déjà en main, pour l'ANNONCER plutôt que la cacher.
 * Les deux doivent lire la même liste d'états, et c'est tout l'objet de les poser côte à côte.
 *
 * 📍 Ce prédicat existait, écrit à la main, dans `layers/ticketing/.../orders.get.ts`, **sous le
 * même nom que l'util qu'il masquait localement**. Deux réponses à une seule question, dont une
 * invisible depuis l'autre : c'est ainsi qu'elles divergent. Le constat B8 était en train d'en
 * ajouter une troisième dans « Mes billets ».
 */
describe('estUnBilletAnnule', () => {
  it('reconnaît une LIGNE annulée', () => {
    expect(estUnBilletAnnule({ state: 'Canceled' }, { status: 'Processed' })).toBe(true)
  })

  it('reconnaît une COMMANDE remboursée, même si la ligne est intacte', () => {
    // Les deux façons ne se recouvrent pas : la garde d'origine ne connaissait que celle-ci.
    expect(estUnBilletAnnule({ state: 'Processed' }, { status: 'Refunded' })).toBe(true)
  })

  it('laisse passer un billet valide', () => {
    expect(estUnBilletAnnule({ state: 'Processed' }, { status: 'Processed' })).toBe(false)
  })

  it('⚠️ LIT LA MÊME LISTE QUE LE FRAGMENT DE `where`', () => {
    /*
     * L'ASSERTION QUI TIENT LES DEUX FORMES ENSEMBLE. Sans elle, ajouter un état d'annulation à
     * `ETATS_DE_BILLET_ANNULE` pourrait n'atteindre qu'une des deux : le guichet refuserait un
     * billet que « Mes billets » continuerait d'annoncer comme valide — exactement la
     * contradiction que ce lot vient de fermer.
     */
    for (const etat of ETATS_DE_BILLET_ANNULE) {
      expect(estUnBilletAnnule({ state: etat }, { status: 'Processed' })).toBe(true)
    }
  })

  it('tolère une ligne ou une commande sans état — la donnée peut être partielle', () => {
    // Un `select` qui oublierait le champ rendrait `undefined` : le lire comme « annulé » serait
    // pire que l'inverse, puisqu'on refuserait un billet valide à l'entrée.
    expect(estUnBilletAnnule({}, {})).toBe(false)
    expect(estUnBilletAnnule({ state: null }, { status: null })).toBe(false)
  })
})
