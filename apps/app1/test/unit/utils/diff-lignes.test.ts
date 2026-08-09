import { describe, expect, it } from 'vitest'

import { comparerLignes, meriteUnDiff } from '../../../shared/utils/diff-lignes'

const textes = (lignes: { texte: string; modifiee: boolean }[]) => lignes.map((l) => l.texte)
const modifiees = (lignes: { texte: string; modifiee: boolean }[]) =>
  lignes.filter((l) => l.modifiee).map((l) => l.texte)

describe('comparerLignes', () => {
  it('ne marque rien sur deux textes identiques', () => {
    const r = comparerLignes('10:00 atelier\n20:30 gala', '10:00 atelier\n20:30 gala')

    expect(r.aDesDifferences).toBe(false)
    expect(modifiees(r.anciennes)).toEqual([])
    expect(modifiees(r.nouvelles)).toEqual([])
  })

  it('repère une ligne ajoutée', () => {
    const r = comparerLignes('10:00 atelier', '10:00 atelier\n20:30 gala')

    expect(modifiees(r.nouvelles)).toEqual(['20:30 gala'])
    expect(modifiees(r.anciennes)).toEqual([])
    expect(r.aDesDifferences).toBe(true)
  })

  it('repère une ligne supprimée', () => {
    const r = comparerLignes('10:00 atelier\n20:30 gala', '10:00 atelier')

    expect(modifiees(r.anciennes)).toEqual(['20:30 gala'])
    expect(modifiees(r.nouvelles)).toEqual([])
  })

  /**
   * Le cas courant : le modèle relève à nouveau une journée et n'en change qu'une ligne. Sans
   * comparaison, il faut relire les deux colonnes en entier pour trouver laquelle.
   */
  it('isole la seule ligne qui change au milieu d’un programme', () => {
    const ancien = ['10:00 accueil', '14:00 atelier massues', '20:30 gala'].join('\n')
    const nouveau = ['10:00 accueil', '14:00 atelier diabolo', '20:30 gala'].join('\n')
    const r = comparerLignes(ancien, nouveau)

    expect(modifiees(r.anciennes)).toEqual(['14:00 atelier massues'])
    expect(modifiees(r.nouvelles)).toEqual(['14:00 atelier diabolo'])
  })

  // Les lignes conservées doivent rester à leur place, sinon le lecteur perd le fil du déroulé.
  it('préserve l’ordre et la totalité des deux textes', () => {
    const ancien = 'a\nb\nc'
    const nouveau = 'a\nx\nc\nd'
    const r = comparerLignes(ancien, nouveau)

    expect(textes(r.anciennes)).toEqual(['a', 'b', 'c'])
    expect(textes(r.nouvelles)).toEqual(['a', 'x', 'c', 'd'])
  })

  it('traite un ancien texte vide comme un ajout intégral', () => {
    const r = comparerLignes('', '10:00 accueil\n20:30 gala')

    expect(modifiees(r.nouvelles)).toEqual(['10:00 accueil', '20:30 gala'])
    expect(r.aDesDifferences).toBe(true)
  })

  it('renonce au détail au-delà de la borne, sans mentir sur la différence', () => {
    const gros = Array.from({ length: 401 }, (_, i) => `ligne ${i}`).join('\n')
    const r = comparerLignes(gros, gros + '\nune de plus')

    expect(r.aDesDifferences).toBe(true)
    expect(r.anciennes.every((l) => l.modifiee)).toBe(true)
  })

  it('ne signale pas de différence sur deux textes vides', () => {
    expect(comparerLignes('', '').aDesDifferences).toBe(false)
  })
})

describe('meriteUnDiff', () => {
  // Sur une date ou une URL, colorer la ligne entière n'apprend rien de plus que les deux encadrés.
  it('écarte les valeurs tenant sur une ligne', () => {
    expect(meriteUnDiff('2026-08-01', '2026-08-02')).toBe(false)
    expect(meriteUnDiff('https://a.example', 'https://b.example')).toBe(false)
  })

  it('retient dès qu’un des deux textes a plusieurs lignes', () => {
    expect(meriteUnDiff('10:00 accueil\n20:30 gala', '10:00 accueil')).toBe(true)
    expect(meriteUnDiff('', 'a\nb')).toBe(true)
  })
})
