import { describe, expect, it } from 'vitest'

import {
  montantPourPdf,
  nomFichierTresorerie,
  preparerTableau,
  regrouperParCode,
  SANS_CODE,
  soldeDe,
  totalDesGroupes,
  type LigneTresorerie,
} from '../../../app/utils/export-tresorerie'

/**
 * L'export PDF de la trésorerie.
 *
 * Un PDF ne se rattrape pas : envoyé au comptable ou à une assemblée générale, il vit avec ses
 * erreurs. Ce sont donc les totaux et les ruptures de groupe qui comptent ici, plus que la mise
 * en forme — un sous-total faux ne se voit qu'à la lecture, trop tard.
 */
const ligne = (champs: Partial<LigneTresorerie> = {}): LigneTresorerie => ({
  kind: 'EXPENSE',
  title: 'Location de salle',
  code: { code: '6132', label: 'Locations immobilières' },
  settled: 10000,
  pending: 0,
  ...champs,
})

/** Un formateur lisible en test : les centimes tels quels, suffixés. */
const formater = (centimes: number) => `${centimes}c`

describe('regrouperParCode', () => {
  it('ne garde que la nature demandée', () => {
    const groupes = regrouperParCode(
      [ligne({ kind: 'EXPENSE' }), ligne({ kind: 'INCOME' })],
      'INCOME'
    )

    expect(groupes).toHaveLength(1)
    expect(groupes[0]!.lignes[0]!.kind).toBe('INCOME')
  })

  it('rassemble les lignes d’un même code et additionne les sous-totaux', () => {
    const groupes = regrouperParCode(
      [
        ligne({ settled: 10000, pending: 0 }),
        ligne({ settled: 2500, pending: 500 }),
        ligne({ code: { code: '6257', label: 'Réceptions' }, settled: 3000, pending: 0 }),
      ],
      'EXPENSE'
    )

    expect(groupes).toHaveLength(2)
    const locations = groupes.find((g) => g.code === '6132')!
    expect(locations.lignes).toHaveLength(2)
    expect(locations.regle).toBe(12500)
    // L'engagé CONTIENT le réglé : 10000 + (2500 + 500).
    expect(locations.engage).toBe(13000)
  })

  it('range les codes dans l’ordre du plan comptable', () => {
    const groupes = regrouperParCode(
      [
        ligne({ code: { code: '6257', label: 'Réceptions' } }),
        ligne({ code: { code: '6132', label: 'Locations' } }),
        ligne({ code: { code: '618', label: 'Divers' } }),
      ],
      'EXPENSE'
    )

    expect(groupes.map((g) => g.code)).toEqual(['618', '6132', '6257'])
  })

  it('met les lignes sans code en dernier, jamais en premier', () => {
    // Un fourre-tout, pas un compte : en tête de document, il donnerait l'impression que rien
    // n'est imputé.
    const groupes = regrouperParCode(
      [ligne({ code: null }), ligne({ code: { code: '6132', label: 'Locations' } })],
      'EXPENSE'
    )

    expect(groupes.map((g) => g.code)).toEqual(['6132', SANS_CODE])
  })

  it('traite un code vide ou fait d’espaces comme une absence de code', () => {
    const groupes = regrouperParCode(
      [ligne({ code: { code: '   ', label: 'Vide' } }), ligne({ code: undefined })],
      'EXPENSE'
    )

    expect(groupes).toHaveLength(1)
    expect(groupes[0]!.code).toBe(SANS_CODE)
    expect(groupes[0]!.lignes).toHaveLength(2)
  })

  it('ne scinde pas un groupe quand le libellé d’un code varie', () => {
    // La base l'interdit, mais une réponse plus ancienne pourrait le porter : scinder fausserait
    // les sous-totaux sans rien signaler.
    const groupes = regrouperParCode(
      [
        ligne({ code: { code: '6132', label: 'Locations' }, settled: 100 }),
        ligne({ code: { code: '6132', label: 'Locations immobilières' }, settled: 200 }),
      ],
      'EXPENSE'
    )

    expect(groupes).toHaveLength(1)
    expect(groupes[0]!.libelle).toBe('Locations')
    expect(groupes[0]!.regle).toBe(300)
  })

  it('rend une liste vide sans se plaindre', () => {
    expect(regrouperParCode([], 'EXPENSE')).toEqual([])
  })
})

