import { describe, expect, it } from 'vitest'

import {
  estAjoutableAUneListe,
  etatDeRachat,
  objetsARacheter,
  objetsNonComptes,
  quantiteARacheter,
  resumeRachat,
  sansSaisie,
  type ObjetManquant,
} from '../../../../../layers/stock/app/utils/manquants-stock'

/**
 * Ce qui manque à l'échelle de l'édition.
 *
 * Le point le plus important de ce fichier n'est pas le calcul de l'écart — il est éprouvé dans
 * `comptage-stock` — mais la séparation entre « il en manque » et « personne n'a encore compté ».
 * Confondre les deux ferait passer une caisse jamais ouverte pour une caisse intacte.
 */
const objet = (champs: Partial<ObjetManquant> = {}): ObjetManquant => ({
  id: 1,
  name: 'Gobelet',
  quantity: 10,
  finalQuantity: null,
  group: { id: 1, name: 'Bar' },
  ...champs,
})

describe('etatDeRachat', () => {
  it('dit « manquant » quand le recomptage est inférieur au départ', () => {
    expect(etatDeRachat(objet({ quantity: 10, finalQuantity: 7 }))).toBe('manquant')
  })

  it('dit « non compté » tant que personne n’a compté', () => {
    // Et surtout PAS « complet » : c'est toute la raison d'être de ce module.
    expect(etatDeRachat(objet({ quantity: 10, finalQuantity: null }))).toBe('non-compte')
  })

  it('dit « manquant » pour une caisse comptée vide, pas « non compté »', () => {
    // Zéro est un comptage, et le plus mauvais de tous. Le lire comme une absence de comptage
    // ferait disparaître de la liste de rachat exactement ce qu'il faut racheter en entier.
    expect(etatDeRachat(objet({ quantity: 3, finalQuantity: 0 }))).toBe('manquant')
  })

  it('range le surplus avec ce qui est complet', () => {
    // Un objet rangé dans la mauvaise caisse : il y a là quelque chose à comprendre, mais rien à
    // racheter, et cette page ne parle que de rachat.
    expect(etatDeRachat(objet({ quantity: 2, finalQuantity: 5 }))).toBe('complet')
    expect(etatDeRachat(objet({ quantity: 4, finalQuantity: 4 }))).toBe('complet')
  })

  it('donne la priorité à la saisie du jour sur ce qui est enregistré', () => {
    // La page permet de compter sur place : ce qu'on vient de taper doit changer l'état aussitôt,
    // sans attendre l'enregistrement.
    expect(etatDeRachat(objet({ quantity: 10, finalQuantity: 10, saisie: 6 }))).toBe('manquant')
    expect(etatDeRachat(objet({ quantity: 10, finalQuantity: 6, saisie: 10 }))).toBe('complet')
  })

  it('revient à « non compté » quand la saisie du jour efface le comptage', () => {
    expect(etatDeRachat(objet({ quantity: 10, finalQuantity: 6, saisie: null }))).toBe('non-compte')
  })
})

describe('quantiteARacheter', () => {
  it('rend le manque en positif', () => {
    // On rachète 3 gobelets, on ne rachète pas « -3 ».
    expect(quantiteARacheter(objet({ quantity: 10, finalQuantity: 7 }))).toBe(3)
  })

  it('ne rend rien quand il n’y a rien à racheter', () => {
    expect(quantiteARacheter(objet({ quantity: 4, finalQuantity: 4 }))).toBeNull()
    expect(quantiteARacheter(objet({ quantity: 2, finalQuantity: 5 }))).toBeNull()
    expect(quantiteARacheter(objet({ finalQuantity: null }))).toBeNull()
  })

  it('rend la quantité entière pour une caisse vide', () => {
    expect(quantiteARacheter(objet({ quantity: 3, finalQuantity: 0 }))).toBe(3)
  })
})

