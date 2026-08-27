import { describe, it, expect } from 'vitest'

import {
  REGLES_MOT_DE_PASSE,
  evaluerReglesMotDePasse,
  forceMotDePasse,
  motDePasseValide,
  schemaMotDePasse,
} from '../../../shared/utils/regles-mot-de-passe'

/** De quoi couvrir chaque combinaison d'exigence satisfaite ou non. */
const ECHANTILLON = [
  '',
  'abc',
  'abcdefgh',
  'Abcdefgh',
  'abcdefg1',
  'Abcdefg1',
  'Abcdefg1!',
  'Court1A',
  'Bonjourlemonde!',
  'Bonjourlemonde1!',
  'MOTDEPASSE1',
  '12345678',
]

describe('regles-mot-de-passe', () => {
  it('décrit les trois exigences dans un ordre stable', () => {
    expect(REGLES_MOT_DE_PASSE.map((r) => r.cle)).toEqual(['longueur', 'majuscule', 'chiffre'])
  })

  describe('motDePasseValide', () => {
    it('exige les trois à la fois', () => {
      expect(motDePasseValide('Abcdefg1')).toBe(true)
      expect(motDePasseValide('Court1A')).toBe(false) // trop court
      expect(motDePasseValide('abcdefg1')).toBe(false) // sans majuscule
      expect(motDePasseValide('Abcdefgh')).toBe(false) // sans chiffre
    })

    it("n'exige pas de minuscule", () => {
      expect(motDePasseValide('MOTDEPASSE1')).toBe(true)
    })
  })

  describe('forceMotDePasse', () => {
    it('compte les exigences satisfaites, plus un bonus de robustesse', () => {
      expect(forceMotDePasse('')).toBe(0)
      expect(forceMotDePasse('abcdefgh')).toBe(1)
      expect(forceMotDePasse('Abcdefgh')).toBe(2)
      expect(forceMotDePasse('Abcdefg1')).toBe(3)
      expect(forceMotDePasse('Abcdefg1!')).toBe(4)
    })

    it('marque des points sans pour autant rendre le mot de passe acceptable', () => {
      // Le cœur du défaut rapporté : un score élevé ne vaut pas validité
      expect(forceMotDePasse('Bonjourlemonde!')).toBe(3)
      expect(motDePasseValide('Bonjourlemonde!')).toBe(false)
    })
  })

  describe('evaluerReglesMotDePasse', () => {
    it('dit laquelle manque, pour l’afficher pendant la saisie', () => {
      const etat = evaluerReglesMotDePasse('Bonjourlemonde!')

      expect(etat.filter((r) => !r.satisfaite).map((r) => r.cle)).toEqual(['chiffre'])
    })
  })

  describe('schemaMotDePasse', () => {
    it('accepte exactement ce que la liste affichée déclare valide', () => {
      // C'est cette égalité qui empêche l'interface et la validation de diverger :
      // c'était précisément le défaut, un mot de passe annoncé « fort » puis refusé.
      const schema = schemaMotDePasse()

      for (const motDePasse of ECHANTILLON) {
        expect(schema.safeParse(motDePasse).success, motDePasse).toBe(motDePasseValide(motDePasse))
      }
    })

    it('signale toutes les exigences manquantes, pas seulement la première', () => {
      const resultat = schemaMotDePasse().safeParse('abc')

      expect(resultat.success).toBe(false)
      expect(resultat.error?.issues).toHaveLength(3)
    })

    it('emprunte ses messages au traducteur quand on lui en fournit un', () => {
      const resultat = schemaMotDePasse((cle) => `traduit:${cle}`).safeParse('Abcdefgh')

      expect(resultat.error?.issues[0]?.message).toBe('traduit:errors.password_digit_required')
    })
  })
})
