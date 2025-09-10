<template>
  <div class="space-y-4">
    <!-- Aperçu actuel -->
    <div class="flex justify-center">
      <div class="relative">
        <UiUserAvatar
          :user="previewUser"
          :size="120"
          border
          class="shadow-lg transition-transform hover:scale-105"
        />
        <UButton
          icon="i-heroicons-camera"
          size="sm"
          color="primary"
          variant="solid"
          class="absolute -bottom-2 -right-2 rounded-full shadow-lg"
          @click="openModal"
        />
      </div>
    </div>

    <!-- Modal d'upload -->
    <UModal
      v-model:open="showModal"
      size="md"
      :title="$t('admin.change_profile_picture')"
      :description="$t('admin.change_profile_picture_description')"
      :prevent-close="hasUnsavedChanges"
    >
      <template #body>
        <div class="space-y-6">
          <!-- Aperçu dans la modal -->
          <div class="flex justify-center">
            <UiUserAvatar
              :user="getPreviewUser()"
              :size="100"
              border
              class="border-primary-200 dark:border-primary-700 shadow-xl"
            />
          </div>

          <!-- Upload de photo -->
          <div>
            <ImageUpload
              v-model="tempProfilePictureUrl"
              :endpoint="{ type: 'profile', id: user.id }"
              :options="{
                validation: {
                  maxSize: 5 * 1024 * 1024,
                  allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
                  allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp'],
                },
                resetAfterUpload: false,
              }"
              :alt="$t('admin.profile_picture_alt')"
              :placeholder="$t('admin.profile_picture_placeholder')"
              :allow-delete="!!user.profilePicture"
              @uploaded="onProfilePictureUploaded"
              @deleted="onProfilePictureDeleted"
              @error="onProfilePictureError"
            />
          </div>

          <!-- Informations -->
          <div class="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
            <div class="flex items-start gap-3">
              <UIcon
                name="i-heroicons-information-circle"
                class="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5"
              />
              <div>
                <p class="text-sm font-medium text-gray-900 dark:text-white mb-1">
                  {{ $t('admin.profile_picture_info') }}
                </p>
                <ul class="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                  <li>{{ $t('profile.formats_accepted') }}</li>
                  <li>{{ $t('profile.max_size') }}</li>
                  <li>{{ $t('profile.recommended_resolution') }}</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </template>

      <template #footer>
        <div class="flex justify-end gap-3">
          <UButton variant="outline" @click="cancelChanges">
            {{ $t('common.cancel') }}
          </UButton>
          <UButton :disabled="!hasUnsavedChanges" :loading="saving" @click="saveChanges">
            {{ $t('common.save') }}
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import ImageUpload from '~/components/ui/ImageUpload.vue'

interface User {
  id: number
  email: string
  pseudo: string
  nom: string
  prenom: string
  profilePicture?: string | null
}

interface Props {
  user: User
  modelValue?: string | null
}

interface Emits {
  (e: 'update:modelValue' | 'changed', value: string | null): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const toast = useToast()
const { t } = useI18n()

// État local
const showModal = ref(false)
const tempProfilePictureUrl = ref(props.user.profilePicture || '')
const saving = ref(false)

// Computed pour l'utilisateur avec la photo temporaire
const previewUser = computed(() => ({
  ...props.user,
  profilePicture: props.modelValue || props.user.profilePicture,
}))

// Computed pour détecter les changements
const hasUnsavedChanges = computed(() => {
  return tempProfilePictureUrl.value !== (props.user.profilePicture || '')
})

// Fonction pour obtenir l'utilisateur de prévisualisation dans la modal
const getPreviewUser = () => ({
  ...props.user,
  profilePicture: tempProfilePictureUrl.value,
})

// Ouvrir la modal
const openModal = () => {
  tempProfilePictureUrl.value = props.user.profilePicture || ''
  showModal.value = true
}

// Annuler les changements
const cancelChanges = () => {
  tempProfilePictureUrl.value = props.user.profilePicture || ''
  showModal.value = false
}

// Sauvegarder les changements
const saveChanges = async () => {
  if (!hasUnsavedChanges.value) return

  saving.value = true

  try {
    // Appel API pour mettre à jour la photo de profil
    const response = await $fetch<{ success: boolean; profilePicture: string | null }>(
      `/api/admin/users/${props.user.id}/profile-picture`,
      {
        method: 'PUT',
        body: {
          profilePicture: tempProfilePictureUrl.value || null,
        },
      }
    )

    // Émettre les événements avec le nom de fichier final (pas l'URL temporaire)
    const finalProfilePicture = response.profilePicture
    emit('update:modelValue', finalProfilePicture)
    emit('changed', finalProfilePicture)

    showModal.value = false

    toast.add({
      title: t('common.success'),
      description: t('admin.profile_picture_updated'),
      color: 'success',
    })
  } catch (error: any) {
    console.error('Erreur lors de la mise à jour de la photo:', error)

    toast.add({
      title: t('common.error'),
      description: error.data?.message || t('admin.profile_picture_update_error'),
      color: 'error',
    })
  } finally {
    saving.value = false
  }
}

// Gestionnaires d'événements ImageUpload
const onProfilePictureUploaded = (result: { success: boolean; imageUrl?: string }) => {
  console.log('Upload result:', result)
  if (result.success && result.imageUrl) {
    tempProfilePictureUrl.value = result.imageUrl
  }
}

const onProfilePictureDeleted = () => {
  tempProfilePictureUrl.value = ''
}

const onProfilePictureError = (error: any) => {
  console.error('Erreur upload:', error)
  toast.add({
    title: t('common.error'),
    description: error.message || t('upload.error'),
    color: 'error',
  })
}

// Watcher pour synchroniser les changements externes
watch(
  () => props.user.profilePicture,
  (newValue) => {
    if (!showModal.value) {
      tempProfilePictureUrl.value = newValue || ''
    }
  }
)
</script>
