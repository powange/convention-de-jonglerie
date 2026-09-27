import { describe, expect, it } from 'vitest'

import { avanceNormalisee } from '../../../server/utils/treasury-guards'
import { avancesARembourser, type TreasuryLine } from '../../../server/utils/treasury-compute'
import { cleDuNomAvance, nomAvanceAEnregistrer } from '../../../shared/utils/avance-nom-libre'

/**
 * Les avances faites par quelqu'un SANS COMPTE.
 *
 * Beaucoup de ceux qui sortent de l'argent sur une convention ne sont pas inscrits sur le site :
 * la trésorerie ne savait donc pas à qui l'association devait ces montants. Un nom saisi librement
 * les désigne désormais.
 *
 * Tout le risque tient au regroupement. Le panneau « à rembourser » totalise une dette par
 * personne, et le bouton la solde en un versement : si l'agrégat et le remboursement en lot ne
 * retiennent pas EXACTEMENT les mêmes lignes, on verse une somme et il reste des lignes ouvertes.
 * D'où un seul normaliseur, et ces tests dessus.
 *
 * `avancesARembourser` n'avait aucun test avant ce lot — la suite passait donc au vert sans rien
 * dire de ce calcul.
 */

const ligne = (p: Partial<TreasuryLine>): TreasuryLine =>
  ({
    key: 'entry:1',
    origin: 'manual',
    kind: 'EXPENSE',
    title: 'Courses',
    settled: 1000,
    pending: 0,
    readOnly: false,
    reimbursed: false,
    ...p,
  }) as TreasuryLine

const compte = (id: number, pseudo: string) => ({ id, pseudo })

describe('cleDuNomAvance', () => {
  it('rapproche les écritures d’un même nom : casse, accents, espaces', () => {
    const attendue = cleDuNomAvance('Jean-Luc')
    expect(cleDuNomAvance('jean-luc')).toBe(attendue)
    expect(cleDuNomAvance('  JEAN-LUC  ')).toBe(attendue)
    expect(cleDuNomAvance('Jéan-Luc')).toBe(attendue)
    expect(cleDuNomAvance('Jean-Luc\t')).toBe(attendue)
  })

  it('ne devine pas la ponctuation d’un nom', () => {
    // « Jean Luc » sans tiret reste distinct : fusionner deux orthographes réellement différentes
    // inventerait un rapprochement que personne n'a demandé.
    expect(cleDuNomAvance('Jean Luc')).not.toBe(cleDuNomAvance('Jean-Luc'))
  })

  it('ne désigne personne quand il n’y a rien à lire', () => {
    expect(cleDuNomAvance(null)).toBeNull()
    expect(cleDuNomAvance(undefined)).toBeNull()
    expect(cleDuNomAvance('   ')).toBeNull()
  })

  it('est idempotente : la clé passée à nouveau rend la même clé', () => {
    // Le remboursement en lot reçoit la clé DÉJÀ normalisée et lui réapplique le normaliseur.
    // Sans cette propriété, il ne retrouverait aucune ligne.
    const cle = cleDuNomAvance('Jean-Luc')!
    expect(cleDuNomAvance(cle)).toBe(cle)
  })
})

describe('nomAvanceAEnregistrer', () => {
  it('réduit les espaces mais garde casse et accents', () => {
    // On regroupe sans la casse, on affiche ce qui a été tapé : personne n'aime voir son nom en
    // minuscules dans un tableau relu par d'autres.
    expect(nomAvanceAEnregistrer('  Zoé   Lefèvre ')).toBe('Zoé Lefèvre')
  })

  it('rend null pour une saisie vide', () => {
    expect(nomAvanceAEnregistrer('   ')).toBeNull()
    expect(nomAvanceAEnregistrer(null)).toBeNull()
  })
})

