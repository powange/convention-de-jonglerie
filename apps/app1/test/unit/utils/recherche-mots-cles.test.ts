import { describe, expect, it } from 'vitest'

import {
  correspondAuxMotsCles,
  motsClesDeLaRequete,
  normaliserPourRecherche,
} from '../../../server/utils/recherche-mots-cles'

/**
 * La recherche comparait la saisie entière à chaque champ pris isolément. Sur une personne dont
 * le nom est « Omer » et le prénom « Emma » : « omer » trouvait, « emma » aussi, mais « omer
 * emma » ne trouvait rien — aucun champ ne contient les deux — et un espace en fin de saisie
 * suffisait à tout faire disparaître.
 */
const OMER_EMMA = ['Omer', 'Emma', 'emma62', 'emma.omer@exemple.fr']

describe('motsClesDeLaRequete', () => {
  it('découpe la saisie en mots', () => {
    expect(motsClesDeLaRequete('omer emma')).toEqual(['omer', 'emma'])
  })

  it('ignore les espaces en trop, où qu’ils soient', () => {
    // C'est le cas signalé : un espace après le mot ne doit rien changer.
    expect(motsClesDeLaRequete('emma ')).toEqual(['emma'])
    expect(motsClesDeLaRequete('  omer   emma  ')).toEqual(['omer', 'emma'])
  })

  it('rend une liste vide pour une saisie sans mot', () => {
    expect(motsClesDeLaRequete('')).toEqual([])
    expect(motsClesDeLaRequete('   ')).toEqual([])
    expect(motsClesDeLaRequete(null)).toEqual([])
    expect(motsClesDeLaRequete(undefined)).toEqual([])
  })
})

describe('normaliserPourRecherche', () => {
  it('retire les accents et la casse', () => {
    expect(normaliserPourRecherche('Jérôme')).toBe('jerome')
    expect(normaliserPourRecherche('ÉLOÏSE')).toBe('eloise')
  })

  it('tolère une valeur absente', () => {
    expect(normaliserPourRecherche(null)).toBe('')
    expect(normaliserPourRecherche(undefined)).toBe('')
  })
})

describe('correspondAuxMotsCles', () => {
  const cherche = (requete: string, champs = OMER_EMMA) =>
    correspondAuxMotsCles(champs, motsClesDeLaRequete(requete))

  it('trouve sur un seul mot, comme avant', () => {
    expect(cherche('omer')).toBe(true)
    expect(cherche('Emma')).toBe(true)
  })

  it('trouve malgré un espace en fin de saisie', () => {
    expect(cherche('emma ')).toBe(true)
  })

  it('trouve avec les deux mots, dans un sens comme dans l’autre', () => {
    // Chaque mot est dans un champ différent : c'est exactement ce qui échouait.
    expect(cherche('omer emma')).toBe(true)
    expect(cherche('emma omer')).toBe(true)
  })

  it('exige que tous les mots soient trouvés', () => {
    expect(cherche('omer dupont')).toBe(false)
  })

  it('cherche aussi dans le pseudo et l’e-mail', () => {
    expect(cherche('emma62')).toBe(true)
    expect(cherche('exemple.fr')).toBe(true)
  })

  it('ignore les accents des deux côtés', () => {
    expect(cherche('jerome', ['Jérôme', 'Blanc'])).toBe(true)
    expect(cherche('Jérôme', ['jerome', 'Blanc'])).toBe(true)
  })

  it('ne rend personne sans mot-clé', () => {
    // Une saisie vide ne doit pas faire remonter toute l'édition.
    expect(correspondAuxMotsCles(OMER_EMMA, [])).toBe(false)
  })

  it('tolère des champs absents', () => {
    expect(cherche('omer', ['Omer', null, undefined, ''])).toBe(true)
    expect(cherche('omer', [null, undefined])).toBe(false)
  })
})
