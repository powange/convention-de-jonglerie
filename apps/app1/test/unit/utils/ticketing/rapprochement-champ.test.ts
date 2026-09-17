import { describe, expect, it } from 'vitest'

import {
  reponseDesigneLeChamp,
  type ChampPersonnaliseVise,
} from '../../../../server/utils/ticketing/rapprochement-champ'

/**
 * La règle partagée par le décompte des quotas et le calcul des articles à remettre.
 *
 * Ce qu'elle protège tient en une phrase : renommer un champ personnalisé ne doit plus détacher
 * les billets déjà vendus. Et ce qu'elle ne doit JAMAIS faire : rapprocher un identifiant interne
 * d'un identifiant fournisseur, deux espaces sans rapport.
 */
const champ: ChampPersonnaliseVise = {
  id: 12,
  label: 'Régime alimentaire',
  helloAssoCustomFieldId: 6402086,
}

/** Un champ créé ici, sans billetterie externe derrière. */
const champLocal: ChampPersonnaliseVise = {
  id: 8,
  label: 'Taille de t-shirt',
  helloAssoCustomFieldId: null,
}

describe('reponseDesigneLeChamp', () => {
  describe('par l’identifiant interne', () => {
    it('reconnaît le champ malgré un libellé devenu faux', async () => {
      expect(reponseDesigneLeChamp({ customFieldId: 12, name: 'Régime alimentare' }, champ)).toBe(
        true
      )
    })

    it('refuse un autre champ, même si le libellé correspond', () => {
      // L'identifiant présent est décisif, y compris pour refuser : le libellé n'a pas à
      // réconcilier deux champs que leurs identifiants distinguent.
      expect(reponseDesigneLeChamp({ customFieldId: 99, name: 'Régime alimentaire' }, champ)).toBe(
        false
      )
    })
  })

  describe('par l’identifiant du fournisseur', () => {
    it('reconnaît le champ importé malgré un libellé devenu faux', () => {
      expect(reponseDesigneLeChamp({ id: 6402086, name: 'Ancien libellé' }, champ)).toBe(true)
    })

    it('refuse un autre identifiant fournisseur', () => {
      expect(reponseDesigneLeChamp({ id: 1, name: 'Régime alimentaire' }, champ)).toBe(false)
    })

    it('refuse quand le champ n’a pas d’identifiant fournisseur', () => {
      // Un champ créé ici ne peut pas correspondre à l'identifiant d'une billetterie externe.
      // Sans ce garde, `undefined === undefined` aurait suffi à les marier.
      expect(reponseDesigneLeChamp({ id: 6402086 }, champLocal)).toBe(false)
    })
  })

  /**
   * Le test qui protège du pire : les deux identifiants n'ont aucun rapport entre eux.
   */
  it('ne confond jamais les deux espaces d’identifiants', () => {
    // 6402086 est l'identifiant FOURNISSEUR du champ visé ; posé comme identifiant interne, il
    // désigne un tout autre champ.
    expect(reponseDesigneLeChamp({ customFieldId: 6402086 }, champ)).toBe(false)
    // Et 12 est son identifiant INTERNE ; posé comme identifiant fournisseur, il ne vaut rien.
    expect(reponseDesigneLeChamp({ id: 12 }, champ)).toBe(false)
  })

  describe('par le libellé, en dernier repli', () => {
    it('reconnaît le champ quand l’instantané ne porte aucun identifiant', () => {
      expect(reponseDesigneLeChamp({ name: 'Régime alimentaire' }, champ)).toBe(true)
    })

    it('refuse un libellé différent', () => {
      expect(reponseDesigneLeChamp({ name: 'Taille de t-shirt' }, champ)).toBe(false)
    })

    it('refuse un instantané qui ne porte rien du tout', () => {
      expect(reponseDesigneLeChamp({}, champ)).toBe(false)
    })
  })

  it('ignore un identifiant qui n’est pas un nombre', () => {
    // Un instantané ancien ou malformé peut porter une chaîne : elle ne doit ni servir de clé,
    // ni empêcher le repli sur le libellé.
    expect(
      reponseDesigneLeChamp({ customFieldId: '12', name: 'Régime alimentaire' } as never, champ)
    ).toBe(true)
  })
})
