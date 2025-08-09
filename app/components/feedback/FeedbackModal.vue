<template>
  <UModal 
    v-model:open="open"
    :title="t('feedback.title')"
    :description="t('feedback.description')"
  >
    <template #content>
      <UCard v-if="!submitted" class="shadow-xl border-0">
        <div class="p-6">
          <!-- En-tête avec icône -->
          <div class="text-center mb-6">
            <div class="mx-auto w-12 h-12 bg-primary-500 rounded-full flex items-center justify-center mb-3 shadow-lg">
              <UIcon name="i-heroicons-chat-bubble-left-right" class="text-white" size="24" />
            </div>
          </div>

          <UForm :schema="feedbackSchema" :state="form" @submit="submitFeedback" class="space-y-6">
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
                  class="w-full feedback-modal-content"
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
            <div v-if="!user" class="space-y-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
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

                <UFormField :label="t('feedback.email.label') + ' (' + t('common.optional') + ')'" name="email">
                  <UInput
                    v-model="form.email"
                    type="email"
                    :placeholder="t('feedback.email.placeholder')"
                    icon="i-heroicons-envelope"
                    class="w-full"
                  />
                </UFormField>
              </div>

              <!-- Captcha pour utilisateurs non connectés -->
              <div id="recaptcha-container" class="flex justify-center"></div>
            </div>

            <!-- URL (optionnel, auto-rempli) -->
            <UFormField :label="t('feedback.url.label')" name="url">
              <UInput
                v-model="form.url"
                :placeholder="t('feedback.url.placeholder')"
                readonly
                icon="i-heroicons-link"
                class="w-full opacity-60"
              />
            </UFormField>

            <!-- Boutons d'action -->
            <div class="flex flex-col sm:flex-row justify-end gap-3 pt-4">
              <UButton 
                color="gray" 
                variant="outline" 
                @click="closeModal"
                class="order-2 sm:order-1"
                icon="i-heroicons-x-mark"
              >
                {{ t('common.cancel') }}
              </UButton>
              <UButton 
                type="submit" 
                :loading="loading"
                size="lg"
                class="order-1 sm:order-2"
                icon="i-heroicons-paper-airplane"
              >
                {{ loading ? t('forms.buttons.publishing') : t('feedback.submit') }}
              </UButton>
            </div>
          </UForm>
        </div>
      </UCard>

      <!-- Message de confirmation -->
      <UCard v-else class="shadow-xl border-0">
        <div class="p-8 text-center">
          <!-- Animation de succès -->
          <div class="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/50 rounded-full flex items-center justify-center mb-6 shadow-lg">
            <UIcon name="i-heroicons-check-circle" class="text-green-600 dark:text-green-400" size="32" />
          </div>
          
          <h3 class="text-xl font-semibold text-gray-900 dark:text-white mb-3">
            {{ t('feedback.success.title') }}
          </h3>
          <p class="text-gray-600 dark:text-gray-400 mb-8 max-w-sm mx-auto">
            {{ t('feedback.success.message') }}
          </p>
          
          <UButton 
            @click="closeModal"
            size="lg"
            icon="i-heroicons-hand-thumb-up"
            class="shadow-lg"
          >
            {{ t('common.close') }}
          </UButton>
        </div>
      </UCard>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { z } from 'zod'

// Utilisation de defineModel pour v-model
const open = defineModel<boolean>('open', { default: false })

const authStore = useAuthStore()
const { t } = useI18n()
const toast = useToast()
const route = useRoute()

// État local
const loading = ref(false)
const submitted = ref(false)
let recaptchaWidgetId: number | null = null

