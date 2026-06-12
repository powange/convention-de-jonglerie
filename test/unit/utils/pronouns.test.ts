import { describe, it, expect } from 'vitest'

import {
  isValidPronoun,
  formatPronoun,
  formatUserFullName,
  PRONOUN_NONE,
} from '../../../app/utils/pronouns'

// Fausse fonction de traduction : reproduit le mapping fr des pronoms.
const t = (key: string) => {
  const labels: Record<string, string> = {
    'profile.pronouns_options.she': 'elle',
    'profile.pronouns_options.he': 'il',
    'profile.pronouns_options.they': 'iel',
  }
  return labels[key] ?? key
}

describe('pronouns utils', () => {
  describe('isValidPronoun', () => {
    it('accepte les pronoms connus', () => {
      expect(isValidPronoun('she')).toBe(true)
      expect(isValidPronoun('he')).toBe(true)
      expect(isValidPronoun('they')).toBe(true)
    })

    it('accepte la valeur vide / null (non renseigné)', () => {
      expect(isValidPronoun('')).toBe(true)
      expect(isValidPronoun(null)).toBe(true)
    })

    it('refuse les valeurs inconnues', () => {
      expect(isValidPronoun('xx')).toBe(false)
      expect(isValidPronoun(PRONOUN_NONE)).toBe(false)
    })
  })

  describe('formatPronoun', () => {
    it('traduit un pronom valide', () => {
      expect(formatPronoun('she', t)).toBe('elle')
      expect(formatPronoun('he', t)).toBe('il')
      expect(formatPronoun('they', t)).toBe('iel')
    })

    it('retourne une chaîne vide si non renseigné', () => {
      expect(formatPronoun('', t)).toBe('')
      expect(formatPronoun(null, t)).toBe('')
      expect(formatPronoun(undefined, t)).toBe('')
      expect(formatPronoun(PRONOUN_NONE, t)).toBe('')
    })

    it('retourne une chaîne vide pour une valeur invalide', () => {
      expect(formatPronoun('xx', t)).toBe('')
    })
  })

  describe('formatUserFullName', () => {
    it('ajoute le pronom entre parenthèses quand il est renseigné', () => {
      expect(formatUserFullName({ prenom: 'Jean', nom: 'Dupont', pronouns: 'he' }, t)).toBe(
        'Jean Dupont (il)'
      )
    })

    it('retourne uniquement le nom quand le pronom est absent', () => {
      expect(formatUserFullName({ prenom: 'Jean', nom: 'Dupont' }, t)).toBe('Jean Dupont')
      expect(formatUserFullName({ prenom: 'Jean', nom: 'Dupont', pronouns: '' }, t)).toBe(
        'Jean Dupont'
      )
      expect(formatUserFullName({ prenom: 'Jean', nom: 'Dupont', pronouns: PRONOUN_NONE }, t)).toBe(
        'Jean Dupont'
      )
    })

    it('gère un prénom ou un nom manquant', () => {
      expect(formatUserFullName({ prenom: 'Jean', nom: null, pronouns: 'they' }, t)).toBe(
        'Jean (iel)'
      )
      expect(formatUserFullName({ prenom: null, nom: 'Dupont' }, t)).toBe('Dupont')
    })

    it('retourne seulement le pronom si aucun nom mais pronom renseigné', () => {
      expect(formatUserFullName({ prenom: null, nom: null, pronouns: 'she' }, t)).toBe('(elle)')
    })

    it('retourne une chaîne vide pour un utilisateur null/undefined', () => {
      expect(formatUserFullName(null, t)).toBe('')
      expect(formatUserFullName(undefined, t)).toBe('')
    })

    it('retourne une chaîne vide si ni nom ni pronom', () => {
      expect(formatUserFullName({ prenom: null, nom: null }, t)).toBe('')
    })
  })
})
