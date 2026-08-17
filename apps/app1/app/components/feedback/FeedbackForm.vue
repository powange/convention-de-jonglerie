<template>
  <UForm :schema="feedbackSchema" :state="form" class="space-y-6" @submit="submitFeedback">
    <!-- Section principale -->
    <div class="space-y-4">
      <!-- Type de feedback -->
      <UFormField :label="t('feedback.type.label')" name="type">
        <USelect
          v-model="form.type"
          :items="feedbackOptions"
          :placeholder="t('feedback.type.placeholder')"
          icon="i-heroicons-tag"
          value-key="value"
          class="w-full feedback-form-content"
        />
      </UFormField>

      <!-- Sujet -->
      <UFormField :label="t('feedback.subject.label')" name="subject">
        <UInput
          v-model="form.subject"
          :placeholder="t('feedback.subject.placeholder')"
          maxlength="200"
          icon="i-heroicons-pencil-square"
          class="w-full"
        />
      </UFormField>

      <!-- Message -->
      <UFormField :label="t('feedback.message.label')" name="message">
        <UTextarea
          v-model="form.message"
          :placeholder="t('feedback.message.placeholder')"
          :rows="6"
          maxlength="5000"
          class="w-full resize-none"
        />
        <div class="text-right text-xs text-gray-500 dark:text-gray-400 mt-1">
          {{ form.message?.length || 0 }}/5000
        </div>
      </UFormField>
    </div>

    <!-- Section pour utilisateurs non connectés -->
    <div
      v-if="!user"
      class="space-y-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700"
    >
      <div class="flex items-center gap-2 mb-3">
        <UIcon name="i-heroicons-user-circle" class="text-gray-500" size="20" />
        <p class="text-sm font-medium text-gray-700 dark:text-gray-300">
          {{ t('feedback.guest.info') }}
        </p>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <UFormField :label="t('feedback.name.label')" name="name" required>
          <UInput
            v-model="form.name"
            :placeholder="t('feedback.name.placeholder')"
            maxlength="100"
            icon="i-heroicons-user"
            class="w-full"
            required
          />
        </UFormField>

        <UFormField
          :label="t('feedback.email.label') + ' (' + t('common.optional') + ')'"
          name="email"
        >
          <UInput
            v-model="form.email"
            type="email"
            :placeholder="t('feedback.email.placeholder')"
            icon="i-heroicons-envelope"
            class="w-full"
          />
        </UFormField>
      </div>

      <!-- reCAPTCHA v3: attribution requise -->
      <div class="text-[11px] leading-snug text-gray-500 dark:text-gray-400">
        {{ t('feedback.recaptcha.protected_by') }}
        <a
          href="https://policies.google.com/privacy"
          target="_blank"
          rel="noopener noreferrer"
          class="underline hover:text-gray-700 dark:hover:text-gray-300"
          >{{ t('feedback.recaptcha.privacy_policy') }}</a
        >
        {{ t('feedback.recaptcha.and') }}
        <a
          href="https://policies.google.com/terms"
          target="_blank"
          rel="noopener noreferrer"
          class="underline hover:text-gray-700 dark:hover:text-gray-300"
        >
          {{ t('feedback.recaptcha.terms_of_service') }}
        </a>
        {{ t('feedback.recaptcha.apply') }}.
      </div>
    </div>

    <!-- Page concernée, reprise du lien d'origine -->
    <UFormField :label="t('feedback.url.label')" name="url">
      <UInput
        v-model="form.url"
        :placeholder="t('feedback.url.placeholder')"
        readonly
        icon="i-heroicons-link"
        class="w-full opacity-60"
      />
    </UFormField>

    <div class="flex justify-end pt-2">
      <UButton type="submit" :loading="loading" size="lg" icon="i-heroicons-paper-airplane">
        {{ loading ? t('forms.buttons.publishing') : t('feedback.submit') }}
      </UButton>
    </div>
  </UForm>
</template>

<script setup lang="ts">
import { z } from 'zod'

const props = defineProps<{
  /** Page d'où vient l'utilisateur, reprise dans le champ « page concernée » */
  initialUrl?: string
}>()

const emit = defineEmits<{ submitted: [] }>()

const authStore = useAuthStore()
const { t } = useI18n()
const toast = useToast()

// reCAPTCHA v3 (pas de widget)
let recaptchaLoaded = false

// Schéma de validation - utiliser des computed ou les valeurs par défaut
const feedbackSchema = computed(() => {
  // Pour les visiteurs, seul le nom est requis (pas l'email)
  if (!authStore.user) {
    return z.object({
      type: z.enum(['bug', 'feature', 'general', 'other']),
      subject: z
        .string()
        .min(5, t('feedback.validation.subject.min'))
        .max(200, t('feedback.validation.subject.max')),
      message: z
        .string()
        .min(20, t('feedback.validation.message.min'))
        .max(5000, t('feedback.validation.message.max')),
      name: z
        .string()
        .min(2, t('feedback.validation.name.min'))
        .max(100, t('feedback.validation.name.max')),
      email: z.string().email(t('feedback.validation.email.invalid')).optional().or(z.literal('')),
      url: z.string().optional(),
    })
  }

  // Pour les utilisateurs connectés
  return z.object({
    type: z.enum(['bug', 'feature', 'general', 'other']),
    subject: z
      .string()
      .min(5, t('feedback.validation.subject.min'))
      .max(200, t('feedback.validation.subject.max')),
    message: z
      .string()
      .min(20, t('feedback.validation.message.min'))
      .max(5000, t('feedback.validation.message.max')),
    url: z.string().optional(),
  })
})

