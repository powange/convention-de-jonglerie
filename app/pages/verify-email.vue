<template>
  <div class="flex items-center justify-center p-4">
    <div class="w-full max-w-md">
      <!-- En-tête avec logo/icône -->
      <div class="text-center mb-8">
        <div
          class="mx-auto w-16 h-16 bg-primary-500 rounded-full flex items-center justify-center mb-4 shadow-lg"
        >
          <UIcon name="i-heroicons-envelope-open" class="text-white" size="32" />
        </div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          {{ $t('auth.verify_email_title') }}
        </h1>
        <p class="text-gray-600 dark:text-gray-400">
          {{ $t('auth.verification_sent_to') }} <br />
          <span class="font-medium text-gray-800 dark:text-gray-200">{{ email }}</span>
        </p>
      </div>

      <!-- Card principale -->
      <UCard class="shadow-xl border-0 backdrop-blur-sm bg-white/80 dark:bg-gray-800/80">
        <div class="space-y-6">
          <!-- Instructions -->
          <div v-if="!needsPassword" class="text-center">
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
              {{ $t('auth.enter_6_digit_code') }}
            </p>
          </div>

          <!-- Mode vérification : Saisie du code -->
          <div v-if="!needsPassword" class="space-y-4">
            <div class="flex justify-center">
              <div class="flex gap-2">
                <UInput
                  v-for="(_digit, index) in codeDigits"
                  :key="index"
                  :ref="(el) => setDigitRef(index, el)"
                  v-model="codeDigits[index]"
                  type="text"
                  maxlength="1"
                  class="w-12 h-12 text-center text-xl font-bold"
                  :class="{ 'border-red-500': hasError && !isValidCode }"
                  @input="handleDigitInput(index, $event)"
                  @keydown="handleKeyDown(index, $event)"
                  @paste="handlePaste"
                />
              </div>
            </div>

            <!-- Message d'erreur -->
            <div v-if="hasError" class="text-center">
              <p class="text-sm text-red-500">{{ errorMessage }}</p>
            </div>

            <!-- Expiration timer -->
            <div v-if="timeRemaining > 0" class="text-center">
              <p class="text-xs text-gray-500">
                {{ $t('auth.code_valid_for') }} {{ Math.floor(timeRemaining / 60) }}:{{
                  String(timeRemaining % 60).padStart(2, '0')
                }}
              </p>
            </div>

            <!-- Bouton de vérification -->
            <UButton
              :loading="loading"
              :disabled="!isValidCode"
              size="lg"
              block
              class="mt-6"
              icon="i-heroicons-check-circle"
              @click="handleVerification"
            >
              {{ loading ? t('auth.verifying') : t('auth.verify_code') }}
            </UButton>
          </div>

          <!-- Mode création de mot de passe -->
          <div v-else class="space-y-6">
            <div class="text-center">
              <UIcon name="i-heroicons-check-circle" class="text-green-500 text-3xl mb-2" />
              <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
                {{ $t('auth.code_verified_create_password') }}
              </p>
            </div>

            <!-- Formulaire de création de mot de passe -->
            <div class="space-y-4">
              <UFormField :label="$t('auth.password')" required>
                <UInput
                  v-model="password"
                  type="password"
                  :placeholder="$t('auth.password_placeholder')"
                  icon="i-heroicons-lock-closed"
                />
              </UFormField>

              <UFormField :label="$t('auth.confirm_password')" required>
                <UInput
                  v-model="confirmPassword"
                  type="password"
                  :placeholder="$t('auth.confirm_password_placeholder')"
                  icon="i-heroicons-lock-closed"
                />
              </UFormField>

              <!-- Validation du mot de passe (utilise la même validation que le serveur) -->
              <div class="space-y-2 text-xs">
                <div class="flex items-center gap-2">
                  <UIcon
                    :name="
                      password.length >= 8 ? 'i-heroicons-check-circle' : 'i-heroicons-x-circle'
                    "
                    :class="password.length >= 8 ? 'text-green-500' : 'text-gray-400'"
                  />
                  <span :class="password.length >= 8 ? 'text-green-600' : 'text-gray-500'">
                    {{ $t('auth.password_min_length') }}
                  </span>
                </div>
                <div class="flex items-center gap-2">
                  <UIcon
                    :name="
                      /[A-Z]/.test(password) ? 'i-heroicons-check-circle' : 'i-heroicons-x-circle'
                    "
                    :class="/[A-Z]/.test(password) ? 'text-green-500' : 'text-gray-400'"
                  />
                  <span :class="/[A-Z]/.test(password) ? 'text-green-600' : 'text-gray-500'">
                    {{ $t('auth.password_uppercase') }}
                  </span>
                </div>
                <div class="flex items-center gap-2">
                  <UIcon
                    :name="
                      /[0-9]/.test(password) ? 'i-heroicons-check-circle' : 'i-heroicons-x-circle'
                    "
                    :class="/[0-9]/.test(password) ? 'text-green-500' : 'text-gray-400'"
                  />
                  <span :class="/[0-9]/.test(password) ? 'text-green-600' : 'text-gray-500'">
                    {{ $t('auth.password_number') }}
                  </span>
                </div>
                <div class="flex items-center gap-2">
                  <UIcon
                    :name="
                      isPasswordConfirmed ? 'i-heroicons-check-circle' : 'i-heroicons-x-circle'
                    "
                    :class="isPasswordConfirmed ? 'text-green-500' : 'text-gray-400'"
                  />
                  <span :class="isPasswordConfirmed ? 'text-green-600' : 'text-gray-500'">
                    {{ $t('auth.passwords_match') }}
                  </span>
                </div>
              </div>

              <!-- Message d'erreur -->
              <div v-if="hasError" class="text-center">
                <p class="text-sm text-red-500">{{ errorMessage }}</p>
              </div>
            </div>

            <!-- Bouton de création -->
            <UButton
              :loading="loading"
              :disabled="!isPasswordValid || !isPasswordConfirmed"
              size="lg"
              block
              icon="i-heroicons-key"
              @click="handleSetPassword"
            >
              {{ loading ? t('auth.creating_password') : t('auth.create_password_and_activate') }}
            </UButton>
          </div>

          <!-- Actions supplémentaires (seulement en mode vérification) -->
          <div
            v-if="!needsPassword"
            class="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700"
          >
            <!-- Renvoyer le code -->
            <div class="text-center">
              <UButton
                variant="ghost"
                size="sm"
                :disabled="resendCooldown > 0"
                @click="handleResendCode"
              >
                <template v-if="resendCooldown > 0">
                  {{ $t('auth.resend_in') }} {{ resendCooldown }}s
                </template>
                <template v-else>
                  <UIcon name="i-heroicons-arrow-path" class="mr-1" />
                  {{ $t('auth.resend_code') }}
                </template>
              </UButton>
            </div>

            <!-- Retour -->
            <div class="text-center">
              <NuxtLink
                to="/login"
                class="text-sm text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
              >
                {{ $t('auth.back_to_login') }}
              </NuxtLink>
            </div>
          </div>
        </div>
      </UCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