describe('totalDesGroupes', () => {
  it('additionne les sous-totaux affichés', () => {
    const groupes = regrouperParCode(
      [
        ligne({ settled: 10000, pending: 0 }),
        ligne({ code: { code: '6257', label: 'Réceptions' }, settled: 2000, pending: 1000 }),
      ],
      'EXPENSE'
    )

    expect(totalDesGroupes(groupes)).toEqual({ regle: 12000, engage: 13000 })
  })

  it('rend zéro sur une trésorerie vide', () => {
    expect(totalDesGroupes([])).toEqual({ regle: 0, engage: 0 })
  })
})

describe('soldeDe', () => {
  it('retranche les charges des produits, sur les deux lectures', () => {
    const solde = soldeDe({ regle: 12000, engage: 15000 }, { regle: 20000, engage: 20000 })

    expect(solde).toEqual({ regle: 8000, engage: 5000 })
  })

  it('rend un solde négatif quand les charges dépassent', () => {
    expect(soldeDe({ regle: 5000, engage: 5000 }, { regle: 1000, engage: 1000 })).toEqual({
      regle: -4000,
      engage: -4000,
    })
  })
})

describe('preparerTableau', () => {
  /** Les lignes calculées portent une clé : le titre passe par une traduction, comme à l'écran. */
  const titrer = (ligne: LigneTresorerie) =>
    ligne.title.startsWith('ARTIST_') ? `traduit:${ligne.title}` : ligne.title

  const imprime = (lignes: LigneTresorerie[]) =>
    preparerTableau(
      regrouperParCode(lignes, 'EXPENSE'),
      formater,
      titrer,
      'Sans code',
      'Sous-total'
    )

  const tableau = (lignes: LigneTresorerie[]) => imprime(lignes).lignes

  it('écrit le code et son libellé dans DEUX colonnes distinctes', () => {
    // La demande même : un « 6132 — Locations » fondu en une colonne ne se trie ni ne se recopie.
    const [premiere] = tableau([ligne()])

    expect(premiere![0]).toBe('6132')
    expect(premiere![1]).toBe('Locations immobilières')
  })

  it('ne répète le code que sur la première ligne du groupe', () => {
    // Recopié sur chaque écriture, il remplirait la page et l'œil ne trouverait plus les ruptures.
    const lignes = tableau([ligne({ title: 'Salle' }), ligne({ title: 'Chapiteau' })])

    expect(lignes[0]![0]).toBe('6132')
    expect(lignes[1]![0]).toBe('')
    expect(lignes[1]![1]).toBe('')
  })

  it('ajoute un sous-total quand le groupe porte plusieurs écritures', () => {
    const lignes = tableau([
      ligne({ settled: 10000, pending: 0 }),
      ligne({ settled: 2500, pending: 500 }),
    ])

    expect(lignes).toHaveLength(3)
    expect(lignes[2]).toEqual(['', '', 'Sous-total', '12500c', '13000c'])
  })

  it('n’ajoute pas de sous-total sous une écriture unique', () => {
    // Il répéterait la ligne juste au-dessus.
    expect(tableau([ligne()])).toHaveLength(1)
  })

  it('nomme le groupe sans code, et lui laisse la colonne du libellé vide', () => {
    const [premiere] = tableau([ligne({ code: null })])

    expect(premiere![0]).toBe('Sans code')
    expect(premiere![1]).toBe('')
  })

  it('fait traduire le titre des lignes calculées', () => {
    // Défaut constaté sur un vrai export : les lignes venues des artistes et de la billetterie
    // portent une CLÉ, et `ARTIST_PAYMENT` s'imprimait tel quel dans un document destiné à un
    // comptable. Le titre passe donc par la même traduction qu'à l'écran.
    const [premiere] = tableau([ligne({ title: 'ARTIST_PAYMENT' })])

    expect(premiere![2]).toBe('traduit:ARTIST_PAYMENT')
  })

  it('laisse intact le titre d’une ligne saisie à la main', () => {
    const [premiere] = tableau([ligne({ title: 'Gobelets' })])

    expect(premiere![2]).toBe('Gobelets')
  })

  it('formate les deux colonnes de montants, réglé puis engagé', () => {
    const [premiere] = tableau([ligne({ settled: 2500, pending: 500 })])

    expect(premiere![3]).toBe('2500c')
    expect(premiere![4]).toBe('3000c')
  })
})