// Formulaire
const form = reactive({
  type: 'general' as 'bug' | 'feature' | 'general' | 'other',
  subject: '',
  message: '',
  name: '',
  email: '',
  url: props.initialUrl ?? '',
  captchaToken: '',
})

// Computed pour l'utilisateur (pour simplifier dans le template)
const user = computed(() => authStore.user)

// Types de feedback
const feedbackTypes = [
  { value: 'bug', label: 'feedback.types.bug' },
  { value: 'feature', label: 'feedback.types.suggestion' },
  { value: 'general', label: 'feedback.types.general' },
  { value: 'other', label: 'feedback.types.complaint' },
]

// Options de feedback traduites
const feedbackOptions = computed(() =>
  feedbackTypes.map((type) => ({
    value: type.value,
    label: t(type.label),
  }))
)

/**
 * L'API n'accepte qu'une URL absolue (`z.string().url()`), alors que la page d'origine nous
 * parvient en chemin relatif — c'est sous cette forme qu'elle transite dans la query du lien.
 * On la complète donc avec l'origine du site, qui n'est connue que côté navigateur.
 */
function urlAbsolue(chemin: string) {
  if (!chemin) return window.location.href
  if (chemin.startsWith('/')) return window.location.origin + chemin
  return chemin
}

// La page d'origine arrive après l'hydratation quand elle vient de la query
watch(
  () => props.initialUrl,
  (url) => {
    if (url) form.url = urlAbsolue(url)
  }
)

onMounted(() => {
  // Sans page d'origine, le retour porte sur la page de retour elle-même
  form.url = urlAbsolue(form.url)

  // Charger le script reCAPTCHA v3 pour les utilisateurs non connectés
  if (!authStore.user) ensureRecaptchaScript()
})

// Charger le script reCAPTCHA v3 (une seule fois)
function ensureRecaptchaScript() {
  if (typeof window === 'undefined') return
  const siteKey = useRuntimeConfig().public.recaptchaSiteKey
  if (!siteKey) {
    console.warn('reCAPTCHA site key manquante (public.recaptchaSiteKey)')
    return
  }
  if (recaptchaLoaded || window.grecaptcha) return
  const script = document.createElement('script')
  script.src = 'https://www.google.com/recaptcha/api.js?render=' + encodeURIComponent(siteKey)
  script.async = true
  script.onload = () => {
    recaptchaLoaded = true
  }
  script.onerror = () => {
    console.error('Échec du chargement du script reCAPTCHA v3')
  }
  document.head.appendChild(script)
}

const { execute, loading } = useApiAction('/api/feedback', {
  method: 'POST',
  body: () => ({
    type: form.type,
    subject: form.subject,
    message: form.message,
    name: authStore.user ? undefined : form.name,
    email: authStore.user ? undefined : form.email,
    url: form.url,
    captchaToken: form.captchaToken,
  }),
  successMessage: {
    title: t('feedback.success.title'),
    description: t('feedback.success.toast'),
  },
  errorMessages: { default: t('feedback.error.submit') },
  onSuccess: () => emit('submitted'),
})

async function submitFeedback() {
  // Le captcha ne protège que les envois anonymes : une session vaut déjà preuve d'humanité
  if (!authStore.user) {
    const token = await recupererTokenCaptcha()
    if (!token) return
    form.captchaToken = token
  }

  await execute()
}

/**
 * Jeton reCAPTCHA v3, ou null si le script n'a pas pu répondre — auquel cas l'utilisateur est
 * prévenu par un toast, faute de quoi le formulaire semblerait ne rien faire.
 */
async function recupererTokenCaptcha(): Promise<string | null> {
  try {
    ensureRecaptchaScript()
    const siteKey = useRuntimeConfig().public.recaptchaSiteKey
    if (!window.grecaptcha || !siteKey) {
      toast.add({ title: t('feedback.error.captcha_not_loaded'), color: 'error' })
      return null
    }
    const token: string = await new Promise((resolve, reject) => {
      window.grecaptcha.ready(() => {
        window.grecaptcha.execute(siteKey, { action: 'feedback' }).then(resolve).catch(reject)
      })
    })
    if (!token) {
      toast.add({ title: t('feedback.error.captcha_required'), color: 'error' })
      return null
    }
    return token
  } catch (error) {
    console.error('Erreur avec reCAPTCHA v3:', error)
    toast.add({ title: t('feedback.error.captcha_not_loaded'), color: 'error' })
    return null
  }
}

// Type global pour reCAPTCHA
type Grecaptcha = {
  ready: (cb: () => void) => void
  execute: (siteKey: string, options: { action: string }) => Promise<string>
}

declare global {
  interface Window {
    grecaptcha: Grecaptcha
  }
}
</script>
