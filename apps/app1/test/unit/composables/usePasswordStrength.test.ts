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

  describe('libellé et couleurs : ce que voit l’utilisateur', () => {
    // Le défaut rapporté : 15 caractères, une majuscule, un caractère spécial, aucun chiffre.
    // Le compteur annonçait « Mot de passe fort » en vert, puis la validation le refusait.
    const SANS_CHIFFRE = 'Bonjourlemonde!'

    it('n’annonce pas « fort » un mot de passe auquel il manque un chiffre', () => {
      const { strength, strengthText, valide } = usePasswordStrength(ref(SANS_CHIFFRE))

      // Il marque pourtant des points : longueur, majuscule, et le bonus de robustesse
      expect(strength.value).toBe(3)
      expect(valide.value).toBe(false)
      expect(strengthText.value).toBe('auth.password_incomplete')
    })

    it('signale en rouge, texte comme barres, tant qu’une exigence manque', () => {
      const { strengthTextColor, getStrengthBarColor } = usePasswordStrength(ref(SANS_CHIFFRE))

      expect(strengthTextColor.value).toBe('text-red-500')
      expect(getStrengthBarColor(1)).toBe('bg-red-500')
      expect(getStrengthBarColor(3)).toBe('bg-red-500')
      expect(getStrengthBarColor(4)).toBe('bg-gray-200 dark:bg-gray-700')
    })

    it('annonce « fort » dès que les trois exigences sont satisfaites', () => {
      const { strengthText, strengthTextColor, valide } = usePasswordStrength(ref('Abcdefg1'))

      expect(valide.value).toBe(true)
      expect(strengthText.value).toBe('auth.password_strong')
      expect(strengthTextColor.value).toBe('text-green-500')
    })

    it('réserve « très fort » au mot de passe valide qui décroche le bonus', () => {
      const { strengthText, strengthTextColor, getStrengthBarColor } = usePasswordStrength(
        ref('Abcdefg1!')
      )

      expect(strengthText.value).toBe('auth.password_very_strong')
      expect(strengthTextColor.value).toBe('text-emerald-500')
      expect(getStrengthBarColor(4)).toBe('bg-emerald-500')
    })
  })

  describe('regles : les exigences affichées pendant la saisie', () => {
    it('les décrit toutes, satisfaites ou non, dans un ordre stable', () => {
      const { regles } = usePasswordStrength(ref('Bonjourlemonde!'))

      expect(regles.value.map((r) => r.cle)).toEqual(['longueur', 'majuscule', 'chiffre'])
      expect(regles.value.map((r) => r.satisfaite)).toEqual([true, true, false])
      expect(regles.value.map((r) => r.libelle)).toEqual([
        'auth.password_rule_length',
        'auth.password_rule_uppercase',
        'auth.password_rule_digit',
      ])
    })

    it('coche l’exigence manquante dès qu’elle est remplie', () => {
      const motDePasse = ref('Bonjourlemonde!')
      const { regles, valide } = usePasswordStrength(motDePasse)
      expect(valide.value).toBe(false)

      motDePasse.value = 'Bonjourlemonde1!'
      expect(regles.value.every((r) => r.satisfaite)).toBe(true)
      expect(valide.value).toBe(true)
    })
  })
})
