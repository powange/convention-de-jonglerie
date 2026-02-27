<template>
  <UModal
    v-model:open="isOpen"
    :title="$t('workshops.import_from_image')"
    size="xl"
    :prevent-close="extracting || importing"
    @close="closeModal"
  >
    <template #body>
      <div class="space-y-4">
        <!-- Étape 1 : Upload de l'image -->
        <div v-if="!extractedWorkshops.length" class="space-y-4">
          <UFormField
            :label="$t('workshops.select_image')"
            :description="$t('workshops.select_image_description')"
          >
            <div class="space-y-4">
              <!-- Zone de drop ou bouton upload -->
              <div
                class="border-2 border-dashed rounded-lg p-8 text-center transition-colors"
                :class="
                  dragOver
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                    : 'border-gray-300 dark:border-gray-700'
                "
                @dragover.prevent="dragOver = true"
                @dragleave.prevent="dragOver = false"
                @drop.prevent="handleDrop"
              >
                <UIcon name="i-heroicons-photo" class="h-12 w-12 mx-auto mb-3 text-gray-400" />
                <p class="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  {{ $t('workshops.drag_drop_image') }}
                </p>
                <UButton
                  icon="i-heroicons-arrow-up-tray"
                  color="primary"
                  variant="soft"
                  @click="triggerFileInput"
                >
                  {{ $t('workshops.choose_file') }}
                </UButton>
                <input
                  ref="fileInput"
                  type="file"
                  accept="image/*"
                  class="hidden"
                  @change="handleFileSelect"
                />
              </div>

              <!-- Prévisualisation de l'image -->
              <div v-if="selectedImage" class="space-y-2">
                <div class="flex items-center justify-between">
                  <p class="text-sm font-medium text-gray-900 dark:text-white">
                    {{ selectedImage.name }}
                  </p>
                  <UButton
                    icon="i-heroicons-x-mark"
                    size="xs"
                    color="error"
                    variant="ghost"
                    @click="clearImage"
                  />
                </div>
                <img
                  :src="imagePreview"
                  :alt="selectedImage.name"
                  class="w-full h-64 object-contain rounded-lg border border-gray-200 dark:border-gray-700"
                />
              </div>
            </div>
          </UFormField>

          <!-- Aide contextuelle -->
          <UAlert
            icon="i-heroicons-information-circle"
            color="info"
            variant="subtle"
            :title="$t('workshops.extraction_help_title')"
            :description="$t('workshops.extraction_help_description')"
          />
        </div>

        <!-- Étape 2 : Affichage des workshops extraits -->
        <div v-else class="space-y-4">
          <div class="flex items-center justify-between">
            <div>
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
                {{ $t('workshops.extracted_workshops') }}
              </h3>
              <p class="text-sm text-gray-600 dark:text-gray-400">
                {{ $t('workshops.extracted_workshops_description') }}
              </p>
            </div>
            <UButton
              icon="i-heroicons-arrow-left"
              size="sm"
              variant="ghost"
              @click="resetExtraction"
            >
              {{ $t('common.back') }}
            </UButton>
          </div>

          <!-- Liste des workshops extraits -->
          <div class="space-y-3 max-h-96 overflow-y-auto">
            <div
              v-for="(workshop, index) in extractedWorkshops"
              :key="index"
              class="p-4 border rounded-lg dark:border-gray-700"
              :class="{
                'border-primary-500 bg-primary-50 dark:bg-primary-900/20': workshop.selected,
                'border-gray-200 dark:border-gray-700': !workshop.selected,
              }"
            >
              <div class="flex items-start gap-3">
                <!-- Checkbox de sélection -->
                <UCheckbox
                  v-model="workshop.selected"
                  class="mt-1"
                  @update:model-value="toggleWorkshopSelection(index)"
                />

                <!-- Détails du workshop -->
                <div class="flex-1 space-y-3">
                  <!-- Titre -->
                  <UFormField :label="$t('workshops.workshop_title')" required>
                    <UInput
                      v-model="workshop.title"
                      :placeholder="$t('workshops.title_placeholder')"
                      class="w-full"
                    />
                  </UFormField>

                  <!-- Description -->
                  <UFormField :label="$t('workshops.workshop_description')">
                    <UTextarea
                      v-model="workshop.description"
                      :placeholder="$t('workshops.description_placeholder')"
                      rows="2"
                      class="w-full"
                    />
                  </UFormField>

                  <!-- Date et heure -->
                  <div class="space-y-3">
                    <UiDateTimePicker
                      v-model="workshop.startDateTime"
                      :date-label="$t('workshops.start_date')"
                      :time-label="$t('workshops.start_time')"
                      :placeholder="$t('workshops.start_datetime')"
                      required
                    />
                    <UiDateTimePicker
                      v-model="workshop.endDateTime"
                      :date-label="$t('workshops.end_date')"
                      :time-label="$t('workshops.end_time')"
                      :placeholder="$t('workshops.end_datetime')"
                      required
                    />
                  </div>

                  <!-- Nombre max de participants et lieu -->
                  <div class="grid grid-cols-2 gap-3">
                    <UFormField :label="$t('workshops.max_participants')">
                      <UInput
                        v-model.number="workshop.maxParticipants"
                        type="number"
                        min="1"
                        :placeholder="$t('workshops.unlimited')"
                        class="w-full"
                      />
                    </UFormField>

                    <UFormField :label="$t('workshops.workshop_location_optional')">
                      <UInput
                        v-model="workshop.location"
                        :placeholder="$t('workshops.workshop_location_placeholder')"
                        class="w-full"
                      />
                    </UFormField>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Statistiques de sélection -->
          <div class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <p class="text-sm text-gray-600 dark:text-gray-400">
              {{ selectedWorkshopsCount }} / {{ extractedWorkshops.length }}
              {{ $t('workshops.workshops_selected') }}
            </p>
            <div class="flex gap-2">
              <UButton size="xs" variant="ghost" @click="selectAllWorkshops">
                {{ $t('workshops.select_all') }}
              </UButton>
              <UButton size="xs" variant="ghost" @click="deselectAllWorkshops">
                {{ $t('workshops.deselect_all') }}
              </UButton>
            </div>
          </div>
        </div>

        <!-- Message d'erreur -->
        <UAlert
          v-if="errorMessage"
          icon="i-heroicons-x-circle"
          color="error"
          variant="subtle"
          :title="$t('common.error')"
          :description="errorMessage"
        />
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end gap-3">
        <UButton variant="ghost" :disabled="extracting || importing" @click="closeModal">
          {{ $t('common.cancel') }}
        </UButton>

        <!-- Bouton d'extraction -->
        <UButton
          v-if="!extractedWorkshops.length"
          color="primary"
          :loading="extracting"
          :disabled="!selectedImage"
          @click="extractWorkshops"
        >
          {{ $t('workshops.extract_workshops') }}
        </UButton>

        <!-- Bouton d'import -->
        <UButton
          v-else
          color="primary"
          :loading="importing"
          :disabled="selectedWorkshopsCount === 0"
          @click="importSelectedWorkshops"
        >
          {{ $t('workshops.import_selected') }} ({{ selectedWorkshopsCount }})
        </UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'

