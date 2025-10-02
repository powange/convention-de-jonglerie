<template>
  <UModal v-model:open="isOpen" size="2xl" prevent-close>
    <template #header>
      <div class="flex items-center gap-3">
        <div class="p-2 rounded-full bg-orange-100 dark:bg-orange-900/30">
          <UIcon name="i-heroicons-ticket" class="w-5 h-5 text-orange-600 dark:text-orange-400" />
        </div>
        <div>
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
            {{ isEditing ? 'Modifier' : 'Configurer' }} HelloAsso
          </h3>
          <p class="text-sm text-gray-500 dark:text-gray-400">
            {{ isEditing ? 'Mettre à jour la configuration' : 'Connectez votre billetterie' }}
          </p>
        </div>
      </div>
    </template>

    <template #body>
      <div class="space-y-6">
        <!-- Étape 1 : Guide et identifiants API -->
        <div class="space-y-4">
          <div class="flex items-center gap-2">
            <div
              class="flex items-center justify-center w-7 h-7 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 font-semibold text-sm"
            >
              1
            </div>
            <h3 class="font-semibold text-base">Identifiants API</h3>
          </div>

          <div
            class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4"
          >
            <div class="flex items-start gap-2">
              <UIcon
                name="i-heroicons-information-circle"
                class="text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0"
              />
              <div class="text-sm">
                <p class="font-medium text-blue-900 dark:text-blue-100 mb-1">
                  Obtenir vos identifiants API
                </p>
                <p class="text-blue-700 dark:text-blue-300">
                  Consultez le
                  <a
                    href="https://centredaide.helloasso.com/association?question=comment-fonctionne-l-api-helloasso"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="underline hover:text-blue-600 font-medium"
                  >
                    guide HelloAsso
                  </a>
                  pour savoir comment créer un client API et obtenir vos identifiants.
                </p>
              </div>
            </div>
          </div>

          <UFormField label="Client ID" hint="Identifiant public de votre client API" required>
            <UInput
              v-model="localConfig.clientId"
              placeholder="ex: abc123def456"
              icon="i-heroicons-key"
              type="text"
              size="lg"
              class="font-mono w-full"
            />
          </UFormField>

          <UFormField
            label="Client Secret"
            hint="Clé secrète (chiffrée après enregistrement)"
            required
          >
            <UInput
              v-model="localConfig.clientSecret"
              placeholder="••••••••••••••••"
              icon="i-heroicons-lock-closed"
              type="password"
              size="lg"
              class="font-mono w-full"
            />
          </UFormField>
        </div>

        <!-- Étape 2 : Configuration du formulaire -->
        <div class="space-y-4">
          <div class="flex items-center gap-2">
            <div
              class="flex items-center justify-center w-7 h-7 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 font-semibold text-sm"
            >
              2
            </div>
            <h3 class="font-semibold text-base">Identifier votre formulaire</h3>
          </div>

          <div
            v-if="detectedFromUrl"
            class="bg-success-50 dark:bg-success-900/20 border border-success-200 dark:border-success-800 rounded-lg p-4"
          >
            <div class="flex items-start gap-2">
              <UIcon
                name="i-heroicons-check-circle"
                class="text-success-600 dark:text-success-400 mt-0.5 flex-shrink-0"
              />
              <div class="text-sm">
                <p class="font-medium text-success-900 dark:text-success-100 mb-1">
                  Configuration détectée automatiquement
                </p>
                <p class="text-success-700 dark:text-success-300">
                  Les informations du formulaire ont été pré-remplies depuis l'URL de billeterie de
                  l'édition. Vous pouvez les modifier si nécessaire.
                </p>
              </div>
            </div>
          </div>

          <div
            v-else
            class="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4"
          >
            <p class="text-sm text-gray-700 dark:text-gray-300 mb-2">
              <span class="font-medium">Exemple d'URL HelloAsso :</span>
            </p>
            <code
              class="block text-xs bg-white dark:bg-gray-900 p-2 rounded border border-gray-200 dark:border-gray-700 font-mono break-all"
            >
              https://www.helloasso.com/associations/<span class="text-primary-600 font-semibold"
                >slug-organisation</span
              >/evenements/<span class="text-primary-600 font-semibold">slug-formulaire</span>
            </code>
          </div>

          <div class="space-y-4">
            <UFormField
              label="Slug de l'organisation"
              hint="Le nom de votre association dans l'URL"
              required
            >
              <UInput
                v-model="localConfig.organizationSlug"
                placeholder="ex: juggling-convention"
                icon="i-heroicons-building-office"
                size="lg"
              />
            </UFormField>

            <UFormField
              label="Type de formulaire"
              hint="Le type visible dans l'URL HelloAsso"
              required
            >
              <USelect
                v-model="localConfig.formType"
                :items="formTypeOptions"
                placeholder="Sélectionnez un type"
                size="lg"
              />
            </UFormField>

            <UFormField
              label="Slug du formulaire"
              hint="Le nom de votre formulaire dans l'URL"
              required
            >
              <UInput
                v-model="localConfig.formSlug"
                placeholder="ex: billeterie-convention-2025"
                icon="i-heroicons-document-text"
                size="lg"
              />
            </UFormField>
          </div>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex flex-col sm:flex-row gap-3">
        <UButton
          color="neutral"
          variant="outline"
          icon="i-heroicons-x-mark"
          size="lg"
          class="flex-1 justify-center"
          @click="handleCancel"
        >
          Annuler
        </UButton>
        <UButton
          variant="outline"
          icon="i-heroicons-arrow-path"
          :disabled="!canSave"
          :loading="testing"
          size="lg"
          class="flex-1 justify-center"
          @click="handleTest"
        >
          Tester la connexion
        </UButton>
        <UButton
          color="primary"
          icon="i-heroicons-check-circle"
          :disabled="!canSave"
          :loading="saving"
          size="lg"
          class="flex-1 justify-center"
          @click="handleSave"
        >
          {{ isEditing ? 'Mettre à jour' : 'Enregistrer' }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { parseHelloAssoUrl } from '~/utils/helloasso'

interface HelloAssoConfig {
  clientId: string
  clientSecret: string
  organizationSlug: string
  formType: string
  formSlug: string
}

interface Props {
  open: boolean
  config?: HelloAssoConfig
  ticketingUrl?: string
}

interface Emits {
  (e: 'update:open', value: boolean): void
  (e: 'save' | 'test', config: HelloAssoConfig): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const isOpen = computed({
  get: () => props.open,
  set: (value) => emit('update:open', value),
})

const localConfig = ref<HelloAssoConfig>({
  clientId: '',
  clientSecret: '',
  organizationSlug: '',
  formType: 'Event',
  formSlug: '',
})

const formTypeOptions = [
  { label: 'Événement', value: 'Event' },
  { label: 'Billetterie', value: 'Ticketing' },
  { label: 'Adhésion', value: 'Membership' },
  { label: 'Don', value: 'Donation' },
  { label: 'Crowdfunding', value: 'CrowdFunding' },
  { label: 'Boutique', value: 'Shop' },
]

const isEditing = computed(() => !!props.config)
const saving = ref(false)
const testing = ref(false)

// Indiquer si les champs ont été détectés depuis l'URL
const detectedFromUrl = ref(false)

const canSave = computed(() => {
  return (
    localConfig.value.clientId.trim() !== '' &&
    localConfig.value.clientSecret.trim() !== '' &&
    localConfig.value.organizationSlug.trim() !== '' &&
    localConfig.value.formType !== '' &&
    localConfig.value.formSlug.trim() !== ''
  )
})

// Charger la config existante quand elle change
watch(
  () => props.config,
  (newConfig) => {
    if (newConfig) {
      localConfig.value = { ...newConfig }
    }
  },
  { immediate: true }
)

// Réinitialiser quand la modal s'ouvre
watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      if (props.config) {
        localConfig.value = { ...props.config }
        detectedFromUrl.value = false
      } else {
        // Détecter automatiquement les slugs depuis ticketingUrl si disponible
        const parsedUrl = props.ticketingUrl ? parseHelloAssoUrl(props.ticketingUrl) : null

        localConfig.value = {
          clientId: '',
          clientSecret: '',
          organizationSlug: parsedUrl?.organizationSlug || '',
          formType: parsedUrl?.formType || 'Event',
          formSlug: parsedUrl?.formSlug || '',
        }

        // Indiquer si on a détecté les informations depuis l'URL
        detectedFromUrl.value = !!parsedUrl
      }
      saving.value = false
      testing.value = false
    }
  }
)

const handleCancel = () => {
  isOpen.value = false
}

const handleSave = () => {
  if (!canSave.value) return
  saving.value = true
  emit('save', { ...localConfig.value })
}

const handleTest = () => {
  if (!canSave.value) return
  testing.value = true
  emit('test', { ...localConfig.value })
}

// Méthodes exposées pour le parent
defineExpose({
  setSaving: (value: boolean) => {
    saving.value = value
  },
  setTesting: (value: boolean) => {
    testing.value = value
  },
})
</script>
