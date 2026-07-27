<template>
  <div class="flex items-center justify-center p-4">
    <div class="w-full max-w-md">
      <!-- En-tête -->
      <div class="text-center mb-8">
        <div
          class="mx-auto w-16 h-16 bg-primary-500 rounded-full flex items-center justify-center mb-4 shadow-lg"
        >
          <UIcon name="i-heroicons-sparkles" class="text-white" size="32" />
        </div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          {{ $t('auth.invitation_title') }}
        </h1>
        <p class="text-gray-600 dark:text-gray-400">{{ $t('auth.invitation_subtitle') }}</p>
      </div>

      <UCard class="shadow-xl border-0 backdrop-blur-sm bg-white/80 dark:bg-gray-800/80">
        <!-- Formulaire de définition du mot de passe -->
        <UForm
          v-if="!invalidToken && !activated"
          :state="state"
          :schema="schema"
          class="space-y-6"
          @submit="handleSubmit"
        >
          <div class="space-y-4">
            <UFormField
              :label="t('auth.new_password')"
              name="newPassword"
              :help="t('auth.min_characters')"
            >
              <UInput
                v-model="state.newPassword"
                :type="showNewPassword ? 'text' : 'password'"
                required
                :placeholder="$t('profile.new_password_placeholder')"
                icon="i-heroicons-lock-closed"
                class="w-full"
                :disabled="loading"
                :ui="{ trailing: 'pe-1' }"
              >
                <template #trailing>
                  <UButton
                    color="neutral"
                    variant="link"
                    size="sm"
                    :icon="showNewPassword ? 'i-heroicons-eye-slash' : 'i-heroicons-eye'"
                    :aria-label="
                      showNewPassword ? t('auth.hide_password') : t('auth.show_password')
                    "
                    :aria-pressed="showNewPassword"
                    :disabled="loading"
                    @click="showNewPassword = !showNewPassword"
                  />
                </template>
              </UInput>
            </UFormField>

            <UFormField :label="t('auth.confirm_new_password')" name="confirmPassword">
              <UInput
                v-model="state.confirmPassword"
                :type="showConfirmPassword ? 'text' : 'password'"
                required
                :placeholder="$t('profile.confirm_new_password_placeholder')"
                icon="i-heroicons-lock-closed"
                class="w-full"
                :disabled="loading"
                :ui="{ trailing: 'pe-1' }"
              >
                <template #trailing>
                  <UButton
                    color="neutral"
                    variant="link"
                    size="sm"
                    :icon="showConfirmPassword ? 'i-heroicons-eye-slash' : 'i-heroicons-eye'"
                    :aria-label="
                      showConfirmPassword ? t('auth.hide_password') : t('auth.show_password')
                    "
                    :aria-pressed="showConfirmPassword"
                    :disabled="loading"
                    @click="showConfirmPassword = !showConfirmPassword"
                  />
                </template>
              </UInput>
            </UFormField>
          </div>

          <!-- Indicateur de force du mot de passe -->
          <div v-if="state.newPassword" class="space-y-2">
            <div class="text-sm text-gray-600 dark:text-gray-400">
              {{ $t('auth.password_strength') }}
            </div>
            <div class="flex space-x-1">
              <div
                v-for="i in 4"
                :key="i"
                class="h-2 flex-1 rounded-full"
                :class="getPasswordStrengthColor(i, passwordStrength)"
              />
            </div>
            <div class="text-xs text-gray-500 dark:text-gray-400">
              {{ getPasswordStrengthText(passwordStrength) }}
            </div>
          </div>

          <UButton
            type="submit"
            :loading="loading"
            size="lg"
            block
            class="mt-8"
            icon="i-heroicons-check"
          >
            {{ loading ? t('auth.invitation_activating') : t('auth.invitation_activate') }}
          </UButton>
        </UForm>

        <!-- Succès : compte activé -->
        <div v-if="activated" class="text-center space-y-6">
          <div
            class="mx-auto w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mb-4"
          >
            <UIcon name="i-heroicons-check" class="text-white" size="32" />
          </div>

          <UAlert
            icon="i-heroicons-check-circle"
            color="success"
            :title="t('auth.invitation_success_title')"
            :description="t('auth.invitation_success_description')"
          />

          <UButton to="/" size="lg" block icon="i-heroicons-arrow-right">
            {{ $t('auth.invitation_go_to_app') }}
          </UButton>
        </div>

        <!-- Token invalide / expiré -->
        <div v-if="invalidToken" class="text-center space-y-6">
          <div
            class="mx-auto w-16 h-16 bg-red-500 rounded-full flex items-center justify-center mb-4"
          >
            <UIcon name="i-heroicons-exclamation-triangle" class="text-white" size="32" />
          </div>

          <UAlert
            icon="i-heroicons-exclamation-triangle"
            color="error"
            :title="t('auth.invalid_link')"
            :description="invalidTokenMessage"
          />

          <UButton to="/login" variant="soft" size="lg" block icon="i-heroicons-arrow-left">
            {{ $t('auth.back_to_login') }}
          </UButton>
        </div>
      </UCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, computed } from 'vue'