import type { HttpError } from '~/types'

const route = useRoute()
const router = useRouter()
const toast = useToast()
const authStore = useAuthStore()

// Middleware pour gérer l'accès à la vérification email
definePageMeta({
  middleware: 'verify-email-access',
})
const { t } = useI18n()

// Email depuis la query string
const email = computed(() => (route.query.email as string) || '')

// État du code
const codeDigits = ref(['', '', '', '', '', ''])
const digitRefs = ref<(HTMLInputElement | null)[]>([])
const loading = ref(false)
const hasError = ref(false)
const errorMessage = ref('')

// État de création de mot de passe
const needsPassword = ref(false)
const password = ref('')
const confirmPassword = ref('')

// Timer et cooldown
const timeRemaining = ref(15 * 60) // 15 minutes en secondes
const resendCooldown = ref(0)
let timerInterval: NodeJS.Timeout | null = null
let resendInterval: NodeJS.Timeout | null = null

// Code valide ?
const isValidCode = computed(() => {
  return codeDigits.value.every((digit) => digit.length === 1 && /^\d$/.test(digit))
})

const fullCode = computed(() => codeDigits.value.join(''))

// Validation du mot de passe (même validation que le schéma server)
const isPasswordValid = computed(() => {
  if (!password.value || password.value.length < 8) return false
  if (!/[A-Z]/.test(password.value)) return false
  if (!/[0-9]/.test(password.value)) return false
  return true
})