describe('objetsARacheter', () => {
  it('ne garde que ce qui manque', () => {
    const liste = objetsARacheter([
      objet({ id: 1, quantity: 10, finalQuantity: 7 }),
      objet({ id: 2, quantity: 4, finalQuantity: 4 }),
      objet({ id: 3, quantity: 5, finalQuantity: null }),
      objet({ id: 4, quantity: 2, finalQuantity: 6 }),
    ])

    expect(liste.map((o) => o.id)).toEqual([1])
  })

  it('met le plus gros manque en premier', () => {
    // On regarde cette page pour décider quoi acheter : ce qui manque en nombre pèse le plus.
    const liste = objetsARacheter([
      objet({ id: 1, name: 'Gobelet', quantity: 10, finalQuantity: 8 }),
      objet({ id: 2, name: 'Massue', quantity: 30, finalQuantity: 5 }),
      objet({ id: 3, name: 'Balle', quantity: 12, finalQuantity: 7 }),
    ])

    expect(liste.map((o) => o.id)).toEqual([2, 3, 1])
  })

  it('départage deux manques égaux par le nom, pour un ordre stable', () => {
    const liste = objetsARacheter([
      objet({ id: 1, name: 'Zébu', quantity: 5, finalQuantity: 3 }),
      objet({ id: 2, name: 'Anneau', quantity: 9, finalQuantity: 7 }),
    ])

    expect(liste.map((o) => o.name)).toEqual(['Anneau', 'Zébu'])
  })
})

describe('objetsNonComptes', () => {
  it('ne garde que ce qui attend d’être compté, groupe par groupe', () => {
    // On finit de compter caisse par caisse : l'ordre suit le rangement, pas l'urgence.
    const liste = objetsNonComptes([
      objet({ id: 1, name: 'Praticable', group: { id: 2, name: 'Scène' } }),
      objet({ id: 2, name: 'Gobelet', quantity: 10, finalQuantity: 7 }),
      objet({ id: 3, name: 'Enceinte', group: { id: 1, name: 'Audio' } }),
      objet({ id: 4, name: 'Câble', group: { id: 1, name: 'Audio' } }),
    ])

    expect(liste.map((o) => o.name)).toEqual(['Câble', 'Enceinte', 'Praticable'])
  })
})

describe('resumeRachat', () => {
  it('compte les objets manquants et les exemplaires séparément', () => {
    // Deux nouvelles différentes : combien d'articles sur la liste, et combien d'unités à payer.
    const resume = resumeRachat([
      objet({ id: 1, quantity: 10, finalQuantity: 7 }),
      objet({ id: 2, quantity: 30, finalQuantity: 5 }),
      objet({ id: 3, quantity: 4, finalQuantity: 4 }),
    ])

    expect(resume.objetsManquants).toBe(2)
    expect(resume.exemplairesARacheter).toBe(28)
  })

  it('compte à part ce qui n’a pas été compté', () => {
    // Le chiffre qui dit si la liste de rachat est complète. « 12 exemplaires à racheter » n'a pas
    // le même sens selon qu'il reste 0 ou 40 objets à compter.
    const resume = resumeRachat([
      objet({ id: 1, quantity: 10, finalQuantity: 7 }),
      objet({ id: 2 }),
      objet({ id: 3 }),
    ])

    expect(resume).toEqual({
      objetsManquants: 1,
      exemplairesARacheter: 3,
      nonComptes: 2,
      total: 3,
    })
  })

  it('ne laisse pas le surplus effacer un manque', () => {
    // Deux enceintes perdues et trois praticables en trop ne font pas « +1 ».
    const resume = resumeRachat([
      objet({ id: 1, quantity: 5, finalQuantity: 3 }),
      objet({ id: 2, quantity: 2, finalQuantity: 5 }),
    ])

    expect(resume.exemplairesARacheter).toBe(2)
    expect(resume.objetsManquants).toBe(1)
  })

  it('rend des zéros sur une édition sans matériel, sans se plaindre', () => {
    expect(resumeRachat([])).toEqual({
      objetsManquants: 0,
      exemplairesARacheter: 0,
      nonComptes: 0,
      total: 0,
    })
  })
})

describe('estAjoutableAUneListe', () => {
  it('n’accepte que ce qui manque', () => {
    expect(estAjoutableAUneListe(objet({ quantity: 10, finalQuantity: 7 }))).toBe(true)
  })

  it('refuse un objet jamais compté', () => {
    // Sans écart connu, il n'y a pas de quantité à racheter : la ligne serait illisible. C'est la
    // conséquence directe du lien vivant entre l'article et l'objet.
    expect(estAjoutableAUneListe(objet({ finalQuantity: null }))).toBe(false)
  })

  it('refuse un objet complet ou en surplus', () => {
    expect(estAjoutableAUneListe(objet({ quantity: 4, finalQuantity: 4 }))).toBe(false)
    expect(estAjoutableAUneListe(objet({ quantity: 2, finalQuantity: 5 }))).toBe(false)
  })
})

