import { describe, expect, it } from 'vitest'

import {
  estAjoutableAUneListe,
  etatDeRachat,
  objetsARacheter,
  objetsNonComptes,
  quantiteARacheter,
  resumeRachat,
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
