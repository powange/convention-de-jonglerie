import { describe, expect, it } from 'vitest'

import {
  COLONNES_TRESORERIE,
  entetesDeLaTresorerie,
  preparerLignesTresorerie,
  type LigneTresorerieCsv,
} from '../../../app/utils/export-tresorerie-csv'

/**
 * La trésorerie en CSV, pour que le comptable reprenne les écritures.
 *
 * Le seul export était un PDF, fait pour être lu en assemblée. Rien ne se reprenait dans un
 * tableur, alors que chaque ligne porte déjà son code, sa nature, son réglé, son engagé, la
 * personne qui a avancé et son justificatif.
 *
 * Ce qui peut être faux ici sans que personne ne le voie : un montant livré en centimes, une
 * colonne décalée d'un cran, un « oui » là où la ligne dit non. Un tableur ne s'en plaint pas — il
 * additionne.
 */

/** Traducteur d'essai : rend la clé, sauf pour les quelques mots que les assertions lisent. */
const t = (cle: string) => {
  const mots: Record<string, string> = {
    'common.yes': 'Oui',
    'common.no': 'Non',
    'gestion.treasury.expense': 'Charge',
    'gestion.treasury.income': 'Produit',
    'gestion.treasury.export_origin_computed': 'Calculé',
    'gestion.treasury.export_origin_manual': 'Saisi',
  }
  return mots[cle] ?? cle
}

const titre = (ligne: LigneTresorerieCsv) => ligne.title

const ligne = (over: Partial<LigneTresorerieCsv> = {}): LigneTresorerieCsv => ({
  kind: 'EXPENSE',
  title: 'Location de la salle',
  settled: 45000,
  pending: 0,
  origin: 'manual',
  ...over,
})

/** Les colonnes, par leur nom, pour ne pas écrire d'index nus dans les assertions. */
const col = (rangee: string[], id: (typeof COLONNES_TRESORERIE)[number]['id']) =>
  rangee[COLONNES_TRESORERIE.findIndex((c) => c.id === id)]

