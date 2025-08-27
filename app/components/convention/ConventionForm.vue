<template>
  <UForm :state="form" :validate="validate" class="space-y-6" @submit="onSubmit">
    <!-- Convention name -->
    <UFormField :label="$t('components.convention_form.convention_name')" name="name" required>
      <UInput
        v-model="form.name"
        :placeholder="$t('forms.placeholders.convention_name_example')"
        class="w-full"
        @blur="trimField('name')"
      />
    </UFormField>

    <!-- Description -->
    <UFormField :label="$t('common.description')" name="description">
      <UTextarea
        v-model="form.description"
        :placeholder="$t('forms.placeholders.convention_description')"
        :rows="4"
        class="w-full"
        @blur="trimField('description')"
      />
    </UFormField>

    <!-- Logo -->
    <UFormField :label="$t('components.convention_form.convention_logo')" name="logo">
      <div class="space-y-4">
        <!-- Mode upload de fichier ou URL -->
        <div class="flex gap-2">
          <UButton
            type="button"
            :variant="uploadMode === 'file' ? 'solid' : 'outline'"
            color="primary"
            size="sm"
            @click="uploadMode = 'file'"
          >
            {{ $t('components.convention_form.upload_file') }}
          </UButton>
          <UButton
            type="button"
            :variant="uploadMode === 'url' ? 'solid' : 'outline'"
            color="primary"
            size="sm"
            @click="uploadMode = 'url'"
          >
            {{ $t('components.convention_form.external_url') }}
          </UButton>
        </div>

        <!-- Upload de fichier -->
        <div v-if="uploadMode === 'file'">
          <ImageUpload
            v-model="form.logo"
            :endpoint="{ type: 'convention', id: initialData?.id }"
            :options="{
              validation: {
                maxSize: 5 * 1024 * 1024,
                allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
                allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp'],
              },
              resetAfterUpload: false,
            }"
            :alt="$t('components.convention_form.convention_logo_alt')"
            :placeholder="$t('components.convention_form.click_to_select_image')"
            :allow-delete="!!initialData?.id"
            @uploaded="onImageUploaded"
            @deleted="onImageDeleted"
            @error="onImageError"
          />
        </div>

        <!-- URL externe -->
        <div v-else>
          <UInput
            v-model="form.logo"
            :placeholder="$t('upload.logo_url_optional_placeholder')"
            class="w-full"
            @blur="trimField('logo')"
          />
          <p class="text-sm text-gray-500 mt-1">
            {{ $t('components.convention_form.logo_url_description') }}
          </p>

          <!-- Aperçu de l'URL -->
          <div v-if="form.logo" class="mt-3">
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-2">
              {{ $t('components.convention_form.logo_preview') }}
            </p>
            <img
              :src="form.logo"
              :alt="form.name || $t('components.convention_form.convention_logo_alt')"
              class="w-24 h-24 object-cover rounded-lg border border-gray-200 dark:border-gray-700"
              @error="logoError = true"
              @load="logoError = false"
            />
            <UAlert
              v-if="logoError"
              color="error"
              variant="subtle"
              :title="$t('components.convention_form.loading_error_title')"
              :description="$t('components.convention_form.loading_error_description')"
              class="mt-2"
            />
          </div>
        </div>
      </div>
    </UFormField>

    <!-- Boutons d'action -->
    <div class="flex gap-3 pt-4">
      <UButton type="submit" color="primary" :loading="loading" :disabled="loading">
        {{ submitButtonText }}
      </UButton>

      <UButton type="button" color="neutral" variant="outline" @click="$emit('cancel')">
        Annuler
      </UButton>
    </div>
  </UForm>
</template>

<script setup lang="ts">
import { reactive, ref, onMounted } from 'vue'

import ImageUpload from '~/components/ui/ImageUpload.vue'
import type { Convention } from '~/types'

const { t } = useI18n()

interface Props {
  initialData?: Convention
  submitButtonText?: string
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  submitButtonText: 'Enregistrer',
  loading: false,
  initialData: undefined,
})

const emit = defineEmits<{
  submit: [data: Omit<Convention, 'id' | 'createdAt' | 'updatedAt' | 'authorId' | 'author'>]
  cancel: []
}>()

const toast = useToast()

const logoError = ref(false)
const uploadMode = ref<'file' | 'url'>('file')

const form = reactive({
  name: '',
  description: '',
  logo: '',
})

// Fonctions utilitaires
const trimField = (fieldName: keyof typeof form) => {
  if (form[fieldName] && typeof form[fieldName] === 'string') {
    form[fieldName] = form[fieldName].trim()
  }
}

const trimAllFields = () => {
  trimField('name')
  trimField('description')
  trimField('logo')
}

const isValidUrl = (url: string): boolean => {
  // Accepter les chaînes vides
  if (!url || url.trim() === '') {
    return true
  }

  // Accepter les URLs relatives (commençant par / ou ./)
  if (url.startsWith('/') || url.startsWith('./')) {
    return true
  }

  // Vérifier les URLs absolues
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

// Gestionnaires d'événements pour ImageUpload
const onImageUploaded = (result: { success: boolean; imageUrl?: string }) => {
  if (result.success && result.imageUrl) {
    form.logo = result.imageUrl
    toast.add({
      title: t('components.convention_form.image_uploaded'),
      description: "L'image a été uploadée avec succès",
      color: 'success',
    })
  }
}

const onImageDeleted = () => {
  form.logo = ''
  toast.add({
    title: t('components.convention_form.image_deleted'),
    description: "L'image a été supprimée avec succès",
    color: 'success',
  })
}

const onImageError = (error: string) => {
  toast.add({
    title: 'Erreur',
    description: error,
    color: 'error',
  })
}

// Validation
const validate = (state: typeof form) => {
  const errors = []

  if (!state.name || state.name.trim().length === 0) {
    errors.push({ path: 'name', message: t('errors.required_field') })
  } else if (state.name.trim().length < 3) {
    errors.push({ path: 'name', message: t('validation.name_min_3') })
  } else if (state.name.trim().length > 100) {
    errors.push({ path: 'name', message: t('validation.name_max_100') })
  }

  if (state.description && state.description.length > 1000) {
    errors.push({
      path: 'description',
      message: t('validation.description_max_1000'),
    })
  }

  // Valider l'URL du logo seulement en mode URL et si elle n'est pas vide
  if (state.logo && state.logo.trim() && !isValidUrl(state.logo.trim())) {
    errors.push({ path: 'logo', message: "L'URL du logo n'est pas valide" })
  }

  return errors
}

// Soumission du formulaire
const onSubmit = async () => {
  trimAllFields()

  // Données du formulaire sans l'image
  const formData = {
    name: form.name.trim(),
    description: form.description.trim() || null,
    logo: uploadMode.value === 'url' ? form.logo.trim() || null : form.logo || null,
  }

  emit('submit', formData)
}

// Initialisation avec les données existantes
onMounted(() => {
  if (props.initialData) {
    form.name = props.initialData.name || ''
    form.description = props.initialData.description || ''
    form.logo = props.initialData.logo || ''
  }
})
</script>
