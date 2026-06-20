import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'

// Mock de l'auto-import Nuxt useI18n : la fonction t renvoie la clé telle quelle
vi.stubGlobal('useI18n', () => ({ t: (key: string) => key }))

import { usePasswordStrength } from '../../../app/composables/usePasswordStrength'

describe('usePasswordStrength', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('calcul du score (strength)', () => {
    it('retourne 0 pour un mot de passe vide', () => {
      const { strength } = usePasswordStrength(ref(''))
      expect(strength.value).toBe(0)
    })

    it('retourne 1 quand seul le critère longueur >= 8 est rempli', () => {
      // 8 caractères, minuscules uniquement, pas de chiffre/spécial, longueur <= 12
      const { strength } = usePasswordStrength(ref('abcdefgh'))
      expect(strength.value).toBe(1)
    })

    it('retourne 1 quand seul le critère majuscule est rempli', () => {
      // moins de 8 caractères, une majuscule, pas de chiffre/spécial
      const { strength } = usePasswordStrength(ref('Abc'))
      expect(strength.value).toBe(1)
    })

    it('retourne 1 quand seul le critère chiffre est rempli', () => {
      const { strength } = usePasswordStrength(ref('abc1'))
      expect(strength.value).toBe(1)
    })

    it('retourne 1 quand seul le critère caractère spécial est rempli', () => {
      const { strength } = usePasswordStrength(ref('abc!'))
      expect(strength.value).toBe(1)
    })

    it('retourne 2 pour longueur >= 8 et une majuscule', () => {
      // 8 caractères, une majuscule, pas de chiffre ni spécial, longueur <= 12
      const { strength } = usePasswordStrength(ref('Abcdefgh'))
      expect(strength.value).toBe(2)
    })

    it('retourne 3 pour longueur >= 8, majuscule et chiffre', () => {
      // 8 caractères, majuscule, chiffre, pas de spécial, longueur <= 12
      const { strength } = usePasswordStrength(ref('Abcdefg1'))
      expect(strength.value).toBe(3)
    })

    it('retourne 4 pour les 4 critères (longueur, majuscule, chiffre, spécial)', () => {
      const { strength } = usePasswordStrength(ref('Abcdefg1!'))
      expect(strength.value).toBe(4)
    })

    it('retourne 4 quand la longueur dépasse 12 (4e critère via longueur)', () => {
      // 13 caractères, majuscule, chiffre, pas de spécial mais longueur > 12
      const { strength } = usePasswordStrength(ref('Abcdefghij123'))
      expect(strength.value).toBe(4)
    })

    it('plafonne le score à 4 même avec un mot de passe très complet', () => {
      const { strength } = usePasswordStrength(ref('Abcdefghijklmnop1!@#'))
      expect(strength.value).toBe(4)
    })
  })

  describe('valeurs limites du critère longueur', () => {
    it('7 caractères ne valide pas le critère longueur', () => {
      const { strength } = usePasswordStrength(ref('abcdefg'))
      expect(strength.value).toBe(0)
    })

    it('8 caractères valide le critère longueur (limite inférieure)', () => {
      const { strength } = usePasswordStrength(ref('abcdefgh'))
      expect(strength.value).toBe(1)
    })

    it('12 caractères ne déclenche pas le 4e critère par longueur', () => {
      // 12 caractères minuscules : seul le critère longueur >= 8 est rempli
      const { strength } = usePasswordStrength(ref('abcdefghijkl'))
      expect(strength.value).toBe(1)
    })

    it('13 caractères déclenche le 4e critère par longueur (> 12)', () => {
      // 13 caractères minuscules : longueur >= 8 (1) + longueur > 12 (1) = 2
      const { strength } = usePasswordStrength(ref('abcdefghijklm'))
      expect(strength.value).toBe(2)
    })
  })

  describe('réactivité', () => {
    it('recalcule le score quand la référence change', () => {
      const password = ref('')
      const { strength } = usePasswordStrength(password)
      expect(strength.value).toBe(0)

      password.value = 'Abcdefg1!'
      expect(strength.value).toBe(4)

      password.value = 'abc'
      expect(strength.value).toBe(0)
    })
  })

  describe('strengthText (libellé i18n)', () => {
    it('retourne la clé « faible » pour un score de 0', () => {
      const { strengthText } = usePasswordStrength(ref(''))
      expect(strengthText.value).toBe('auth.password_weak')
    })

    it('retourne la clé « faible » pour un score de 1', () => {
      const { strengthText } = usePasswordStrength(ref('abcdefgh'))
      expect(strengthText.value).toBe('auth.password_weak')
    })

    it('retourne la clé « moyen » pour un score de 2', () => {
      const { strengthText } = usePasswordStrength(ref('Abcdefgh'))
      expect(strengthText.value).toBe('auth.password_medium')
    })

    it('retourne la clé « fort » pour un score de 3', () => {
      const { strengthText } = usePasswordStrength(ref('Abcdefg1'))
      expect(strengthText.value).toBe('auth.password_strong')
    })

    it('retourne la clé « très fort » pour un score de 4', () => {
      const { strengthText } = usePasswordStrength(ref('Abcdefg1!'))
      expect(strengthText.value).toBe('auth.password_very_strong')
    })
  })

  describe('strengthTextColor (couleur du texte)', () => {
    it('retourne rouge pour un score de 0', () => {
      const { strengthTextColor } = usePasswordStrength(ref(''))
      expect(strengthTextColor.value).toBe('text-red-500')
    })

    it('retourne rouge pour un score de 1', () => {
      const { strengthTextColor } = usePasswordStrength(ref('abcdefgh'))
      expect(strengthTextColor.value).toBe('text-red-500')
    })

    it('retourne orange pour un score de 2', () => {
      const { strengthTextColor } = usePasswordStrength(ref('Abcdefgh'))
      expect(strengthTextColor.value).toBe('text-orange-500')
    })

    it('retourne vert pour un score de 3', () => {
      const { strengthTextColor } = usePasswordStrength(ref('Abcdefg1'))
      expect(strengthTextColor.value).toBe('text-green-500')
    })

    it('retourne émeraude pour un score de 4', () => {
      const { strengthTextColor } = usePasswordStrength(ref('Abcdefg1!'))
      expect(strengthTextColor.value).toBe('text-emerald-500')
    })
  })

  describe('getStrengthBarColor (couleur des barres)', () => {
    it('colore les barres jusqu’au niveau atteint et laisse les autres en gris', () => {
      // score = 3 (Abcdefg1)
      const { getStrengthBarColor } = usePasswordStrength(ref('Abcdefg1'))
      expect(getStrengthBarColor(1)).toBe('bg-green-500')
      expect(getStrengthBarColor(2)).toBe('bg-green-500')
      expect(getStrengthBarColor(3)).toBe('bg-green-500')
      // barre au-delà du score : grise
      expect(getStrengthBarColor(4)).toBe('bg-gray-200 dark:bg-gray-700')
    })

    it('retourne le gris par défaut pour un score de 0 quelle que soit la barre', () => {
      const { getStrengthBarColor } = usePasswordStrength(ref(''))
      // barIndex 0 <= strength 0 : entre dans le switch, mais score 0 => default gris
      expect(getStrengthBarColor(0)).toBe('bg-gray-200 dark:bg-gray-700')
      // barIndex 1 > strength 0 : gris
      expect(getStrengthBarColor(1)).toBe('bg-gray-200 dark:bg-gray-700')
    })

    it('retourne rouge pour les barres actives au score 1', () => {
      const { getStrengthBarColor } = usePasswordStrength(ref('abcdefgh'))
      expect(getStrengthBarColor(1)).toBe('bg-red-500')
      expect(getStrengthBarColor(2)).toBe('bg-gray-200 dark:bg-gray-700')
    })

    it('retourne orange pour les barres actives au score 2', () => {
      const { getStrengthBarColor } = usePasswordStrength(ref('Abcdefgh'))
      expect(getStrengthBarColor(1)).toBe('bg-orange-500')
      expect(getStrengthBarColor(2)).toBe('bg-orange-500')
      expect(getStrengthBarColor(3)).toBe('bg-gray-200 dark:bg-gray-700')
    })

    it('retourne émeraude pour toutes les barres actives au score 4', () => {
      const { getStrengthBarColor } = usePasswordStrength(ref('Abcdefg1!'))
      expect(getStrengthBarColor(1)).toBe('bg-emerald-500')
      expect(getStrengthBarColor(2)).toBe('bg-emerald-500')
      expect(getStrengthBarColor(3)).toBe('bg-emerald-500')
      expect(getStrengthBarColor(4)).toBe('bg-emerald-500')
    })
  })
})