const isPasswordConfirmed = computed(() => {
  return password.value === confirmPassword.value && password.value.length > 0
})

// Gestion des refs pour les inputs
const setDigitRef = (index: number, el: any) => {
  if (el && el.$el) {
    digitRefs.value[index] = el.$el.querySelector('input')
  } else {
    digitRefs.value[index] = el
  }
}

// Gestion de la saisie des chiffres
const handleDigitInput = (index: number, event: any) => {
  const value = event.target.value

  // Ne garder que le dernier chiffre saisi
  if (value.length > 1) {
    codeDigits.value[index] = value.slice(-1)
  } else {
    codeDigits.value[index] = value
  }

  // Passer au champ suivant si un chiffre a été saisi
  if (value && index < 5) {
    focusDigit(index + 1)
  }

  // Réinitialiser l'erreur
  hasError.value = false
}

// Gestion des touches spéciales
const handleKeyDown = (index: number, event: KeyboardEvent) => {
  if (event.key === 'Backspace' && !codeDigits.value[index] && index > 0) {
    // Si backspace sur un champ vide, aller au précédent
    focusDigit(index - 1)
  } else if (event.key === 'ArrowLeft' && index > 0) {
    focusDigit(index - 1)
  } else if (event.key === 'ArrowRight' && index < 5) {
    focusDigit(index + 1)
  }
}

// Gestion du collage
const handlePaste = (event: ClipboardEvent) => {
  event.preventDefault()
  const pastedData = event.clipboardData?.getData('text') || ''
  const digits = pastedData.replace(/\D/g, '').split('').slice(0, 6)

  digits.forEach((digit, index) => {
    if (index < 6) {
      codeDigits.value[index] = digit
    }
  })

  // Focus sur le prochain champ vide ou le dernier
  const nextEmptyIndex = codeDigits.value.findIndex((digit) => !digit)
  focusDigit(nextEmptyIndex !== -1 ? nextEmptyIndex : 5)
}

// Focus sur un chiffre spécifique
const focusDigit = (index: number) => {
  nextTick(() => {
    digitRefs.value[index]?.focus()
  })
}

// Vérification du code
const handleVerification = async () => {
  if (!isValidCode.value) return

  loading.value = true
  hasError.value = false

  try {
    const response = await $fetch<{
      needsPassword: boolean
      message: string
      user: { id: number; email: string }
    }>('/api/auth/verify-email', {
      method: 'POST',
      body: {
        email: email.value,
        code: fullCode.value,
      },
    })

    // Si l'utilisateur a besoin de créer un mot de passe, afficher le formulaire
    if (response.needsPassword) {
      needsPassword.value = true
      return
    }

    // Sinon, l'utilisateur est maintenant connecté automatiquement
    // Mettre à jour le store auth avec les données utilisateur
    authStore.user = response.user

    // Sauvegarder dans sessionStorage (pas de rememberMe pour la vérification email)
    if (import.meta.client) {
      sessionStorage.setItem('authUser', JSON.stringify(response.user))
      sessionStorage.setItem('rememberMe', 'false')
    }

    toast.add({
      title: t('auth.email_verified_success'),
      description: t('auth.account_now_active'),
      icon: 'i-heroicons-check-circle',
      color: 'success',
    })

    // Recharger l'application pour synchroniser la session et rediriger
    // Le délai permet d'afficher le toast avant le rechargement
    setTimeout(() => {
      reloadNuxtApp({ path: '/welcome/categories' })
    }, 500)
  } catch (e: unknown) {
    const error = e as HttpError
    hasError.value = true

    if (error.statusCode === 400 || error.status === 400) {
      if (error.message?.includes('expired') || error.message?.includes('expiré')) {
        errorMessage.value = t('auth.code_expired')
      } else if (error.message?.includes('incorrect')) {
        errorMessage.value = t('auth.code_incorrect')
      } else {
        errorMessage.value = error.message || t('auth.invalid_code')
      }
    } else {
      errorMessage.value = t('errors.server_error')
    }
  } finally {
    loading.value = false
  }
}

