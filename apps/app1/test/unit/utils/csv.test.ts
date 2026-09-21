import { describe, expect, it } from 'vitest'

import {
  BOM_UTF8,
  celluleCsv,
  nomDeFichierCsv,
  ressembleAUneFormule,
  versCsv,
} from '../../../shared/utils/csv'

/**
 * Le CSV que les organisateurs ouvrent dans un tableur.
 *
 * Ce qui se joue ici ne se voit jamais en relisant le code : un fichier mal formé s'ouvre, et
 * ment. Les trois façons dont il ment sont éprouvées séparément — un encodage perdu, une colonne
 * décalée par une virgule, une cellule qui s'exécute.
 *
 * La règle anti-formule est la plus délicate : trop lâche, elle laisse passer une instruction ;
 * trop stricte, elle marque 144 des 202 numéros de téléphone en base. Les deux bords sont donc
 * tenus par des tests.
 */

describe('ressembleAUneFormule', () => {
  it('reconnaît les deux têtes toujours dangereuses', () => {
    expect(ressembleAUneFormule('=1+1')).toBe(true)
    expect(ressembleAUneFormule('@SUM(A1)')).toBe(true)
  })

  it('reconnaît une formule déguisée derrière un signe', () => {
    // Le cas qui justifie de ne pas se contenter du premier caractère.
    expect(ressembleAUneFormule('+HYPERLINK("http://exemple.fr")')).toBe(true)
    expect(ressembleAUneFormule('-WEBSERVICE("http://exemple.fr")')).toBe(true)
  })

  it('LAISSE INTACT un numéro de téléphone international', () => {
    // 144 des 202 numéros en base commencent par « + ». Les marquer tous pour parer un danger
    // jamais observé serait le remède pire que le mal.
    expect(ressembleAUneFormule('+33612345678')).toBe(false)
    expect(ressembleAUneFormule('+33 6 12 34 56 78')).toBe(false)
    expect(ressembleAUneFormule('+33 (0)6.12.34.56.78')).toBe(false)
  })

  it('laisse intact un nombre négatif', () => {
    expect(ressembleAUneFormule('-42')).toBe(false)
    expect(ressembleAUneFormule('-12.5')).toBe(false)
  })

  it('écarte une tabulation ou un retour chariot en tête', () => {
    // Certains tableurs les consomment et découvrent le caractère suivant.
    expect(ressembleAUneFormule('\t=1+1')).toBe(true)
    expect(ressembleAUneFormule('\r=1+1')).toBe(true)
  })

  it('laisse tranquille ce qui est manifestement du texte', () => {
    expect(ressembleAUneFormule('Alice Martin')).toBe(false)
    expect(ressembleAUneFormule('')).toBe(false)
    expect(ressembleAUneFormule('a@exemple.fr')).toBe(false)
  })
})

describe('celluleCsv', () => {
  it('entoure toujours de guillemets, même sans nécessité', () => {
    // Une règle appliquée partout se vérifie d'un coup d'œil.
    expect(celluleCsv('Alice')).toBe('"Alice"')
  })

  it('double les guillemets internes', () => {
    expect(celluleCsv('Il a dit "oui"')).toBe('"Il a dit ""oui"""')
  })

  it('garde une virgule et un retour à la ligne SANS décaler les colonnes', () => {
    // Le défaut le plus courant : une motivation libre contient tôt ou tard une virgule.
    expect(celluleCsv('Bonjour, je suis dispo')).toBe('"Bonjour, je suis dispo"')
    expect(celluleCsv('ligne 1\nligne 2')).toBe('"ligne 1\nligne 2"')
  })

  it('neutralise une formule par une apostrophe de tête', () => {
    // Excel n'affiche pas cette apostrophe, et la cellule cesse d'être une instruction.
    expect(celluleCsv('=cmd|/c calc')).toBe(`"'=cmd|/c calc"`)
  })

  it('n’ajoute rien devant un téléphone', () => {
    expect(celluleCsv('+33612345678')).toBe('"+33612345678"')
  })

  it('rend une cellule VIDE pour une valeur absente, et non « null »', () => {
    expect(celluleCsv(null)).toBe('""')
    expect(celluleCsv(undefined)).toBe('""')
    expect(celluleCsv('')).toBe('""')
  })

  it('écrit les nombres et les booléens tels qu’ils se lisent', () => {
    expect(celluleCsv(0)).toBe('"0"')
    expect(celluleCsv(42)).toBe('"42"')
    expect(celluleCsv(false)).toBe('"false"')
  })
})

describe('versCsv', () => {
  it('commence par la marque d’ordre des octets', () => {
    // Sans elle, Excel sous Windows affiche « Prénom » en « PrÃ©nom » sur toute la colonne.
    expect(versCsv(['Prénom'], [])).toMatch(new RegExp(`^${BOM_UTF8}`))
  })

  it('échappe les EN-TÊTES comme les cellules', () => {
    // Ils n'en avaient pas besoin jusqu'ici, aucun libellé ne portant de virgule — c'est
    // exactement ce qui tient par chance jusqu'à la première traduction.
    expect(versCsv(['Nom, prénom'], [])).toBe(`${BOM_UTF8}"Nom, prénom"`)
  })

  it('sépare les lignes par CRLF, comme le format le fixe', () => {
    const csv = versCsv(['A'], [['x'], ['y']])
    expect(csv).toBe(`${BOM_UTF8}"A"\r\n"x"\r\n"y"`)
  })

  it('assemble un tableau complet', () => {
    const csv = versCsv(
      ['Nom', 'Téléphone'],
      [
        ['Alice Martin', '+33612345678'],
        ['Bob, dit « Bob »', null],
      ]
    )
    expect(csv.split('\r\n')).toEqual([
      `${BOM_UTF8}"Nom","Téléphone"`,
      '"Alice Martin","+33612345678"',
      '"Bob, dit « Bob »",""',
    ])
  })

  it('rend un fichier réduit à ses en-têtes quand il n’y a aucune ligne', () => {
    // Un export vide doit rester un CSV valide : ouvert dans un tableur, il montre les colonnes.
    expect(versCsv(['Nom'], [])).toBe(`${BOM_UTF8}"Nom"`)
  })
})

describe('nomDeFichierCsv', () => {
  it('ajoute l’extension', () => {
    expect(nomDeFichierCsv('organisateurs-edition-22')).toBe('organisateurs-edition-22.csv')
  })

  it('neutralise ce qui casserait l’en-tête ou sortirait du dossier', () => {
    expect(nomDeFichierCsv('../../etc/passwd')).toBe('etc-passwd.csv')
    expect(nomDeFichierCsv('rapport "final"')).toBe('rapport-final.csv')
  })

  it('remplace les espaces et ne laisse pas de tirets en trop', () => {
    expect(nomDeFichierCsv('  export   des  organisateurs ')).toBe('export-des-organisateurs.csv')
  })

  it('garde un nom utilisable quand il ne reste rien', () => {
    expect(nomDeFichierCsv('///')).toBe('export.csv')
  })
})