import { z } from 'zod'

import { useAuthStore } from '~/stores/auth'

const route = useRoute()
const { t } = useI18n()
const { fetch: refreshSession } = useUserSession()
const authStore = useAuthStore()

// Rediriger les utilisateurs déjà connectés
definePageMeta({
  middleware: 'guest-only',
})

const schema = z
  .object({
    newPassword: z
      .string()
      .min(8, t('errors.password_too_short'))
      .regex(/(?=.*[A-Z])/, t('errors.password_uppercase_required'))
      .regex(/(?=.*\d)/, t('errors.password_digit_required')),
    confirmPassword: z.string().min(1, t('errors.required_field')),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: t('errors.passwords_dont_match'),
    path: ['confirmPassword'],
  })

const state = reactive({
  newPassword: '',
  confirmPassword: '',
})

const invalidToken = ref(false)
const invalidTokenMessage = ref('')
const activated = ref(false)

const showNewPassword = ref(false)
const showConfirmPassword = ref(false)

const token = computed(() => route.query.token as string)

const passwordStrength = computed(() => {
  const password = state.newPassword
  if (!password) return 0

  let strength = 0
  if (password.length >= 8) strength++
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++
  if (/\d/.test(password)) strength++
  if (/[^a-zA-Z0-9]/.test(password)) strength++

  return strength
})

const getPasswordStrengthColor = (index: number, strength: number) => {
  if (index <= strength) {
    switch (strength) {
      case 1:
        return 'bg-red-500'
      case 2:
        return 'bg-yellow-500'
      case 3:
        return 'bg-blue-500'
      case 4:
        return 'bg-green-500'
      default:
        return 'bg-gray-200 dark:bg-gray-700'
    }
  }
  return 'bg-gray-200 dark:bg-gray-700'
}

const getPasswordStrengthText = (strength: number) => {
  switch (strength) {
    case 0:
      return t('auth.strength_very_weak')
    case 1:
      return t('auth.strength_weak')
    case 2:
      return t('auth.strength_medium')
    case 3:
      return t('auth.strength_good')
    case 4:
      return t('auth.strength_excellent')
    default:
      return ''
  }
}

// Vérifier la validité du token (réutilise l'endpoint du reset de mot de passe)
onMounted(async () => {
  if (!token.value) {
    invalidToken.value = true
    invalidTokenMessage.value = t('auth.invitation_invalid_description')
    return
  }

  try {
    const response = await $fetch<{ data: { valid: boolean; reason?: string } }>(
      '/api/auth/verify-reset-token',
      { params: { token: token.value } }
    )

    if (!response.data.valid) {
      invalidToken.value = true
      invalidTokenMessage.value =
        response.data.reason === 'expired'
          ? t('auth.invitation_expired')
          : t('auth.invitation_invalid_description')
    }
  } catch (error) {
    console.error('Error verifying invitation token:', error)
    invalidToken.value = true
    invalidTokenMessage.value = t('auth.invitation_invalid_description')
  }
})

const { execute: executeAccept, loading } = useApiAction('/api/auth/accept-invitation', {
  method: 'POST',
  body: () => ({
    token: token.value,
    password: state.newPassword,
  }),
  successMessage: {
    title: t('auth.invitation_success_title'),
    description: t('auth.invitation_success_description'),
  },
  errorMessages: { default: t('errors.server_error') },
  onSuccess: async () => {
    // Le compte est connecté côté serveur. Rafraîchir la session nuxt-auth-utils
    // ET ré-hydrater le store Pinia (le header lit `useAuthStore`, pas
    // `useUserSession`) pour que l'état connecté s'affiche sans recharger la page.
    await refreshSession()
    authStore.initializeAuth()
    activated.value = true
  },
  onError: (error) => {
    const message = error.data?.message || ''
    if (message.includes('invalide') || message.includes('expiré') || message.includes('utilisé')) {
      invalidToken.value = true
      invalidTokenMessage.value = message.includes('expiré')
        ? t('auth.invitation_expired')
        : t('auth.invitation_invalid_description')
    }
  },
})

const handleSubmit = () => {
  executeAccept()
}
</script>
