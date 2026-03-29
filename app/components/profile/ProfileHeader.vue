<template>
  <div
    class="bg-gradient-to-r from-primary-50 to-blue-50 dark:from-primary-900/20 dark:to-blue-900/20 rounded-2xl p-6 sm:p-8"
  >
    <div class="flex flex-row items-start gap-6">
      <div class="relative group">
        <UiUserAvatar
          v-if="authStore.user"
          :key="avatarKey"
          :user="authStore.user"
          :size="avatarSize"
          border
          class="shadow-xl transition-transform group-hover:scale-105"
        />
        <UButton
          icon="i-heroicons-camera"
          size="sm"
          color="primary"
          variant="solid"
          class="absolute -bottom-2 -right-2 rounded-full shadow-lg transition-all hover:scale-110"
          @click="openProfilePictureModal"
        />
      </div>
      <div class="text-left flex-1">
        <h1 class="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-2">
          {{ $t('profile.hello', { name: authStore.user?.prenom || authStore.user?.pseudo }) }}
        </h1>
        <div class="space-y-2">
          <div class="flex items-center justify-start gap-2 text-gray-600 dark:text-gray-300">
            <UIcon name="i-heroicons-calendar-days" class="w-4 h-4" />
            <span class="text-sm">
              {{ $t('profile.member_since', { date: formatMemberSince }) }}
            </span>
          </div>
          <div class="flex items-center justify-start gap-2 text-gray-500 dark:text-gray-400">
            <UIcon name="i-heroicons-envelope" class="w-4 h-4" />
            <span class="text-xs">
              {{ authStore.user?.email }}
            </span>
          </div>
          <div
            v-if="!authStore.user?.profilePicture"
            class="flex items-center justify-start gap-2 text-gray-500 dark:text-gray-400"
          >
            <UIcon name="i-heroicons-photo" class="w-4 h-4" />
            <span class="text-xs">{{ t('profile.gravatar_avatar') }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal pour photo de profil -->
    <UModal
      v-model:open="showProfilePictureModal"
      size="md"
      :title="$t('profile.picture')"
      :description="$t('profile.customize_avatar')"
      :prevent-close="profilePictureUrl !== (authStore.user?.profilePicture || '')"
    >
      <template #body>
        <div class="space-y-8">
          <!-- Aperçu actuel -->
          <div class="flex justify-center">
            <UiUserAvatar
              v-if="authStore.user"
              :user="getPreviewUser()"
              :size="128"
              border
              class="border-primary-200 dark:border-primary-700 shadow-xl"
            />
          </div>

          <!-- Upload de photo -->
          <div>
            <UiImageUpload
              v-model="profilePictureUrl"
              :endpoint="{ type: 'profile', id: authStore.user?.id }"
              :options="{
                validation: {
                  maxSize: 5 * 1024 * 1024,
                  allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
                  allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp'],
                },
                resetAfterUpload: false,
              }"
              :alt="$t('pages.profile.photo_alt')"
              :placeholder="$t('pages.profile.photo_placeholder')"
              :allow-delete="!!authStore.user?.profilePicture"
              @uploaded="onProfilePictureTemporarilyUploaded"
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
                  {{ $t('profile.important_info') }}
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
          <UButton variant="outline" @click="cancelProfilePictureChanges">
            {{ $t('common.cancel') }}
          </UButton>
          <UButton
            :disabled="profilePictureUrl === (authStore.user?.profilePicture || '')"
            :loading="pictureValidationLoading"
            @click="validateProfilePictureChanges"
          >
            {{ $t('common.validate') }}
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import type { User } from '~/types'

const authStore = useAuthStore()
const toast = useToast()
const { locale, t } = useI18n()

const { width: windowWidth } = useWindowSize()
const avatarSize = computed(() => (windowWidth.value < 640 ? 80 : 120))

const showProfilePictureModal = ref(false)
const profilePictureUrl = ref(authStore.user?.profilePicture || '')
const avatarKey = ref(Date.now())
const pictureValidationLoading = ref(false)

const formatMemberSince = computed(() => {
  const createdAt = authStore.user?.createdAt || Date.now()
  const date = new Date(createdAt)
  const localeCode = locale.value === 'fr' ? 'fr-FR' : 'en-US'
  return date.toLocaleDateString(localeCode, { year: 'numeric', month: 'long' })
})

const openProfilePictureModal = () => {
  resetProfilePictureModal()
  showProfilePictureModal.value = true
}

const resetProfilePictureModal = () => {
  pictureValidationLoading.value = false
  profilePictureUrl.value = authStore.user?.profilePicture || ''
}

const getPreviewUser = () => {
  if (!authStore.user) return authStore.user
  return { ...authStore.user, profilePicture: profilePictureUrl.value || null }
}

const onProfilePictureTemporarilyUploaded = async (result: { imageUrl?: string; user?: User }) => {
  if (result.imageUrl) {
    profilePictureUrl.value = result.imageUrl
  }
}

const onProfilePictureDeleted = () => {
  profilePictureUrl.value = ''
}

const validateProfilePictureChanges = async () => {
  if (profilePictureUrl.value === (authStore.user?.profilePicture || '')) return

  pictureValidationLoading.value = true

  try {
    const profilePictureValue = profilePictureUrl.value || null

    const response = await $fetch<{ success: boolean; data: any }>('/api/profile/update', {
      method: 'PUT',
      body: {
        email: authStore.user?.email,
        pseudo: authStore.user?.pseudo,
        nom: authStore.user?.nom,
        prenom: authStore.user?.prenom,
        telephone: authStore.user?.phone,
        profilePicture: profilePictureValue,
      },
    })

    if (response.data) {
      authStore.updateUser(response.data)
      profilePictureUrl.value = response.data.profilePicture || ''
    }

    const isDelete = !profilePictureValue
    toast.add({
      title: isDelete ? t('profile.photo_deleted') : t('profile.photo_updated'),
      description: isDelete
        ? t('profile.profile_picture_deleted')
        : t('profile.profile_picture_changed'),
      icon: 'i-heroicons-check-circle',
      color: 'success',
    })

    avatarKey.value++
    resetProfilePictureModal()
    showProfilePictureModal.value = false
  } catch (error) {
    console.error('Erreur lors de la sauvegarde de la photo de profil:', error)
    toast.add({
      title: t('common.error'),
      description: t('profile.cannot_change_photo'),
      icon: 'i-heroicons-x-circle',
      color: 'error',
    })
  } finally {
    pictureValidationLoading.value = false
  }
}

const cancelProfilePictureChanges = () => {
  resetProfilePictureModal()
  showProfilePictureModal.value = false
}

const onProfilePictureError = (error: string) => {
  toast.add({
    title: t('common.error'),
    description: error || t('profile.cannot_change_photo'),
    icon: 'i-heroicons-x-circle',
    color: 'error',
  })
}
</script>
