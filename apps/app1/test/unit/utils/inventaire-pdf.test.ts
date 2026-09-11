import { describe, expect, it } from 'vitest'

import {
  nomFichierInventaire,
  preparerInventairePourPdf,
  resumeInventaire,
} from '../../../../../layers/stock/app/utils/inventaire-pdf'

/**
 * La fiche existe pour les moments où l'application ne sert à rien : le hangar sans réseau, le
 * camion qu'on charge. Ce qui sort du site se décide donc ici, et pas dans le code de mise en
 * page — une fiche imprimée ne se rattrape pas, et la colonne qu'on oublie coûte un aller-retour
 * au local.
 */
const objet = (nom: string, champs: Record<string, unknown> = {}) => ({
  name: nom,
  quantity: 3,
  ...champs,
})

describe('preparerInventairePourPdf', () => {
  it('rend les colonnes utiles', () => {
    const [ligne] = preparerInventairePourPdf([
      objet('Rallonge 10 m', {
        quantity: 12,
        location: 'Étagère du fond',
        tags: [{ tag: { name: 'Fragile' } }, { tag: { name: 'Son' } }],
      }),
    ])

    expect(ligne).toMatchObject({
      nom: 'Rallonge 10 m',
      quantite: '12',
      emplacement: 'Étagère du fond',
      tags: 'Fragile, Son',
    })
  })

  it('préfère le nom de la zone au texte libre', () => {
    // La même règle qu'à l'écran : la carte prime, le texte libre complète.
    const [ligne] = preparerInventairePourPdf([
      objet('Enceinte', { location: 'Sous la scène', zone: { name: 'Chapiteau', color: '#fff' } }),
    ])

    expect(ligne?.emplacement).toBe('Chapiteau')
  })

  it('garde l’ordre reçu', () => {
    // On parcourt les caisses dans l'ordre où elles sont rangées : une fiche qui trierait
    // autrement obligerait à chercher chaque ligne.
    const lignes = preparerInventairePourPdf([objet('Zèbre'), objet('Âne')])

    expect(lignes.map((l) => l.nom)).toEqual(['Zèbre', 'Âne'])
  })

  it('écarte un objet sans nom', () => {
    expect(preparerInventairePourPdf([objet('   ')])).toEqual([])
  })

  it('signale l’état d’un emprunt', () => {
    const [ligne] = preparerInventairePourPdf([
      objet('Praticable', { isExternalLoan: true, pickedUpAt: '2026-10-01T10:00:00.000Z' }),
    ])

    expect(ligne?.etatEmprunt).toBe('gestion.stock.loan_to_return')
  })

  it('ne met pas d’état sur le matériel de la convention', () => {
    // Une colonne remplie partout ne signalerait plus rien.
    const [ligne] = preparerInventairePourPdf([objet('Balles', { isExternalLoan: false })])

    expect(ligne?.etatEmprunt).toBeNull()
  })

  it('reporte un comptage déjà fait', () => {
    // Sans lui, on recompte ce qui l'a été, et l'on ne sait pas distinguer « pas encore vu » de
    // « vu, et il n'en reste rien ».
    const lignes = preparerInventairePourPdf([
      objet('Comptée', { finalQuantity: 2 }),
      objet('Vidée', { finalQuantity: 0 }),
      objet('Pas comptée'),
    ])

    expect(lignes.map((l) => l.compte)).toEqual(['2', '0', ''])
  })

  it('laisse la colonne vide plutôt que d’écrire zéro', () => {
    // Zéro imprimé voudrait dire « il n'en reste aucun » ; la case vide dit « à compter ».
    const [ligne] = preparerInventairePourPdf([objet('Praticable', { finalQuantity: null })])

    expect(ligne?.compte).toBe('')
  })

  it('tolère un objet sans tags ni emplacement', () => {
    const [ligne] = preparerInventairePourPdf([objet('Nu')])

    expect(ligne).toMatchObject({ tags: '', emplacement: '' })
  })
})

describe('resumeInventaire', () => {
  it('compte les objets, les comptages et les emprunts', () => {
    const lignes = preparerInventairePourPdf([
      objet('A', { finalQuantity: 1 }),
      objet('B', { isExternalLoan: true }),
      objet('C'),
    ])

    expect(resumeInventaire(lignes)).toEqual({ objets: 3, comptes: 1, empruntes: 1 })
  })

  it('rend des zéros sur une fiche vide', () => {
    expect(resumeInventaire([])).toEqual({ objets: 0, comptes: 0, empruntes: 0 })
  })
})

describe('nomFichierInventaire', () => {
  it('compose le nom à partir de l’édition et du groupe', () => {
    // Les deux, parce qu'on imprime plusieurs groupes d'affilée : trois fichiers appelés
    // « inventaire.pdf » ne se distinguent plus dans un dossier de téléchargements.
    expect(nomFichierInventaire('Sonorisation', 'Convention 2026')).toBe(
      'inventaire-convention-2026-sonorisation.pdf'
    )
  })

  it('retire accents et ponctuation', () => {
    expect(nomFichierInventaire("L'Été à Rêve-sur-Mer !")).toBe(
      'inventaire-l-ete-a-reve-sur-mer.pdf'
    )
  })

  it('se contente du groupe sans édition', () => {
    expect(nomFichierInventaire('Cuisine')).toBe('inventaire-cuisine.pdf')
  })

  it('retombe sur un nom générique sans rien', () => {
    // Sans ce repli, un nom vide produirait un fichier appelé « inventaire-.pdf ».
    expect(nomFichierInventaire(null)).toBe('inventaire.pdf')
    expect(nomFichierInventaire('   ', '!!!')).toBe('inventaire.pdf')
  })
})
