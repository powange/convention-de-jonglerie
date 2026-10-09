import { describe, expect, it } from 'vitest'

import {
  empreinteDuDeroule,
  numerosSansTitre,
  type NumeroDuDeroule,
} from '../../../../../layers/artists/app/utils/deroule-de-cabaret'

const numero = (p: Partial<NumeroDuDeroule> = {}): NumeroDuDeroule => ({
  title: 'Jonglerie de massues',
  companyName: '',
  duration: null,
  description: null,
  technicalNeeds: null,
  stageSetup: null,
  artistIds: [],
  ...p,
})

/**
 * Le déroulé d'un cabaret : ce qui empêche d'enregistrer, et ce qui compte comme une modification.
 *
 * ## Le défaut que ces cas ferment
 *
 * L'enregistrement **filtrait** silencieusement les numéros sans titre, et le serveur **remplace**
 * l'ensemble du déroulé : les numéros absents du corps étaient donc **supprimés**. Un titre effacé
 * par mégarde, ou un numéro renseigné avant d'être nommé, disparaissait — et l'écran annonçait
 * « spectacle mis à jour ».
 */
describe('numerosSansTitre', () => {
  it('ne relève rien quand tous les numéros sont nommés', () => {
    expect(numerosSansTitre([numero(), numero({ title: 'Monocycle' })])).toEqual([])
  })

  it('relève les rangs des numéros sans titre, dans l’ordre', () => {
    expect(numerosSansTitre([numero({ title: '' }), numero(), numero({ title: '   ' })])).toEqual([
      0, 2,
    ])
  })

  it('traite un titre fait d’espaces comme vide', () => {
    // Le serveur applique `trim()` : un titre d'espaces s'enregistrerait vide. L'accepter ici
    // reviendrait à laisser passer exactement ce qu'on veut interdire.
    expect(numerosSansTitre([numero({ title: '\t \n' })])).toEqual([0])
  })

  it('ne relève rien sur un déroulé vide', () => {
    // Un cabaret sans aucun numéro est un état légitime — c'est celui d'un spectacle qu'on vient
    // de créer. Le refuser empêcherait d'enregistrer une page qu'on n'a pas encore remplie.
    expect(numerosSansTitre([])).toEqual([])
  })
})

describe('empreinteDuDeroule', () => {
  it('rend la même empreinte pour deux déroulés identiques', () => {
    expect(empreinteDuDeroule([numero()])).toBe(empreinteDuDeroule([numero()]))
  })

  it('ne dépend pas de l’ordre d’insertion des clés', () => {
    /*
     * ⚠️ LE CAS QUI MOTIVE TOUTE LA FONCTION. `JSON.stringify` dépend de l'ordre d'insertion :
     * les numéros chargés viennent d'une projection, ceux ajoutés par l'éditeur sont construits
     * ailleurs. Deux objets de même contenu rendraient deux chaînes différentes, et la garde de
     * sortie se déclencherait sur un déroulé que personne n'a touché.
     */
    const charge: NumeroDuDeroule = {
      id: 7,
      title: 'Massues',
      companyName: 'Cie X',
      duration: 12,
      description: null,
      technicalNeeds: null,
      stageSetup: null,
      artistIds: [3, 1],
    }
    const ajoute: NumeroDuDeroule = {
      artistIds: [3, 1],
      stageSetup: null,
      technicalNeeds: null,
      description: null,
      duration: 12,
      companyName: 'Cie X',
      title: 'Massues',
      id: 7,
    }
    expect(JSON.stringify(charge)).not.toBe(JSON.stringify(ajoute))
    expect(empreinteDuDeroule([charge])).toBe(empreinteDuDeroule([ajoute]))
  })

  it('normalise une durée saisie en chaîne', () => {
    // `UInput` écrit du texte : taper « 12 » puis le retaper à l'identique passerait sinon pour
    // une modification, et la garde de sortie se déclencherait sans raison.
    expect(empreinteDuDeroule([numero({ duration: '12' })])).toBe(
      empreinteDuDeroule([numero({ duration: 12 })])
    )
  })

  it('traite une durée vidée comme absente', () => {
    expect(empreinteDuDeroule([numero({ duration: '' })])).toBe(
      empreinteDuDeroule([numero({ duration: null })])
    )
  })

  it('ignore l’ordre des artistes sélectionnés', () => {
    // L'ordre d'un menu de sélection multiple n'a aucun sens métier.
    expect(empreinteDuDeroule([numero({ artistIds: [3, 1, 2] })])).toBe(
      empreinteDuDeroule([numero({ artistIds: [1, 2, 3] })])
    )
  })

  describe('ce qui DOIT changer l’empreinte', () => {
    /*
     * ⚠️ LA MOITIÉ QUI COMPTE VRAIMENT. Une fausse alerte est agaçante ; une fausse ABSENCE
     * d'alerte laisse perdre le travail sans rien demander. C'est le second qu'il faut rendre
     * impossible, et chacun de ces cas en ferme une forme.
     */
    const reference = empreinteDuDeroule([numero()])

    it.each([
      ['le titre', numero({ title: 'Autre chose' })],
      ['la compagnie', numero({ companyName: 'Cie Y' })],
      ['la durée', numero({ duration: 15 })],
      ['la description', numero({ description: 'Un texte' })],
      ['les besoins techniques', numero({ technicalNeeds: 'Deux projecteurs' })],
      ['la disposition de scène', numero({ stageSetup: 'Tapis' })],
      ['les artistes', numero({ artistIds: [1] })],
      ["l'identifiant", numero({ id: 4 })],
    ])('%s', (_libelle, modifie) => {
      expect(empreinteDuDeroule([modifie])).not.toBe(reference)
    })

    it('un numéro ajouté', () => {
      expect(empreinteDuDeroule([numero(), numero({ title: 'Monocycle' })])).not.toBe(reference)
    })

    it('un numéro retiré', () => {
      expect(empreinteDuDeroule([])).not.toBe(reference)
    })

    it('deux numéros réordonnés', () => {
      // L'ordre des numéros EST le déroulé du cabaret : le confondre serait perdre un déplacement.
      const a = numero({ title: 'A' })
      const b = numero({ title: 'B' })
      expect(empreinteDuDeroule([a, b])).not.toBe(empreinteDuDeroule([b, a]))
    })
  })
})
