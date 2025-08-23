<template>
  <div class="max-w-md mx-auto p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
    <h3 class="text-lg font-semibold mb-4">{{ t('upload.demo_title') }}</h3>

    <!-- Mode de sélection -->
    <div class="flex gap-2 mb-4">
      <UButton
        :variant="uploadMode === 'file' ? 'solid' : 'outline'"
        color="primary"
        size="sm"
        @click="uploadMode = 'file'"
      >
        {{ t('components.convention_form.upload_file') }}
      </UButton>
      <UButton
        :variant="uploadMode === 'url' ? 'solid' : 'outline'"
        color="primary"
        size="sm"
        @click="uploadMode = 'url'"
      >
        {{ t('components.convention_form.external_url') }}
      </UButton>
    </div>

    <!-- Upload de fichier -->
    <div v-if="uploadMode === 'file'">
      <ImageUpload
        v-model="logoUrl"
        :endpoint="{ type: 'generic' }"
        :options="{
          validation: {
            maxSize: 5 * 1024 * 1024, // 5MB
            allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
            allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp'],
          },
          autoUpload: true,
          resetAfterUpload: false,
        }"
        :alt="t('upload.convention_logo_alt')"
        :placeholder="t('upload.click_select_convention_logo')"
        @uploaded="onUploaded"
        @deleted="onDeleted"
        @error="onError"
      />
    </div>

    <!-- URL externe -->
    <div v-else>
      <UFormField :label="t('upload.logo_url_label')">
        <UInput v-model="logoUrl" :placeholder="t('upload.logo_url_placeholder')" type="url" />
      </UFormField>

      <!-- Aperçu de l'URL -->
      <div v-if="logoUrl" class="mt-3">
        <p class="text-sm text-gray-600 dark:text-gray-400 mb-2">
          {{ t('components.convention_form.logo_preview') }}
        </p>
        <img
          :src="logoUrl"
          :alt="t('upload.logo_preview_alt')"
          class="w-full h-32 object-cover rounded-lg border border-gray-200 dark:border-gray-700"
          @error="logoError = true"
          @load="logoError = false"
        />
        <UAlert
          v-if="logoError"
          color="red"
          variant="subtle"
          :title="t('upload.loading_error_title')"
          description="Impossible de charger l'image depuis cette URL"
          class="mt-2"
        />
      </div>
    </div>

    <!-- Informations sur l'image actuelle -->
    <div v-if="logoUrl" class="mt-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
      <div class="flex items-center space-x-2 text-sm">
        <UIcon name="i-heroicons-check-circle" class="text-green-500" />
        <span class="text-gray-700 dark:text-gray-300">{{ t('upload.image_configured') }}</span>
      </div>
      <p class="text-xs text-gray-500 dark:text-gray-400 mt-1 break-all">{{ logoUrl }}</p>
    </div>

    <!-- Messages -->
    <div v-if="message" class="mt-4">
      <UAlert
        :color="messageType"
        variant="subtle"
        :title="message"
        :close-button="{
          icon: 'i-heroicons-x-mark-20-solid',
          color: 'gray',
          variant: 'link',
          padded: false,
        }"
        @close="message = ''"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import ImageUpload from './ImageUpload.vue'

// Composables
const { t } = useI18n()

// États réactifs
const uploadMode = ref<'file' | 'url'>('file')
const logoUrl = ref<string>('')
const logoError = ref(false)
const message = ref('')
const messageType = ref<'green' | 'red'>('green')

// Gestionnaires d'événements
const onUploaded = (result: { success: boolean; imageUrl?: string }) => {
  message.value = 'Image uploadée avec succès !'
  messageType.value = 'green'
  console.log('Upload résultat:', result)
}

const onDeleted = () => {
  message.value = 'Image supprimée avec succès !'
  messageType.value = 'green'
  logoUrl.value = ''
}

const onError = (error: string) => {
  message.value = `Erreur : ${error}`
  messageType.value = 'red'
}

// Watchers
watch(uploadMode, (newMode) => {
  if (newMode === 'file') {
    logoError.value = false
  }
})

watch(logoUrl, () => {
  logoError.value = false
})
</script>
