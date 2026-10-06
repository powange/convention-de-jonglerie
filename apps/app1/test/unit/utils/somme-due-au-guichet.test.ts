import { describe, expect, it } from 'vitest'

import { sommeDueAuGuichet, type DettesDuBillet } from '../../../shared/utils/somme-due-au-guichet'

/**
 * Laquelle des trois dettes le guichet annonce-t-il ?
 *
 * ⚠️ POURQUOI CES TESTS EXISTENT. Cette précédence a déjà échoué, et sans rien casser : l'encadré
 * ne s'affichait simplement PAS pour une remise, alors que le serveur annonçait la dette. Aucune
 * erreur, aucun message, rien dans les journaux — une personne qui repart sans son argent.
 */

const dettes = (over: Partial<DettesDuBillet> = {}): DettesDuBillet => ({
  estUneRemise: false,
  dueParLeBillet: null,
  soldeToutLaCommande: false,
  dueParLaCommande: 0,
  ...over,
})

describe('la somme annoncée au guichet', () => {
  it('⚠️ LE DÉFAUT CORRIGÉ : la remise l’emporte sur une commande qui ne doit rien', () => {
    /*
     * `detteDeCommande` rend TOUJOURS un objet, total nul compris : `soldeToutLaCommande` était
     * donc vrai dès qu'un billet s'affichait, et l'on retombait sur un total de commande à zéro.
     */
    expect(
      sommeDueAuGuichet(
        dettes({ estUneRemise: true, dueParLeBillet: 200, soldeToutLaCommande: true })
      )
    ).toBe(200)
  })

  it('⚠️ …et même sur une commande qui doit AUTRE CHOSE', () => {
    /*
     * Le cas le plus traître : un billet remisé dans une commande dont d'autres lignes sont
     * annulées. Annoncer le total de la commande ferait rendre une somme que le bouton de la
     * remise ne solderait pas — et la dette reparaîtrait le lendemain, pour être rendue deux fois.
     */
    expect(
      sommeDueAuGuichet(
        dettes({
          estUneRemise: true,
          dueParLeBillet: 200,
          soldeToutLaCommande: true,
          dueParLaCommande: 5000,
        })
      )
    ).toBe(200)
  })

  it('sans remise, la commande l’emporte quand elle se solde d’un geste', () => {
    expect(
      sommeDueAuGuichet(
        dettes({ dueParLeBillet: 2000, soldeToutLaCommande: true, dueParLaCommande: 5800 })
      )
    ).toBe(5800)
  })

  it('…mais retombe sur le billet quand la commande a plusieurs titulaires', () => {
    // Rendre le total à qui présente un billet donnerait à une personne l'argent des autres.
    expect(
      sommeDueAuGuichet(
        dettes({ dueParLeBillet: 2000, soldeToutLaCommande: false, dueParLaCommande: 5800 })
      )
    ).toBe(2000)
  })

  it('zéro n’est pas une dette', () => {
    // L'annoncer ferait ouvrir la caisse pour rien.
    expect(sommeDueAuGuichet(dettes({ soldeToutLaCommande: true, dueParLaCommande: 0 }))).toBeNull()
  })

  it('rien à rendre : rien à annoncer', () => {
    // Le témoin négatif : sans lui, une règle qui rendrait toujours un montant passerait.
    expect(sommeDueAuGuichet(dettes())).toBeNull()
  })

  it('une remise déjà rendue n’annonce rien', () => {
    // `estUneRemise` est faux dès que l'argent est sorti ; le billet ne doit plus rien.
    expect(sommeDueAuGuichet(dettes({ estUneRemise: false, dueParLeBillet: null }))).toBeNull()
  })
})
