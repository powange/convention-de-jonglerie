import { describe, expect, it } from 'vitest'

import {
  contientLaSaisie,
  motsDeLaRequete,
  normaliserTexte,
} from '../../../shared/utils/recherche-texte'

/**
 * La comparaison de textes partagée par les écrans de recherche.
 *
 * Ce qui s'éprouve ici tient en une phrase : sur un clavier de téléphone, les accents demandent un
 * appui long, donc personne ne les tape. Une recherche qui les exige ne trouve rien.
 */
describe('normaliserTexte', () => {
  it('retire les accents et la casse', () => {
    expect(normaliserTexte('Réserver la salle')).toBe('reserver la salle')
    expect(normaliserTexte('ÉLECTRICITÉ')).toBe('electricite')
  })

  it('gère les autres diacritiques du français', () => {
    expect(normaliserTexte('Noël, çà et là, aiguë')).toBe('noel, ca et la, aigue')
  })

  it('coupe les espaces de bord', () => {
    expect(normaliserTexte('  bar  ')).toBe('bar')
  })

  it('accepte une valeur absente', () => {
    expect(normaliserTexte(null)).toBe('')
    expect(normaliserTexte(undefined)).toBe('')
  })
})

describe('motsDeLaRequete', () => {
  it('découpe et normalise', () => {
    expect(motsDeLaRequete('  Câbles   XLR ')).toEqual(['cables', 'xlr'])
  })

  it('ne rend aucun mot sur une saisie vide', () => {
    expect(motsDeLaRequete('   ')).toEqual([])
    expect(motsDeLaRequete(null)).toEqual([])
  })
})

describe('contientLaSaisie', () => {
  it('trouve malgré les accents manquants', () => {
    // Le cas qui motive tout ce fichier.
    expect(contientLaSaisie('reserver', 'Réserver la salle', null)).toBe(true)
  })

  it('trouve malgré la casse', () => {
    expect(contientLaSaisie('SALLE', 'Réserver la salle', null)).toBe(true)
  })

  it('cherche dans chacun des champs proposés', () => {
    expect(contientLaSaisie('devis', 'Commander les bracelets', 'Relancer pour le devis')).toBe(
      true
    )
  })

  it('ne trouve pas ce qui n’y est pas', () => {
    expect(contientLaSaisie('bracelet', 'Réserver la salle', 'Avant le 30 juin')).toBe(false)
  })

  it('laisse tout passer sur une saisie vide', () => {
    // L'état au repos du champ de recherche n'est pas un filtre.
    expect(contientLaSaisie('', 'Réserver la salle')).toBe(true)
    expect(contientLaSaisie('   ', 'Réserver la salle')).toBe(true)
    expect(contientLaSaisie(null, 'Réserver la salle')).toBe(true)
  })

  it('ignore un champ absent sans se plaindre', () => {
    expect(contientLaSaisie('salle', null, undefined, 'Réserver la salle')).toBe(true)
    expect(contientLaSaisie('salle', null, undefined)).toBe(false)
  })

  it('cherche la saisie d’un bloc, et non mot à mot', () => {
    // Contrairement à l'inventaire du matériel, qui croise des mots : ici l'on tape le début d'un
    // titre qu'on a sous les yeux. « salle reserver » ne doit donc pas trouver « Réserver la salle ».
    expect(contientLaSaisie('salle reserver', 'Réserver la salle')).toBe(false)
    expect(contientLaSaisie('reserver la', 'Réserver la salle')).toBe(true)
  })
})