describe('avanceNormalisee — un compte OU un nom, jamais les deux', () => {
  it('garde le compte et efface le nom quand les deux arrivent', () => {
    // Le compte désigne sans ambiguïté, le nom se regroupe par ressemblance. Laisser les deux
    // ferait compter la ligne dans deux dettes du panneau.
    const r = avanceNormalisee({ kind: 'EXPENSE', advancedById: 7, advancedByName: 'Jean-Luc' })
    expect(r).toMatchObject({ advancedById: 7, advancedByName: null })
  })

  it('garde le nom, nettoyé, quand il n’y a pas de compte', () => {
    const r = avanceNormalisee({ kind: 'EXPENSE', advancedByName: '  Jean-Luc  ' })
    expect(r).toMatchObject({ advancedById: null, advancedByName: 'Jean-Luc' })
  })

  it('efface tout sur une recette : une recette n’est avancée par personne', () => {
    const r = avanceNormalisee({
      kind: 'INCOME',
      advancedById: 7,
      advancedByName: 'Jean-Luc',
      reimbursed: true,
    })
    expect(r).toEqual({ advancedById: null, advancedByName: null, reimbursed: false })
  })

  it('un remboursement sans personne désignée n’a pas de sens : il est effacé', () => {
    const r = avanceNormalisee({ kind: 'EXPENSE', reimbursed: true })
    expect(r.reimbursed).toBe(false)
  })

  it('un nom vide ne porte pas d’avance, donc aucun remboursement', () => {
    const r = avanceNormalisee({ kind: 'EXPENSE', advancedByName: '   ', reimbursed: true })
    expect(r).toEqual({ advancedById: null, advancedByName: null, reimbursed: false })
  })
})

describe('avancesARembourser', () => {
  it('additionne les avances d’un même compte', () => {
    const r = avancesARembourser([
      ligne({ advancedBy: compte(7, 'Camille'), settled: 1000 }),
      ligne({ advancedBy: compte(7, 'Camille'), settled: 500 }),
    ])

    expect(r.total).toBe(1500)
    expect(r.detail).toHaveLength(1)
    expect(r.detail[0]).toMatchObject({ cle: 'u:7', montant: 1500, nomLibre: null })
  })

  it('additionne les avances d’un même nom libre, quelle qu’en soit l’orthographe', () => {
    const r = avancesARembourser([
      ligne({ advancedByName: 'Jean-Luc', settled: 1000 }),
      ligne({ advancedByName: 'jean-luc', settled: 500 }),
      ligne({ advancedByName: '  JEAN-LUC ', settled: 250 }),
    ])

    expect(r.detail).toHaveLength(1)
    expect(r.detail[0]?.montant).toBe(1750)
    // Le nom affiché est celui de la PREMIÈRE ligne rencontrée, tel qu'il a été tapé.
    expect(r.detail[0]?.nomLibre).toBe('Jean-Luc')
    expect(r.detail[0]?.personne).toBeNull()
  })

  it('ne confond jamais un compte et un nom libre', () => {
    /*
     * Le piège que la clé préfixée écarte : un compte d'identifiant 7 et un nom libre ne doivent
     * pas se rejoindre par accident, dans un sens comme dans l'autre.
     */
    const r = avancesARembourser([
      ligne({ advancedBy: compte(7, 'Camille'), settled: 1000 }),
      ligne({ advancedByName: 'Camille', settled: 400 }),
    ])

    expect(r.detail).toHaveLength(2)
    expect(r.detail.map((d) => d.cle).sort()).toEqual(['n:camille', 'u:7'])
    expect(r.total).toBe(1400)
  })

  it('ignore une avance déjà remboursée', () => {
    const r = avancesARembourser([
      ligne({ advancedByName: 'Jean-Luc', reimbursed: true, settled: 1000 }),
    ])

    expect(r).toEqual({ total: 0, detail: [] })
  })

  it('ignore une avance prévisionnelle : rien n’est encore sorti d’une poche', () => {
    // Une ligne prévisionnelle a `settled` à 0 — c'est ce qui l'exclut, et c'est voulu : le
    // montant retenu est celui réglé, pas le montant annoncé.
    const r = avancesARembourser([
      ligne({ advancedByName: 'Jean-Luc', isForecast: true, settled: 0, pending: 1000 }),
    ])

    expect(r).toEqual({ total: 0, detail: [] })
  })

  it('ignore une recette et une ligne sans personne désignée', () => {
    const r = avancesARembourser([
      ligne({ kind: 'INCOME', advancedByName: 'Jean-Luc', settled: 1000 }),
      ligne({ settled: 1000 }),
      ligne({ advancedByName: '   ', settled: 1000 }),
    ])

    expect(r).toEqual({ total: 0, detail: [] })
  })

  it('classe de la plus grosse dette à la plus petite', () => {
    // C'est l'ordre du panneau : on rembourse d'abord celui à qui on doit le plus.
    const r = avancesARembourser([
      ligne({ advancedByName: 'Petite', settled: 100 }),
      ligne({ advancedBy: compte(7, 'Grosse'), settled: 5000 }),
      ligne({ advancedByName: 'Moyenne', settled: 900 }),
    ])

    expect(r.detail.map((d) => d.montant)).toEqual([5000, 900, 100])
  })
})
