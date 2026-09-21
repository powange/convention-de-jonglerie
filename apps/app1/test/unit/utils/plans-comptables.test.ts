import { describe, it, expect } from 'vitest'

import associations from '../../../app/assets/plans-comptables/fr-associations.json'
import pcg from '../../../app/assets/plans-comptables/fr-pcg.json'
import {
  compterComptes,
  filtrerComptes,
  type CompteDuPlan,
  type PlanComptable,
} from '../../../app/utils/plans-comptables'

const ARBRE: CompteDuPlan[] = [
  {
    code: '62',
    libelle: 'Autres services extérieurs',
    enfants: [
      {
        code: '625',
        libelle: 'Déplacements, missions et réceptions',
        enfants: [
          { code: '6251', libelle: 'Voyages et déplacements' },
          { code: '6257', libelle: 'Réceptions' },
        ],
      },
      { code: '626', libelle: 'Frais postaux et de télécommunications' },
    ],
  },
  { code: '63', libelle: 'Impôts, taxes et versements assimilés' },
]

describe('filtrerComptes', () => {
  it('rend l’arbre intact quand la recherche est vide', () => {
    expect(filtrerComptes(ARBRE, '   ')).toBe(ARBRE)
  })

  it('garde les parents d’un compte trouvé, et eux seuls', () => {
    // « voyages » ne figure que dans le libellé de 6251, et dans aucun de ses parents : c'est
    // donc le cas qui montre que la branche est élaguée jusqu'à la feuille trouvée.
    const resultat = filtrerComptes(ARBRE, 'voyages')

    // Sans ses parents, « 6251 » s'afficherait hors contexte — or c'est le contexte qui permet
    // de juger si c'est le bon compte.
    expect(resultat).toHaveLength(1)
    expect(resultat[0]!.code).toBe('62')
    expect(resultat[0]!.enfants).toHaveLength(1)
    expect(resultat[0]!.enfants![0]!.code).toBe('625')
    expect(resultat[0]!.enfants![0]!.enfants!.map((c) => c.code)).toEqual(['6251'])
  })

  it('ouvre toute la branche quand c’est un parent qui correspond', () => {
    // « réceptions » figure dans le libellé de 625 lui-même : on a trouvé le bon rayon, et on
    // veut alors voir tout ce qu'il contient — y compris 6251, qui ne correspond pas.
    const resultat = filtrerComptes(ARBRE, 'réceptions')
    expect(resultat[0]!.enfants![0]!.enfants!.map((c) => c.code)).toEqual(['6251', '6257'])
  })

  it('ignore les accents et la casse', () => {
    expect(filtrerComptes(ARBRE, 'IMPOTS')).toHaveLength(1)
    expect(filtrerComptes(ARBRE, 'deplacements')[0]!.code).toBe('62')
  })

  it('cherche aussi sur le code, espaces compris', () => {
    const resultat = filtrerComptes(ARBRE, '62 57')
    expect(resultat[0]!.enfants![0]!.enfants!.map((c) => c.code)).toEqual(['6257'])
  })

  it('conserve TOUS les enfants d’un compte qui correspond lui-même', () => {
    // Chercher « 625 » doit ouvrir la branche entière : on a trouvé le bon rayon, on veut voir
    // ce qu'il contient, pas seulement ce qui porte le même préfixe.
    const resultat = filtrerComptes(ARBRE, '625')
    expect(resultat[0]!.enfants![0]!.enfants).toHaveLength(2)
  })

  it('ne rend rien quand rien ne correspond', () => {
    expect(filtrerComptes(ARBRE, 'zzzz')).toEqual([])
  })
})

describe('compterComptes', () => {
  it('compte les sous-comptes', () => {
    expect(compterComptes(ARBRE)).toBe(6)
  })
})

/**
 * Ces plans sont des données réglementaires saisies à la main : rien dans le code ne les
 * vérifie, et une coquille sur un numéro de compte produirait une imputation fausse et
 * parfaitement plausible. Ces contrôles tiennent lieu de relecture.
 */
describe.each([
  ['plan comptable général', pcg as unknown as PlanComptable],
  ['plan des associations', associations as unknown as PlanComptable],
])('%s', (_nom, plan) => {
  const tousLesComptes = (comptes: CompteDuPlan[]): CompteDuPlan[] =>
    comptes.flatMap((compte) => [compte, ...tousLesComptes(compte.enfants ?? [])])

  const comptes = tousLesComptes(plan.racines)

  it('porte son identité et sa référence réglementaire', () => {
    expect(plan.id).toMatch(/^[a-z]{2}-[a-z-]+$/)
    expect(plan.pays).toMatch(/^[A-Z]{2}$/)
    expect(plan.reference.length).toBeGreaterThan(20)
  })

  it('n’a aucun code en double', () => {
    const codes = comptes.map((compte) => compte.code)
    expect(codes).toHaveLength(new Set(codes).size)
  })

  it('n’a que des codes numériques et des libellés non vides', () => {
    for (const compte of comptes) {
      expect(compte.code, `code « ${compte.code} »`).toMatch(/^\d{1,5}$/)
      expect(compte.libelle.trim(), `libellé de ${compte.code}`).not.toBe('')
    }
  })

  it('range chaque sous-compte sous un parent dont il prolonge le numéro', () => {
    const verifier = (parent: CompteDuPlan) => {
      for (const enfant of parent.enfants ?? []) {
        expect(
          enfant.code.startsWith(parent.code),
          `${enfant.code} n'est pas un sous-compte de ${parent.code}`
        ).toBe(true)
        expect(enfant.code.length).toBeGreaterThan(parent.code.length)
        verifier(enfant)
      }
    }
    plan.racines.forEach(verifier)
  })
})

describe('les deux plans ensemble', () => {
  it('signale les numéros que les deux plans emploient différemment', () => {
    // 657 et 757 existent dans les deux, avec des intitulés sans rapport : le PCG réformé y met
    // les cessions d'immobilisations, le plan associatif les aides financières et les gains de
    // change. Une note doit le dire, sinon quelqu'un importera le mauvais.
    const trouver = (plan: PlanComptable, code: string): CompteDuPlan | undefined => {
      const chercher = (comptes: CompteDuPlan[]): CompteDuPlan | undefined => {
        for (const compte of comptes) {
          if (compte.code === code) return compte
          const trouve = chercher(compte.enfants ?? [])
          if (trouve) return trouve
        }
      }
      return chercher(plan.racines)
    }

    for (const code of ['657', '757']) {
      const dansPcg = trouver(pcg as unknown as PlanComptable, code)
      const dansAssociations = trouver(associations as unknown as PlanComptable, code)
      expect(dansPcg, code).toBeDefined()
      expect(dansAssociations, code).toBeDefined()
      expect(dansPcg!.libelle).not.toBe(dansAssociations!.libelle)
      expect(dansPcg!.note, `note manquante sur ${code} du PCG`).toBeTruthy()
      expect(dansAssociations!.note, `note manquante sur ${code} associatif`).toBeTruthy()
    }
  })
})
