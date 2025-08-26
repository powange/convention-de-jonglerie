<template>
  <div class="flex items-center justify-center p-4">
    <div class="w-full max-w-lg">
      <!-- En-tête avec logo/icône -->
      <div class="text-center mb-8">
        <div
          class="mx-auto w-16 h-16 bg-primary-500 rounded-full flex items-center justify-center mb-4 shadow-lg"
        >
          <UIcon name="i-heroicons-key" class="text-white" size="32" />
        </div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          {{ $t('auth.login_title') }}
        </h1>
        <p class="text-gray-600 dark:text-gray-400">{{ $t('auth.login_subtitle') }}</p>
      </div>

      <!-- Card principale -->
      <UCard class="shadow-xl border-0 backdrop-blur-sm bg-white/80 dark:bg-gray-800/80">
        <!-- Étape 1: Saisie email -->
        <template v-if="step === 'email'">
          <UForm
            :state="emailState"
            :schema="emailSchema"
            class="space-y-6"
            @submit="handleEmailSubmit"
          >
            <UFormField :label="t('common.email')" name="email">
              <UInput
                v-model="emailState.email"
                type="email"
                required
                :placeholder="t('auth.email_placeholder')"
                icon="i-heroicons-envelope"
                class="w-full"
              />
            </UFormField>

            <UButton
              type="submit"
              :loading="loading"
              size="lg"
              block
              class="mt-2"
              icon="i-heroicons-arrow-right"
            >
              {{ $t('common.confirm') }}
            </UButton>
          </UForm>
                  <UFormField :label="t('auth.phone_optional')" name="phone">
                    <UInput v-model="registerState.phone" autocomplete="tel" />
                  </UFormField>

          <!-- Séparateur OU -->
          <div class="my-6">
            <div class="flex items-center">
              <div class="flex-1 h-px bg-gray-200 dark:bg-gray-700"></div>
              <span class="mx-3 text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">{{
                $t('common.or')
              }}</span>
              <div class="flex-1 h-px bg-gray-200 dark:bg-gray-700"></div>
            </div>
          </div>

          <!-- Continuer avec Google -->
          <div class="space-y-3">
            <UButton
              block
              color="neutral"
              variant="soft"
              icon="i-simple-icons-google"
              @click="onGoogleLogin"
            >
              {{ $t('auth.continue_with_google') }}
            </UButton>
            <UButton
              block
              color="neutral"
              variant="soft"
              icon="i-simple-icons-facebook"
              @click="onFacebookLogin"
            >
              {{ $t('auth.continue_with_facebook') }}
            </UButton>
          </div>
        </template>

        <!-- Étape 2: Mot de passe -->
        <template v-else-if="step === 'password'">
          <div class="mb-4 text-sm text-gray-600 dark:text-gray-400">
            <span class="font-medium">{{ emailState.email }}</span>
            <UButton
              variant="link"
              color="neutral"
              size="xs"
              class="ml-2"
              @click="step = 'email'"
              >{{ $t('common.edit') || 'Modifier' }}</UButton
            >
          </div>
          <UForm
            :state="passwordState"
            :schema="passwordSchema"
            class="space-y-6"
            @submit="handlePasswordSubmit"
          >
            <UFormField :label="t('common.password')" name="password">
              <UInput
                v-model="passwordState.password"
                :type="showPassword ? 'text' : 'password'"
                required
                :placeholder="t('auth.password_placeholder')"
                icon="i-heroicons-lock-closed"
                class="w-full"
                :ui="{ trailing: 'pe-1' }"
              >
                <template #trailing>
                  <UButton
                    color="neutral"
                    variant="link"
                    size="sm"
                    :icon="showPassword ? 'i-heroicons-eye-slash' : 'i-heroicons-eye'"
                    :aria-label="showPassword ? t('auth.hide_password') : t('auth.show_password')"
                    :aria-pressed="showPassword"
                    @click="showPassword = !showPassword"
                  />
                </template>
              </UInput>
            </UFormField>

            <div class="flex items-center justify-between">
              <UFormField name="rememberMe">
                <UCheckbox v-model="passwordState.rememberMe" :label="$t('auth.remember_me')" />
              </UFormField>

              <NuxtLink
                to="/auth/forgot-password"
                class="text-sm text-primary-600 hover:text-primary-500 dark:text-primary-400 dark:hover:text-primary-300 transition-colors"
              >
                {{ $t('auth.forgot_password_link') }}
              </NuxtLink>
            </div>

            <UButton
              type="submit"
              :loading="loading"
              size="lg"
              block
              class="mt-2"
              icon="i-heroicons-arrow-right-on-rectangle"
            >
              {{ loading ? $t('auth.login_button_loading') : $t('auth.login_button') }}
            </UButton>
          </UForm>
        </template>

        <!-- Étape 3: Inscription -->
        <template v-else>
          <div class="mb-4 text-sm text-gray-600 dark:text-gray-400">
            <span class="font-medium">{{ emailState.email }}</span>
            <UButton
              variant="link"
              color="neutral"
              size="xs"
              class="ml-2"
              @click="step = 'email'"
              >{{ $t('common.edit') || 'Modifier' }}</UButton
            >
          </div>
          <!-- Encarts d'informations comme sur register.vue -->
          <div class="mt-2 space-y-3 mb-6">
            <div
              class="p-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg"
            >
              <div class="flex items-start gap-3">
                <UIcon
                  name="i-heroicons-envelope"
                  class="text-blue-600 dark:text-blue-400 mt-0.5"
                  size="20"
                />
                <div>
                  <p class="text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">
                    {{ $t('auth.email_access_required') }}
                  </p>
                  <p class="text-xs text-blue-700 dark:text-blue-300">
                    {{ $t('auth.verification_email_notice') }}
                  </p>
                </div>
              </div>
            </div>

            <div
              class="p-4 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg"
            >
              <div class="flex items-start gap-3">
                <UIcon
                  name="i-heroicons-user-circle"
                  class="text-amber-600 dark:text-amber-400 mt-0.5"
                  size="20"
                />
                <div>
                  <p class="text-sm font-medium text-amber-800 dark:text-amber-200 mb-1">
                    {{ $t('auth.personal_account_only') }}
                  </p>
                  <p class="text-xs text-amber-700 dark:text-amber-300">
                    {{ $t('auth.personal_account_description') }}
                  </p>
                </div>
              </div>
            </div>
          </div>
          <UForm
            :state="registerState"
            :schema="registerSchema"
            class="space-y-6"
            @submit="handleRegisterSubmit"
          >
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <UFormField :label="t('auth.first_name')" name="prenom">
                <UInput
                  v-model="registerState.prenom"
                  :placeholder="t('auth.first_name_placeholder')"
                  required
                  icon="i-heroicons-user"
                  class="w-full"
                />
              </UFormField>
              <UFormField :label="t('auth.last_name')" name="nom">
                <UInput
                  v-model="registerState.nom"
                  :placeholder="t('auth.last_name_placeholder')"
                  required
                  icon="i-heroicons-user"
                  class="w-full"
                />
              </UFormField>
            </div>
            <UFormField
              :label="t('auth.username')"
              name="pseudo"
              :hint="t('auth.username_public_hint')"
            >
              <UInput
                v-model="registerState.pseudo"
                :placeholder="t('auth.username_placeholder')"
                required
                icon="i-heroicons-at-symbol"
                class="w-full"
              />
            </UFormField>
            <div class="grid grid-cols-1 gap-4">
              <UFormField :label="t('common.password')" name="password">
                <UInput
                  v-model="registerState.password"
                  :type="showRegisterPassword ? 'text' : 'password'"
                  :placeholder="t('auth.password_placeholder_secure')"
                  required
                  icon="i-heroicons-lock-closed"
                  class="w-full"
                  :ui="{ trailing: 'pe-1' }"
                >
                  <template #trailing>
                    <UButton
                      color="neutral"
                      variant="link"
                      size="sm"
                      :icon="showRegisterPassword ? 'i-heroicons-eye-slash' : 'i-heroicons-eye'"
                      :aria-label="
                        showRegisterPassword ? t('auth.hide_password') : t('auth.show_password')
                      "
                      :aria-pressed="showRegisterPassword"
                      @click="showRegisterPassword = !showRegisterPassword"
                    />
                  </template>
                </UInput>
                <!-- Indicateur de force du mot de passe (style register.vue) -->
                <div v-if="registerState.password" class="mt-2">
                  <div class="flex gap-1 mb-1">
                    <div
                      v-for="i in 4"
                      :key="i"
                      class="h-1 flex-1 rounded"
                      :class="getPasswordStrengthBarColor(i)"
                    />
                  </div>
                  <p class="text-xs" :class="getPasswordStrengthTextColor()">
                    {{ getPasswordStrengthText() }}
                  </p>
                </div>
              </UFormField>
              <UFormField :label="t('auth.confirm_password')" name="confirm">
                <UInput
                  v-model="registerState.confirm"
                  :type="showRegisterConfirm ? 'text' : 'password'"
                  :placeholder="t('auth.confirm_password_placeholder')"
                  required
                  icon="i-heroicons-shield-check"
                  class="w-full"
                  :ui="{ trailing: 'pe-1' }"
                >
                  <template #trailing>
                    <UButton
                      color="neutral"
                      variant="link"
                      size="sm"
                      :icon="showRegisterConfirm ? 'i-heroicons-eye-slash' : 'i-heroicons-eye'"
                      :aria-label="
                        showRegisterConfirm ? t('auth.hide_password') : t('auth.show_password')
                      "
                      :aria-pressed="showRegisterConfirm"
                      @click="showRegisterConfirm = !showRegisterConfirm"
                    />
                  </template>
                </UInput>
              </UFormField>
            </div>
            <UButton
              type="submit"
              :loading="loading"
              size="lg"
              block
              class="mt-2"
              icon="i-heroicons-user-plus"
            >
              {{ $t('auth.create_account') }}
            </UButton>
          </UForm>
        </template>
      </UCard>

      <!-- Footer -->
      <div class="mt-8 text-center">
        <p class="text-xs text-gray-500 dark:text-gray-400">
          {{ $t('auth.connection_problem') }}
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { z } from 'zod'

