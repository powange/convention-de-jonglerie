import { describe, it, expect } from 'vitest'

import { codesProposes } from '../../../app/utils/codes-tresorerie'

/**
 * Trois règles se superposent ici — le sens de la ligne, la recherche, le code déjà posé — et
 * elles s'appliquent à deux selects différents. C'est exactement l'empilement qui casse en
 * silence : la première version de cette fonctionnalité ne filtrait qu'un des deux selects, et
 * rien ne l'a signalé.
 */
const CODES = [
  { id: 1, code: '6257', label: 'Réceptions' },
  { id: 2, code: '6132', label: 'Locations immobilières' },
  { id: 3, code: '7061', label: 'Billetterie' },
  { id: 4, code: '756', label: 'Cotisations' },
  { id: 5, code: 'REPAS', label: 'Repas des bénévoles' },
]

describe('codesProposes', () => {
  describe('au repos, le sens de la ligne restreint la liste', () => {
    it('ne propose que les comptes de classe 6 sur une charge', () => {
      const resultat = codesProposes(CODES, { sens: 'EXPENSE' })
      expect(resultat.map((c) => c.code)).toEqual(['6257', '6132'])
    })

    it('ne propose que les comptes de classe 7 sur un produit', () => {
      const resultat = codesProposes(CODES, { sens: 'INCOME' })
      expect(resultat.map((c) => c.code)).toEqual(['7061', '756'])
    })

    it('laisse de côté un code qui ne suit pas la numérotation', () => {
      // Conséquence assumée du choix de déduire le sens du premier chiffre : « REPAS » n'est
      // classé nulle part. C'est la recherche qui le rattrape, cf. plus bas.
      expect(codesProposes(CODES, { sens: 'EXPENSE' }).some((c) => c.code === 'REPAS')).toBe(false)
      expect(codesProposes(CODES, { sens: 'INCOME' }).some((c) => c.code === 'REPAS')).toBe(false)
    })
  })

  describe('une recherche ouvre la liste à tout', () => {
    it('rend tous les codes dès qu’un terme est saisi', () => {
      const resultat = codesProposes(CODES, { sens: 'EXPENSE', recherche: 'rep' })
      expect(resultat).toHaveLength(CODES.length)
      expect(resultat.map((c) => c.code)).toContain('REPAS')
    })

    it('ne filtre pas elle-même sur le terme', () => {
      // Le tri par le terme revient au composant Nuxt UI : cette fonction ne décide que de la
      // SOURCE. Filtrer ici ferait le travail deux fois, et de deux façons différentes.
      const resultat = codesProposes(CODES, { sens: 'EXPENSE', recherche: 'zzzz' })
      expect(resultat).toHaveLength(CODES.length)
    })

    it('traite une recherche faite d’espaces comme une absence de recherche', () => {
      expect(codesProposes(CODES, { sens: 'EXPENSE', recherche: '   ' })).toHaveLength(2)
    })
  })

  describe('le code déjà posé ne disparaît jamais', () => {
    it('rapatrie en tête un code courant que le sens exclut', () => {
      // Une charge imputée sur « REPAS » : sans cette règle, le champ paraîtrait vide alors que
      // l'imputation existe, et le premier clic l'effacerait.
      const resultat = codesProposes(CODES, { sens: 'EXPENSE', codeCourantId: 5 })
      expect(resultat.map((c) => c.code)).toEqual(['REPAS', '6257', '6132'])
    })

    it('ne le duplique pas quand il figure déjà dans la liste', () => {
      const resultat = codesProposes(CODES, { sens: 'EXPENSE', codeCourantId: 1 })
      expect(resultat.map((c) => c.code)).toEqual(['6257', '6132'])
    })

    it('ignore un code courant qui n’existe plus', () => {
      // Le code a pu être supprimé de la convention entre-temps.
      const resultat = codesProposes(CODES, { sens: 'EXPENSE', codeCourantId: 999 })
      expect(resultat.map((c) => c.code)).toEqual(['6257', '6132'])
    })

    it('n’ajoute rien quand aucune imputation n’est posée', () => {
      expect(codesProposes(CODES, { sens: 'EXPENSE', codeCourantId: null })).toHaveLength(2)
    })
  })

  it('conserve l’ordre d’origine des codes', () => {
    const inverses = [...CODES].reverse()
    expect(codesProposes(inverses, { sens: 'EXPENSE' }).map((c) => c.code)).toEqual([
      '6132',
      '6257',
    ])
  })

  it('rend une liste vide plutôt que de tout proposer quand rien ne correspond', () => {
    const resultat = codesProposes([{ id: 1, code: 'REPAS' }], { sens: 'EXPENSE' })
    expect(resultat).toEqual([])
  })
})
