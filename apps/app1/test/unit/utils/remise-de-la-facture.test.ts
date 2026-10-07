import { describe, it, expect } from 'vitest'

import { remiseDeLaFacture } from '../../../server/utils/remise-de-la-facture'

describe('remiseDeLaFacture', () => {
  it('coche la remise quand une facture est déposée', () => {
    expect(remiseDeLaFacture({ invoiceUrl: '/uploads/.../facture.pdf' })).toEqual({
      invoiceProvided: true,
    })
  })

  it('ne décoche pas au retrait du fichier', () => {
    /*
     * Délibéré : la case est cochable seule, pour une facture reçue par courriel ou sur papier.
     * La décocher ici effacerait en silence ce qu'un organisateur a saisi à la main.
     */
    expect(remiseDeLaFacture({ invoiceUrl: null })).toEqual({})
  })

  it('ne touche à rien quand l’appel ne parle pas de la facture', () => {
    // L'espace artiste enregistre un justificatif à la fois : les autres appels ne disent rien
    // de la facture, et ne doivent donc rien changer.
    expect(remiseDeLaFacture({ consumablesReceiptUrl: '/uploads/.../ticket.jpg' })).toEqual({})
    expect(remiseDeLaFacture({})).toEqual({})
  })
})
