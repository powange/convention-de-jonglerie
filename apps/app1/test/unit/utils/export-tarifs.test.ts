import { describe, expect, it } from 'vitest'

import {
  COLONNES_EXPORT_TARIFS,
  colonnesAExporter,
  lignesDExportDesTarifs,
  prixDUnTarif,
  valeurDeColonne,
  type FormateursDExport,
} from '../../../../../layers/ticketing/app/utils/ticketing/export-tarifs'

/** Des formateurs reconnaissables : on vérifie ce que l'export compose, pas leur mise en forme. */
const F: FormateursDExport = {
  montant: (centimes) => `${(centimes / 100).toFixed(2)} €`,
  date: (valeur) => `le ${String(valeur).slice(0, 10)}`,
  repas: (repas: any) => `repas:${repas.id}`,
  oui: 'Oui',
  non: 'Non',
}

const tarif = (p: Record<string, unknown> = {}): any => ({
  id: 1,
  name: 'Pass week-end',
  customName: null,
  description: null,
  price: 4500,
  minAmount: null,
  maxAmount: null,
  isActive: true,
  position: 1,
  validFrom: null,
  validUntil: null,
  quotas: [],
  handoutItems: [],
  meals: [],
  ...p,
})

describe('prixDUnTarif', () => {
  it('rend le montant pour un tarif à prix fixe', () => {
    expect(prixDUnTarif(tarif({ price: 4500 }), F)).toBe('45.00 €')
  })

  /*
   * Un tarif libre n'a pas de prix, il a des bornes. Rendre « 0.00 € » ferait croire à la
   * gratuité — un chiffre faux mais plausible, qui ne se remarque qu'une fois la caisse faite.
   */
  it('rend les bornes pour un tarif libre, jamais un prix', () => {
    expect(prixDUnTarif(tarif({ price: 0, minAmount: 1000, maxAmount: 5000 }), F)).toBe(
      'Min: 10.00 € – Max: 50.00 €'
    )
    expect(prixDUnTarif(tarif({ price: 0, minAmount: 1000 }), F)).toBe('Min: 10.00 €')
    expect(prixDUnTarif(tarif({ price: 0, maxAmount: 5000 }), F)).toBe('Max: 50.00 €')
  })
})

describe('valeurDeColonne', () => {
  /* Le nom personnalisé est celui que l'organisateur a choisi, et celui que l'écran montre. */
  it('préfère le nom personnalisé à celui de la billetterie externe', () => {
    expect(valeurDeColonne(tarif({ customName: 'Tarif soutien' }), 'title', F)).toBe(
      'Tarif soutien'
    )
    expect(valeurDeColonne(tarif({ customName: null }), 'title', F)).toBe('Pass week-end')
    // Une chaîne vide n'est pas un nom : on retombe sur celui de la billetterie.
    expect(valeurDeColonne(tarif({ customName: '' }), 'title', F)).toBe('Pass week-end')
  })

  it('laisse vide ce qui n’est pas renseigné, plutôt que d’inventer', () => {
    expect(valeurDeColonne(tarif(), 'validFrom', F)).toBe('')
    expect(valeurDeColonne(tarif(), 'validUntil', F)).toBe('')
    expect(valeurDeColonne(tarif(), 'description', F)).toBe('')
    expect(valeurDeColonne(tarif(), 'quotas', F)).toBe('')
  })

  it('rend les dates par le formateur, qui porte le fuseau de l’édition', () => {
    expect(valeurDeColonne(tarif({ validFrom: '2026-07-14T08:00:00Z' }), 'validFrom', F)).toBe(
      'le 2026-07-14'
    )
  })

  it('compte zéro billet vendu quand le champ est absent', () => {
    expect(valeurDeColonne(tarif(), 'tickets', F)).toBe('0')
    expect(valeurDeColonne(tarif({ soldCount: 12 }), 'tickets', F)).toBe('12')
  })

  it('joint les quotas, les articles et les repas comme la liste les affiche', () => {
    const complet = tarif({
      quotas: [{ quota: { id: 1, title: 'Camping' } }, { quota: { id: 2, title: 'Repas' } }],
      handoutItems: [
        { quantity: 1, handoutItem: { id: 1, name: 'Bracelet' } },
        { quantity: 3, handoutItem: { id: 2, name: 'Ticket boisson' } },
      ],
      meals: [{ meal: { id: 7 } }],
    })
    expect(valeurDeColonne(complet, 'quotas', F)).toBe('Camping, Repas')
    // La quantité n'apparaît qu'au-delà de un, comme sur l'écran.
    expect(valeurDeColonne(complet, 'handoutItems', F)).toBe('Bracelet, Ticket boisson ×3')
    expect(valeurDeColonne(complet, 'meals', F)).toBe('repas:7')
  })

  /* Une relation amputée ne doit pas produire une virgule orpheline ni « undefined ». */
  it('écarte les relations incomplètes au lieu de les rendre', () => {
    const bancal = tarif({
      quotas: [{ quota: { id: 1, title: 'Camping' } }, { quota: null }],
      handoutItems: [{ quantity: 1, handoutItem: null }],
    })
    expect(valeurDeColonne(bancal, 'quotas', F)).toBe('Camping')
    expect(valeurDeColonne(bancal, 'handoutItems', F)).toBe('')
  })

  it('rend l’état actif en toutes lettres', () => {
    expect(valeurDeColonne(tarif({ isActive: true }), 'isActive', F)).toBe('Oui')
    expect(valeurDeColonne(tarif({ isActive: false }), 'isActive', F)).toBe('Non')
  })
})