// Schéma de validation - utiliser des computed ou les valeurs par défaut
const feedbackSchema = computed(() => {
  // Pour les visiteurs, seul le nom est requis (pas l'email)
  if (!authStore.user) {
    return z.object({
      type: z.enum(['BUG', 'SUGGESTION', 'GENERAL', 'COMPLAINT']),
      subject: z.string().min(5, t('feedback.validation.subject.min')).max(200, t('feedback.validation.subject.max')),
      message: z.string().min(20, t('feedback.validation.message.min')).max(5000, t('feedback.validation.message.max')),
      name: z.string().min(2, t('feedback.validation.name.min')).max(100, t('feedback.validation.name.max')),
      email: z.string().email(t('feedback.validation.email.invalid')).optional().or(z.literal('')),
      url: z.string().optional()
    })
  }
  
  // Pour les utilisateurs connectés
  return z.object({
    type: z.enum(['BUG', 'SUGGESTION', 'GENERAL', 'COMPLAINT']),
    subject: z.string().min(5, t('feedback.validation.subject.min')).max(200, t('feedback.validation.subject.max')),
    message: z.string().min(20, t('feedback.validation.message.min')).max(5000, t('feedback.validation.message.max')),
    url: z.string().optional()
  })
})

// Formulaire
const form = reactive({
  type: 'GENERAL' as const,
  subject: '',
  message: '',
  name: '',
  email: '',
  url: '',
  captchaToken: ''
})

// Computed pour l'utilisateur (pour simplifier dans le template)
const user = computed(() => authStore.user)

// Types de feedback
const feedbackTypes = [
  { value: 'BUG', label: 'feedback.types.bug' },
  { value: 'SUGGESTION', label: 'feedback.types.suggestion' },
  { value: 'GENERAL', label: 'feedback.types.general' },
  { value: 'COMPLAINT', label: 'feedback.types.complaint' }
]

// Options de feedback traduites
const feedbackOptions = computed(() => 
  feedbackTypes.map(type => ({
    value: type.value,
    label: t(type.label)
  }))
)

// Référence pour le premier champ du formulaire
const firstFieldRef = ref<HTMLElement>()
const isRecaptchaReady = ref(false)

// Initialiser l'URL actuelle
onMounted(() => {
  form.url = window.location.href
})

// Gérer le focus et le captcha quand la modal s'ouvre
watch(open, (isOpen) => {
  if (isOpen) {
    // Mettre à jour l'URL
    form.url = window.location.href
    
    // Charger et rendre le captcha pour les utilisateurs non connectés
    if (!authStore.user) {
      nextTick(() => {
        if (!window.grecaptcha) {
          console.log('Chargement du script reCAPTCHA...')
          loadRecaptcha()
        } else {
          console.log('Script déjà chargé, rendu du widget...')
          // Reset et re-render si nécessaire
          if (recaptchaWidgetId !== null) {
            try {
              window.grecaptcha.reset(recaptchaWidgetId)
            } catch (e) {
              console.log('Reset du widget précédent échoué, création d\'un nouveau')
              recaptchaWidgetId = null
            }
          }
          renderRecaptcha()
        }
      })
    }
    
    // Focus sur le premier champ après l'ouverture
    nextTick(() => {
      const firstInput = document.querySelector('.feedback-modal-content input, .feedback-modal-content select') as HTMLElement
      if (firstInput) {
        firstInput.focus()
      }
    })
  } else {
    // Reset le captcha quand la modal se ferme
    if (window.grecaptcha && recaptchaWidgetId !== null) {
      try {
        window.grecaptcha.reset(recaptchaWidgetId)
      } catch (e) {
        console.log('Impossible de reset le captcha')
      }
    }
  }
})

// Nettoyer le reCAPTCHA au démontage
onBeforeUnmount(() => {
  if (window.grecaptcha && recaptchaWidgetId !== null) {
    window.grecaptcha.reset(recaptchaWidgetId)
  }
})

// Charger reCAPTCHA
function loadRecaptcha() {
  if (window.grecaptcha) {
    renderRecaptcha()
    return
  }

  console.log('Ajout du script reCAPTCHA...')
  const script = document.createElement('script')
  script.src = 'https://www.google.com/recaptcha/api.js?onload=onRecaptchaLoad&render=explicit'
  script.async = true
  document.head.appendChild(script)

  window.onRecaptchaLoad = () => {
    console.log('Script reCAPTCHA chargé')
    renderRecaptcha()
  }
}

