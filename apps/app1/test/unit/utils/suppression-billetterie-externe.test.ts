import { describe, expect, it } from 'vitest'

import { resumeDeconnexionBilletterie } from '../../../../../layers/ticketing/app/utils/suppression-billetterie-externe'

/**
 * La confirmation demandait « êtes-vous sûr de vouloir déconnecter la billetterie ? », ce qui laisse
 * croire qu'on défait un branchement. La base est en cascade : on détruit les tarifs, les options et
 * les commandes importés — et chaque commande emporte ses billets.
 */
const config = (compte?: { tiers?: number; options?: number; orders?: number } | null) => ({
  _count: compte,
})

describe('resumeDeconnexionBilletterie', () => {
  it('compte ce que la cascade emporte', () => {
    expect(resumeDeconnexionBilletterie(config({ tiers: 4, options: 2, orders: 137 }))).toEqual({
      tarifs: 4,
      options: 2,
      commandes: 137,
      quelqueChoseDisparait: true,
    })
  })

  it('ne signale rien quand rien n’a été importé', () => {
    // Une billetterie configurée mais jamais synchronisée : la confirmation n'a rien à annoncer,
    // et en inventer ferait douter pour rien.
    expect(resumeDeconnexionBilletterie(config({ tiers: 0, options: 0, orders: 0 }))).toMatchObject(
      { quelqueChoseDisparait: false }
    )
  })

  it('suffit d’une seule catégorie pour qu’il y ait quelque chose à dire', () => {
    expect(resumeDeconnexionBilletterie(config({ orders: 1 })).quelqueChoseDisparait).toBe(true)
    expect(resumeDeconnexionBilletterie(config({ tiers: 1 })).quelqueChoseDisparait).toBe(true)
    expect(resumeDeconnexionBilletterie(config({ options: 1 })).quelqueChoseDisparait).toBe(true)
  })

  it('traite un décompte manquant comme zéro plutôt que d’échouer', () => {
    // Une API qui cesserait de rendre ce champ rendrait sinon la confirmation impossible, et l'on
    // retomberait sur l'ancienne — celle qui n'annonçait rien.
    for (const cas of [config(null), config(undefined), null, undefined, {} as never]) {
      expect(resumeDeconnexionBilletterie(cas)).toEqual({
        tarifs: 0,
        options: 0,
        commandes: 0,
        quelqueChoseDisparait: false,
      })
    }
  })

  it('compte une catégorie même si les autres manquent', () => {
    expect(resumeDeconnexionBilletterie(config({ orders: 12 }))).toEqual({
      tarifs: 0,
      options: 0,
      commandes: 12,
      quelqueChoseDisparait: true,
    })
  })
})