describe('lignesDExportDesTarifs', () => {
  it('rend une colonne par en-tête, dans l’ordre annoncé', () => {
    const lignes = lignesDExportDesTarifs([tarif(), tarif({ id: 2, position: 2 })], F)
    expect(lignes).toHaveLength(2)
    for (const ligne of lignes) {
      expect(ligne).toHaveLength(COLONNES_EXPORT_TARIFS.length)
      // Un export n'a pas de types : toute valeur doit être une chaîne, y compris les nombres.
      for (const cellule of ligne) expect(typeof cellule).toBe('string')
    }
  })

  it('conserve l’ordre reçu, qui est celui de l’écran', () => {
    const lignes = lignesDExportDesTarifs(
      [tarif({ position: 3, name: 'C' }), tarif({ position: 1, name: 'A' })],
      F
    )
    const colonneNom = COLONNES_EXPORT_TARIFS.indexOf('title')
    expect(lignes.map((l) => l[colonneNom])).toEqual(['C', 'A'])
  })

  it('rend un tableau vide sans tarif', () => {
    expect(lignesDExportDesTarifs([], F)).toEqual([])
  })
})

/**
 * Le lien entre le menu des colonnes et le fichier.
 *
 * C'est le seul endroit où l'écran et l'export peuvent diverger sans que rien ne le dise : les
 * identifiants d'export sont EXACTEMENT ceux des colonnes du tableau, et c'est cela qui fait que
 * décocher une colonne la retire du fichier.
 */
describe('colonnesAExporter', () => {
  it('retient les colonnes visibles, dans leur ordre', () => {
    expect(colonnesAExporter(['title', 'price', 'position'])).toEqual([
      'title',
      'price',
      'position',
    ])
  })

  it('retire une colonne décochée', () => {
    const visibles = COLONNES_EXPORT_TARIFS.filter((c) => c !== 'price')
    expect(colonnesAExporter(visibles)).not.toContain('price')
    expect(colonnesAExporter(visibles)).toHaveLength(COLONNES_EXPORT_TARIFS.length - 1)
  })

  /* La colonne d'actions n'a aucun sens dans un fichier : trois boutons ne s'impriment pas. */
  it("écarte la colonne d'actions", () => {
    expect(colonnesAExporter(['title', 'actions'])).toEqual(['title'])
  })

  /*
   * Une colonne que le module ne sait pas rendre est ignorée plutôt que rendue vide : une colonne
   * en moins se remarque, une colonne vide se lit comme une donnée absente.
   */
  it('ignore une colonne inconnue au lieu de la rendre vide', () => {
    expect(colonnesAExporter(['title', 'colonneInventee'])).toEqual(['title'])
  })

  it('ne rend rien quand tout est décoché', () => {
    expect(colonnesAExporter([])).toEqual([])
  })
})

describe('les colonnes retenues gouvernent les lignes', () => {
  it('ne produit que les colonnes demandées, dans leur ordre', () => {
    const lignes = lignesDExportDesTarifs([tarif({ price: 4500 })], F, ['price', 'title'])
    expect(lignes).toEqual([['45.00 €', 'Pass week-end']])
  })

  /* Le PDF a besoin d'apprêter ses cellules ; le CSV non. D'où le passage en paramètre. */
  it('applique la préparation fournie, colonne par colonne', () => {
    const lignes = lignesDExportDesTarifs([tarif()], F, ['title', 'position'], (valeur, colonne) =>
      colonne === 'title' ? valeur.toUpperCase() : valeur
    )
    expect(lignes).toEqual([['PASS WEEK-END', '1']])
  })
})
