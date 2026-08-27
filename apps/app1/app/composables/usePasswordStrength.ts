import { computed, type Ref } from 'vue'

import {
  evaluerReglesMotDePasse,
  forceMotDePasse,
  motDePasseValide,
} from '~~/shared/utils/regles-mot-de-passe'

export const usePasswordStrength = (password: Ref<string>) => {
  const { t } = useI18n()

  const strength = computed(() => forceMotDePasse(password.value))

  /** Les exigences obligatoires et leur état, à afficher pendant la saisie. */
  const regles = computed(() =>
    evaluerReglesMotDePasse(password.value).map((regle) => ({
      ...regle,
      libelle: t(regle.cleLibelle),
    }))
  )

  /** Le mot de passe serait-il accepté à la validation ? */
  const valide = computed(() => motDePasseValide(password.value))

  const strengthText = computed(() => {
    // Un mot de passe auquel il manque une exigence est refusé quel que soit son score :
    // l'annoncer « fort » revenait à promettre une inscription qui échouait ensuite.
    if (!valide.value) return t('auth.password_incomplete')

    // Valide implique les trois exigences satisfaites, donc un score d'au moins 3 :
    // il ne reste qu'à distinguer « fort » de « très fort ».
    return strength.value === 4 ? t('auth.password_very_strong') : t('auth.password_strong')
  })

  const strengthTextColor = computed(() => {
    if (!valide.value) return 'text-red-500'
    return strength.value === 4 ? 'text-emerald-500' : 'text-green-500'
  })

  const getStrengthBarColor = (barIndex: number) => {
    if (barIndex > strength.value) return 'bg-gray-200 dark:bg-gray-700'
    if (!valide.value) return 'bg-red-500'
    return strength.value === 4 ? 'bg-emerald-500' : 'bg-green-500'
  }

  return {
    strength,
    strengthText,
    strengthTextColor,
    getStrengthBarColor,
    regles,
    valide,
  }
}
