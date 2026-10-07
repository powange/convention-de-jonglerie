import { describe, expect, it } from 'vitest'

import {
  bicEstPlausible,
  coordonneeBancaireOuNull,
  formaterIbanParGroupes,
  ibanEstPlausible,
  normaliserCoordonneeBancaire,
} from '~~/shared/utils/coordonnees-bancaires'

/**
 * Les IBAN d'exemple publiés par les banques centrales, et eux seuls.
 *
 * ⚠️ NE JAMAIS METTRE UN IBAN RÉEL DANS UN TEST, pas même tronqué : un test vit dans l'historique
 * du dépôt et n'en sort plus. Ceux-ci sont les exemples de documentation de leurs pays respectifs,
 * et leur clé de contrôle est juste — c'est précisément ce qui les rend utilisables ici.
 */
const IBAN_FR = 'FR1420041010050500013M02606'
const IBAN_BE = 'BE68539007547034'
const IBAN_DE = 'DE89370400440532013000'

describe('normaliserCoordonneeBancaire', () => {
  it('met en majuscules et retire les espaces de recopie', () => {
    // Un IBAN est imprimé par groupes de quatre, et se recopie avec ces espaces.
    expect(normaliserCoordonneeBancaire('fr14 2004 1010 0505 0001 3M02 606')).toBe(IBAN_FR)
  })

  it('retire aussi les séparateurs qu’on glisse parfois', () => {
    expect(normaliserCoordonneeBancaire('BE68-5390/0754.7034')).toBe(IBAN_BE)
  })

  it('rend une chaîne vide pour rien du tout', () => {
    expect(normaliserCoordonneeBancaire(null)).toBe('')
    expect(normaliserCoordonneeBancaire(undefined)).toBe('')
    expect(normaliserCoordonneeBancaire('   ')).toBe('')
  })
})

describe('coordonneeBancaireOuNull', () => {
  it('rend null quand il n’y a rien, pour que la base dise NULL', () => {
    // Une chaîne vide en base se lirait comme « un IBAN, mais vide » : ce n'est pas une absence.
    expect(coordonneeBancaireOuNull('')).toBeNull()
    expect(coordonneeBancaireOuNull('  -  ')).toBeNull()
    expect(coordonneeBancaireOuNull(null)).toBeNull()
  })

  it('rend la valeur normalisée sinon', () => {
    expect(coordonneeBancaireOuNull('be68 5390 0754 7034')).toBe(IBAN_BE)
  })
})

describe('ibanEstPlausible', () => {
  it('accepte des IBAN dont la clé de contrôle est juste', () => {
    expect(ibanEstPlausible(IBAN_FR)).toBe(true)
    expect(ibanEstPlausible(IBAN_BE)).toBe(true)
    expect(ibanEstPlausible(IBAN_DE)).toBe(true)
  })

  it('accepte la même valeur écrite avec ses espaces', () => {
    expect(ibanEstPlausible('BE68 5390 0754 7034')).toBe(true)
  })

  it('⚠️ refuse un chiffre changé, que la forme seule ne verrait pas', () => {
    // C'EST LA RAISON D'ÊTRE DE CETTE FONCTION. La faute de frappe ci-dessous a la bonne longueur,
    // le bon pays, la bonne forme — seule la clé de contrôle la distingue d'un compte réel. Sans
    // elle, le virement part vers un compte qui n'existe pas et personne ne l'apprend avant des
    // semaines.
    expect(ibanEstPlausible('BE68539007547035')).toBe(false)
  })

  it('refuse deux chiffres permutés', () => {
    // L'autre faute courante en recopiant : l'ordre, non le caractère.
    expect(ibanEstPlausible('BE68539007547043')).toBe(false)
  })

  it('refuse ce qui n’a pas la forme d’un IBAN', () => {
    expect(ibanEstPlausible('FR14')).toBe(false)
    expect(ibanEstPlausible('1420041010050500013M02606')).toBe(false)
    expect(ibanEstPlausible('bonjour')).toBe(false)
  })

  it('accepte le vide : la plupart des artistes n’en donnent pas', () => {
    // L'absence de coordonnées n'est pas une faute de saisie. Un appelant qui les EXIGE le
    // vérifie lui-même — ici, personne ne les exige.
    expect(ibanEstPlausible('')).toBe(true)
    expect(ibanEstPlausible(null)).toBe(true)
  })
})

describe('bicEstPlausible', () => {
  it('accepte les deux longueurs normalisées', () => {
    expect(bicEstPlausible('BNPAFRPP')).toBe(true)
    expect(bicEstPlausible('BNPAFRPPXXX')).toBe(true)
    expect(bicEstPlausible('gebabebb')).toBe(true)
  })

  it('refuse une longueur intermédiaire', () => {
    // 9 ou 10 caractères : ni le code court, ni le code avec agence.
    expect(bicEstPlausible('BNPAFRPPX')).toBe(false)
    expect(bicEstPlausible('BNPAFRPPXX')).toBe(false)
  })

  it('refuse des chiffres là où le pays est attendu', () => {
    expect(bicEstPlausible('BNPA12PP')).toBe(false)
  })

  it('accepte le vide', () => {
    expect(bicEstPlausible(null)).toBe(true)
  })
})

describe('formaterIbanParGroupes', () => {
  it('coupe par quatre, comme sur un relevé', () => {
    // C'est la seule forme sous laquelle on relit un IBAN caractère par caractère.
    expect(formaterIbanParGroupes(IBAN_BE)).toBe('BE68 5390 0754 7034')
  })

  it('ne laisse pas d’espace en fin quand la longueur est un multiple de quatre', () => {
    expect(formaterIbanParGroupes('BE68539007547034')).not.toMatch(/ $/)
  })

  it('laisse le dernier groupe incomplet tel quel', () => {
    expect(formaterIbanParGroupes(IBAN_FR)).toBe('FR14 2004 1010 0505 0001 3M02 606')
  })

  it('rend une chaîne vide pour rien', () => {
    expect(formaterIbanParGroupes(null)).toBe('')
  })
})