const { t } = useI18n()
const toast = useToast()

interface WorkshopExtracted {
  title: string
  description?: string
  startDateTime: string
  endDateTime: string
  maxParticipants?: number
  location?: string
  selected: boolean
}

interface Props {
  open: boolean
  editionId: number
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'success'): void
}>()

const isOpen = computed({
  get: () => props.open,
  set: (value) => emit('update:open', value),
})

// État
const fileInput = ref<HTMLInputElement>()
const selectedImage = ref<File | null>(null)
const imagePreview = ref<string>('')
const dragOver = ref(false)
const extracting = ref(false)
const importing = ref(false)
const extractedWorkshops = ref<WorkshopExtracted[]>([])
const errorMessage = ref('')

// Computed
const selectedWorkshopsCount = computed(() => {
  return extractedWorkshops.value.filter((w) => w.selected).length
})

// Méthodes de gestion de fichier
const triggerFileInput = () => {
  fileInput.value?.click()
}

const handleFileSelect = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.files && target.files[0]) {
    selectImage(target.files[0])
  }
}

const handleDrop = (event: DragEvent) => {
  dragOver.value = false
  if (event.dataTransfer?.files && event.dataTransfer.files[0]) {
    selectImage(event.dataTransfer.files[0])
  }
}

const selectImage = (file: File) => {
  // Vérifier que c'est bien une image
  if (!file.type.startsWith('image/')) {
    toast.add({
      title: t('errors.invalid_file_type'),
      description: t('workshops.only_images_allowed'),
      color: 'error',
      icon: 'i-heroicons-x-circle',
    })
    return
  }

  // Vérifier la taille (max 10MB)
  if (file.size > 10 * 1024 * 1024) {
    toast.add({
      title: t('errors.file_too_large'),
      description: t('workshops.max_file_size'),
      color: 'error',
      icon: 'i-heroicons-x-circle',
    })
    return
  }

  selectedImage.value = file

  // Créer une prévisualisation
  const reader = new FileReader()
  reader.onload = (e) => {
    imagePreview.value = e.target?.result as string
  }
  reader.readAsDataURL(file)

  errorMessage.value = ''
}

const clearImage = () => {
  selectedImage.value = null
  imagePreview.value = ''
  if (fileInput.value) {
    fileInput.value.value = ''
  }
}