describe('preparerTableau — repérage des sous-totaux', () => {
  const imprime = (lignes: LigneTresorerie[]) =>
    preparerTableau(
      regrouperParCode(lignes, 'EXPENSE'),
      formater,
      (l) => l.title,
      'Sans code',
      'Sous-total'
    )

  it('désigne le rang exact des lignes de sous-total', () => {
    // La mise en page les teinte d'après ces rangs. Les reconnaître à leur libellé casserait dès
    // qu'on traduit la page, et sans que rien ne le signale.
    const { lignes, sousTotaux } = imprime([
      ligne({ title: 'Salle' }),
      ligne({ title: 'Chapiteau' }),
      ligne({ code: { code: '6257', label: 'Réceptions' }, title: 'Repas' }),
    ])

    expect(sousTotaux).toEqual([2])
    expect(lignes[2]![2]).toBe('Sous-total')
  })

  it('marque un sous-total par groupe qui en porte un', () => {
    const { sousTotaux } = imprime([
      ligne({ title: 'A' }),
      ligne({ title: 'B' }),
      ligne({ code: { code: '6257', label: 'Réceptions' }, title: 'C' }),
      ligne({ code: { code: '6257', label: 'Réceptions' }, title: 'D' }),
    ])

    expect(sousTotaux).toEqual([2, 5])
  })

  it('ne marque rien quand aucun groupe n’a de sous-total', () => {
    expect(imprime([ligne()]).sousTotaux).toEqual([])
    expect(imprime([]).sousTotaux).toEqual([])
  })
})

describe('nomFichierTresorerie', () => {
  const un_jour = new Date(2026, 8, 14)

  it('date le fichier, pour que deux exports ne se confondent pas', () => {
    // Un export se refait à mesure que les comptes se complètent : trois homonymes dans un
    // dossier de téléchargements ne se distinguent plus.
    expect(nomFichierTresorerie('Convention 2026', un_jour)).toBe(
      'tresorerie-convention-2026-2026-09-14.pdf'
    )
  })

  it('retire les accents et ce qui gêne un système de fichiers', () => {
    expect(nomFichierTresorerie('Été à Nîmes !', un_jour)).toBe(
      'tresorerie-ete-a-nimes-2026-09-14.pdf'
    )
  })

  it('reste un nom valable sans nom d’édition', () => {
    expect(nomFichierTresorerie(null, un_jour)).toBe('tresorerie-2026-09-14.pdf')
    expect(nomFichierTresorerie('   ', un_jour)).toBe('tresorerie-2026-09-14.pdf')
  })

  it('complète les mois et les jours à deux chiffres', () => {
    // Sans cela, le tri par nom placerait le 2026-9-3 après le 2026-10-1.
    expect(nomFichierTresorerie('X', new Date(2026, 0, 3))).toBe('tresorerie-x-2026-01-03.pdf')
  })
})

describe('montantPourPdf', () => {
  it('remplace l’espace insécable étroite des milliers', () => {
    // Le défaut constaté en vrai : « 4 124,16 € » s'imprimait « 4/124,16 € ». Les polices standard
    // de jsPDF sont encodées en WinAnsi, qui ne connaît pas U+202F.
    expect(montantPourPdf('4\u202f124,16\u00a0€')).toBe('4 124,16 €')
  })

  it('ne se voit que sur les montants à quatre chiffres', () => {
    // La raison pour laquelle un jeu d'essai modeste ne l'aurait jamais montré.
    const petit = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(
      483.37
    )
    expect(montantPourPdf(petit)).toBe(petit.replace(/\u00a0/g, ' '))
  })

  it('traite ce que produit réellement Intl', () => {
    const gros = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(
      4124.16
    )
    const imprimable = montantPourPdf(gros)

    expect(imprimable).not.toMatch(/[\u202f\u00a0]/)
    expect(imprimable).toContain('4 124,16')
  })

  it('laisse intact un montant déjà propre', () => {
    expect(montantPourPdf('483,37 €')).toBe('483,37 €')
  })
})
