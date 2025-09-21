import { computed, type Ref } from 'vue'

export const usePasswordStrength = (password: Ref<string>) => {
  const { t } = useI18n()

  const strength = computed(() => {
    const pwd = password.value
    if (!pwd) return 0

    let score = 0

    // Longueur minimale
    if (pwd.length >= 8) score++

    // Contient une majuscule
    if (/[A-Z]/.test(pwd)) score++

    // Contient un chiffre
    if (/\d/.test(pwd)) score++

    // Contient un caractère spécial ou longueur > 12
    if (/[!@#$%^&*(),.?":{}|<>]/.test(pwd) || pwd.length > 12) score++

    return score
  })

  const strengthText = computed(() => {
    switch (strength.value) {
      case 0:
      case 1:
        return t('auth.password_weak')
      case 2:
        return t('auth.password_medium')
      case 3:
        return t('auth.password_strong')
      case 4:
        return t('auth.password_very_strong')
      default:
        return ''
    }
  })

  const strengthTextColor = computed(() => {
    switch (strength.value) {
      case 0:
      case 1:
        return 'text-red-500'
      case 2:
        return 'text-orange-500'
      case 3:
        return 'text-green-500'
      case 4:
        return 'text-emerald-500'
      default:
        return 'text-gray-500'
    }
  })

  const getStrengthBarColor = (barIndex: number) => {
    if (barIndex <= strength.value) {
      switch (strength.value) {
        case 1:
          return 'bg-red-500'
        case 2:
          return 'bg-orange-500'
        case 3:
          return 'bg-green-500'
        case 4:
          return 'bg-emerald-500'
        default:
          return 'bg-gray-200 dark:bg-gray-700'
      }
    }
    return 'bg-gray-200 dark:bg-gray-700'
  }

  return {
    strength,
    strengthText,
    strengthTextColor,
    getStrengthBarColor,
  }
}
