<template>
  <div class="flex items-center justify-center p-4">
    <div class="w-full max-w-lg">
      <!-- En-tête avec logo/icône -->
      <div class="text-center mb-8">
        <div
          class="mx-auto w-16 h-16 bg-primary-500 rounded-full flex items-center justify-center mb-4 shadow-lg"
        >
          <UIcon
            :name="
              step === 'email'
                ? 'i-heroicons-envelope'
                : step === 'register'
                  ? 'i-heroicons-user-plus'
                  : 'i-heroicons-key'
            "
            class="text-white"
            size="32"
          />
        </div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          {{
            step === 'email'
              ? $t('auth.login_title')
              : step === 'register'
                ? $t('auth.register_title')
                : $t('auth.connection_title')
          }}
        </h1>
        <p class="text-gray-600 dark:text-gray-400">
          {{
            step === 'email'
              ? $t('auth.login_subtitle')
              : step === 'register'
                ? $t('auth.register_subtitle')
                : $t('auth.connection_subtitle')
          }}
        </p>
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
                :icon="
                  emailValidationStatus === 'validating'
                    ? 'i-heroicons-clock'
                    : 'i-heroicons-envelope'
                "
                :trailing-icon="
                  emailValidationStatus === 'valid'
                    ? emailExists
                      ? 'i-heroicons-check-circle'
                      : 'i-heroicons-user-plus'
                    : emailValidationStatus === 'invalid'
                      ? 'i-heroicons-x-circle'
                      : undefined
                "
                :color="
                  emailValidationStatus === 'valid'
                    ? 'success'
                    : emailValidationStatus === 'invalid'
                      ? 'error'
                      : undefined
                "
                class="w-full"
              />
              <!-- Indication du statut -->
              <div v-if="emailValidationStatus !== 'idle'" class="mt-1 text-xs">
                <p v-if="emailValidationStatus === 'validating'" class="text-gray-500">
                  {{ t('auth.validating_email') }}
                </p>
                <p
                  v-else-if="emailValidationStatus === 'valid' && emailExists"
                  class="text-green-600"
                >
                  {{ t('auth.email_found') }}
                </p>
                <p
                  v-else-if="emailValidationStatus === 'valid' && !emailExists"
                  class="text-blue-600"
                >
                  {{ t('auth.email_available') }}
                </p>
                <p v-else-if="emailValidationStatus === 'invalid'" class="text-red-600">
                  {{ t('auth.invalid_email') }}
                </p>
              </div>
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
            <UFormField :label="t('auth.password')" name="password">
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

          <!-- Encarts d'informations avec switches de confirmation -->
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
                <div class="flex-1">
                  <p class="text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">
                    {{ $t('auth.email_access_required') }}
                  </p>
                  <p class="text-xs text-blue-700 dark:text-blue-300 mb-3">
                    {{ $t('auth.verification_email_notice') }}
                  </p>
                  <div class="flex items-center gap-2">
                    <USwitch v-model="emailAccessConfirmed" />
                    <span class="text-sm text-blue-800 dark:text-blue-200">
                      {{ $t('auth.email_access_confirmation') }}
                    </span>
                  </div>
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
                <div class="flex-1">
                  <p class="text-sm font-medium text-amber-800 dark:text-amber-200 mb-1">
                    {{ $t('auth.personal_account_only') }}
                  </p>
                  <p class="text-xs text-amber-700 dark:text-amber-300 mb-3">
                    {{ $t('auth.personal_account_description') }}
                  </p>
                  <div class="flex items-center gap-2">
                    <USwitch v-model="personalAccountConfirmed" />
                    <span class="text-sm text-amber-800 dark:text-amber-200">
                      {{ $t('auth.personal_account_confirmation') }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Affichage conditionnel du formulaire -->
          <div
            v-if="!canShowRegistrationForm"
            class="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
          >
            <div class="flex items-center gap-2 text-gray-600 dark:text-gray-400">
              <UIcon name="i-heroicons-lock-closed" class="w-5 h-5" />
              <p class="text-sm">
                {{ $t('auth.confirmation_required_message') }}
              </p>
            </div>
          </div>
          <UForm
            v-if="canShowRegistrationForm"
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
                  icon="i-heroicons-user"
                  class="w-full"
                />
              </UFormField>
              <UFormField :label="t('auth.last_name')" name="nom">
                <UInput
                  v-model="registerState.nom"
                  :placeholder="t('auth.last_name_placeholder')"
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
              <UFormField :label="t('auth.password')" name="password">
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
                  <p class="text-xs" :class="passwordStrengthTextColor">
                    {{ passwordStrengthText }}
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
import { reactive, ref, computed, watchEffect } from 'vue'
import { z } from 'zod'

import { useDebounce } from '~/composables/useDebounce'
import { usePasswordStrength } from '~/composables/usePasswordStrength'
import type { HttpError } from '~/types'

import { useAuthStore } from '../stores/auth'

const onGoogleLogin = async () => {
  // Détecter si on est en mode PWA et stocker l'info dans un cookie
  if (import.meta.client) {
    const isPWA =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true
    if (isPWA) {
      document.cookie = `pwa_mode=true; path=/; max-age=600; SameSite=Lax`
    }
  }

  // Navigation externe pour forcer l'appel de la route serveur (/server/routes/auth/google.get.ts)
  const returnTo = useRoute().query.returnTo as string
  const googleUrl = returnTo
    ? `/auth/google?returnTo=${encodeURIComponent(returnTo)}`
    : '/auth/google'
  await navigateTo(googleUrl, { external: true })
}

const onFacebookLogin = async () => {
  // Détecter si on est en mode PWA et stocker l'info dans un cookie
  if (import.meta.client) {
    const isPWA =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true
    if (isPWA) {
      document.cookie = `pwa_mode=true; path=/; max-age=600; SameSite=Lax`
    }
  }

  // Navigation externe pour forcer l'appel de la route serveur (/server/routes/auth/facebook.get.ts)
  const returnTo = useRoute().query.returnTo as string
  const facebookUrl = returnTo
    ? `/auth/facebook?returnTo=${encodeURIComponent(returnTo)}`
    : '/auth/facebook'
  await navigateTo(facebookUrl, { external: true })
}

const authStore = useAuthStore()
const toast = useToast()
const router = useRouter()
const { t } = useI18n()

// Middleware pour rediriger les utilisateurs connectés
definePageMeta({
  middleware: 'guest-only',
})

// Flow state
const step = ref<'email' | 'password' | 'register'>('email')

// Étape email
const emailSchema = z.object({ email: z.string().email(t('errors.invalid_email')) })
const emailState = reactive({ email: '' })

// Validation email en temps réel avec debounce
const emailRef = computed(() => emailState.email)
const debouncedEmail = useDebounce(emailRef, 500)
const emailValidationStatus = ref<'idle' | 'validating' | 'valid' | 'invalid'>('idle')
const emailExists = ref<boolean | null>(null)

// Étape password
const passwordSchema = z.object({
  password: z.string().min(1, t('errors.password_required')),
  rememberMe: z.boolean().optional(),
})
const passwordState = reactive({ password: '', rememberMe: false })

// Étape register
const registerSchema = z
  .object({
    prenom: z.string().optional(),
    nom: z.string().optional(),
    pseudo: z.string().min(3, t('errors.username_min_3_chars')),
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
const registerState = reactive({ prenom: '', nom: '', pseudo: '', password: '', confirm: '' })

// Utiliser le composable pour la force du mot de passe
const passwordRef = computed(() => registerState.password)
const {
  strengthText: passwordStrengthText,
  strengthTextColor: passwordStrengthTextColor,
  getStrengthBarColor: getPasswordStrengthBarColor,
} = usePasswordStrength(passwordRef)

// UI state
const showPassword = ref(false)
const showRegisterPassword = ref(false)
const showRegisterConfirm = ref(false)
const loading = ref(false)

// States pour les switches de confirmation d'inscription
const emailAccessConfirmed = ref(false)
const personalAccountConfirmed = ref(false)

// Computed pour afficher le formulaire d'inscription
const canShowRegistrationForm = computed(() => {
  return emailAccessConfirmed.value && personalAccountConfirmed.value
})

// Watcher pour validation email en temps réel
watch(debouncedEmail, async (email) => {
  if (!email || !email.includes('@') || email.length < 5) {
    emailValidationStatus.value = 'idle'
    emailExists.value = null
    return
  }

  // Vérifier si l'email est valide avec le schéma
  const emailResult = emailSchema.safeParse({ email })
  if (!emailResult.success) {
    emailValidationStatus.value = 'invalid'
    emailExists.value = null
    return
  }

  emailValidationStatus.value = 'validating'
  try {
    const res = (await $fetch('/api/auth/check-email', {
      method: 'POST',
      body: { email },
    })) as { exists: boolean }
    emailExists.value = res.exists
    emailValidationStatus.value = 'valid'
  } catch {
    emailValidationStatus.value = 'invalid'
    emailExists.value = null
  }
})

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
    const { isAuthPage, cleanReturnTo } = useReturnTo()

    // Utiliser l'URL nettoyée ou rediriger vers l'accueil si c'est une page d'auth
    const finalDestination = returnTo && !isAuthPage(returnTo) ? cleanReturnTo(returnTo) : '/'

    router.push(finalDestination)
  } catch (e: unknown) {
    const error = e as HttpError
    let errorMessage = t('errors.login_failed')
    if ((error as any).statusCode === 401 || (error as any).status === 401) {
      errorMessage = t('errors.invalid_credentials')
    } else if ((error as any).statusCode === 403 || (error as any).status === 403) {
      const errAny = error as any
      const isEmailNotVerified =
        errAny.message?.includes('email not verified') ||
        errAny.message?.includes('email not verified') ||
        errAny.message?.includes('Email non vérifié') ||
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
        errorMessage = (error as any).message || t('errors.access_denied')
      }
    } else if (error.message || (error as any).data?.message) {
      errorMessage = (error.message as string) || (error as any).data?.message || errorMessage
    }
    toast.add({ title: errorMessage, icon: 'i-heroicons-x-circle', color: 'error' })
  } finally {
    loading.value = false
  }
}

// Métadonnées dynamiques de la page
watchEffect(() => {
  const currentStep = step.value
  let title, description

  if (currentStep === 'email') {
    title = t('auth.login_title')
    description = 'Connectez-vous à votre compte ou créez-en un nouveau'
  } else if (currentStep === 'register') {
    title = t('auth.register_title')
    description = 'Créez votre compte pour rejoindre la communauté des jongleurs'
  } else {
    title = t('auth.connection_title')
    description = 'Connectez-vous à votre compte'
  }

  useSeoMeta({
    title,
    description,
  })
})

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