describe('preparerLignesTresorerie', () => {
  it('rend une colonne par en-tête, ni plus ni moins', () => {
    // Le décalage d'un cran est le défaut le plus coûteux d'un CSV : il déplace toute la suite, et
    // le fichier reste parfaitement lisible.
    const rangees = preparerLignesTresorerie([ligne()], t, titre)

    expect(entetesDeLaTresorerie(t)).toHaveLength(COLONNES_TRESORERIE.length)
    expect(rangees[0]).toHaveLength(COLONNES_TRESORERIE.length)
  })

  it('écrit les montants en unité courante, à deux décimales', () => {
    // 45000 centimes livrés tels quels donneraient un total quatre-vingt-dix-neuf fois trop grand,
    // sans que rien ne le signale.
    const rangees = preparerLignesTresorerie([ligne({ settled: 45000, pending: 1250 })], t, titre)

    expect(col(rangees[0]!, 'regle')).toBe('450.00')
    // L'engagé CONTIENT le réglé, il ne s'y ajoute pas comme une seconde dépense : c'est la
    // convention de la page et du PDF.
    expect(col(rangees[0]!, 'engage')).toBe('462.50')
  })

  it('écrit un montant rond avec ses décimales', () => {
    const rangees = preparerLignesTresorerie([ligne({ settled: 50000, pending: 0 })], t, titre)

    expect(col(rangees[0]!, 'regle')).toBe('500.00')
  })

  it('range les charges avant les produits', () => {
    const rangees = preparerLignesTresorerie(
      [
        ligne({ kind: 'INCOME', title: 'Buvette', settled: 10000 }),
        ligne({ kind: 'EXPENSE', title: 'Salle', settled: 20000 }),
      ],
      t,
      titre
    )

    expect(rangees.map((r) => col(r, 'nature'))).toEqual(['Charge', 'Produit'])
    expect(rangees.map((r) => col(r, 'intitule'))).toEqual(['Salle', 'Buvette'])
  })

  it('suit l’ordre du plan comptable, et referme par les lignes sans code', () => {
    // Le même ordre que le PDF, par `regrouperParCode` : deux exports d'une même page qui ne
    // présenteraient pas les lignes dans le même ordre se compareraient mal.
    const rangees = preparerLignesTresorerie(
      [
        ligne({ title: 'Sans imputation' }),
        ligne({ title: 'Compte 625', code: { code: '625', label: 'Déplacements' } }),
        ligne({ title: 'Compte 606', code: { code: '606', label: 'Fournitures' } }),
      ],
      t,
      titre
    )

    expect(rangees.map((r) => col(r, 'intitule'))).toEqual([
      'Compte 606',
      'Compte 625',
      'Sans imputation',
    ])
    expect(rangees.map((r) => col(r, 'code'))).toEqual(['606', '625', ''])
    expect(rangees[0] && col(rangees[0], 'libelleCode')).toBe('Fournitures')
  })

  describe('la date de l’opération', () => {
    it('sort en ISO, pas dans le fuseau du lecteur', () => {
      // La colonne est une DATE que Prisma rend à minuit UTC. La formater en heure locale la
      // ferait glisser d'un jour à l'ouest de Greenwich — le 12 juin deviendrait le 11 — et un
      // tableur trie de toute façon mieux une date ISO qu'une date écrite pour l'œil.
      const rangees = preparerLignesTresorerie(
        [ligne({ operationDate: '2026-06-12T00:00:00.000Z' })],
        t,
        titre
      )

      expect(col(rangees[0]!, 'dateOperation')).toBe('2026-06-12')
    })

    it('laisse la cellule vide quand la ligne n’en a pas', () => {
      // Une ligne calculée n'en a jamais, et les entrées antérieures au champ non plus : on ne
      // leur invente pas de date, surtout pas celle de leur saisie.
      const rangees = preparerLignesTresorerie([ligne()], t, titre)

      expect(col(rangees[0]!, 'dateOperation')).toBe('')
    })
  })

  it('dit oui ou non, et non true ou false', () => {
    const rangees = preparerLignesTresorerie(
      [
        ligne({ isForecast: true, reimbursed: false }),
        ligne({ isForecast: false, reimbursed: true }),
      ],
      t,
      titre
    )

    expect(rangees.map((r) => col(r, 'previsionnel'))).toEqual(['Oui', 'Non'])
    expect(rangees.map((r) => col(r, 'rembourse'))).toEqual(['Non', 'Oui'])
  })

  it('dit non plutôt que rien quand l’information est absente', () => {
    // Une cellule vide se lirait « on ne sait pas » ; l'absence de drapeau veut dire non.
    const rangees = preparerLignesTresorerie([ligne()], t, titre)

    expect(col(rangees[0]!, 'previsionnel')).toBe('Non')
    expect(col(rangees[0]!, 'rembourse')).toBe('Non')
  })

  it('nomme la personne qui a avancé, par son compte ou par son nom libre', () => {
    const rangees = preparerLignesTresorerie(
      [
        ligne({ advancedBy: { pseudo: 'Camille' } }),
        ligne({ advancedByName: 'Jean-Luc' }),
        ligne(),
      ],
      t,
      titre
    )

    expect(rangees.map((r) => col(r, 'avancePar'))).toEqual(['Camille', 'Jean-Luc', ''])
  })

  it('distingue une ligne calculée d’une ligne saisie', () => {
    const rangees = preparerLignesTresorerie(
      [ligne({ origin: 'source' }), ligne({ origin: 'manual' })],
      t,
      titre
    )

    expect(rangees.map((r) => col(r, 'origine'))).toEqual(['Calculé', 'Saisi'])
  })

  it('emploie le titre que l’appelant résout', () => {
    // Les lignes calculées portent une CLÉ i18n et non un libellé : cet util ne connaît pas les
    // mots de la page, elle lui passe sa fonction.
    const rangees = preparerLignesTresorerie(
      [ligne({ origin: 'source', title: 'TICKETING_PARTICIPANTS' })],
      t,
      () => 'Billetterie — entrées'
    )

    expect(col(rangees[0]!, 'intitule')).toBe('Billetterie — entrées')
  })

  it('porte l’URL du justificatif, et une cellule vide sans lui', () => {
    const rangees = preparerLignesTresorerie(
      [ligne({ imageUrl: '/uploads/conventions/7/editions/21/treasury/facture.pdf' }), ligne()],
      t,
      titre
    )

    expect(col(rangees[0]!, 'justificatif')).toBe(
      '/uploads/conventions/7/editions/21/treasury/facture.pdf'
    )
    expect(col(rangees[1]!, 'justificatif')).toBe('')
  })

  it('n’écarte aucune ligne', () => {
    // Un export dont le total ne retombe pas sur celui de l'écran est pire qu'une colonne
    // manquante : on cherche l'erreur là où il n'y en a pas.
    const lignes = [
      ligne({ kind: 'EXPENSE' }),
      ligne({ kind: 'EXPENSE', code: { code: '606', label: 'Fournitures' } }),
      ligne({ kind: 'INCOME' }),
      ligne({ kind: 'INCOME', code: { code: '706', label: 'Ventes' } }),
    ]

    expect(preparerLignesTresorerie(lignes, t, titre)).toHaveLength(lignes.length)
  })

  it('rend un tableau vide sans lignes', () => {
    expect(preparerLignesTresorerie([], t, titre)).toEqual([])
  })
})
