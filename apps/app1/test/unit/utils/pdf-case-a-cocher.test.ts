import { describe, expect, it, vi } from 'vitest'

import {
  aDejaUneColonneACocher,
  COTE_CASE,
  dessinerCaseACocher,
  ENTETE_COCHE,
  entetesAvecCoche,
  LARGEUR_COLONNE_COCHE,
  lignesAvecCoche,
  styleColonneCoche,
} from '../../../app/utils/pdf-case-a-cocher'

/**
 * La colonne de cases à cocher des tableaux imprimés.
 *
 * Le motif existait dans le PDF de restauration, pour lui seul. Ce qui se vérifie ici tient en
 * deux points : la case est bien CENTRÉE dans sa cellule — un carré collé au bord se lit comme une
 * rature —, et elle ne se dessine que sur les lignes de données.
 */
const cellule = (champs: Record<string, unknown> = {}) => ({
  column: { index: 0 },
  section: 'body',
  cell: { x: 10, y: 20, width: 6, height: 8 },
  ...champs,
})

describe('dessinerCaseACocher', () => {
  it('centre le carré dans sa cellule', () => {
    const doc = { rect: vi.fn() }
    dessinerCaseACocher(doc, cellule())

    // Cellule de 6 × 8 à partir de (10, 20), carré de 4 : il reste 1 de marge horizontale et 2
    // de marge verticale, à répartir de part et d'autre.
    expect(doc.rect).toHaveBeenCalledWith(11, 22, COTE_CASE, COTE_CASE, 'S')
  })

  it('trace un contour, sans remplissage', () => {
    // `'S'` pour *stroke* : une case pleine serait une case déjà cochée.
    const doc = { rect: vi.fn() }
    dessinerCaseACocher(doc, cellule())
    expect(doc.rect.mock.calls[0]?.[4]).toBe('S')
  })

  it('ne dessine RIEN dans l’en-tête', () => {
    // Une case dans la ligne de titre inviterait à cocher la colonne entière.
    const doc = { rect: vi.fn() }
    dessinerCaseACocher(doc, cellule({ section: 'head' }))
    expect(doc.rect).not.toHaveBeenCalled()
  })

  it('ne dessine RIEN dans le pied', () => {
    const doc = { rect: vi.fn() }
    dessinerCaseACocher(doc, cellule({ section: 'foot' }))
    expect(doc.rect).not.toHaveBeenCalled()
  })

  it('ne dessine que dans la PREMIÈRE colonne', () => {
    const doc = { rect: vi.fn() }
    for (const index of [1, 2, 5]) {
      dessinerCaseACocher(doc, cellule({ column: { index } }))
    }
    expect(doc.rect).not.toHaveBeenCalled()
  })

  it('ne tombe pas sur une cellule incomplète', () => {
    // Le rappel vient d'une bibliothèque tierce, à travers un type `any` chez tous les appelants.
    // Une propriété manquante ne doit pas faire échouer l'export entier, pour une case.
    const doc = { rect: vi.fn() }
    expect(() => dessinerCaseACocher(doc, {})).not.toThrow()
    expect(() => dessinerCaseACocher(doc, cellule({ cell: {} }))).not.toThrow()
    expect(() => dessinerCaseACocher(doc, cellule({ cell: { x: 1, y: 2 } }))).not.toThrow()
    expect(doc.rect).not.toHaveBeenCalled()
  })

  it('accepte une cellule plus petite que la case sans se plaindre', () => {
    // Un tableau très serré donnerait des marges négatives. Mieux vaut un carré qui déborde
    // légèrement qu'un export qui s'arrête.
    const doc = { rect: vi.fn() }
    dessinerCaseACocher(doc, cellule({ cell: { x: 0, y: 0, width: 2, height: 2 } }))
    expect(doc.rect).toHaveBeenCalledWith(-1, -1, COTE_CASE, COTE_CASE, 'S')
  })
})

