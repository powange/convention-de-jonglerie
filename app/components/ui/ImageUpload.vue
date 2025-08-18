<template>
  <div class="space-y-4">
    <!-- Zone d'upload -->
    <div class="flex flex-col space-y-3">
      <!-- Preview actuelle ou placeholder -->
      <div v-if="modelValue || previewUrl" class="relative">
        <img 
          :src="previewUrl || modelValue" 
          :alt="alt" 
          class="w-full h-32 object-cover rounded-lg border-2 border-gray-200 dark:border-gray-700"
        >
        <div class="absolute top-2 right-2 flex space-x-2">
          <!-- Bouton de suppression -->
          <UButton
            v-if="!uploading && (previewUrl || (modelValue && allowDelete))"
            icon="i-heroicons-trash"
            color="error"
            variant="solid"
            size="xs"
            @click="handleDelete"
          />
        </div>
        <!-- Overlay de progression -->
        <div 
          v-if="uploading" 
          class="absolute inset-0 bg-black bg-opacity-50 rounded-lg flex items-center justify-center"
        >
          <div class="text-center text-white">
            <UIcon name="i-heroicons-arrow-path" class="animate-spin text-2xl mb-2" />
            <div class="text-sm">{{ t('upload.uploading') }}</div>
            <div v-if="progress > 0" class="text-xs mt-1">{{ progress }}%</div>
          </div>
        </div>
      </div>

      <!-- Zone de drop ou bouton si pas d'image -->
      <div 
        v-else
        class="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center cursor-pointer hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
        :class="{ 'border-blue-400 bg-blue-50 dark:bg-blue-900/20': isDragOver }"
        @click="triggerFileInput"
        @dragover.prevent="onDragOver" 
        @dragleave.prevent="onDragLeave"
        @drop.prevent="onDrop"
      >
        <UIcon name="i-heroicons-photo" class="text-4xl text-gray-400 dark:text-gray-500 mb-3" />
        <p class="text-gray-600 dark:text-gray-400 mb-2">
          {{ placeholder || t('components.convention_form.click_to_select_image') }}
        </p>
        <p class="text-xs text-gray-500 dark:text-gray-400">
          {{ t('upload.formats_accepted') }}: {{ validation.allowedExtensions.join(', ') }}
        </p>
        <p class="text-xs text-gray-500 dark:text-gray-400">
          {{ t('upload.max_size') }}: {{ formatFileSize(validation.maxSize) }}
        </p>
      </div>

      <!-- Input file caché -->
      <input
        ref="fileInput"
        type="file"
        :accept="validation.allowedTypes.join(',')"
        class="hidden"
        @change="handleFileSelect"
      >

      <!-- Boutons d'action -->
      <div v-if="!uploading" class="flex justify-center space-x-2">
        <UButton
          variant="outline"
          icon="i-heroicons-photo"
          @click="triggerFileInput"
        >
          {{ t('upload.select_file') }}
        </UButton>
        
        <UButton
          v-if="selectedFile && !autoUpload"
          color="primary"
          icon="i-heroicons-arrow-up-tray"
          @click="upload"
        >
          {{ t('upload.upload') }}
        </UButton>
      </div>
    </div>

    <!-- Messages d'erreur -->
    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      :title="t('upload.upload_error')"
      :description="error"
      :close-button="{ icon: 'i-heroicons-x-mark-20-solid', color: 'neutral', variant: 'link', padded: false }"
      @close="error = null"
    />

    <!-- Informations sur le fichier sélectionné -->
    <div v-if="selectedFile && !uploading" class="text-sm text-gray-600 dark:text-gray-400">
      <div class="flex items-center space-x-2">
        <UIcon name="i-heroicons-document" />
        <span>{{ selectedFile.name }}</span>
        <span class="text-xs">({{ formatFileSize(selectedFile.size) }})</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { UploadEndpoint, UploadOptions } from '~/types/upload'

interface Props {
  /** Valeur actuelle (URL de l'image) */
  modelValue?: string | null
  /** Endpoint pour l'upload */
  endpoint: UploadEndpoint
  /** Options d'upload personnalisées */
  options?: UploadOptions
  /** Texte alternatif pour l'image */
  alt?: string
  /** Placeholder pour la zone d'upload */
  placeholder?: string
  /** Upload automatique dès sélection */
  autoUpload?: boolean
  /** Autoriser la suppression de l'image actuelle */
  allowDelete?: boolean
}

interface Emits {
  (e: 'update:modelValue', value: string | null): void
  (e: 'uploaded', result: { success: boolean; imageUrl?: string }): void
  (e: 'deleted'): void
  (e: 'error', error: string): void
}

const props = withDefaults(defineProps<Props>(), {
  alt: 'Uploaded image',
  autoUpload: true,
  allowDelete: true
})

const emit = defineEmits<Emits>()

// Composables
const { t } = useI18n()

// Composable d'upload
const { 
  uploading, 
  progress, 
  selectedFile, 
  previewUrl, 
  error,
  selectFile,
  uploadFile,
  deleteImage,
  reset,
  validation 
} = useImageUpload(props.options)

// États réactifs
const fileInput = ref<HTMLInputElement>()
const isDragOver = ref(false)

// Méthodes utilitaires
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

const triggerFileInput = () => {
  fileInput.value?.click()
}

// Gestionnaires d'événements
const handleFileSelect = (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  
  if (file && selectFile(file)) {
    if (props.autoUpload) {
      upload()
    }
  }
}

const onDragOver = (event: DragEvent) => {
  isDragOver.value = true
  event.dataTransfer!.dropEffect = 'copy'
}

const onDragLeave = () => {
  isDragOver.value = false
}

const onDrop = (event: DragEvent) => {
  isDragOver.value = false
  const files = event.dataTransfer?.files
  
  if (files && files.length > 0) {
    const file = files[0]
    if (selectFile(file) && props.autoUpload) {
      upload()
    }
  }
}

const upload = async () => {
  try {
    const result = await uploadFile(props.endpoint)
    emit('update:modelValue', result.imageUrl || null)
    emit('uploaded', result)
  } catch (uploadError: unknown) {
    const message = uploadError instanceof Error ? uploadError.message : 'Upload failed'
    emit('error', message)
  }
}

const handleDelete = async () => {
  if (previewUrl.value) {
    // Suppression locale (fichier sélectionné mais pas encore uploadé)
    reset()
    return
  }

  if (props.modelValue && props.allowDelete) {
    try {
      await deleteImage(props.endpoint)
      emit('update:modelValue', null)
      emit('deleted')
    } catch (deleteError: unknown) {
      const message = deleteError instanceof Error ? deleteError.message : 'Delete failed'
      emit('error', message)
    }
  }
}

// Watchers
watch(error, (newError) => {
  if (newError) {
    emit('error', newError)
  }
})

// Nettoyage
onUnmounted(() => {
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value)
  }
})
</script>