// Extraction des workshops
const extractWorkshops = async () => {
  if (!selectedImage.value) return

  extracting.value = true
  errorMessage.value = ''

  try {
    // Convertir l'image en base64
    const reader = new FileReader()
    reader.readAsDataURL(selectedImage.value)

    await new Promise((resolve) => {
      reader.onload = resolve
    })

    const base64Image = reader.result as string

    // Appeler l'API d'extraction
    const response = await $fetch<{ data: { workshops: WorkshopExtracted[] } }>(
      `/api/editions/${props.editionId}/workshops/extract-from-image`,
      {
        method: 'POST',
        body: {
          image: base64Image,
        },
      }
    )

    // Marquer tous les workshops comme sélectionnés par défaut
    // Convertir les dates ISO en format datetime-local (YYYY-MM-DDTHH:mm)
    extractedWorkshops.value = response.data.workshops.map((w) => ({
      ...w,
      startDateTime: w.startDateTime ? new Date(w.startDateTime).toISOString().slice(0, 16) : '',
      endDateTime: w.endDateTime ? new Date(w.endDateTime).toISOString().slice(0, 16) : '',
      selected: true,
    }))

    if (extractedWorkshops.value.length === 0) {
      toast.add({
        title: t('workshops.no_workshops_found'),
        description: t('workshops.no_workshops_found_description'),
        color: 'warning',
        icon: 'i-heroicons-exclamation-triangle',
      })
    } else {
      toast.add({
        title: t('workshops.extraction_success'),
        description: t('workshops.extraction_success_description', {
          count: extractedWorkshops.value.length,
        }),
        color: 'success',
        icon: 'i-heroicons-check-circle',
      })
    }
  } catch (error: any) {
    console.error('Error extracting workshops:', error)
    errorMessage.value = error?.data?.message || error?.message || t('workshops.extraction_error')
    toast.add({
      title: t('workshops.extraction_error'),
      description: errorMessage.value,
      color: 'error',
      icon: 'i-heroicons-x-circle',
    })
  } finally {
    extracting.value = false
  }
}

// Gestion de la sélection
const toggleWorkshopSelection = (index: number) => {
  extractedWorkshops.value[index].selected = !extractedWorkshops.value[index].selected
}

const selectAllWorkshops = () => {
  extractedWorkshops.value.forEach((w) => {
    w.selected = true
  })
}

const deselectAllWorkshops = () => {
  extractedWorkshops.value.forEach((w) => {
    w.selected = false
  })
}

// Import des workshops sélectionnés
const importSelectedWorkshops = async () => {
  const selectedWorkshops = extractedWorkshops.value.filter((w) => w.selected)

  if (selectedWorkshops.length === 0) {
    toast.add({
      title: t('workshops.no_workshops_selected'),
      color: 'warning',
      icon: 'i-heroicons-exclamation-triangle',
    })
    return
  }

  importing.value = true
  errorMessage.value = ''

  try {
    // Importer les workshops un par un
    const results = await Promise.allSettled(
      selectedWorkshops.map((workshop) =>
        $fetch(`/api/editions/${props.editionId}/workshops`, {
          method: 'POST',
          body: {
            title: workshop.title,
            description: workshop.description,
            startDateTime: workshop.startDateTime,
            endDateTime: workshop.endDateTime,
            maxParticipants: workshop.maxParticipants || null,
            location: workshop.location,
          },
        })
      )
    )

    const successCount = results.filter((r) => r.status === 'fulfilled').length
    const failCount = results.filter((r) => r.status === 'rejected').length

    if (successCount > 0) {
      toast.add({
        title: t('workshops.import_success'),
        description: t('workshops.import_success_description', { count: successCount }),
        color: 'success',
        icon: 'i-heroicons-check-circle',
      })
    }

    if (failCount > 0) {
      toast.add({
        title: t('workshops.import_partial_error'),
        description: t('workshops.import_partial_error_description', {
          success: successCount,
          fail: failCount,
        }),
        color: 'warning',
        icon: 'i-heroicons-exclamation-triangle',
      })
    }

    emit('success')
    closeModal()
  } catch (error: any) {
    console.error('Error importing workshops:', error)
    errorMessage.value = error?.data?.message || error?.message || t('workshops.import_error')
    toast.add({
      title: t('workshops.import_error'),
      description: errorMessage.value,
      color: 'error',
      icon: 'i-heroicons-x-circle',
    })
  } finally {
    importing.value = false
  }
}

// Réinitialisation
const resetExtraction = () => {
  extractedWorkshops.value = []
  errorMessage.value = ''
}

const closeModal = () => {
  clearImage()
  resetExtraction()
  isOpen.value = false
}

// Reset au changement d'édition
watch(
  () => props.editionId,
  () => {
    closeModal()
  }
)
</script>