describe('styleColonneCoche', () => {
  it('ne fixe la largeur QUE de la première colonne', () => {
    // Le reste du tableau garde ses largeurs : la case s'ajoute, elle ne réorganise rien.
    expect(styleColonneCoche()).toEqual({ 0: { cellWidth: LARGEUR_COLONNE_COCHE } })
  })

  it('laisse la place au carré', () => {
    expect(LARGEUR_COLONNE_COCHE).toBeGreaterThan(COTE_CASE)
  })

  it('rend un objet NEUF à chaque appel', () => {
    // Les appelants l'étalent dans leurs propres styles ; un objet partagé se ferait modifier
    // par le premier tableau et le second hériterait de ses largeurs.
    const premier = styleColonneCoche()
    premier[0]!.cellWidth = 99
    expect(styleColonneCoche()[0]?.cellWidth).toBe(LARGEUR_COLONNE_COCHE)
  })
})

describe('aDejaUneColonneACocher', () => {
  it('reconnaît la colonne à son en-tête vide', () => {
    expect(aDejaUneColonneACocher([ENTETE_COCHE, 'Nom'])).toBe(true)
    expect(aDejaUneColonneACocher(['  ', 'Nom'])).toBe(true)
  })

  it('ne prend PAS une colonne titrée pour une colonne à cocher', () => {
    // Le cas de la feuille d'inventaire : « Compté » est laissée vide pour écrire un NOMBRE.
    // Elle porte un titre, donc elle n'empêche pas d'ajouter de quoi cocher.
    expect(aDejaUneColonneACocher(['Nom', 'Attendu', 'Compté'])).toBe(false)
  })

  it('tient sur un tableau sans colonne', () => {
    expect(aDejaUneColonneACocher([])).toBe(false)
  })
})

describe('entetesAvecCoche et lignesAvecCoche', () => {
  const entetes = ['Nom', 'Téléphone']
  const lignes = [
    ['Alice', '0601'],
    ['Bob', '0602'],
  ]

  it('ajoutent la colonne des DEUX côtés, jamais d’un seul', () => {
    // C'est l'invariant qui compte : décaler les en-têtes sans les lignes donne un tableau dont
    // chaque colonne porte le titre de sa voisine. Rien ne lève, et tout est faux.
    const avecEntetes = entetesAvecCoche(entetes)
    const avecLignes = lignesAvecCoche(entetes, lignes)

    expect(avecEntetes).toEqual([ENTETE_COCHE, 'Nom', 'Téléphone'])
    expect(avecLignes[0]).toEqual(['', 'Alice', '0601'])
    for (const ligne of avecLignes) {
      expect(ligne).toHaveLength(avecEntetes.length)
    }
  })

  it('NE DOUBLENT PAS une colonne déjà présente', () => {
    // Deux cases par ligne donneraient deux endroits où cocher la même chose.
    const dejaLa = [ENTETE_COCHE, 'Nom']
    expect(entetesAvecCoche(dejaLa)).toEqual(dejaLa)
    expect(lignesAvecCoche(dejaLa, [['', 'Alice']])).toEqual([['', 'Alice']])
  })

  it('prennent leur décision sur les MÊMES en-têtes', () => {
    // Les deux fonctions reçoivent les en-têtes d'origine : c'est ce qui les empêche de se
    // contredire, l'une ajoutant sa colonne quand l'autre s'abstient.
    const dejaLa = [ENTETE_COCHE, 'Nom']
    expect(lignesAvecCoche(dejaLa, [['', 'Alice']])[0]).toHaveLength(
      entetesAvecCoche(dejaLa).length
    )
    expect(lignesAvecCoche(entetes, lignes)[0]).toHaveLength(entetesAvecCoche(entetes).length)
  })

  it('ne modifient pas les tableaux reçus', () => {
    // L'appelant garde souvent ses en-têtes pour autre chose — un CSV, par exemple, qui n'a que
    // faire d'une case à cocher.
    entetesAvecCoche(entetes)
    lignesAvecCoche(entetes, lignes)
    expect(entetes).toEqual(['Nom', 'Téléphone'])
    expect(lignes[0]).toEqual(['Alice', '0601'])
  })

  it('tiennent sur une liste vide', () => {
    expect(entetesAvecCoche([])).toEqual([ENTETE_COCHE])
    expect(lignesAvecCoche([], [])).toEqual([])
  })
})