import type { HttpError } from '~/types'

import { useAuthStore } from '../stores/auth'

const onGoogleLogin = async () => {
  // Navigation externe pour forcer l'appel de la route serveur (/server/routes/auth/google.get.ts)
  await navigateTo('/auth/google', { external: true })
}

const onFacebookLogin = async () => {
  // Navigation externe pour forcer l'appel de la route serveur (/server/routes/auth/facebook.get.ts)
  await navigateTo('/auth/facebook', { external: true })
}

const authStore = useAuthStore()
const toast = useToast()
const router = useRouter()
const { t } = useI18n()

// Flow state
const step = ref<'email' | 'password' | 'register'>('email')

// Étape email
const emailSchema = z.object({ email: z.string().email(t('errors.invalid_email')) })
const emailState = reactive({ email: '' })

// Étape password
const passwordSchema = z.object({
  password: z.string().min(1, t('errors.password_required')),
  rememberMe: z.boolean().optional(),
})
const passwordState = reactive({ password: '', rememberMe: false })

// Étape register
const registerSchema = z
  .object({
    prenom: z.string().min(1, t('errors.first_name_required')),
    nom: z.string().min(1, t('errors.last_name_required')),
    pseudo: z.string().min(3, t('errors.username_min_3_chars')),
    phone: z
      .string()
      .regex(/^[+0-9 ().-]{6,30}$/u, t('errors.invalid_phone'))
      .optional()
      .or(z.literal('').transform(() => undefined)),
    password: z
      .string()
      .min(8, t('errors.password_too_short'))
      .regex(/(?=.*[A-Z])/, t('errors.password_uppercase_required'))
      .regex(/(?=.*\d)/, t('errors.password_digit_required')),
    confirm: z.string(),
  })
  .refine((data) => data.password === data.confirm, {
    message: t('errors.passwords_dont_match'),
    path: ['confirm'],
  })