// Création du mot de passe
const handleSetPassword = async () => {
  if (!isPasswordValid.value || !isPasswordConfirmed.value) return

  loading.value = true
  hasError.value = false

  try {
    const response = await $fetch('/api/auth/set-password-and-verify', {
      method: 'POST',
      body: {
        email: email.value,
        code: fullCode.value,
        password: password.value,
      },
    })

    // Mettre à jour le store auth avec les données utilisateur
    authStore.user = response.user

    // Sauvegarder dans sessionStorage (pas de rememberMe pour la vérification email)
    if (import.meta.client) {
      sessionStorage.setItem('authUser', JSON.stringify(response.user))
      sessionStorage.setItem('rememberMe', 'false')
    }

    toast.add({
      title: t('auth.password_created_success'),
      description: t('auth.account_now_active'),
      icon: 'i-heroicons-check-circle',
      color: 'success',
    })

    // Recharger l'application pour synchroniser la session et rediriger
    // Le délai permet d'afficher le toast avant le rechargement
    setTimeout(() => {
      reloadNuxtApp({ path: '/welcome/categories' })
    }, 500)
  } catch (e: unknown) {
    const error = e as HttpError
    hasError.value = true
    errorMessage.value = error.message || t('errors.server_error')
  } finally {
    loading.value = false
  }
}

// Action pour renvoyer le code
const { execute: executeResendCode } = useApiAction('/api/auth/resend-verification', {
  method: 'POST',
  body: () => ({ email: email.value }),
  successMessage: {
    title: t('auth.code_resent'),
    description: t('auth.new_code_sent'),
  },
  errorMessages: { default: t('errors.server_error') },
  onSuccess: () => {
    // Réinitialiser le timer et démarrer le cooldown
    timeRemaining.value = 15 * 60
    resendCooldown.value = 60
    startResendCooldown()
  },
})

const handleResendCode = () => {
  if (resendCooldown.value > 0) return
  executeResendCode()
}

// Démarrer le timer
const startTimer = () => {
  if (timerInterval) clearInterval(timerInterval)

  timerInterval = setInterval(() => {
    timeRemaining.value--
    if (timeRemaining.value <= 0) {
      clearInterval(timerInterval!)
    }
  }, 1000)
}

// Démarrer le cooldown de renvoi
const startResendCooldown = () => {
  if (resendInterval) clearInterval(resendInterval)

  resendInterval = setInterval(() => {
    resendCooldown.value--
    if (resendCooldown.value <= 0) {
      clearInterval(resendInterval!)
    }
  }, 1000)
}

// Lifecycle
onMounted(() => {
  // Vérifier que l'email est présent
  if (!email.value) {
    router.push('/login')
    return
  }

  // Focus sur le premier champ
  nextTick(() => {
    focusDigit(0)
  })

  // Démarrer le timer
  startTimer()
})

onUnmounted(() => {
  if (timerInterval) clearInterval(timerInterval)
  if (resendInterval) clearInterval(resendInterval)
})
</script>
