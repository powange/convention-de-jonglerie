<template>
  <div>
    <!-- Loading initial -->
    <div v-if="initialLoading" class="flex items-center justify-center py-12">
      <UIcon name="i-lucide-loader-2" class="h-8 w-8 animate-spin text-primary" />
    </div>

    <!-- Erreur : édition non trouvée -->
    <div v-else-if="!edition">
      <UAlert
        icon="i-lucide-alert-triangle"
        color="error"
        variant="soft"
        :title="$t('edition.not_found')"
      />
    </div>

    <!-- Erreur : accès refusé -->
    <div v-else-if="!canEdit">
      <UAlert
        icon="i-lucide-shield-alert"
        color="error"
        variant="soft"
        :title="$t('pages.access_denied.title')"
        :description="$t('pages.access_denied.description')"
      />
    </div>

    <!-- Contenu principal -->
    <div v-else class="space-y-6">
      <!-- En-tête -->
      <div>
        <h1 class="text-2xl font-bold">{{ $t('gestion.about.title') }}</h1>
        <p class="text-sm text-gray-500 dark:text-gray-400">
          {{ $t('gestion.about.description') }}
        </p>
      </div>

      <!-- Formulaire -->
      <div class="space-y-6">
        <!-- Affiche -->
        <UFormField :label="$t('components.edition_form.convention_poster_optional')" name="image">
          <UiImageUpload
            v-model="imageUrl"
            :endpoint="uploadEndpoint"
            :options="{
              validation: {
                maxSize: 5 * 1024 * 1024,
                allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
                allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp'],
              },
              resetAfterUpload: false,
            }"
            :alt="$t('components.edition_form.poster_alt')"
            :placeholder="$t('components.edition_form.poster_placeholder')"
            @uploaded="onImageUploaded"
            @deleted="onImageDeleted"
            @error="onImageError"
          />
        </UFormField>

        <!-- Description -->
        <UFormField :label="$t('common.description')" name="description">
          <MinimalMarkdownEditor
            v-model="description"
            :empty-placeholder="$t('components.edition_form.convention_description_placeholder')"
            @blur="description = description?.trim() || ''"
          />
        </UFormField>

        <!-- Programme -->
        <UFormField :label="$t('common.program')" name="program">
          <MinimalMarkdownEditor
            v-model="program"
            :empty-placeholder="$t('components.edition_form.program_placeholder')"
            @blur="program = program?.trim() || ''"
          />
        </UFormField>
      </div>

      <!-- Bouton enregistrer -->
      <div class="flex justify-end">
        <UButton
          icon="i-lucide-save"
          :label="$t('gestion.about.save')"
          :loading="saving"
          @click="save()"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import { useEditionStore } from '~/stores/editions'

definePageMeta({
  middleware: ['authenticated'],
})

const route = useRoute()
const { t } = useI18n()
const toast = useToast()
const editionStore = useEditionStore()
const authStore = useAuthStore()

const editionId = computed(() => parseInt(route.params.id as string))
const edition = computed(() => editionStore.getEditionById(editionId.value))

const initialLoading = ref(true)

// Permissions
const canEdit = computed(() => {
  if (!edition.value || !authStore.user?.id) return false
  return editionStore.canEditEdition(edition.value, authStore.user.id)
})

// État local
const imageUrl = ref<string | null>(null)
const description = ref('')
const program = ref('')

// Endpoint d'upload
const uploadEndpoint = computed(() => ({
  type: 'edition' as const,
  id: editionId.value,
}))

// Synchroniser les valeurs avec l'édition chargée
watch(
  edition,
  (newEdition) => {
    if (newEdition) {
      imageUrl.value = newEdition.imageUrl || null
      description.value = newEdition.description || ''
      program.value = newEdition.program || ''
    }
  },
  { immediate: true }
)

// Gestionnaires d'événements pour l'upload d'image
const onImageUploaded = (result: {
  success: boolean
  imageUrl?: string
  edition?: { imageUrl?: string }
}) => {
  if (result.success) {
    const newImageUrl = result.imageUrl || result.edition?.imageUrl
    if (newImageUrl) {
      imageUrl.value = newImageUrl
    }
    toast.add({
      title: t('upload.success_message'),
      icon: 'i-heroicons-check-circle',
      color: 'success',
    })
  }
}

const onImageDeleted = () => {
  imageUrl.value = null
  toast.add({
    title: t('upload.delete_message'),
    icon: 'i-heroicons-check-circle',
    color: 'success',
  })
}

const onImageError = (error: string) => {
  toast.add({
    title: t('upload.error_message'),
    description: error,
    icon: 'i-heroicons-exclamation-triangle',
    color: 'error',
  })
}

// Sauvegarde
const { execute: save, loading: saving } = useApiAction(() => `/api/editions/${editionId.value}`, {
  method: 'PUT',
  body: () => ({
    imageUrl: imageUrl.value?.trim() || null,
    description: description.value?.trim() || null,
    program: program.value?.trim() || null,
  }),
  successMessage: { title: t('gestion.about.save_success') },
  errorMessages: { default: t('gestion.about.save_error') },
  onSuccess: (response: any) => {
    const data = response?.data || response
    if (data) {
      editionStore.setEdition(data)
    }
  },
})

// Charger l'édition
onMounted(async () => {
  if (!edition.value) {
    try {
      await editionStore.fetchEditionById(editionId.value, { force: true })
    } catch (error) {
      console.error('Failed to fetch edition:', error)
    }
  }
  initialLoading.value = false
})
</script>