/**
 * Une saisie non enregistrée ne déplace rien.
 *
 * Le défaut constaté : dans l'onglet « reste à compter », taper un chiffre faisait disparaître la
 * ligne AVANT tout enregistrement — n'importe quelle valeur suffit à ne plus être « non compté ».
 * On ne pouvait donc pas taper « 12 », la case s'évanouissant après le « 1 ».
 *
 * Aucun des vingt tests précédents ne le voyait : ils ne renseignaient que `finalQuantity`, jamais
 * `saisie`. C'est ce trou-là que ce bloc ferme, et c'est pourquoi chaque cas ci-dessous pose une
 * saisie qui CONTREDIT l'enregistré — sans cette contradiction, le test passerait quelle que soit
 * la règle.
 */
describe('la saisie du jour ne change pas d’onglet', () => {
  it('garde dans « reste à compter » un objet tapé mais non enregistré', () => {
    // Le cas exact du rapport : on tape le premier chiffre de « 12 ».
    const liste = objetsNonComptes([objet({ name: 'Marmite', quantity: 12, saisie: 1 })])
    expect(liste.map((o) => o.name)).toEqual(['Marmite'])
  })

  it('laisse la saisie sur la ligne rendue, pour que la case montre ce qu’on tape', () => {
    // La ligne ne bouge pas, mais elle n'est pas figée pour autant : c'est l'objet d'origine qui
    // ressort, saisie comprise, sans quoi la case se serait vidée sous les doigts.
    const [ligne] = objetsNonComptes([objet({ quantity: 12, saisie: 1 })])
    expect(ligne?.saisie).toBe(1)
  })

  it('ne fait pas entrer dans « ce qui manque » un objet seulement tapé', () => {
    // Sinon le même objet figurerait dans les deux onglets à la fois.
    expect(objetsARacheter([objet({ quantity: 12, saisie: 1 })])).toEqual([])
  })

  it('n’en fait pas sortir un objet qu’on vient de corriger sans enregistrer', () => {
    const liste = objetsARacheter([
      objet({ name: 'Gobelet', quantity: 10, finalQuantity: 7, saisie: 10 }),
    ])
    expect(liste.map((o) => o.name)).toEqual(['Gobelet'])
  })

  it('résume l’enregistré, pour que le compteur d’un onglet dise son nombre de lignes', () => {
    const lignes = [
      objet({ id: 1, quantity: 12, saisie: 1 }),
      objet({ id: 2, quantity: 10, finalQuantity: 7, saisie: 10 }),
    ]
    const resume = resumeRachat(lignes)

    // Un non-compté tapé reste un non-compté ; un manquant corrigé reste un manquant, avec ses
    // 3 exemplaires. Le tableau montre une ligne dans chaque onglet, le résumé dit la même chose.
    expect(resume).toEqual({
      objetsManquants: 1,
      exemplairesARacheter: 3,
      nonComptes: 1,
      total: 2,
    })
    expect(resume.nonComptes).toBe(objetsNonComptes(lignes).length)
    expect(resume.objetsManquants).toBe(objetsARacheter(lignes).length)
  })

  it('classe les manquants sur l’écart ENREGISTRÉ, pas sur celui qu’on tape', () => {
    // Sans quoi l'ordre se serait recomposé à chaque frappe, sous le curseur.
    const liste = objetsARacheter([
      objet({ id: 1, name: 'Petit manque', quantity: 10, finalQuantity: 9, saisie: 0 }),
      objet({ id: 2, name: 'Gros manque', quantity: 10, finalQuantity: 2 }),
    ])
    expect(liste.map((o) => o.name)).toEqual(['Gros manque', 'Petit manque'])
  })
})

describe('sansSaisie', () => {
  it('efface la saisie sans toucher au reste', () => {
    const avant = objet({ quantity: 10, finalQuantity: 7, saisie: 3 })
    expect(sansSaisie(avant)).toEqual({ ...avant, saisie: undefined })
  })

  it('ne modifie pas la ligne d’origine', () => {
    // Elle continue d'alimenter l'affichage : la muter viderait la case en cours de frappe.
    const avant = objet({ saisie: 3 })
    sansSaisie(avant)
    expect(avant.saisie).toBe(3)
  })

  it('distingue « case vidée » de « jamais touchée », comme compteRetenu', () => {
    // `null` est une valeur — on efface un comptage —, `undefined` une absence. Les confondre
    // ferait passer un effacement pour une ligne intacte.
    expect(etatDeRachat(objet({ quantity: 10, finalQuantity: 6, saisie: null }))).toBe('non-compte')
    expect(etatDeRachat(sansSaisie(objet({ quantity: 10, finalQuantity: 6, saisie: null })))).toBe(
      'manquant'
    )
  })
})