function renderRecaptcha() {
  if (!window.grecaptcha || authStore.user) return

  // Attendre un peu que le DOM soit prêt
  setTimeout(() => {
    const container = document.getElementById('recaptcha-container')
    const siteKey = useRuntimeConfig().public.recaptchaSiteKey
    
    console.log('Container trouvé:', !!container)
    console.log('Site key:', siteKey)
    
    if (container && siteKey) {
      // Vider le container avant de rendre
      container.innerHTML = ''
      
      try {
        recaptchaWidgetId = window.grecaptcha.render(container, {
          sitekey: siteKey,
          theme: 'light',
          size: 'normal'
        })
        console.log('reCAPTCHA rendu avec succès, widget ID:', recaptchaWidgetId)
        isRecaptchaReady.value = true
      } catch (error) {
        console.error('Erreur lors du rendu du reCAPTCHA:', error)
        isRecaptchaReady.value = false
      }
    }
  }, 200)
}

async function submitFeedback() {
  if (loading.value) return

  loading.value = true

  try {
    // Validation des champs requis pour les utilisateurs non connectés
    if (!authStore.user) {
      if (!form.name) {
        toast.add({
          title: t('feedback.error.name_required'),
          description: t('feedback.error.name_required_desc'),
          color: 'red'
        })
        loading.value = false
        return
      }

      // Vérifier le captcha
      if (window.grecaptcha && recaptchaWidgetId !== null) {
        try {
          const captchaResponse = window.grecaptcha.getResponse(recaptchaWidgetId)
          if (!captchaResponse) {
            toast.add({
              title: t('feedback.error.captcha_required'),
              color: 'red'
            })
            loading.value = false
            return
          }
          form.captchaToken = captchaResponse
        } catch (error) {
          console.error('Erreur avec le captcha:', error)
          toast.add({
            title: t('feedback.error.captcha_not_loaded'),
            color: 'red'
          })
          loading.value = false
          return
        }
      } else {
        // Si le captcha n'est pas chargé mais requis
        toast.add({
          title: t('feedback.error.captcha_not_loaded'),
          color: 'red'
        })
        loading.value = false
        return
      }
    }

    // Envoyer le feedback
    await $fetch('/api/feedback', {
      method: 'POST',
      body: {
        type: form.type,
        subject: form.subject,
        message: form.message,
        name: authStore.user ? undefined : form.name,
        email: authStore.user ? undefined : form.email,
        url: form.url,
        captchaToken: form.captchaToken
      }
    })

    submitted.value = true
    
    toast.add({
      title: t('feedback.success.title'),
      description: t('feedback.success.toast'),
      color: 'green'
    })

  } catch (error: any) {
    console.error('Erreur lors de l\'envoi du feedback:', error)
    
    let errorMessage = t('feedback.error.submit')
    if (error.data?.statusMessage) {
      errorMessage = error.data.statusMessage
    }

    toast.add({
      title: t('feedback.error.title'),
      description: errorMessage,
      color: 'red'
    })

    // Reset captcha en cas d'erreur
    if (!authStore.user && window.grecaptcha && recaptchaWidgetId !== null) {
      window.grecaptcha.reset(recaptchaWidgetId)
    }

  } finally {
    loading.value = false
  }
}

function closeModal() {
  open.value = false
  
  // Reset du formulaire après fermeture
  setTimeout(() => {
    submitted.value = false
    Object.assign(form, {
      type: 'GENERAL',
      subject: '',
      message: '',
      name: '',
      email: '',
      url: window.location.href,
      captchaToken: ''
    })
    
    // Ne pas détruire le widget, juste le reset
    if (!authStore.user && window.grecaptcha && recaptchaWidgetId !== null) {
      try {
        window.grecaptcha.reset(recaptchaWidgetId)
      } catch (e) {
        console.log('Impossible de reset le captcha lors de la fermeture')
      }
    }
  }, 300)
}

// Type global pour reCAPTCHA
declare global {
  interface Window {
    grecaptcha: any
    onRecaptchaLoad: () => void
  }
}
</script>