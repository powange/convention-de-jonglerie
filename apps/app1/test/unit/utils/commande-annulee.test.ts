import { describe, expect, it } from 'vitest'

import {
  commandeEstAnnulee,
  commandeModifiableIci,
  gesteDestructeur,
} from '../../../../../layers/ticketing/app/utils/commande-annulee'
import { montantTotalDeLaLigne } from '../../../../../layers/ticketing/app/utils/montant-ligne-commande'

describe('commandeEstAnnulee', () => {
  it('reconnaît le statut du prestataire', () => {
    // `Refunded` veut dire « annulée », pas « remboursée en argent » : c'est un nom hérité des
    // billetteries externes, et c'est pour ça qu'il ne doit pas se promener dans les composants.
    expect(commandeEstAnnulee({ status: 'Refunded' })).toBe(true)
  })

  it('ne confond pas avec les autres statuts', () => {
    for (const statut of ['Processed', 'Pending', 'Authorized', 'refunded', 'REFUNDED', '', null])
      expect(commandeEstAnnulee({ status: statut })).toBe(false)
  })

  it('traite une commande absente comme non annulée', () => {
    // L'écran interroge parfois `orderToCancel` avant qu'il soit renseigné. Répondre « annulée »
    // ferait proposer une suppression définitive sur rien.
    expect(commandeEstAnnulee(null)).toBe(false)
    expect(commandeEstAnnulee(undefined)).toBe(false)
    expect(commandeEstAnnulee({})).toBe(false)
  })
})

describe('gesteDestructeur', () => {
  it('propose d’annuler une commande active', () => {
    expect(gesteDestructeur({ status: 'Processed' })).toBe('annuler')
  })

  it('propose de supprimer une commande déjà annulée', () => {
    // Ce n'est pas un détail de vocabulaire : sur une commande déjà annulée, le geste efface
    // définitivement la commande et ses billets. Annoncer « annuler » ferait cliquer quelqu'un
    // sur ce qu'il croit réversible.
    expect(gesteDestructeur({ status: 'Refunded' })).toBe('supprimer')
  })

  it('suit strictement l’annulation', () => {
    for (const commande of [null, undefined, {}, { status: 'Pending' }])
      expect(gesteDestructeur(commande)).toBe('annuler')
  })
})

describe('commandeModifiableIci', () => {
  it('refuse une commande importée d’une billetterie externe', () => {
    // Elle appartient au prestataire : la modifier ici ferait diverger les deux côtés, sans que
    // rien ne le signale.
    expect(commandeModifiableIci({ externalTicketing: { id: 3 } })).toBe(false)
  })

  it('accepte une commande saisie à la main', () => {
    expect(commandeModifiableIci({ status: 'Processed' })).toBe(true)
    expect(commandeModifiableIci({ externalTicketing: null })).toBe(true)
  })

  it('refuse une commande absente', () => {
    expect(commandeModifiableIci(null)).toBe(false)
    expect(commandeModifiableIci(undefined)).toBe(false)
  })
})

describe('montantTotalDeLaLigne', () => {
  it('ajoute les options au tarif', () => {
    expect(
      montantTotalDeLaLigne({ amount: 2300, selectedOptions: [{ amount: 500 }, { amount: 150 }] })
    ).toBe(2950)
  })

  it('rend des centimes, pas des euros', () => {
    // Le facteur cent est l'erreur qui ne se voit pas : un total de 29,50 € affiché 2950 saute
    // aux yeux, l'inverse non.
    expect(montantTotalDeLaLigne({ amount: 2300 })).toBe(2300)
  })

  it('compte une ligne sans option', () => {
    expect(montantTotalDeLaLigne({ amount: 1000, selectedOptions: [] })).toBe(1000)
    expect(montantTotalDeLaLigne({ amount: 1000, selectedOptions: null })).toBe(1000)
  })

  it('traite un montant absent comme zéro plutôt que d’échouer', () => {
    // Une ligne dont le prix n'est pas encore connu doit se lire, pas casser la page.
    expect(montantTotalDeLaLigne({})).toBe(0)
    expect(montantTotalDeLaLigne(null)).toBe(0)
    expect(montantTotalDeLaLigne({ amount: null, selectedOptions: [{ amount: null }] })).toBe(0)
  })

  it('ignore une option sans prix sans perdre les autres', () => {
    expect(
      montantTotalDeLaLigne({ amount: 100, selectedOptions: [{ amount: null }, { amount: 50 }] })
    ).toBe(150)
  })
})
