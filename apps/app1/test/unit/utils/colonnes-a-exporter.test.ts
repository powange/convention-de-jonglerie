import { describe, expect, it } from 'vitest'

import {
  colonnesExportablesVisibles,
  colonneVisible,
  tableauAExporter,
  type ColonneExportable,
} from '../../../app/utils/colonnes-a-exporter'

/**
 * Un export n'emporte que les colonnes affichées.
 *
 * ⚠️ DEMANDÉ PAR L'UTILISATEUR : « sur les exports des tableaux en csv ou pdf, il faut que ça
 * n'exporte que les colonnes du tableau sélectionné ». Les sept écrans à colonnes masquables
 * portaient un menu de sélection à côté de leurs boutons d'export, et les exports ignoraient
 * la sélection.
 */

interface Personne {
  nom: string
  email: string
  telephone: string
}

const COLONNES: ColonneExportable<Personne>[] = [
  { id: 'nom', entete: 'Nom', valeur: (p) => p.nom },
  { id: 'email', entete: 'Courriel', valeur: (p) => p.email },
  { id: 'telephone', entete: 'Téléphone', valeur: (p) => p.telephone },
]

const GENS: Personne[] = [
  { nom: 'Dupont', email: 'd@x.fr', telephone: '0600' },
  { nom: 'Martin', email: 'm@x.fr', telephone: '0601' },
]

describe('colonneVisible', () => {
  it('🔬 une colonne ABSENTE de l’objet est visible', () => {
    /*
     * ⚠️ LA SUBTILITÉ QUI DÉCIDE DE TOUT. `colonnesMasqueesDepuisUrl` ne liste que les colonnes
     * MASQUÉES : tant que l'utilisateur n'a rien touché, l'objet est vide. Tester `=== true`
     * n'exporterait alors plus aucune colonne — l'inverse exact du défaut qu'on corrige, et un
     * défaut bien pire, puisqu'il viderait tous les exports du dépôt d'un coup.
     */
    expect(colonneVisible('nom', {})).toBe(true)
    expect(colonneVisible('nom', undefined)).toBe(true)
    expect(colonneVisible('nom', null)).toBe(true)
    expect(colonneVisible('nom', { email: false })).toBe(true)
  })

  it('🔬 une colonne à `false` est masquée', () => {
    expect(colonneVisible('email', { email: false })).toBe(false)
  })

  it('`true` explicite reste visible', () => {
    // Le composable peut écrire `true` quand on révèle une colonne masquée par défaut.
    expect(colonneVisible('email', { email: true })).toBe(true)
  })
})

describe('colonnesExportablesVisibles', () => {
  it('🔬 retire les colonnes masquées, et garde l’ordre déclaré', () => {
    const retenues = colonnesExportablesVisibles(COLONNES, { email: false })

    expect(retenues.map((c) => c.id)).toEqual(['nom', 'telephone'])
  })

  it('garde tout quand rien n’est masqué', () => {
    expect(colonnesExportablesVisibles(COLONNES, {}).map((c) => c.id)).toEqual([
      'nom',
      'email',
      'telephone',
    ])
  })

  it('rend une liste vide si tout est masqué, sans se plaindre', () => {
    // Cas limite réel : l'utilisateur peut décocher toutes les colonnes masquables. L'export doit
    // produire un fichier vide plutôt que de lever — c'est à l'écran de l'en dissuader, pas ici.
    const tout = { nom: false, email: false, telephone: false }
    expect(colonnesExportablesVisibles(COLONNES, tout)).toEqual([])
  })
})

describe('tableauAExporter', () => {
  it('🔬 aligne les lignes sur les en-têtes retenus', () => {
    /*
     * 📍 C'EST LA RAISON D'ÊTRE DE CETTE FONCTION. Filtrer les en-têtes d'un côté et les valeurs de
     * l'autre est la façon dont une colonne finit décalée d'un cran — un défaut qui ne se voit
     * qu'une fois le fichier ouvert, et qu'on attribue alors aux données.
     */
    const { entetes, lignes } = tableauAExporter(COLONNES, { email: false }, GENS)

    expect(entetes).toEqual(['Nom', 'Téléphone'])
    expect(lignes).toEqual([
      ['Dupont', '0600'],
      ['Martin', '0601'],
    ])
    // Chaque ligne a exactement autant de cases que d'en-têtes.
    for (const ligne of lignes) expect(ligne).toHaveLength(entetes.length)
  })

  it('traverse une liste de lignes vide', () => {
    expect(tableauAExporter(COLONNES, {}, [])).toEqual({
      entetes: ['Nom', 'Courriel', 'Téléphone'],
      lignes: [],
    })
  })
})