const registerState = reactive({ prenom: '', nom: '', pseudo: '', phone: '', password: '', confirm: '' })

// UI state
const showPassword = ref(false)
const showRegisterPassword = ref(false)
const showRegisterConfirm = ref(false)
const loading = ref(false)

// Indicateur de force du mot de passe (repris de register.vue)
const getPasswordStrength = () => {
  const password = registerState.password
  if (!password) return 0
  let strength = 0
  if (password.length >= 8) strength++
  if (/[A-Z]/.test(password)) strength++
  if (/\d/.test(password)) strength++
  if (/[!@#$%^&*(),.?":{}|<>]/.test(password) || password.length > 12) strength++
  return strength
}

// Fonctions d'affichage pour l'indicateur (utilisées dans le template)
const getPasswordStrengthText = () => {
  const strength = getPasswordStrength()
  switch (strength) {
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
}

const getPasswordStrengthTextColor = () => {
  const strength = getPasswordStrength()
  switch (strength) {
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
}

const getPasswordStrengthBarColor = (barIndex: number) => {
  const strength = getPasswordStrength()
  if (barIndex <= strength) {
    switch (strength) {
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

const handleEmailSubmit = async () => {
  loading.value = true
  try {
    const res = (await $fetch('/api/auth/check-email', {
      method: 'POST',
      body: { email: emailState.email },
    })) as { exists: boolean }
    step.value = res.exists ? 'password' : 'register'
  } catch {
    toast.add({ title: t('errors.network_error'), icon: 'i-heroicons-x-circle', color: 'error' })
  } finally {
    loading.value = false
  }
}

const handlePasswordSubmit = async () => {
  loading.value = true
  try {
    await authStore.login(emailState.email, passwordState.password, passwordState.rememberMe)
    toast.add({
      title: t('messages.login_success'),
      icon: 'i-heroicons-check-circle',
      color: 'success',
    })
    const returnTo = useRoute().query.returnTo as string
    const shouldNotReturnTo =
      returnTo &&
      (returnTo.includes('/auth/reset-password') ||
        returnTo.includes('/auth/forgot-password') ||
        returnTo.includes('/login') ||
        returnTo.includes('/verify-email'))
    router.push(shouldNotReturnTo ? '/' : returnTo || '/')
  } catch (e: unknown) {
    const error = e as HttpError
    let errorMessage = t('errors.login_failed')
    if ((error as any).statusCode === 401 || (error as any).status === 401) {
      errorMessage = t('errors.invalid_credentials')
    } else if ((error as any).statusCode === 403 || (error as any).status === 403) {
      const errAny = error as any
      const isEmailNotVerified =
        errAny.statusMessage?.includes('email not verified') ||
        errAny.message?.includes('email not verified') ||
        errAny.statusMessage?.includes('Email non vérifié') ||
        errAny.message?.includes('Email non vérifié')
      const errorData = (error as any).data
      const actualData = errorData?.data || errorData
      if (isEmailNotVerified) {
        const email = actualData?.email || emailState.email
        toast.add({
          title: t('errors.email_not_verified'),
          description: t('errors.email_verification_required'),
          icon: 'i-heroicons-envelope-open',
          color: 'warning',
        })
        await router.push(`/verify-email?email=${encodeURIComponent(email)}`)
        return
      } else {
        errorMessage = (error as any).statusMessage || t('errors.access_denied')
      }
    } else if (error.message || (error as any).data?.message) {
      errorMessage = (error.message as string) || (error as any).data?.message || errorMessage
    }
    toast.add({ title: errorMessage, icon: 'i-heroicons-x-circle', color: 'error' })
  } finally {
    loading.value = false
  }
}

const handleRegisterSubmit = async () => {
  loading.value = true
  try {
    const response = (await $fetch('/api/auth/register', {
      method: 'POST',
      body: {
        email: emailState.email,
        password: registerState.password,
        pseudo: registerState.pseudo,
        nom: registerState.nom,
        prenom: registerState.prenom,
          phone: registerState.phone || undefined,
      },
    })) as any
    if (response?.requiresVerification) {
      await navigateTo(
        `/verify-email?email=${encodeURIComponent(response.email || emailState.email)}`
      )
      toast.add({
        title: t('messages.account_created'),
        description: t('messages.verification_code_sent'),
        icon: 'i-heroicons-envelope',
        color: 'success',
      })
      return
    }
    // Si pas de vérification requise, on peut tenter une connexion directe (optionnel)
    toast.add({
      title: t('messages.account_created'),
      icon: 'i-heroicons-check-circle',
      color: 'success',
    })
  } catch (e: unknown) {
    const error = e as HttpError
    let errorMessage = t('errors.registration_failed')
    if ((error as any).statusCode === 409 || (error as any).status === 409) {
      errorMessage = t('errors.email_or_username_taken')
    } else if (error.message || (error as any).data?.message) {
      errorMessage = (error.message as string) || (error as any).data?.message || errorMessage
    }
    toast.add({ title: errorMessage, icon: 'i-heroicons-x-circle', color: 'error' })
  } finally {
    loading.value = false
  }
}
</script>
